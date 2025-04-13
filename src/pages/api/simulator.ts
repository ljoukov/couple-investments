import {
  format,
  addMonths,
  differenceInMonths,
  differenceInYears,
} from "date-fns";
import { std, sqrt } from "mathjs"; // Using mathjs for stats funcs
import { fetchFinnhubCandles, HistoricalData } from "./equity-data"; // Import REAL data fetching

// --- Interfaces (Define API Input/Output Structure - NO CHANGE NEEDED) ---

interface Allocation {
  ticker: string; // e.g., 'AAPL', 'MSFT', 'SPY'
  percentage: number; // e.g., 50 for 50%
}

interface StrategyConfig {
  name: string; // e.g., "Mark's Picks", "Sarah's Diversified"
  allocations: Allocation[];
}

interface SimulationRequest {
  strategies: StrategyConfig[];
  initialInvestment: number;
  startDate: string; // ISO format e.g., "2014-01-01"
  endDate: string; // ISO format e.g., "2024-01-01"
}

interface TimeSeriesPoint {
  date: string; // ISO format e.g., "2014-01-31"
  value: number; // Portfolio value on that date
}

interface StrategyResult {
  strategyName: string;
  finalValue: number;
  averageAnnualReturn: number; // CAGR
  annualizedVolatility: number; // Annualized standard deviation of monthly returns
  maxDrawdown: number; // Percentage, negative number e.g., -0.65 for -65%
  timeSeries: TimeSeriesPoint[];
}

interface SimulationResponse {
  results: StrategyResult[];
}

// --- Simulation Core Logic ---

/**
 * Runs a historical investment simulation using real market data via Finnhub.
 * @param request - The simulation configuration request.
 * @returns A Promise resolving to the simulation results or throwing an error.
 */
