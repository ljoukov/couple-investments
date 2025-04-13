import { executeJsInIsolate } from "./execute-metric";

async function testExecutionWithRealData() {
  // Make sure .env is loaded if running directly
  // import dotenv from 'dotenv';
  // dotenv.config();

  const code1 = `
(async () => {
  // Uses getTickerPrice -> /quote
  // Uses getExchangeRate -> /forex/rates
  const priceUsd = await getTickerPrice('AAPL');
  if (priceUsd === null) return null;
  const rate = await getExchangeRate('USD', 'EUR');
  if (rate === null) return null;
  return priceUsd * rate;
})();
     `;

  const code2 = `
(async () => {
    const ticker = 'NVDA';
    // Uses findLastEarningsDate -> /calendar/earnings
    const lastEarnings = await findLastEarningsDate(ticker, 'today');
    if (!lastEarnings) return null;
    console.log('Found last earnings date:', lastEarnings); // Log inside isolate is tricky, host logs instead

    // Uses getPriceOnDate -> /stock/candle
    const priceOnEarnings = await getPriceOnDate(ticker, lastEarnings);
    if (priceOnEarnings === null) return null;
    console.log('Price on earnings:', priceOnEarnings);

    // Uses getDateAfterTradingDays (approximation)
    const dateAfter5Days = await getDateAfterTradingDays(lastEarnings, 5);
     if (!dateAfter5Days) return null;
     console.log('Date after 5 trading days:', dateAfter5Days);

    // Uses getPriceOnDate -> /stock/candle
    const priceAfter5Days = await getPriceOnDate(ticker, dateAfter5Days);
    if (priceAfter5Days === null) return null;
     console.log('Price after 5 days:', priceAfter5Days);

    if (priceOnEarnings === 0) return null; // Avoid division by zero
    return ((priceAfter5Days / priceOnEarnings) - 1) * 100; // Percentage change
})();
    `;

  try {
    console.log("\n--- Executing Snippet 1 (AAPL in EUR) ---");
    const result1 = await executeJsInIsolate(code1);
    console.log("Result 1:", result1 ? result1.toFixed(2) + " EUR" : "N/A");

    console.log("\n--- Executing Snippet 2 (NVDA Earnings Change) ---");
    const result2 = await executeJsInIsolate(code2);
    console.log("Result 2:", result2 ? result2.toFixed(2) + "%" : "N/A");
  } catch (error) {
    console.error("\n--- Execution Test Failed ---");
    console.error(error);
  }
}
