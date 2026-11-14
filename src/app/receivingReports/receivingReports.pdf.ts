import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../lib/AppError";
import { generateHTML } from "../../lib/generateHTML";
import { generatePDF } from "../../lib/generatePDF";
import { Logger } from "../../lib/logger";

export const generateReceivingReportPDF = async (data: { report: object; orders: object[] }) => {
    try {
        const template = await fs.readFile(
            path.join(__dirname, "../../static/templates/receivingReport.hbs"),
            "utf8"
        );
        const css = await fs.readFile(path.join(__dirname, "../../static/styles/reportStyle.css"), "utf8");
        const html = await generateHTML(template, data);
        return await generatePDF(html, css);
    } catch (error) {
        Logger.error(error);
        throw new AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
    }
};
