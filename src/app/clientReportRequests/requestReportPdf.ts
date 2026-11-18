import fs from "node:fs/promises";
import path from "node:path";
import type {ReportReceiveMethod, ReportRequestStatus} from "@prisma/client";
import {AppError} from "../../lib/AppError";
import {generateHTML} from "../../lib/generateHTML";
import {generatePDF} from "../../lib/generatePDF";
import {Logger} from "../../lib/logger";
import type {reportsOrderReform} from "../orders/reportsOrders.response";

type ReportOrder = NonNullable<ReturnType<typeof reportsOrderReform>>;

const receiptCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const METHOD_LABEL: Record<ReportReceiveMethod, string> = {
  RECEIVING_AGENT: "عن طريق مندوب الاستلام",
  COMPANY_OFFICE: "من مقر الشركة",
};

const draftMessage = (
  request: RequestPdfInput["request"],
  storesCount: number,
) => {
  const date = request.createdAt.toLocaleDateString("en-GB");
  if (request.status === "APPROVED") {
    return `تمت الموافقة على طلب الحساب — الكشف الرسمي رقم ${request.reportIds.join("، ")}`;
  }
  if (request.status === "REJECTED")
    return `تم رفض طلب الحساب المقدم بتاريخ ${date}`;
  if (request.status === "CANCELLED")
    return `ألغى العميل طلب الحساب المقدم بتاريخ ${date}`;
  const perStore =
    storesCount > 1 ? ` — سيُنشأ كشف لكل صفحة (${storesCount})` : "";
  return `طلب حساب بتاريخ ${date} — مسودة للمراجعة وليست كشفاً نهائياً، يُنشأ الكشف بعد موافقة الشركة${perStore}`;
};

export interface RequestPdfInput {
  request: {
    id: number;
    status: ReportRequestStatus;
    receiveMethod: ReportReceiveMethod;
    createdAt: Date;
    reportIds: number[];
  };
  company: {name: string; logo: string};
  client: {name: string; branchId: number | null};
  storeNames: string[];
  orders: ReportOrder[];
  /** Open loans that the report would deduct (pending requests only). */
  loansTotal: number;
}

/**
 * طلب حساب preview: the delivered client report template filled with the request's
 * orders, marked as a draft. Nothing is saved or uploaded.
 */
export const generateRequestReportPdf = async ({
  request,
  company,
  client,
  storeNames,
  orders,
  loansTotal,
}: RequestPdfInput) => {
  const STATIC_DIR =
    process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "build/static")
      : path.join(process.cwd(), "src/static");

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
    } else {
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
    if (!receiptA && !receiptB) return 0;
    if (!receiptA) return 1;
    if (!receiptB) return -1;
    return receiptCollator.compare(receiptA, receiptB);
  });

  const reportData = {
    id: request.id,
    type: "CLIENT",
    createdAt: request.createdAt,
    company,
    createdBy: {name: client.name},
    clientReport: {
      secondaryType: "DELIVERED",
      client: {name: client.name},
      store: {name: storeNames.join("، ")},
      branch: client.branchId ? {id: client.branchId} : null,
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
      fs.readFile(path.join(STATIC_DIR, "templates/clientReport.hbs"), "utf8"),
      fs.readFile(path.join(STATIC_DIR, "styles/reportStyle.css"), "utf8"),
    ]);
    const html = await generateHTML(template, {reportData, orders: sorted});
    return await generatePDF(html, css);
  } catch (error) {
    Logger.error(error);
    throw new AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
  }
};
