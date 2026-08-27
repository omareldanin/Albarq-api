import {OrderStatus} from "@prisma/client";
import {prisma} from "../database/db";

interface StatusMapping {
  internal: OrderStatus;
  external: string;
}

/**
 * Notify a client's external system that an order's status changed.
 * Fire-and-forget: never blocks or fails the caller.
 */
export const notifyClientWebhook = async (params: {
  clientId: number;
  receiptNumber: string;
  status: OrderStatus;
  token?: string;
  note?: string;
}) => {
  const {clientId, receiptNumber, status, note, token} = params;

  try {
    const client = await prisma.client.findUnique({
      where: {id: clientId},
      select: {webhookUrl: true, status: true},
    });

    if (!client?.webhookUrl) return;

    const mappings = (client.status as unknown as StatusMapping[]) ?? [];
    const mapped = mappings.find((m) => m.internal === status);

    // client doesn't care about this status
    if (!mapped) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(client.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && {"x-api-key": token}),
      },
      body: JSON.stringify({
        receiptNumber,
        status: mapped.external,
        ...(note && {note}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[webhook] ${client.webhookUrl} returned ${res.status} for ${receiptNumber}`,
      );
    }
  } catch (err) {
    // never let a client's broken endpoint break our flow
    console.error("[webhook] failed:", err);
  }
};
