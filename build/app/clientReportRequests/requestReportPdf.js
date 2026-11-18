"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestReportPdf = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const AppError_1 = require("../../lib/AppError");
const generateHTML_1 = require("../../lib/generateHTML");
const generatePDF_1 = require("../../lib/generatePDF");
const logger_1 = require("../../lib/logger");
const receiptCollator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
});
const METHOD_LABEL = {
    RECEIVING_AGENT: "عن طريق مندوب الاستلام",
    COMPANY_OFFICE: "من مقر الشركة",
};
const draftMessage = (request, storesCount) => {
    const date = request.createdAt.toLocaleDateString("en-GB");
    if (request.status === "APPROVED") {
        return `تمت الموافقة على طلب الحساب — الكشف الرسمي رقم ${request.reportIds.join("، ")}`;
    }
    if (request.status === "REJECTED")
        return `تم رفض طلب الحساب المقدم بتاريخ ${date}`;
    if (request.status === "CANCELLED")
        return `ألغى العميل طلب الحساب المقدم بتاريخ ${date}`;
    const perStore = storesCount > 1 ? ` — سيُنشأ كشف لكل صفحة (${storesCount})` : "";
    return `طلب حساب بتاريخ ${date} — مسودة للمراجعة وليست كشفاً نهائياً، يُنشأ الكشف بعد موافقة الشركة${perStore}`;
};
/**
 * طلب حساب preview: the delivered client report template filled with the request's
 * orders, marked as a draft. Nothing is saved or uploaded.
 */
const generateRequestReportPdf = async ({ request, company, client, storeNames, orders, loansTotal, }) => {
    const STATIC_DIR = process.env.NODE_ENV === "production"
        ? node_path_1.default.join(process.cwd(), "build/static")
        : node_path_1.default.join(process.cwd(), "src/static");
    // Same totals as a real delivered client report.
    let baghdadOrdersCount = 0;
    let governoratesOrdersCount = 0;
    let insideOrdersCount = 0;
    let clientNet = 0;
    let insideTotal = 0;
    let baghdadTotal = 0;
    let otherTotal = 0;
    for (const order of orders) {
        const net = order.clientNet || 0;
        const isBaghdad = order.governorate === "BAGHDAD";
        clientNet += net;
        if (isBaghdad) {
            baghdadOrdersCount++;
            baghdadTotal += net;
        }
        else {
            governoratesOrdersCount++;
            otherTotal += net;
        }
        if (client.branchId && order.branch?.id === client.branchId) {
            // createReport counts inside orders twice; match it so the preview equals the report.
            insideOrdersCount += 2;
            insideTotal += net;
        }
    }
    const loansDeduction = loansTotal > 0 ? loansTotal : 0;
    const sorted = [...orders].sort((a, b) => {
        const receiptA = a.receiptNumber?.trim() ?? "";
        const receiptB = b.receiptNumber?.trim() ?? "";
        if (!receiptA && !receiptB)
            return 0;
        if (!receiptA)
            return 1;
        if (!receiptB)
            return -1;
        return receiptCollator.compare(receiptA, receiptB);
    });
    const reportData = {
        id: request.id,
        type: "CLIENT",
        createdAt: request.createdAt,
        company,
        createdBy: { name: client.name },
        clientReport: {
            secondaryType: "DELIVERED",
            client: { name: client.name },
            store: { name: storeNames.join("، ") },
            branch: client.branchId ? { id: client.branchId } : null,
        },
        baghdadOrdersCount,
        governoratesOrdersCount,
        insideOrdersCount,
        total: clientNet,
        insideTotal,
        baghdadTotal,
        otherTotal,
        clientNet,
        loansDeduction,
        clientDue: clientNet - loansDeduction,
        draft: {
            requestId: request.id,
            receiveMethod: METHOD_LABEL[request.receiveMethod],
            message: draftMessage(request, storeNames.length),
        },
    };
    try {
        const [template, css] = await Promise.all([
            promises_1.default.readFile(node_path_1.default.join(STATIC_DIR, "templates/clientReport.hbs"), "utf8"),
            promises_1.default.readFile(node_path_1.default.join(STATIC_DIR, "styles/reportStyle.css"), "utf8"),
        ]);
        const html = await (0, generateHTML_1.generateHTML)(template, { reportData, orders: sorted });
        return await (0, generatePDF_1.generatePDF)(html, css);
    }
    catch (error) {
        logger_1.Logger.error(error);
        throw new AppError_1.AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
exports.generateRequestReportPdf = generateRequestReportPdf;
//# sourceMappingURL=requestReportPdf.js.map