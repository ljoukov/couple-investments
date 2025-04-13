import { translateToJsCode } from "./vibes-metric-creation";

async function testTranslation() {
  // Load .env file if running directly
  // import dotenv from 'dotenv';
  // dotenv.config();

  // const query1 = "What is Apple's current stock price in Euros?";
  // const query2 = "Nvidia percentage change from close on last earnings date to close 5 trading days later";
  const query3 = "Current price of Microsoft";

  try {
    console.log(`\nTranslating Query: "${query3}"`);
    const jsCode = await translateToJsCode(query3);
    console.log("\n--- Generated JavaScript ---");
    console.log(jsCode);
    console.log("--------------------------");

    // In a real scenario, you would now send 'jsCode' to your V8 isolate runner.
    // Example (pseudo-code):
    // const result = await runCodeInIsolate(jsCode);
    // console.log("Execution Result:", result);
  } catch (error) {
    console.error("\nTranslation failed:", error);
  }
}