export async function runSimulation(
  request: SimulationRequest
): Promise<SimulationResponse> {
  const {
    strategies,
    initialInvestment,
    startDate: startStr,
    endDate: endStr,
  } = request;
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  const simulationResults: StrategyResult[] = [];

  // Validate request basic structure (add more specific validation as needed)
  if (!strategies || strategies.length === 0 || initialInvestment <= 0) {
    throw new Error(
      "Invalid simulation request: Missing strategies or initial investment."
    );
  }
  strategies.forEach((s, idx) => {
    if (!s.name || !s.allocations || s.allocations.length === 0) {
      throw new Error(
        `Invalid strategy at index ${idx}: Missing name or allocations.`
      );
    }
    const totalPercent = s.allocations.reduce(
      (sum, a) => sum + a.percentage,
      0
    );
    if (Math.abs(totalPercent - 100) > 0.01) {
      // Allow for small floating point errors
      throw new Error(
        `Invalid strategy '${
          s.name
        }': Allocations must sum to 100%, currently ${totalPercent.toFixed(
          2
        )}%.`
      );
    }
  });

  // 1. Identify all unique tickers needed
  const allTickers = new Set<string>();
  strategies.forEach((s) =>
    s.allocations.forEach((a) => allTickers.add(a.ticker))
  );

  // 2. Fetch all required historical data concurrently using Finnhub
  const historicalDataMap = new Map<string, HistoricalData>();
  console.log(
    `Fetching historical data for tickers: ${Array.from(allTickers).join(", ")}`
  );
  const fetchPromises = Array.from(allTickers).map(
    (ticker) =>
      fetchFinnhubCandles(ticker, startDate, endDate) // Use the REAL function
        .then((data) => {
          if (Object.keys(data).length === 0) {
            console.warn(
              `No data returned for ticker ${ticker} in the requested range. Strategy calculations might be affected.`
            );
          }
          historicalDataMap.set(ticker, data);
        })
    // Error during fetch will propagate and reject Promise.all
  );

  try {
    await Promise.all(fetchPromises);
    console.log("Successfully fetched all required historical data.");
  } catch (error: any) {
    console.error("Failed to fetch all necessary historical data.", error);
    // Rethrow or handle appropriately - cannot simulate without data
    throw new Error(
      `Simulation failed: Could not retrieve historical data. ${error.message}`
    );
  }

  // 3. Simulate each strategy
  for (const strategy of strategies) {
    console.log(`Simulating strategy: ${strategy.name}`);
    const timeSeries: TimeSeriesPoint[] = [];
    let portfolioValue = initialInvestment;
    let peakValue = initialInvestment;
    let maxDrawdown = 0;
    const monthlyReturns: number[] = [];

    // Add initial point
    timeSeries.push({
      date: format(startDate, "yyyy-MM-dd"),
      value: portfolioValue,
    });

    let currentDate = startDate;

    // Generate sorted list of relevant monthly dates (ensure consistent end-of-month logic if needed)
    // For simplicity, we find dates present in fetched data, assumes daily data fetched
    // Find a common set of dates available across *all* tickers in the strategy (more robust)
    let commonDates = new Set<string>();
    let isFirstTicker = true;
    for (const alloc of strategy.allocations) {
      const tickerData = historicalDataMap.get(alloc.ticker);
      if (!tickerData) continue; // Skip tickers with no data fetched
      const dates = new Set(Object.keys(tickerData));
      if (isFirstTicker) {
        commonDates = dates;
        isFirstTicker = false;
      } else {
        commonDates = new Set(
          [...commonDates].filter((date) => dates.has(date))
        );
      }
    }
    const simulationDates = Array.from(commonDates)
      .filter(
        (dateStr) =>
          new Date(dateStr) >= startDate && new Date(dateStr) <= endDate
      )
      .sort();

    if (simulationDates.length < 2) {
      console.warn(
        `Strategy '${strategy.name}' lacks sufficient common historical data points (${simulationDates.length}) for simulation in the requested range.`
      );
      // Add a result indicating failure or minimal data
      simulationResults.push({
        strategyName: strategy.name,
        finalValue: initialInvestment, // No change
        averageAnnualReturn: 0,
        annualizedVolatility: 0,
        maxDrawdown: 0,
        timeSeries: [
          { date: format(startDate, "yyyy-MM-dd"), value: initialInvestment },
        ],
      });
      continue; // Skip to next strategy
    }

    // Loop through consecutive simulation dates
    for (let i = 0; i < simulationDates.length - 1; i++) {
      const currentDayStr = simulationDates[i];
      const nextDayStr = simulationDates[i + 1]; // Using daily steps based on available data
      let dayEndValue = 0;

      // Calculate value change for each asset
      for (const allocation of strategy.allocations) {
        const tickerData = historicalDataMap.get(allocation.ticker);
        // Check if data exists for both current and next day for this specific ticker
        if (
          !tickerData ||
          typeof tickerData[currentDayStr] !== "number" ||
          typeof tickerData[nextDayStr] !== "number"
        ) {
          // If data point is missing for *this specific ticker* on a common date,
          // assume its value allocation carries over unchanged for this step.
          // More sophisticated handling (e.g., using last known price) could be added.
          console.warn(
            `Missing data for ${allocation.ticker} between ${currentDayStr} and ${nextDayStr}. Holding value constant for this step.`
          );
          dayEndValue += portfolioValue * (allocation.percentage / 100);
          continue;
        }

        const startPrice = tickerData[currentDayStr];
        const endPrice = tickerData[nextDayStr];

        if (startPrice <= 0) {
          console.warn(
            `Start price is zero or less for ${allocation.ticker} on ${currentDayStr}. Holding value constant.`
          );
          dayEndValue += portfolioValue * (allocation.percentage / 100);
          continue;
        }

        const assetReturn = endPrice / startPrice - 1;
        const valueAllocated = portfolioValue * (allocation.percentage / 100);
        dayEndValue += valueAllocated * (1 + assetReturn);
      }

      // Update portfolio value & track metrics (Track daily for drawdown, calc monthly returns later if desired)
      const previousValue = portfolioValue;
      portfolioValue = dayEndValue;

      // Update Max Drawdown (based on daily values)
      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      }
      // Ensure peakValue is not zero before division
      if (peakValue > 0) {
        const drawdown = (portfolioValue - peakValue) / peakValue;
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      // Store daily time series point
      timeSeries.push({
        date: nextDayStr,
        value: parseFloat(portfolioValue.toFixed(2)),
      });

      // Collect returns for volatility calculation (can do daily or aggregate monthly later)
      // For simplicity using daily, adjust annualization factor if using daily std dev
      if (previousValue > 0) {
        const dailyReturn = portfolioValue / previousValue - 1;
        // monthlyReturns.push(dailyReturn); // If calculating based on daily returns
      } else {
        // monthlyReturns.push(0);
      }
    } // End daily loop

    // --- Calculate final metrics ---

    // Calculate Monthly Returns for standardized Volatility/CAGR
    const monthlyTimeSeries: TimeSeriesPoint[] = [];
    const monthlyReturnsCalc: number[] = [];
    let lastMonth = -1;
    let monthStartValue = initialInvestment;
    timeSeries.forEach((point) => {
      const date = new Date(point.date);
      const month = date.getMonth();
      if (month !== lastMonth || point === timeSeries[timeSeries.length - 1]) {
        // End of month or last point
        if (lastMonth !== -1) {
          // Avoid first iteration
          const monthlyReturn = point.value / monthStartValue - 1;
          monthlyReturnsCalc.push(monthlyReturn);
          monthlyTimeSeries.push(point); // Add end-of-month point
        }
        monthStartValue = point.value;
        lastMonth = month;
      }
    });

    const finalValue = portfolioValue;
    const years =
      differenceInYears(endDate, startDate) +
      (differenceInMonths(endDate, startDate) % 12) / 12;

    // CAGR based on actual start/end values and time period
    const cagr =
      years > 0 && initialInvestment > 0
        ? Math.pow(finalValue / initialInvestment, 1 / years) - 1
        : 0;

    // Annualized Volatility based on standard deviation of *monthly* returns
    const volatility =
      monthlyReturnsCalc.length > 1 ? std(monthlyReturnsCalc) * sqrt(12) : 0;

    simulationResults.push({
      strategyName: strategy.name,
      finalValue: parseFloat(finalValue.toFixed(2)),
      averageAnnualReturn: parseFloat((cagr * 100).toFixed(2)), // Percentage
      annualizedVolatility: parseFloat((volatility * 100).toFixed(2)), // Percentage
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)), // Percentage is calculated daily
      timeSeries: timeSeries, // Return the detailed daily time series
    });
    console.log(`Finished simulation for strategy: ${strategy.name}`);
  } // End strategy loop

  return { results: simulationResults };
}

