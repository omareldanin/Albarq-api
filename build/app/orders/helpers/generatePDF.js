"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = void 0;
const logger_1 = require("../../../lib/logger");
const AppError_1 = require("../../../lib/AppError");
// import {getBrowser} from "../../../lib/puppeteerInstance";
const puppeteer_1 = __importDefault(require("puppeteer"));
// html and css content or html and css file path
const generatePDF = async (html, css, options = {
    landscape: true,
}) => {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        ignoreDefaultArgs: ["--disable-extensions"],
    });
    const page = await browser.newPage();
    try {
        await page.emulateMediaType("print");
        await page.setContent(`
      <style>${css ?? ""}</style>
      ${html}
    `, {
            waitUntil: "domcontentloaded", // MUCH FASTER
        });
        const isLandscape = options.landscape === true;
        const pdf = await page.pdf({
            width: isLandscape ? "210mm" : "148mm",
            height: isLandscape ? "148mm" : "210mm",
            landscape: isLandscape,
            printBackground: true,
            margin: {
                top: "5mm",
                right: "5mm",
                bottom: "5mm",
                left: "5mm",
            },
        });
        await browser.close();
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