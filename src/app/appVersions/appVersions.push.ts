import {Logger} from "../../lib/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo accepts at most 100 messages per request.
const BATCH_SIZE = 100;

interface BroadcastMessage {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/**
 * Sends the same push to many Expo tokens in batches of 100.
 * Push only (no Notification rows), the update isn't tied to an order.
 */
export const broadcastPush = async (
  tokens: string[],
  message: BroadcastMessage,
) => {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            sound: "default",
            title: message.title,
            body: message.body,
            data: message.data,
          })),
        ),
      });
      const result = (await response.json()) as {
        data?: {status: "ok" | "error"}[];
      };
      const tickets = result.data ?? [];
      const ok = tickets.filter((ticket) => ticket.status === "ok").length;
      sent += ok;
      failed += batch.length - ok;
    } catch (error) {
      failed += batch.length;
      Logger.error("App update push batch failed", error);
    }
  }

  Logger.info(
    `App update push finished: ${sent} sent, ${failed} failed, ${tokens.length} tokens`,
  );
  return {sent, failed};
};
