"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderSelectApiKey = void 0;
exports.orderSelectApiKey = {
    id: true,
    totalCost: true,
    paidAmount: true,
    deliveryCost: true,
    clientNet: true,
    printed: true,
    receiptNumber: true,
    quantity: true,
    weight: true,
    recipientName: true,
    recipientPhones: true,
    recipientAddress: true,
    clientNotes: true,
    details: true,
    status: true,
    secondaryStatus: true,
    confirmed: true,
    deliveryType: true,
    deliveryDate: true,
    createdAt: true,
    updatedAt: true,
    governorate: true,
    location: {
        select: {
            id: true,
            name: true,
        },
    },
    store: {
        select: {
            id: true,
            name: true,
        },
    },
    companyReport: {
        where: {
            report: {
                deleted: false,
            },
        },
        select: {
            id: true,
            secondaryType: true,
            companyId: true,
            report: {
                select: {
                    url: true,
                    deleted: true,
                },
            },
        },
    },
    deleted: true,
    deletedAt: true,
    deletedBy: {
        select: {
            id: true,
            name: true,
        },
    },
};
//# sourceMappingURL=orders.response.js.map