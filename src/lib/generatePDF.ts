import puppeteer from "puppeteer";
import {AppError} from "./AppError";
import {Logger} from "./logger";
// import {getBrowser} from "./puppeteerInstance";

export const generatePDF = async (
  html: string,
  css?: string,
  options = {landscape: true}
) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  const page = await browser.newPage();
  try {
    // Use fast loading mode
    await page.setContent(
      `
      <style>${css ?? ""}</style>
      ${html}
    `,
      {
        waitUntil: "domcontentloaded", // MUCH FASTER
      }
    );

    const pdf = await page.pdf({
      format: "A4",
      landscape: options.landscape,
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();
    return pdf;
  } catch (err) {
    Logger.error(err);
    throw new AppError("حدث خطأ أثناء انشاء ملف ال PDF", 500);
  }
};
