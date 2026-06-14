"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBranchClientsReport = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const AppError_1 = require("../../../lib/AppError");
const generateHTML_1 = require("../../../lib/generateHTML");
const generatePDF_1 = require("../../../lib/generatePDF");
const logger_1 = require("../../../lib/logger");
const generateBranchClientsReport = async (reportData, clients) => {
    const STATIC_DIR = process.env.NODE_ENV === "production"
        ? node_path_1.default.join(process.cwd(), "build/static")
        : node_path_1.default.join(process.cwd(), "src/static");
    try {
        let templatePath = "";
        templatePath = node_path_1.default.join(STATIC_DIR, "templates/branchReportClients.hbs");
        const template = await promises_1.default.readFile(templatePath, "utf8");
        const css = await promises_1.default.readFile(node_path_1.default.join(STATIC_DIR, "styles/reportStyle.css"), "utf8");
        const html = await (0, generateHTML_1.generateHTML)(template, { reportData, clients });
        const pdf = await (0, generatePDF_1.generatePDF)(html, css);
        return pdf;
    }
    catch (error) {
        logger_1.Logger.error(error);
        throw new AppError_1.AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
exports.generateBranchClientsReport = generateBranchClientsReport;
//# sourceMappingURL=generateBranchClientsReport.js.map