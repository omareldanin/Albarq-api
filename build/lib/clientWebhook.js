"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyClientWebhook = void 0;
const db_1 = require("../database/db");
/**
 * Notify a client's external system that an order's status changed.
 * Fire-and-forget: never blocks or fails the caller.
 */
const notifyClientWebhook = async (params) => {
    const { clientId, receiptNumber, status, note } = params;
    try {
        const client = await db_1.prisma.client.findUnique({
            where: { id: clientId },
            select: { webhookUrl: true, status: true },
        });
        if (!client?.webhookUrl)
            return;
        const mappings = client.status ?? [];
        const mapped = mappings.find((m) => m.internal === status);
        // client doesn't care about this status
        if (!mapped)
            return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(client.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                receiptNumber,
                status: mapped.external,
                ...(note && { note }),
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
            console.error(`[webhook] ${client.webhookUrl} returned ${res.status} for ${receiptNumber}`);
        }
    }
    catch (err) {
        // never let a client's broken endpoint break our flow
        console.error("[webhook] failed:", err);
    }
};
exports.notifyClientWebhook = notifyClientWebhook;
//# sourceMappingURL=clientWebhook.js.map