"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportReceiptDetails = reportReceiptDetails;
exports.renderReportReceipt = renderReportReceipt;
exports.generateReportReceiptPDF = generateReportReceiptPDF;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const handlebars_1 = __importDefault(require("handlebars"));
const qrcode_1 = __importDefault(require("qrcode"));
const AppError_1 = require("../../../lib/AppError");
const generatePDF_1 = require("../../../lib/generatePDF");
const dates = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Baghdad",
});
function reportReceiptDetails(report) {
    // Use the saved settlement totals, matching the existing report templates.
    switch (report.type) {
        case "CLIENT":
            return {
                type: "كشف عميل",
                label: "العميل",
                name: report.clientReport?.client.name,
                amount: report.clientNet,
            };
        case "BRANCH":
            return {
                type: "كشف فرع",
                label: "الفرع",
                name: report.branchReport?.branch.name,
                amount: report.branchNet,
            };
        case "DELIVERY_AGENT":
            return {
                type: "كشف مندوب",
                label: "المندوب",
                name: report.deliveryAgentReport?.deliveryAgent.name,
                amount: report.companyNet,
            };
        case "COMPANY":
            return {
                type: "كشف شركة",
                label: "الشركة",
                name: report.companyReport?.company.name,
                amount: report.companyNet,
            };
        case "REPOSITORY":
            return {
                type: "كشف مخزن",
                label: "المخزن",
                name: report.repositoryReport?.repository?.name,
                amount: report.clientNet,
            };
        default:
            throw new AppError_1.AppError("إيصال الكشف غير متاح لهذا النوع", 400);
    }
}
async function renderReportReceipt(report) {
    const details = reportReceiptDetails(report);
    const staticDir = node_path_1.default.resolve(__dirname, "../../../static");
    const [template, font, qrCode] = await Promise.all([
        promises_1.default.readFile(node_path_1.default.join(staticDir, "templates/reportReceipt.hbs"), "utf8"),
        promises_1.default.readFile(node_path_1.default.join(staticDir, "fonts/Cairo-VariableFont_slntwght.ttf")),
        qrcode_1.default.toDataURL(String(report.id), {
            margin: 4,
            width: 256,
            errorCorrectionLevel: "M",
        }),
    ]);
    // Names are escaped by Handlebars; the font and QR are embedded for offline printing.
    return handlebars_1.default.compile(template, { strict: true })({
        font: font.toString("base64"),
        company: report.company.name,
        companyLogo: report.company.logo?.trim() || "",
        reportID: report.id,
        date: dates.format(report.createdAt),
        reportType: details.type,
        entityLabel: details.label,
        entityName: details.name || "-",
        isClientReport: report.type === "CLIENT",
        clientSecondaryType: report.clientReport?.secondaryType === "DELIVERED"
            ? "واصل"
            : report.clientReport?.secondaryType === "RETURNED"
                ? "راجع"
                : "-",
        store: report.type === "CLIENT" ? report.clientReport?.store?.name || "-" : "-",
        createdBy: report.createdBy.name,
        baghdadOrdersCount: report.baghdadOrdersCount,
        governoratesOrdersCount: report.governoratesOrdersCount,
        totalOrdersCount: report.baghdadOrdersCount + report.governoratesOrdersCount,
        amountDue: details.amount.toLocaleString("en-GB"),
        showAmountDue: report.secondaryType !== "RETURNED",
        qrCode,
    });
}
async function generateReportReceiptPDF(report) {
    const html = await renderReportReceipt(report);
    return (0, generatePDF_1.generatePDF)(html, undefined, {
        landscape: false,
        format: "A5",
        waitUntil: "load",
    });
}
//# sourceMappingURL=generateReportReceipt.js.map