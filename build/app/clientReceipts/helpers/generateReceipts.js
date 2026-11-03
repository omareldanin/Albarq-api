"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceipts = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const sharp_1 = __importDefault(require("sharp"));
const AppError_1 = require("../../../lib/AppError");
const generateHTML_1 = require("../../../lib/generateHTML");
const generatePDF_1 = require("./generatePDF");
const logger_1 = require("../../../lib/logger");
async function optimizeLogo(url) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error(`Logo download failed: ${response.status}`);
    }
    const original = Buffer.from(await response.arrayBuffer());
    const optimized = await (0, sharp_1.default)(original)
        .resize({
        width: 220,
        withoutEnlargement: true,
    })
        .png({
        palette: true,
        colors: 128,
        compressionLevel: 9,
    })
        .toBuffer();
    return `data:image/png;base64,${optimized.toString("base64")}`;
}
const generateReceipts = async (receipts) => {
    try {
        // Each distinct logo is downloaded and resized once per batch.
        const logoCache = new Map();
        const preparedReceipts = [];
        for (const receipt of receipts) {
            if (!receipt)
                continue;
            let companyLogo = receipt.branch.companyLogo;
            if (companyLogo) {
                let optimizedLogo = logoCache.get(companyLogo);
                if (!optimizedLogo) {
                    optimizedLogo = await optimizeLogo(companyLogo);
                    logoCache.set(companyLogo, optimizedLogo);
                }
                companyLogo = optimizedLogo;
            }
            preparedReceipts.push({
                ...receipt,
                branch: {
                    ...receipt.branch,
                    companyLogo,
                },
            });
        }
        const templatePath = node_path_1.default.join(__dirname, "../../../static/templates/clientReceipt.hbs");
        const template = await promises_1.default.readFile(templatePath, "utf8");
        const html = await (0, generateHTML_1.generateHTML)(template, {
            receipts: preparedReceipts,
        });
        return await (0, generatePDF_1.generatePDF)(html, "", { landscape: false });
    }
    catch (error) {
        logger_1.Logger.error(error);
        throw new AppError_1.AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
exports.generateReceipts = generateReceipts;
//# sourceMappingURL=generateReceipts.js.map