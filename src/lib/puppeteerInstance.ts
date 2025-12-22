import puppeteer, {Browser} from "puppeteer";
import {Logger} from "../lib/logger";

let browser: Browser | null = null;
export const getBrowser = async () => {
  if (browser) return browser;

  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process", // 🔥 HUGE CPU SAVER
      "--no-zygote",
    ],
  });

  browser.on("disconnected", () => {
    Logger.error("Puppeteer browser disconnected – restarting...");
    browser = null;
  });

  return browser;
};

setInterval(async () => {
  if (!browser) return;

  Logger.warn("Restarting Puppeteer browser (maintenance)");

  try {
    await browser.close();
  } catch (err) {
    Logger.error("Error while closing Puppeteer browser", err);
  } finally {
    browser = null;
  }
}, 1000 * 60 * 30);
