import puppeteer, {Browser} from "puppeteer";
import {Logger} from "../lib/logger";

let browser: Browser | null = null;

export const getBrowser = async () => {
  if (browser) return browser;

  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  browser.on("disconnected", () => {
    Logger.error("Puppeteer browser disconnected – restarting...");
    browser = null;
  });

  return browser;
};
