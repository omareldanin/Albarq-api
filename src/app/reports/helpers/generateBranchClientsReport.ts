import fs from "node:fs/promises";
import path from "node:path";
import {AppError} from "../../../lib/AppError";
import {generateHTML} from "../../../lib/generateHTML";
import {generatePDF} from "../../../lib/generatePDF";
import {Logger} from "../../../lib/logger";
import type {reportReform} from "../reports.responses";
// import {uploadPdfToSpaces} from "../../../lib/uploadPdfToSpaces";
// import {prisma} from "../../../database/db";

export const generateBranchClientsReport = async (
  reportData: ReturnType<typeof reportReform>,
  clients: {
    name: string | undefined;
    clientNet: number | null;
    count: number;
  }[],
) => {
  const STATIC_DIR =
    process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "build/static")
      : path.join(process.cwd(), "src/static");

  try {
    let templatePath = "";
    templatePath = path.join(STATIC_DIR, "templates/branchReportClients.hbs");

    const template = await fs.readFile(templatePath, "utf8");
    const css = await fs.readFile(
      path.join(STATIC_DIR, "styles/reportStyle.css"),
      "utf8",
    );

    const html = await generateHTML(template, {reportData, clients});

    const pdf = await generatePDF(html, css);

    // const pdfUrl = await uploadPdfToSpaces(pdf, reportData?.id!!);

    return pdf;
  } catch (error) {
    Logger.error(error);
    throw new AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
  }
};
