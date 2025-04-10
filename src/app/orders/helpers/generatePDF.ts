import puppeteer from "puppeteer";
import { Logger } from "../../../lib/logger";
import { AppError } from "../../../lib/AppError";

// html and css content or html and css file path

export const generatePDF = async (
    html: string,
    css?: string,
    options: {
        landscape?: boolean;
    } = {
        landscape: true
    }
) => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            ignoreDefaultArgs: ["--disable-extensions"],
        });
        const page = await browser.newPage();
 
        await page.emulateMediaType("print");
        await page.setContent(html);
        css && (await page.addStyleTag({ content: css }));

        const pdf = await page.pdf({
            width: "100mm",
            height: "100mm",
            landscape: options.landscape,
            printBackground: true,
            margin: { top: "10px", right: "10px", bottom: "10px", left: "10px" }
        });

        await browser.close();
        return pdf;
        // return Buffer.from(Object.values(pdf));
    } catch (error) {
        Logger.error(error);
        throw new AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
