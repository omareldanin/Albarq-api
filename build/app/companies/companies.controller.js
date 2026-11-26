"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesController = void 0;
const bcrypt = __importStar(require("bcrypt"));
const config_1 = require("../../config");
const AppError_1 = require("../../lib/AppError");
const catchAsync_1 = require("../../lib/catchAsync");
const employees_repository_1 = require("../employees/employees.repository");
const companies_dto_1 = require("./companies.dto");
const companies_repository_1 = require("./companies.repository");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../../database/db");
const companiesRepository = new companies_repository_1.CompaniesRepository();
const employeesRepository = new employees_repository_1.EmployeesRepository();
/** Makes a new API key for a company. Only its hash is stored; the old key stops working. */
const issueCompanyApiKey = async (companyID) => {
    const rawApiKey = `albarq_live_${crypto_1.default.randomBytes(32).toString("hex")}`;
    const apiKeyHash = crypto_1.default.createHash("sha256").update(rawApiKey).digest("hex");
    await db_1.prisma.company.update({
        where: { id: companyID },
        data: { apiKeyHash },
    });
    return rawApiKey;
};
/**
 * The logged-in manager's company, when it can send orders through the API
 * (a partner/external company linked to the company that delivers its orders).
 */
const getMyIntegrationCompany = async (loggedInUser) => {
    if (!loggedInUser.companyID) {
        throw new AppError_1.AppError("ليس لديك صلاحية القيام بهذا الفعل", 403);
    }
    const company = await db_1.prisma.company.findUnique({
        where: { id: loggedInUser.companyID },
        select: {
            id: true,
            name: true,
            apiKeyHash: true,
            apiOnly: true,
            isExternal: true,
            targetCompanyId: true,
            webhookUrl: true,
        },
    });
    if (!company) {
        throw new AppError_1.AppError("company not found", 404);
    }
    if (!company.targetCompanyId || !(company.apiOnly || company.isExternal)) {
        throw new AppError_1.AppError("هذه الشركة غير مفعّلة للربط عبر API", 403);
    }
    return company;
};
class CompaniesController {
    createCompany = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const companyData = companies_dto_1.CompanyCreateSchema.parse(req.body);
        if (companyData.companyData.apiOnly &&
            !companyData.companyData.companyID &&
            loggedInUser.role !== "COMPANY_MANAGER") {
            throw new AppError_1.AppError("اختر الشركة التابعة التي تستلم طلبات هذه الشركة", 400);
        }
        let logo;
        if (req.file) {
            const file = req.file;
            logo = file.location;
        }
        const hashedPassword = bcrypt.hashSync(companyData.companyManager.password + config_1.env.PASSWORD_SALT, 12);
        const createdCompany = await companiesRepository.createCompany({
            loggedInUser: loggedInUser,
            companyData: {
                companyData: { ...companyData.companyData, logo },
                companyManager: {
                    ...companyData.companyManager,
                    password: hashedPassword,
                    avatar: logo,
                },
            },
        });
        res.status(200).json({
            status: "success",
            data: createdCompany,
        });
    });
    generateApikey = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { id } = req.body;
        if (!id) {
            throw new AppError_1.AppError("Client name and permissions are required", 400);
        }
        const company = await companiesRepository.getCompany({
            companyID: id,
        });
        if (!company) {
            throw new AppError_1.AppError("company not found", 404);
        }
        const rawApiKey = await issueCompanyApiKey(company.id);
        res.status(200).json({
            status: "success",
            apiKey: rawApiKey,
        });
    });
    // ---- Self-service API key of a partner company (integration docs page) ----
    getMyApiKeyStatus = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const company = await getMyIntegrationCompany(loggedInUser);
        const targetCompany = company.targetCompanyId
            ? await db_1.prisma.company.findUnique({
                where: { id: company.targetCompanyId },
                select: { name: true },
            })
            : null;
        res.status(200).json({
            status: "success",
            data: {
                hasKey: !!company.apiKeyHash,
                companyName: company.name,
                targetCompanyName: targetCompany?.name ?? null,
                // Where status updates are sent; set by Albarq. The bearer token is never returned.
                webhookUrl: company.webhookUrl ?? null,
            },
        });
    });
    generateMyApiKey = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const company = await getMyIntegrationCompany(loggedInUser);
        // Replaces any previous key: the old one stops working immediately.
        const rawApiKey = await issueCompanyApiKey(company.id);
        res.status(200).json({
            status: "success",
            apiKey: rawApiKey,
        });
    });
    revokeMyApiKey = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const company = await getMyIntegrationCompany(loggedInUser);
        await db_1.prisma.company.update({
            where: { id: company.id },
            data: { apiKeyHash: null },
        });
        res.status(200).json({ status: "success" });
    });
    getAllCompanies = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const minified = req.query.minified
            ? req.query.minified === "true"
            : undefined;
        const mainCompany = req.query.main_company
            ? req.query.main_company === "true"
            : undefined;
        let size = req.query.size ? +req.query.size : 10;
        if (size > 500 && minified !== true) {
            size = 10;
        }
        let page = 1;
        if (req.query.page &&
            !Number.isNaN(+req.query.page) &&
            +req.query.page > 0) {
            page = +req.query.page;
        }
        const { companies, pagesCount } = await companiesRepository.getAllCompaniesPaginated({
            page: page,
            size: size,
            minified: minified,
            mainCompany: mainCompany,
        }, loggedInUser);
        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: companies,
        });
    });
    getCompany = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const company = await companiesRepository.getCompany({
            companyID: +companyID,
        });
        res.status(200).json({
            status: "success",
            data: company,
        });
    });
    updateCompany = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const companyData = companies_dto_1.CompanyUpdateSchema.parse(req.body);
        let logo;
        if (req.file) {
            const file = req.file;
            logo = file.location;
        }
        const companyManagerID = (await employeesRepository.getCompanyManager({
            companyID: +companyID,
        })).id;
        if (!companyManagerID) {
            throw new AppError_1.AppError("لا يوجد مدير لهذه الشركة", 404);
        }
        companyData.companyManagerID = companyManagerID;
        if (companyData.password) {
            const hashedPassword = bcrypt.hashSync(companyData.password + config_1.env.PASSWORD_SALT, 12);
            companyData.password = hashedPassword;
        }
        const company = await companiesRepository.updateCompany({
            companyID: +companyID,
            companyData: { ...companyData, logo },
        });
        res.status(200).json({
            status: "success",
            data: company,
        });
    });
    deleteCompany = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        await companiesRepository.deleteCompany({
            companyID: +companyID,
        });
        res.status(200).json({
            status: "success",
        });
    });
}
exports.CompaniesController = CompaniesController;
//# sourceMappingURL=companies.controller.js.map