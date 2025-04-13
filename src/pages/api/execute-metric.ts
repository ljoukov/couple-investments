import ivm from "isolated-vm";
import {
  format,
  addDays,
  parseISO,
  isWeekend,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
// Import ALL necessary data fetching functions
import {
  fetchFinnhubCandles,
  fetchFinnhubQuote,
  fetchFinnhubForexRates,
  fetchFinnhubEarningsCalendar,
  HistoricalData,
  FinnhubEarning, // Import type if needed for filtering
} from "./equity-data";

// --- Implementations for Exposed APIs (Using REAL API calls) ---

const exposedApiImplementations = {
  /**
   * Gets the latest price for a ticker using Finnhub /quote.
   */
  async getTickerPrice(ticker: string): Promise<number | null> {
    console.log(
      `[Isolate Host] API CALLED: getTickerPrice(${ticker}) - Using equity-data`
    );
    try {
      return await fetchFinnhubQuote(ticker);
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error in getTickerPrice calling fetchFinnhubQuote for ${ticker}:`,
        error.message
      );
      return null; // Return null on failure
    }
  },

  /**
   * Gets historical daily closing prices using fetchFinnhubCandles.
   */
  async getHistoricalData(
    ticker: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; price: number }>> {
    console.log(
      `[Isolate Host] API CALLED: getHistoricalData(${ticker}, ${startDate}, ${endDate}) - Using equity-data`
    );
    try {
      const historicalDataMap: HistoricalData = await fetchFinnhubCandles(
        ticker,
        parseISO(startDate),
        parseISO(endDate)
      );
      const results: Array<{ date: string; price: number }> = Object.entries(
        historicalDataMap
      )
        .map(([date, price]) => ({ date, price }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return results;
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error in getHistoricalData calling fetchFinnhubCandles for ${ticker}:`,
        error.message
      );
      return [];
    }
  },

  /**
   * Gets the exchange rate using Finnhub /forex/rates.
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number | null> {
    console.log(
      `[Isolate Host] API CALLED: getExchangeRate(${fromCurrency}, ${toCurrency}) - Using equity-data`
    );
    try {
      // Finnhub requires specifying the base currency
      const rates = await fetchFinnhubForexRates(fromCurrency);
      if (rates && typeof rates[toCurrency] === "number") {
        return parseFloat(rates[toCurrency].toFixed(6)); // Return specific rate with precision
      }
      console.warn(
        `[Isolate Host] Exchange rate from ${fromCurrency} to ${toCurrency} not found in Finnhub response.`
      );
      return null;
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error in getExchangeRate calling fetchFinnhubForexRates for base ${fromCurrency}:`,
        error.message
      );
      return null;
    }
  },

  /**
   * Finds the closest earnings announcement date for a ticker *before* a given date using Finnhub /calendar/earnings.
   */
  async findLastEarningsDate(
    ticker: string,
    beforeDateStr: string
  ): Promise<string | null> {
    console.log(
      `[Isolate Host] API CALLED: findLastEarningsDate(${ticker}, ${beforeDateStr}) - Using equity-data`
    );
    try {
      const beforeDate =
        beforeDateStr === "today"
          ? startOfDay(new Date())
          : startOfDay(parseISO(beforeDateStr));
      // Fetch earnings for a reasonable lookback period (e.g., 1 year)
      const lookbackStartDate = subDays(beforeDate, 365);

      const earnings = await fetchFinnhubEarningsCalendar(
        lookbackStartDate,
        beforeDate,
        ticker
      );

      if (earnings.length === 0) {
        console.log(
          `[Isolate Host] No earnings found for ${ticker} in the last year before ${format(
            beforeDate,
            "yyyy-MM-dd"
          )}.`
        );
        return null;
      }

      // Filter earnings strictly before the target date and sort descending to find the latest
      const pastEarnings = earnings
        .filter((e) => startOfDay(parseISO(e.date)) < beforeDate)
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending by date

      if (pastEarnings.length > 0) {
        return pastEarnings[0].date; // Return the date string of the most recent one
      } else {
        console.log(
          `[Isolate Host] No earnings found for ${ticker} strictly before ${format(
            beforeDate,
            "yyyy-MM-dd"
          )} in fetched data.`
        );
        return null;
      }
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error in findLastEarningsDate calling fetchFinnhubEarningsCalendar for ${ticker}:`,
        error.message
      );
      return null;
    }
  },

  /**
   * Gets the closing price for a ticker on a *specific* date using fetchFinnhubCandles.
   */
  async getPriceOnDate(ticker: string, date: string): Promise<number | null> {
    console.log(
      `[Isolate Host] API CALLED: getPriceOnDate(${ticker}, ${date}) - Using equity-data`
    );
    try {
      const targetDate = parseISO(date);
      const historicalDataMap: HistoricalData = await fetchFinnhubCandles(
        ticker,
        targetDate, // Fetch just for the target date
        targetDate
      );
      const price = historicalDataMap[date];
      return typeof price === "number" ? price : null;
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error in getPriceOnDate calling fetchFinnhubCandles for ${ticker} on ${date}:`,
        error.message
      );
      return null;
    }
  },

  /**
   * Approximates the date string ('YYYY-MM-DD') for N trading days *after* a given date.
   * NOTE: This is an APPROXIMATION and does NOT account for market holidays.
   */
  async getDateAfterTradingDays(
    startDateStr: string,
    tradingDays: number
  ): Promise<string | null> {
    console.log(
      `[Isolate Host] API CALLED: getDateAfterTradingDays(${startDateStr}, ${tradingDays}) - APPROXIMATION`
    );
    if (tradingDays < 0) return null;
    if (tradingDays === 0) return startDateStr;

    try {
      let currentDate = parseISO(startDateStr);
      let daysAdded = 0;
      let tradingDaysCounted = 0;

      // Iterate day by day, skipping weekends
      while (tradingDaysCounted < tradingDays) {
        currentDate = addDays(currentDate, 1);
        daysAdded++;
        if (!isWeekend(currentDate)) {
          tradingDaysCounted++;
        }
        // Safety break to prevent infinite loops if logic is flawed or too many days requested
        if (daysAdded > tradingDays * 3 && tradingDays > 0) {
          console.warn(
            "[Isolate Host] getDateAfterTradingDays safety break triggered."
          );
          return null;
        }
      }
      return format(currentDate, "yyyy-MM-dd");
    } catch (error: any) {
      console.error(
        `[Isolate Host] Error calculating date after trading days: ${error.message}`
      );
      return null;
    }
  },
};

