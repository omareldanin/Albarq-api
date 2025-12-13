"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const logger_1 = require("../lib/logger");
let browser = null;
const getBrowser = async () => {
    if (browser)
        return browser;
    browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    browser.on("disconnected", () => {
        logger_1.Logger.error("Puppeteer browser disconnected – restarting...");
        browser = null;
    });
    return browser;
};
exports.getBrowser = getBrowser;
//# sourceMappingURL=puppeteerInstance.js.map