import {AppError} from "./AppError";
import {Logger} from "./logger";
import {getBrowser} from "./puppeteerInstance";

export const generatePDF = async (
  html: string,
  css?: string,
  options = {landscape: true}
) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.emulateMediaType("print");
    await page.setContent(html);
    if (css) await page.addStyleTag({content: css});

    const pdf = await page.pdf({
      format: "A4",
      landscape: options.landscape,
      printBackground: true,
      margin: {top: "20px", right: "20px", bottom: "20px", left: "20px"},
    });

    await page.close();
    return pdf;
  } catch (error) {
    Logger.error(error);
    throw new AppError("حدث خطأ أثناء انشاء ملف ال PDF", 500);
  }
};
