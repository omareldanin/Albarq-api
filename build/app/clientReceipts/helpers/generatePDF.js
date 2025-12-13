"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = void 0;
const logger_1 = require("../../../lib/logger");
const AppError_1 = require("../../../lib/AppError");
const puppeteer_1 = __importDefault(require("puppeteer"));
// html and css content or html and css file path
const generatePDF = async (html, css, options = {
    landscape: true,
}) => {
    try {
        const browser = await puppeteer_1.default.launch({
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
            margin: { top: "10px", right: "10px", bottom: "10px", left: "10px" },
        });
        // await browser.close();
        return pdf;
        // return Buffer.from(Object.values(pdf));
    }
    catch (error) {
        logger_1.Logger.error(error);
        throw new AppError_1.AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
exports.generatePDF = generatePDF;
//# sourceMappingURL=generatePDF.js.map