import type { Prisma } from "@prisma/client";

export const clientReceiptSelect={
    id:true,
    receiptNumber:true,
    storeId:true,
    branchId:true,
    store:{
        select:{
            name:true,
            client:{
                select:{
                    id:true,
                    user:{
                        select:{
                            name:true,
                            phone:true
                        }
                    },
                    company:{
                        select:{
                            id:true,
                            logo:true
                        }
                    },
                }
            }
        }
    },
    branch:{
        select:{
            name:true
        }
    }
} satisfies Prisma.ClientOrderReceiptSelect

export const receiptReform = (
    receipt: Prisma.ClientOrderReceiptGetPayload<{
        select: typeof clientReceiptSelect;
    }> | null
) => {
    if (!receipt) {
        return null;
    }
    const receiptReformed = {
        ...receipt,
        // TODO
        client: {
            name: receipt.store.client.user.name,
            phone: receipt.store.client.user.phone,
            companyLogo:receipt.store.client.company.logo,
            companyId:receipt.store.client.company.id
        },
        
    };
    return receiptReformed;
};