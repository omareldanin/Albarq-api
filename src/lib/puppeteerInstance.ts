// puppeteerInstance.ts
import puppeteer, {Browser} from "puppeteer";
import {Logger} from "./logger"; // adjust import

let browser: Browser | null = null;

// Create browser or return existing usable instance
export async function getBrowser() {
  try {
    // If browser exists & is connected → return it
    if (browser && browser.connected) {
      return browser;
    }

    Logger.warn("Launching new Puppeteer browser...");

    // Launch new browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Handle unexpected close → reset browser to null
    browser.on("disconnected", () => {
      Logger.error("Puppeteer browser disconnected → resetting instance");
      browser = null;
    });

    return browser;
  } catch (error) {
    Logger.error("Error launching Puppeteer: " + error);
    browser = null;
    throw error;
  }
}
