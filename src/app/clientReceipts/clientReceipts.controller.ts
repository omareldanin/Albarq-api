import { catchAsync } from "../../lib/catchAsync";
import {
  clientReceiptCreateSchema,
  clientReceiptCreateType,
} from "./clientReceipts.dto";
import { clientReceiptsRepository } from "./clientReceipts.repository";
import { AppError } from "../../lib/AppError";
import { generateReceipts } from "./helpers/generateReceipts";
import { prisma } from "../../database/db";

const clientReceiptRepository = new clientReceiptsRepository();

export class ClientReceiptController {
  generateRandomId() {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Gaza" })
    );

    // Format date as YYMMDD
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${month}${day}`;
    const randomPart = Math.floor(10000 + Math.random() * 90000);

    return `${datePart}${randomPart}`;
  }
  createReceipts = catchAsync(async (req, res) => {
    let receipts: clientReceiptCreateType[];

    receipts = req.body.map((receipt: unknown) =>
      clientReceiptCreateSchema.parse(receipt)
    );

    const createdReceipts = [];

    for (const receipt of receipts) {
      let isUnique = false;
      let receiptId = this.generateRandomId();

      while (!isUnique) {
        receiptId = this.generateRandomId(); // Assuming generateRandomId is in scope

        const exists = await prisma.clientOrderReceipt.count({
          where: {
            receiptNumber: receiptId,
          },
        });

        if (exists === 0) {
          isUnique = true;
        }
      }

      const createdReceipt = await clientReceiptRepository.createClientReceipt({
        storeId: receipt.storeId,
        receiptData: {
          storeId: receipt.storeId,
          branchId: receipt.branchId,
          receiptNumber: receiptId,
        },
      });

      if (!createdReceipt) {
        throw new AppError("Failed to create order", 500);
      }

      createdReceipts.push(createdReceipt);
    }
    const pdf = await generateReceipts(createdReceipts);
    const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    // Set headers for a PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=generated.pdf");
    console.log("PDF size:", pdfBuffer.length);

    res.send(pdfBuffer);
  });
}
