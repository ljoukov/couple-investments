import axios from 'axios';
// Or use the official OpenAI SDK:
// import OpenAI from 'openai';

// --- Configuration ---
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini'; // Or 'gpt-4o', 'gpt-3.5-turbo' etc. Cost/capability trade-off.

// --- Exposed API Definitions (For the OpenAI Prompt) ---
// These MUST match the functions available inside your secure V8 isolate environment.
const exposedApiDefinitions = `
// --- Available Asynchronous Functions ---
// IMPORTANT: You can ONLY use these functions. Do NOT attempt to use fetch, console.log, etc.
// Handle potential errors (e.g., data not found) gracefully, typically by returning null.

/**
 * Gets the latest price for a ticker. Returns null if not found.
 * @param {string} ticker - Stock ticker symbol (e.g., "AAPL", "NVDA").
 * @returns {Promise<number | null>} The latest price or null.
 */
async function getTickerPrice(ticker: string): Promise<number | null>;

/**
 * Gets historical daily closing prices for a ticker within a date range.
 * Returns empty array if no data. Dates are 'YYYY-MM-DD'.
 * @param {string} ticker - Stock ticker symbol.
 * @param {string} startDate - Start date ('YYYY-MM-DD').
 * @param {string} endDate - End date ('YYYY-MM-DD').
 * @returns {Promise<Array<{date: string, price: number}>>} Array of date/price objects.
 */
async function getHistoricalData(ticker: string, startDate: string, endDate: string): Promise<Array<{date: string, price: number}>>;

/**
 * Gets the current exchange rate between two currencies. Returns null if rate unavailable.
 * Uses standard ISO 4217 currency codes (e.g., "USD", "EUR", "GBP").
 * @param {string} fromCurrency - The base currency code.
 * @param {string} toCurrency - The target currency code.
 * @returns {Promise<number | null>} The exchange rate (1 unit of fromCurrency = X units of toCurrency) or null.
 */
async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null>;

/**
 * Finds the closest earnings announcement date for a ticker *before* a given date.
 * Returns the date string ('YYYY-MM-DD') or null if not found.
 * @param {string} ticker - Stock ticker symbol.
 * @param {string} beforeDate - The date to search backwards from ('YYYY-MM-DD'). Use 'today' for the current date.
 * @returns {Promise<string | null>} The earnings date ('YYYY-MM-DD') or null.
 */
async function findLastEarningsDate(ticker: string, beforeDate: string): Promise<string | null>;

/**
 * Gets the closing price for a ticker on a *specific* date.
 * Returns null if the market was closed or data is unavailable.
 * @param {string} ticker - Stock ticker symbol.
 * @param {string} date - The specific date ('YYYY-MM-DD').
 * @returns {Promise<number | null>} The closing price on that date or null.
 */
async function getPriceOnDate(ticker: string, date: string): Promise<number | null>;

// --- Helper: Date calculation (Assume available in the environment) ---
/**
 * Gets the date string ('YYYY-MM-DD') for N trading days *after* a given date.
 * Returns null if calculation is not possible.
 * @param {string} startDate - The starting date ('YYYY-MM-DD').
 * @param {number} tradingDays - Number of trading days to advance (positive integer).
 * @returns {Promise<string | null>} The target date ('YYYY-MM-DD') or null.
 */
 async function getDateAfterTradingDays(startDate: string, tradingDays: number): Promise<string | null>;

// --- Your Goal ---
// Write an async JavaScript IIFE (Immediately Invoked Function Expression)
// that uses *only* the functions defined above to calculate the requested metric.
// The IIFE must return the final calculated value (usually a number or null/undefined if calculation fails).
// Example: (async () => { /* your logic here */ return result; })();
`;

// --- OpenAI Prompt Construction ---
function buildOpenAIPrompt(userQuery: string): string {
    return `
You are an expert AI assistant specializing in financial data analysis. Your task is to translate a natural language query about a financial metric into a concise, secure JavaScript code snippet. This snippet will be executed in a restricted V8 isolate environment.

**Strict Constraints:**
1.  **Only use the predefined async functions listed below.** No other functions (like \`fetch\`, \`console.log\`, \`Math\`, \`Date\`, standard JS \`fetch\`) are available or allowed.
2.  The code **must** be an async IIFE: \`(async () => { /* logic */ return result; })();\`
3.  The IIFE **must return** the final calculated metric value (usually a number).
4.  If a required piece of data cannot be fetched (e.g., `getTickerPrice` returns null), the script should gracefully handle this and return \`null\` or \`undefined\` as the final result. Do not throw errors unless absolutely necessary for control flow *within* the IIFE.
5.  Keep the code as short and efficient as possible.
6.  Assume 'today' refers to the current date when needed for relative calculations like 'last earnings date'.
7.  Identify tickers and currencies accurately from the user query. Use standard uppercase tickers (AAPL, NVDA) and ISO currency codes (USD, EUR).

**Available Async Functions (Do NOT redefine these):**
${exposedApiDefinitions}

**User Query:**
"${userQuery}"

**Generate only the JavaScript async IIFE code snippet based on the query.** Do not include explanations, comments (unless essential for logic), or markdown formatting.
`.trim();
}


/**
 * Translates a natural language query into an executable JavaScript snippet using OpenAI.
 * @param userQuery - The natural language query from the user.
 * @returns A Promise resolving to the JavaScript code snippet string, or throwing an error.
 */
export async function translateToJsCode(userQuery: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not found in environment variables (OPENAI_API_KEY).');
    }

    const prompt = buildOpenAIPrompt(userQuery);
    console.log("Sending prompt to OpenAI:\n", prompt.substring(0, 500) + "..."); // Log beginning of prompt for debugging

    try {
        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: OPENAI_MODEL,
                messages: [
                    // Optional: Add a system message to further set the context
                    // {
                    //     "role": "system",
                    //     "content": "You are an AI assistant that translates natural language financial queries into secure JavaScript code snippets for a restricted V8 environment, using only pre-defined functions."
                    // },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature: 0.2, // Lower temperature for more deterministic code generation
                max_tokens: 350, // Adjust as needed for expected code length
                n: 1, // Generate one response
                stop: null // Let the model decide when to stop
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.choices && response.data.choices.length > 0) {
            let generatedCode = response.data.choices[0].message?.content?.trim() || '';

            // Clean up potential markdown code fences if the AI includes them
            if (generatedCode.startsWith('```javascript')) {
                generatedCode = generatedCode.substring('```javascript'.length);
            }
             if (generatedCode.startsWith('```js')) {
                generatedCode = generatedCode.substring('```js'.length);
             }
            if (generatedCode.endsWith('```')) {
                generatedCode = generatedCode.substring(0, generatedCode.length - '```'.length);
            }

            console.log("Received JS Code Snippet:\n", generatedCode);
            // Basic validation: check if it looks like an IIFE
             if (!generatedCode.startsWith('(async () => {') || !generatedCode.endsWith('})();')) {
                 console.warn("Generated code doesn't strictly match IIFE format. Review needed.");
                 // Depending on strictness, you might throw an error here or attempt to use it anyway.
             }


            return generatedCode.trim();
        } else {
            console.error("OpenAI response missing expected choices data:", response.data);
            throw new Error('OpenAI did not return a valid code snippet.');
        }
    } catch (error: any) {
        console.error('Error calling OpenAI API:', error.response?.data || error.message);
        if (axios.isAxiosError(error) && error.response) {
             throw new Error(`OpenAI API request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else {
             throw new Error(`Failed to communicate with OpenAI API. Reason: ${error.message}`);
        }
    }
}
