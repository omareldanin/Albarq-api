import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
import QRCode from "qrcode";
import {AppError} from "../../../lib/AppError";
import {generatePDF} from "../../../lib/generatePDF";
import type {AllreportReform} from "../reports.responses";

type ReceiptReport = NonNullable<ReturnType<typeof AllreportReform>>;
const dates = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Baghdad",
});

export function reportReceiptDetails(report: ReceiptReport) {
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
      throw new AppError("إيصال الكشف غير متاح لهذا النوع", 400);
  }
}

export async function renderReportReceipt(report: ReceiptReport) {
  const details = reportReceiptDetails(report);
  const staticDir = path.resolve(__dirname, "../../../static");
  const [template, font, qrCode] = await Promise.all([
    fs.readFile(path.join(staticDir, "templates/reportReceipt.hbs"), "utf8"),
    fs.readFile(path.join(staticDir, "fonts/Cairo-VariableFont_slntwght.ttf")),
    QRCode.toDataURL(String(report.id), {
      margin: 4,
      width: 256,
      errorCorrectionLevel: "M",
    }),
  ]);

  // Names are escaped by Handlebars; the font and QR are embedded for offline printing.
  return Handlebars.compile(template, {strict: true})({
    font: font.toString("base64"),
    company: report.company.name,
    companyLogo: report.company.logo?.trim() || "",
    reportID: report.id,
    date: dates.format(report.createdAt),
    reportType: details.type,
    entityLabel: details.label,
    entityName: details.name || "-",
    isClientReport: report.type === "CLIENT",
    store:
      report.type === "CLIENT" ? report.clientReport?.store?.name || "-" : "-",
    createdBy: report.createdBy.name,
    baghdadOrdersCount: report.baghdadOrdersCount,
    governoratesOrdersCount: report.governoratesOrdersCount,
    totalOrdersCount:
      report.baghdadOrdersCount + report.governoratesOrdersCount,
    amountDue: details.amount.toLocaleString("en-GB"),
    qrCode,
  });
}

export async function generateReportReceiptPDF(report: ReceiptReport) {
  const html = await renderReportReceipt(report);
  return generatePDF(html, undefined, {
    landscape: false,
    format: "A5",
    waitUntil: "load",
  });
}