// --- Isolate Execution Logic (NO CHANGES NEEDED) ---

const ISOLATE_MEMORY_LIMIT = 128; // MB
const SCRIPT_EXECUTION_TIMEOUT = 15000; // Increased timeout further for multiple real API calls

export async function executeJsInIsolate(jsCode: string): Promise<any> {
  let isolate: ivm.Isolate | null = null;
  let context: ivm.Context | null = null;

  try {
    isolate = new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT });
    context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    for (const [funcName, funcImpl] of Object.entries(
      exposedApiImplementations
    )) {
      await jail.set(funcName, new ivm.Reference(funcImpl));
    }
    console.log("[Isolate Host] Exposed APIs set in isolate context.");

    const script = await isolate.compileScript(jsCode, {
      filename: "metric-script.js",
    });
    console.log("[Isolate Host] Script compiled successfully.");

    console.log("[Isolate Host] Running script...");
    const promiseRef = await script.run(context, {
      timeout: SCRIPT_EXECUTION_TIMEOUT,
      result: { promise: true, reference: true },
    });

    if (!(promiseRef instanceof ivm.Reference)) {
      throw new Error("Script execution did not return a Promise reference.");
    }
    console.log("[Isolate Host] Script returned promise reference.");

    const result = await promiseRef.apply(undefined, [], {
      timeout: SCRIPT_EXECUTION_TIMEOUT,
      result: { promise: true, copy: true },
    });

    console.log(`[Isolate Host] Script execution finished. Result:`, result);
    return result;
  } catch (error: any) {
    console.error(
      `[Isolate Host] Error during script execution: ${error.message}`
    );
    throw error;
  } finally {
    try {
      if (context) context.release();
    } catch (e) {
      console.error("[Isolate Host] Error releasing context:", e);
    }
    try {
      if (isolate) isolate.dispose();
    } catch (e) {
      console.error("[Isolate Host] Error disposing isolate:", e);
    }
    console.log("[Isolate Host] Isolate resources cleaned up.");
  }
}
