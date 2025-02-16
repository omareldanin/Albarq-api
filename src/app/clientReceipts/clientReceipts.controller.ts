import { catchAsync } from "../../lib/catchAsync";
import { clientReceiptCreateSchema, clientReceiptCreateType } from "./clientReceipts.dto";
import { clientReceiptsRepository } from "./clientReceipts.repository";
import { AppError } from "../../lib/AppError";
import { generateReceipts } from "./helpers/generateReceipts";

const clientReceiptRepository=new clientReceiptsRepository()

export class ClientReceiptController{
    createReceipts=catchAsync(async (req,res)=>{
        let receipts : clientReceiptCreateType[]

        receipts =  req.body.map(((receipt: unknown) => clientReceiptCreateSchema.parse(receipt)))

        const createdReceipts=[]

        for(const receipt of receipts){
            const createdReceipt=await clientReceiptRepository.createClientReceipt({
                storeId:receipt.storeId,
                receiptData:receipt
            })

            if (!createdReceipt) {
                throw new AppError("Failed to create order", 500);
            }

            createdReceipts.push(createdReceipt)
        }
        const pdf = await generateReceipts(createdReceipts)
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        // Set headers for a PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');
        console.log('PDF size:', pdfBuffer.length);

        res.send(pdfBuffer);
    })
}