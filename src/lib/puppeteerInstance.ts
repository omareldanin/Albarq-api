// puppeteerInstance.ts
import puppeteer from "puppeteer";

export const browserPromise = puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
