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
exports.ClientsController = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const config_1 = require("../../config");
const AppError_1 = require("../../lib/AppError");
const catchAsync_1 = require("../../lib/catchAsync");
// import { BranchesRepository } from "../branches/branches.repository";
const employees_repository_1 = require("../employees/employees.repository");
const sendNotification_1 = require("../notifications/helpers/sendNotification");
const clients_dto_1 = require("./clients.dto");
const clientWebhook_1 = require("../../lib/clientWebhook");
const clients_repository_1 = require("./clients.repository");
const clients_filters_1 = require("./clients.filters");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../../database/db");
const zod_1 = require("zod");
const clientsRepository = new clients_repository_1.ClientsRepository();
const employeesRepository = new employees_repository_1.EmployeesRepository();
// const branchesRepository = new BranchesRepository();
/** Creates a new raw API key, stores only its hash, and returns the raw key once. */
const issueClientApiKey = async (clientId) => {
    const rawApiKey = `albarq_live_${crypto_1.default.randomBytes(32).toString("hex")}`;
    const apiKeyHash = crypto_1.default.createHash("sha256").update(rawApiKey).digest("hex");
    await db_1.prisma.client.update({
        where: { id: clientId },
        data: { apiKeyHash },
    });
    return rawApiKey;
};
class ClientsController {
    createClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientData = clients_dto_1.ClientCreateSchema.parse(req.body);
        let companyID = +res.locals.user.companyID;
        const { password, ...rest } = clientData;
        let avatar;
        if (req.file) {
            const file = req.file;
            avatar = file.location;
        }
        const currentUser = res.locals.user;
        // TODO: CANT CRATE ADMIN_ASSISTANT
        if (!companyID &&
            (currentUser.role === client_1.AdminRole.ADMIN ||
                currentUser.role === client_1.AdminRole.ADMIN_ASSISTANT)) {
            companyID = clientData.companyID;
        }
        // hash the password
        const hashedPassword = bcrypt.hashSync(password + config_1.env.PASSWORD_SALT, 12);
        // Optional: link the new client to a receiving agent of the same company.
        const receivingAgentID = req.body.receivingAgentID !== undefined &&
            req.body.receivingAgentID !== null &&
            req.body.receivingAgentID !== ""
            ? zod_1.z.coerce.number().int().positive().parse(req.body.receivingAgentID)
            : undefined;
        if (receivingAgentID) {
            const receivingAgent = await db_1.prisma.employee.findFirst({
                where: {
                    id: receivingAgentID,
                    role: client_1.EmployeeRole.RECEIVING_AGENT,
                    companyId: companyID,
                    deleted: false,
                },
                select: { id: true },
            });
            if (!receivingAgent) {
                throw new AppError_1.AppError("مندوب الاستلام المحدد غير موجود", 400);
            }
        }
        const createdClient = await clientsRepository.createClient(companyID, {
            ...rest,
            password: hashedPassword,
            userID: currentUser.id,
            avatar,
        }, { receivingAgentID });
        res.status(200).json({
            status: "success",
            data: createdClient,
        });
    });
    generateApikey = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { id } = req.body;
        const loggedInUser = res.locals.user;
        if (!id) {
            throw new AppError_1.AppError("Client name and permissions are required", 400);
        }
        const client = await clientsRepository.getClient({
            clientID: id,
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        // Company managers may only issue keys for their own company's clients.
        const isAdmin = loggedInUser.role === client_1.AdminRole.ADMIN ||
            loggedInUser.role === client_1.AdminRole.ADMIN_ASSISTANT;
        if (!isAdmin && client.company?.id !== loggedInUser.companyID) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        const rawApiKey = await issueClientApiKey(client.id);
        res.status(200).json({
            status: "success",
            apiKey: rawApiKey,
        });
    });
    // ---- Self-service API key for the logged-in client (developers page) ----
    getMyApiKeyStatus = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { apiKeyHash: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        res.status(200).json({
            status: "success",
            data: { hasKey: !!client.apiKeyHash },
        });
    });
    generateMyApiKey = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { id: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        // Replaces any previous key: the old one stops working immediately.
        const rawApiKey = await issueClientApiKey(client.id);
        res.status(200).json({
            status: "success",
            apiKey: rawApiKey,
        });
    });
    revokeMyApiKey = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { id: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        await db_1.prisma.client.update({
            where: { id: client.id },
            data: { apiKeyHash: null },
        });
        res.status(200).json({ status: "success" });
    });
    // ---- Webhook settings of the logged-in client (developers page) ----
    getMyWebhook = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { webhookUrl: true, token: true, status: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        res.status(200).json({
            status: "success",
            data: {
                webhookUrl: client.webhookUrl,
                // The secret itself is never sent back, only whether one is saved.
                hasSecret: !!client.token,
                statuses: client.status ?? [],
            },
        });
    });
    updateMyWebhook = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const settings = clients_dto_1.ClientWebhookSettingsSchema.parse(req.body);
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { id: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        const webhookUrl = settings.webhookUrl ? settings.webhookUrl : null;
        if (webhookUrl) {
            const check = await (0, clientWebhook_1.checkWebhookUrl)(webhookUrl);
            if (!check.ok) {
                throw new AppError_1.AppError(check.reason, 400);
            }
        }
        // One value per status; the last one wins.
        const statuses = Object.values(Object.fromEntries(settings.statuses.map((item) => [item.internal, item])));
        await db_1.prisma.client.update({
            where: { id: client.id },
            data: {
                webhookUrl,
                status: statuses,
                ...(settings.secret !== undefined && { token: settings.secret || "" }),
            },
        });
        const updated = await db_1.prisma.client.findUnique({
            where: { id: client.id },
            select: { webhookUrl: true, token: true, status: true },
        });
        res.status(200).json({
            status: "success",
            data: {
                webhookUrl: updated?.webhookUrl ?? null,
                hasSecret: !!updated?.token,
                statuses: updated?.status ?? [],
            },
        });
    });
    testMyWebhook = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const client = await db_1.prisma.client.findFirst({
            where: { id: loggedInUser.id, deleted: false },
            select: { webhookUrl: true, token: true, status: true },
        });
        if (!client) {
            throw new AppError_1.AppError("Client not found", 404);
        }
        if (!client.webhookUrl) {
            throw new AppError_1.AppError("احفظ رابط الـ Webhook أولاً", 400);
        }
        const mappings = client.status ?? [];
        const result = await (0, clientWebhook_1.postClientWebhook)({
            url: client.webhookUrl,
            token: client.token,
            payload: {
                receiptNumber: "TEST-0001",
                status: mappings[0]?.external ?? "TEST",
                note: "رسالة تجريبية من البرق",
                test: true,
            },
        });
        res.status(200).json({ status: "success", data: result });
    });
    getAllClients = (0, catchAsync_1.catchAsync)(async (req, res) => {
        // Filters
        const loggedInUser = res.locals.user;
        let companyID;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyID = req.query.company_id ? +req.query.company_id : undefined;
        }
        else if (loggedInUser.companyID) {
            companyID = loggedInUser.companyID;
        }
        // Show only clients of the same branch as the logged in user
        let branchID = req.query.branch_id
            ? +req.query.branch_id
            : undefined;
        if (loggedInUser.role !== client_1.EmployeeRole.COMPANY_MANAGER &&
            loggedInUser.role !== client_1.AdminRole.ADMIN &&
            loggedInUser.role !== client_1.AdminRole.ADMIN_ASSISTANT &&
            !loggedInUser.mainRepository) {
            const employee = await db_1.prisma.employee.findUnique({
                where: {
                    id: loggedInUser.id,
                },
                select: {
                    branch: {
                        select: {
                            id: true,
                            childBranches: {
                                select: {
                                    id: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!employee?.branch?.childBranches.some((b) => b.id === branchID)) {
                branchID = employee?.branch?.id;
            }
        }
        const listFilters = clients_filters_1.ClientListFilterSchema.parse(req.query);
        const phone = req.query.phone;
        const name = req.query.name;
        const deleted = req.query.deleted || "false";
        const storeID = req.query.store_id ? +req.query.store_id : undefined;
        const minified = req.query.minified
            ? req.query.minified === "true"
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
        const { clients, pagesCount } = await clientsRepository.getAllClientsPaginated({
            page: page,
            size: size,
            deleted: deleted,
            companyID: companyID,
            minified: minified,
            storeID: storeID,
            branchID: branchID,
            phone: phone,
            name: name,
            loggedInUser,
            ...listFilters,
        });
        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: clients,
        });
    });
    getClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const loggedInUser = res.locals.user;
        if (loggedInUser.role === client_1.ClientRole.CLIENT ||
            loggedInUser.role === client_1.EmployeeRole.CLIENT_ASSISTANT) {
            if (clientID !== loggedInUser.id) {
                throw new AppError_1.AppError("غير مصرح لك الاطلاع علي بيانات عميل اخر", 403);
            }
        }
        const client = await clientsRepository.getClient({
            clientID: clientID,
        });
        res.status(200).json({
            status: "success",
            data: client,
        });
    });
    updateClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientData = clients_dto_1.ClientUpdateSchema.parse(req.body);
        const clientID = +req.params.clientID;
        // const companyID = +res.locals.user.companyID;
        let avatar;
        if (req.file) {
            const file = req.file;
            avatar = file.location;
        }
        const oldClient = await clientsRepository.getClient({
            clientID: clientID,
        });
        const { password, ...rest } = clientData;
        // hash the password
        const hashedPassword = bcrypt.hashSync(password + config_1.env.PASSWORD_SALT, 12);
        const updatedClient = await clientsRepository.updateClient({
            clientID: clientID,
            // companyID: companyID,
            clientData: {
                ...rest,
                password: clientData.password ? hashedPassword : undefined,
                avatar,
            },
        });
        // Send notification to the company manager if the client name is updated
        if (clientData.name && oldClient?.name !== updatedClient?.name) {
            // get the company manager id
            const companyManager = await employeesRepository.getCompanyManager({
                companyID: updatedClient?.company.id,
            });
            await (0, sendNotification_1.sendNotification)({
                userID: companyManager?.id,
                title: "تغيير اسم عميل",
                content: `تم تغيير اسم العميل ${oldClient?.name} إلى ${updatedClient?.name}`,
            });
        }
        res.status(200).json({
            status: "success",
            data: updatedClient,
        });
    });
    deleteClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        await clientsRepository.deleteClient({
            clientID: clientID,
        });
        res.status(200).json({
            status: "success",
        });
    });
    deactivateClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const loggedInUserID = +res.locals.user.id;
        await clientsRepository.deactivateClient({
            clientID: clientID,
            deletedByID: loggedInUserID,
        });
        res.status(200).json({
            status: "success",
        });
    });
    reactivateClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        await clientsRepository.reactivateClient({
            clientID: clientID,
        });
        res.status(200).json({
            status: "success",
        });
    });
}
exports.ClientsController = ClientsController;
//# sourceMappingURL=clients.controller.js.map