// --- API Documentation (NO CHANGE from previous version needed here) ---
/*
API Endpoint: /api/simulate
Method: POST
Description: Runs a historical investment simulation for one or more portfolio strategies.
Request Body: (application/json)
{
  "strategies": [
    {
      "name": "string",
      "allocations": [ { "ticker": "string", "percentage": number } ] // Sum of percentages must be 100
    }
  ],
  "initialInvestment": number,
  "startDate": "string", // ISO format "YYYY-MM-DD"
  "endDate": "string"   // ISO format "YYYY-MM-DD"
}
Success Response: (200 OK, application/json)
{
  "results": [
    {
      "strategyName": "string",
      "finalValue": number,
      "averageAnnualReturn": number, // Percentage
      "annualizedVolatility": number, // Percentage
      "maxDrawdown": number, // Negative percentage
      "timeSeries": [ { "date": "string", "value": number } ] // Daily time series points
    }
  ]
}
Error Responses: 400 Bad Request (Invalid input), 500 Internal Server Error (Data fetch fail, etc.)
*/

// --- Example Usage (Commented out - for direct testing) ---
/*
async function testSimulation() {
    // Load .env file if running directly
    // import dotenv from 'dotenv';
    // dotenv.config();

    const request: SimulationRequest = {
        initialInvestment: 10000,
        startDate: "2020-01-01", // Shorter period for faster testing
        endDate: "2023-12-31",
        strategies: [
            {
                name: "Tech Focused",
                allocations: [
                    { ticker: "AAPL", percentage: 50 },
                    { ticker: "MSFT", percentage: 50 },
                ],
            },
            {
                name: "Broad Market",
                allocations: [
                    { ticker: "VOO", percentage: 70 }, // S&P 500 ETF
                    { ticker: "VXUS", percentage: 30 }, // Total Intl Stock ETF
                ],
            },
             {
                 name: "Blended 80/20",
                 allocations: [
                     // Core (80%)
                     { ticker: "VOO", percentage: 0.8 * 70 }, // 56%
                     { ticker: "VXUS", percentage: 0.8 * 30 }, // 24%
                     // Satellite (20%)
                     { ticker: "AAPL", percentage: 0.2 * 50 }, // 10%
                     { ticker: "MSFT", percentage: 0.2 * 50 }, // 10%
                 ],
             },
        ],
    };

    try {
        console.log("Starting test simulation...");
        const response = await runSimulation(request);
        console.log("\n--- Simulation Results (Test) ---");
        // console.log(JSON.stringify(response, null, 2)); // Full output can be large

        response.results.forEach(r => {
             console.log(`\nStrategy: ${r.strategyName}`);
             console.log(`  Final Value: $${r.finalValue.toFixed(2)}`);
             console.log(`  Avg Annual Return: ${r.averageAnnualReturn.toFixed(2)}%`);
             console.log(`  Annualized Volatility: ${r.annualizedVolatility.toFixed(2)}%`);
             console.log(`  Max Drawdown: ${r.maxDrawdown.toFixed(2)}%`);
             console.log(`  Time Series Points: ${r.timeSeries.length}`);
         });
         console.log("--- End Simulation Results (Test) ---");

    } catch (error) {
        console.error("Test simulation failed:", error);
    }
}

// Uncomment to run the test when executing this file directly (e.g., `ts-node simulator.ts`)
// Make sure .env is loaded if you uncomment this.
// testSimulation();
*/
