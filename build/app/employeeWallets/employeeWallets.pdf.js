"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWalletTransactionsReport = renderWalletTransactionsReport;
exports.generateWalletTransactionsPDF = generateWalletTransactionsPDF;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const handlebars_1 = __importDefault(require("handlebars"));
const generatePDF_1 = require("../../lib/generatePDF");
const transactionTypes = {
    DEPOSIT: "إيداع",
    WITHDRAW: "سحب",
    FROM_BRANCH: "من فرع",
    TO_BRANCH: "إلى فرع",
    FROM_WALLET: "من قاصة",
    TO_WALLET: "إلى قاصة",
    FROM_EMPLOYEE: "من موظف",
    TO_EMPLOYEE: "إلى موظف",
    FROM_CLIENT: "من عميل",
    TO_CLIENT: "إلى عميل",
};
const dates = new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baghdad",
});
const amount = (value) => value.toLocaleString("en-GB");
async function renderWalletTransactionsReport(report, filters) {
    const staticDir = node_path_1.default.resolve(__dirname, "../../static");
    const [template, font] = await Promise.all([
        promises_1.default.readFile(node_path_1.default.join(staticDir, "templates/walletTransactions.hbs"), "utf8"),
        promises_1.default.readFile(node_path_1.default.join(staticDir, "fonts/Amiri-Regular.ttf")),
    ]);
    const { wallet, transactions } = report;
    const branchName = transactions.find((row) => row.targetBranch)?.targetBranch
        ?.name;
    const clientName = transactions.find((row) => row.targetClient)?.targetClient
        ?.user.name;
    // Handlebars escapes all user-provided text, including names and transaction descriptions.
    return handlebars_1.default.compile(template, { strict: true })({
        font: font.toString("base64"),
        walletID: wallet.id,
        company: wallet.company.name,
        branch: wallet.branch?.name || "-",
        employee: wallet.employee?.user.name || "بدون موظف",
        total: amount(wallet.total),
        paid: amount(wallet.paid),
        pending: amount(wallet.pending),
        exportedAt: dates.format(new Date()),
        startDate: filters.start_date || "من البداية",
        endDate: filters.end_date || "حتى الآن",
        targetBranch: filters.target_branch_id
            ? `${branchName || "فرع"} (#${filters.target_branch_id})`
            : "كل الفروع",
        targetClient: filters.target_client_id
            ? `${clientName || "عميل"} (#${filters.target_client_id})`
            : "كل العملاء",
        type: filters.type ? transactionTypes[filters.type] : "كل الأنواع",
        approval: filters.approved === undefined
            ? "الكل"
            : filters.approved
                ? "معتمدة"
                : "بانتظار الاعتماد",
        count: transactions.length,
        rows: transactions.map((row) => ({
            id: row.id,
            date: dates.format(row.createdAt),
            type: transactionTypes[row.type],
            description: row.for,
            amount: amount(row.paidAmount),
            targetBranch: row.targetBranch?.name || "-",
            targetClient: row.targetClient?.user.name || "-",
            createdBy: row.createdBy?.name || "-",
        })),
    });
}
async function generateWalletTransactionsPDF(report, filters) {
    const html = await renderWalletTransactionsReport(report, filters);
    return (0, generatePDF_1.generatePDF)(html);
}
//# sourceMappingURL=employeeWallets.pdf.js.map