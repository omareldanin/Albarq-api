"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApiCompany = void 0;
const AppError_1 = require("../lib/AppError");
const db_1 = require("../database/db");
const crypto_1 = __importDefault(require("crypto"));
const isApiCompany = async (req, res, next) => {
    const apiKey = req.header("x-api-key");
    if (!apiKey) {
        return next(new AppError_1.AppError("API Key required", 401));
    }
    const apiKeyHash = crypto_1.default.createHash("sha256").update(apiKey).digest("hex");
    const company = await db_1.prisma.company.findFirst({
        where: { apiKeyHash },
        select: {
            id: true,
            name: true,
            targetCompanyId: true,
        },
    });
    if (!company) {
        return next(new AppError_1.AppError("Invalid API Key", 401));
    }
    res.locals.user = {
        id: company.id,
        name: company.name,
        companyID: company.targetCompanyId,
    };
    next();
};
exports.isApiCompany = isApiCompany;
//# sourceMappingURL=isApiCompany.js.map