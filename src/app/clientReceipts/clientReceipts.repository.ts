import {clientReceiptCreateType} from "./clientReceipts.dto";
import {prisma} from "../../database/db";
// import { AppError } from "../../lib/AppError";
import {clientReceiptSelect, receiptReform} from "./clientReceipts.responses";

export class clientReceiptsRepository {
  async createClientReceipt(data: {
    storeId: number | undefined;
    receiptData: clientReceiptCreateType;
  }) {
    const store = await prisma.store.findUnique({
      where: {
        id: data.storeId,
      },
      select: {
        id: true,
      },
    });

    // if (!store) {
    //   throw new AppError("العميل غير موجود", 400);
    // }

    const receiptData: any = {
      receiptNumber: data.receiptData.receiptNumber,
    };

    if (store?.id) {
      receiptData.store = {connect: {id: store.id}};
    }

    if (data.receiptData.branchId) {
      receiptData.branch = {connect: {id: data.receiptData.branchId}};
    }

    const createdReceipt = await prisma.clientOrderReceipt.create({
      data: receiptData,
      select: clientReceiptSelect,
    });

    return receiptReform(createdReceipt);
  }
}
