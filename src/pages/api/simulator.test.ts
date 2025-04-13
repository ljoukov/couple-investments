import { runSimulation } from "./simulator";

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

    response.results.forEach((r) => {
      console.log(`\nStrategy: ${r.strategyName}`);
      console.log(`  Final Value: $${r.finalValue.toFixed(2)}`);
      console.log(`  Avg Annual Return: ${r.averageAnnualReturn.toFixed(2)}%`);
      console.log(
        `  Annualized Volatility: ${r.annualizedVolatility.toFixed(2)}%`
      );
      console.log(`  Max Drawdown: ${r.maxDrawdown.toFixed(2)}%`);
      console.log(`  Time Series Points: ${r.timeSeries.length}`);
    });
    console.log("--- End Simulation Results (Test) ---");
  } catch (error) {
    console.error("Test simulation failed:", error);
  }
}
