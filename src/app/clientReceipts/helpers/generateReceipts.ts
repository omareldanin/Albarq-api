import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {AppError} from "../../../lib/AppError";
import {generateHTML} from "../../../lib/generateHTML";
import {generatePDF} from "./generatePDF";
import {Logger} from "../../../lib/logger";
import {receiptReform} from "../clientReceipts.responses";

type Receipt = NonNullable<ReturnType<typeof receiptReform>>;

async function optimizeLogo(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Logo download failed: ${response.status}`);
  }

  const original = Buffer.from(await response.arrayBuffer());

  const optimized = await sharp(original)
    .resize({
      width: 220,
      withoutEnlargement: true,
    })
    .png({
      palette: true,
      colors: 128,
      compressionLevel: 9,
    })
    .toBuffer();

  return `data:image/png;base64,${optimized.toString("base64")}`;
}

export const generateReceipts = async (
  receipts: ReturnType<typeof receiptReform>[],
) => {
  try {
    // Each distinct logo is downloaded and resized once per batch.
    const logoCache = new Map<string, string>();
    const preparedReceipts: Receipt[] = [];

    for (const receipt of receipts) {
      if (!receipt) continue;

      let companyLogo = receipt.branch.companyLogo;

      if (companyLogo) {
        let optimizedLogo = logoCache.get(companyLogo);

        if (!optimizedLogo) {
          optimizedLogo = await optimizeLogo(companyLogo);
          logoCache.set(companyLogo, optimizedLogo);
        }

        companyLogo = optimizedLogo;
      }

      preparedReceipts.push({
        ...receipt,
        branch: {
          ...receipt.branch,
          companyLogo,
        },
      });
    }

    const templatePath = path.join(
      __dirname,
      "../../../static/templates/clientReceipt.hbs",
    );

    const template = await fs.readFile(templatePath, "utf8");

    const html = await generateHTML(template, {
      receipts: preparedReceipts,
    });

    return await generatePDF(html, "", {landscape: false});
  } catch (error) {
    Logger.error(error);
    throw new AppError("حدث خطأ أثناء انشاء ملف ال pdf", 500);
  }
};
