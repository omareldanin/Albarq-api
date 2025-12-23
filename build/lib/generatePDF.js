"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const AppError_1 = require("./AppError");
const logger_1 = require("./logger");
// import {getBrowser} from "./puppeteerInstance";
const generatePDF = async (html, css, options = { landscape: true }) => {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        ignoreDefaultArgs: ["--disable-extensions"],
    });
    const page = await browser.newPage();
    try {
        // Use fast loading mode
        await page.setContent(`
      <style>${css ?? ""}</style>
      ${html}
    `, {
            waitUntil: "domcontentloaded", // MUCH FASTER
        });
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
    }
    catch (err) {
        logger_1.Logger.error(err);
        throw new AppError_1.AppError("حدث خطأ أثناء انشاء ملف ال PDF", 500);
    }
};
exports.generatePDF = generatePDF;
//# sourceMappingURL=generatePDF.js.map