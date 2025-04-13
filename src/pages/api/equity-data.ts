import axios from "axios";
import { format, getTime, fromUnixTime } from "date-fns";

// --- Interface for Historical Data Structure ---
// This structure is expected by the simulator
export interface HistoricalData {
  [date: string]: number; // Key: 'yyyy-MM-dd', Value: Adjusted Closing Price
}

// --- Finnhub API Response Interface ---
// Structure of the data returned by Finnhub's /stock/candle endpoint
interface FinnhubCandleResponse {
  c: number[]; // List of close prices
  h: number[]; // List of high prices
  l: number[]; // List of low prices
  o: number[]; // List of open prices
  s: "ok" | "no_data"; // Status of the response
  t: number[]; // List of Unix timestamps
  v: number[]; // List of volume data
}

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

/**
 * Fetches historical daily stock candle data from Finnhub.
 * @param ticker - The stock ticker symbol (e.g., "AAPL", "MSFT").
 * @param startDate - The start date for the historical data.
 * @param endDate - The end date for the historical data.
 * @returns A Promise resolving to HistoricalData map or throwing an error.
 */
export async function fetchFinnhubCandles(
  ticker: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalData> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Finnhub API key not found in environment variables (FINNHUB_API_KEY)."
    );
  }

  // Finnhub uses Unix timestamps (seconds)
  const fromTimestamp = Math.floor(getTime(startDate) / 1000);
  const toTimestamp = Math.floor(getTime(endDate) / 1000);

  const url = `${FINNHUB_BASE_URL}/stock/candle`;

  console.log(
    `Fetching Finnhub data for ${ticker} from ${format(
      startDate,
      "yyyy-MM-dd"
    )} to ${format(endDate, "yyyy-MM-dd")}...`
  );

  try {
    const response = await axios.get<FinnhubCandleResponse>(url, {
      params: {
        symbol: ticker,
        resolution: "D", // Daily resolution
        from: fromTimestamp,
        to: toTimestamp,
        token: apiKey,
      },
      headers: {
        Accept: "application/json",
      },
    });

    const data = response.data;

    if (data.s === "no_data" || !data.t || data.t.length === 0) {
      console.warn(
        `Finnhub returned 'no_data' or empty data for ${ticker} in the specified range.`
      );
      return {}; // Return empty object if no data available
    }

    if (data.s !== "ok") {
      throw new Error(
        `Finnhub API returned status '${data.s}' for ticker ${ticker}`
      );
    }

    const historicalData: HistoricalData = {};
    for (let i = 0; i < data.t.length; i++) {
      const timestamp = data.t[i];
      const closePrice = data.c[i];
      // Convert Unix timestamp (seconds) back to 'yyyy-MM-dd' date string
      const dateStr = format(fromUnixTime(timestamp), "yyyy-MM-dd");
      historicalData[dateStr] = parseFloat(closePrice.toFixed(2));
    }

    console.log(
      `Successfully fetched ${
        Object.keys(historicalData).length
      } data points for ${ticker} from Finnhub.`
    );
    return historicalData;
  } catch (error: any) {
    console.error(
      `Error fetching Finnhub data for ${ticker}:`,
      error.response?.data || error.message
    );
    // Re-throw a more specific error
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Finnhub API request failed for ${ticker} with status ${
          error.response.status
        }: ${JSON.stringify(error.response.data)}`
      );
    } else {
      throw new Error(
        `Failed to fetch Finnhub data for ${ticker}. Reason: ${error.message}`
      );
    }
  }
}
