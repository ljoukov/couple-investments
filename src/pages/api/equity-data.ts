import axios from "axios";
import {
  format,
  getTime,
  fromUnixTime,
  parseISO,
  subDays,
  startOfDay,
} from "date-fns";

// --- Interfaces ---

export interface HistoricalData {
  [date: string]: number; // Key: 'yyyy-MM-dd', Value: Adjusted Closing Price
}

interface FinnhubCandleResponse {
  c: number[]; // List of close prices
  h: number[]; // List of high prices
  l: number[]; // List of low prices
  o: number[]; // List of open prices
  s: "ok" | "no_data"; // Status of the response
  t: number[]; // List of Unix timestamps
  v: number[]; // List of volume data
}

// For /quote endpoint
interface FinnhubQuoteResponse {
  c: number; // Current price
  d: number | null; // Change
  dp: number | null; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
  // [key: string]: any; // Other potential fields
}

// For /forex/rates
interface FinnhubForexRatesResponse {
  base: string;
  quote: { [currency: string]: number }; // e.g., {"EUR": 0.92, "GBP": 0.80}
  // [key: string]: any;
}

// For /calendar/earnings
export interface FinnhubEarning {
  date: string; // YYYY-MM-DD
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string; // "amc" (after market close), "bmo" (before market open), "dmh" (during market hours)
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}
interface FinnhubEarningsCalendarResponse {
  earningsCalendar: FinnhubEarning[];
  // [key: string]: any;
}

// --- Constants & Helper ---
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Finnhub API key not found in environment variables (FINNHUB_API_KEY)."
    );
  }
  return apiKey;
}

async function makeFinnhubRequest<T>(
  endpoint: string,
  params: Record<string, any>,
  ticker?: string
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${FINNHUB_BASE_URL}${endpoint}`;
  const logPrefix = ticker ? `Finnhub API (${ticker})` : "Finnhub API";

  console.log(`${logPrefix}: Requesting ${url} with params:`, params);

  try {
    const response = await axios.get<T>(url, {
      params: { ...params, token: apiKey },
      headers: { Accept: "application/json" },
    });
    console.log(`${logPrefix}: Request successful for ${endpoint}`);
    return response.data;
  } catch (error: any) {
    console.error(
      `${logPrefix}: Error requesting ${endpoint}:`,
      error.response?.data || error.message
    );
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `${logPrefix} request failed for ${endpoint} with status ${
          error.response.status
        }: ${JSON.stringify(error.response.data)}`
      );
    } else {
      throw new Error(
        `${logPrefix} request failed for ${endpoint}. Reason: ${error.message}`
      );
    }
  }
}

// --- API Fetching Functions ---

export async function fetchFinnhubCandles(
  ticker: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalData> {
  const fromTimestamp = Math.floor(getTime(startDate) / 1000);
  const toTimestamp = Math.floor(getTime(endDate) / 1000);

  const data = await makeFinnhubRequest<FinnhubCandleResponse>(
    "/stock/candle",
    {
      symbol: ticker,
      resolution: "D",
      from: fromTimestamp,
      to: toTimestamp,
    },
    ticker
  );

  if (data.s === "no_data" || !data.t || data.t.length === 0) {
    console.warn(
      `Finnhub returned 'no_data' or empty candle data for ${ticker} in the specified range.`
    );
    return {};
  }
  if (data.s !== "ok") {
    throw new Error(
      `Finnhub API candle request returned status '${data.s}' for ticker ${ticker}`
    );
  }

  const historicalData: HistoricalData = {};
  for (let i = 0; i < data.t.length; i++) {
    const dateStr = format(fromUnixTime(data.t[i]), "yyyy-MM-dd");
    historicalData[dateStr] = parseFloat(data.c[i].toFixed(2));
  }
  console.log(
    `Parsed ${
      Object.keys(historicalData).length
    } candle data points for ${ticker}.`
  );
  return historicalData;
}

export async function fetchFinnhubQuote(
  ticker: string
): Promise<number | null> {
  const data = await makeFinnhubRequest<FinnhubQuoteResponse>(
    "/quote",
    { symbol: ticker },
    ticker
  );
  // Check if 'c' (current price) exists and is a number
  if (typeof data.c === "number") {
    return parseFloat(data.c.toFixed(2));
  }
  console.warn(
    `Finnhub quote data for ${ticker} did not contain a valid current price (c):`,
    data
  );
  return null;
}

export async function fetchFinnhubForexRates(
  baseCurrency: string
): Promise<{ [currency: string]: number } | null> {
  // Finnhub free plan might not support extensive base currencies or real-time rates
  // Check their documentation for `/forex/rates` details based on your plan
  try {
    const data = await makeFinnhubRequest<FinnhubForexRatesResponse>(
      "/forex/rates",
      { base: baseCurrency }
    );
    if (data && data.quote && typeof data.quote === "object") {
      return data.quote; // Returns map like {"EUR": 0.92, "GBP": 0.80}
    }
    console.warn(
      `Finnhub forex rates for base ${baseCurrency} did not return valid quote data:`,
      data
    );
    return null;
  } catch (error: any) {
    console.error(
      `Error fetching forex rates for base ${baseCurrency}: ${error.message}`
    );
    // Specific error handling might be needed based on API limits/plan
    if (
      error.message.includes("403") ||
      error.message.includes("Premium access")
    ) {
      console.warn(
        `Access denied for Forex rates for ${baseCurrency}. Check API plan.`
      );
    }
    return null; // Return null on error
  }
}

export async function fetchFinnhubEarningsCalendar(
  startDate: Date,
  endDate: Date,
  ticker?: string
): Promise<FinnhubEarning[]> {
  const params: Record<string, any> = {
    from: format(startDate, "yyyy-MM-dd"),
    to: format(endDate, "yyyy-MM-dd"),
  };
  if (ticker) {
    params.symbol = ticker;
  }

  const data = await makeFinnhubRequest<FinnhubEarningsCalendarResponse>(
    "/calendar/earnings",
    params,
    ticker
  );

  if (data && Array.isArray(data.earningsCalendar)) {
    return data.earningsCalendar;
  }
  console.warn(
    `Finnhub earnings calendar data was not in the expected format:`,
    data
  );
  return [];
}
