import {catchAsync} from "../../lib/catchAsync";
import {
  clientReceiptCreateSchema,
  clientReceiptCreateType,
} from "./clientReceipts.dto";
import {clientReceiptsRepository} from "./clientReceipts.repository";
import {AppError} from "../../lib/AppError";
import {generateReceipts} from "./helpers/generateReceipts";
import {prisma} from "../../database/db";
import {loggedInUserType} from "../../types/user";

const clientReceiptRepository = new clientReceiptsRepository();

export class ClientReceiptController {
  generateRandomId() {
    const now = new Date(
      new Date().toLocaleString("en-US", {timeZone: "Asia/Gaza"})
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
    const user = res.locals.user as loggedInUserType;
    receipts = req.body.map((receipt: unknown) =>
      clientReceiptCreateSchema.parse(receipt)
    );

    const createdReceipts = [];

    for (const receipt of receipts) {
      let isUnique = false;
      let receiptId = this.generateRandomId();
      let storeId: undefined | number;
      let branchId: undefined | number;
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

      if (receipt.storeId) {
        const store = await prisma.store.findUnique({
          where: {
            id: receipt.storeId,
          },
          select: {
            client: {
              select: {
                id: true,
                branchId: true,
              },
            },
          },
        });
        if (receipt.branchId && store?.client.branchId !== receipt.branchId) {
          throw new AppError("هذا العميل لا ينتمي لهذا الفرع", 400);
        }
        storeId = receipt.storeId;
        branchId = store?.client.branchId || undefined;
      }
      if (receipt.branchId && !receipt.storeId) {
        branchId = receipt.branchId;
      }

      const createdReceipt = await clientReceiptRepository.createClientReceipt({
        storeId: receipt.storeId,
        receiptData: {
          storeId: storeId,
          branchId: branchId,
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
