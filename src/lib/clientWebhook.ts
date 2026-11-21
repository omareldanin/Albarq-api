import {OrderStatus} from "@prisma/client";
import dns from "node:dns/promises";
import net from "node:net";
import {prisma} from "../database/db";

export interface StatusMapping {
  internal: OrderStatus;
  external: string;
}

export interface WebhookPayload {
  receiptNumber: string;
  status: string;
  note?: string;
  test?: boolean;
}

export interface WebhookResult {
  ok: boolean;
  status?: number;
  durationMs?: number;
  error?: string;
}

const WEBHOOK_TIMEOUT_MS = 10_000;

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved ranges. */
const isNonPublicAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isNonPublicAddress(mapped[1]);
    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("ff")
    );
  }
  return true;
};

/**
 * Clients choose their own webhook URL, and our server calls it.
 * Only allow public https endpoints so the URL can't reach our internal network.
 */
export const checkWebhookUrl = async (
  raw: string,
  options: {requireHttps?: boolean} = {requireHttps: true},
): Promise<{ok: true; url: URL} | {ok: false; reason: string}> => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {ok: false, reason: "رابط الـ Webhook غير صالح"};
  }
  const allowed = options.requireHttps ? ["https:"] : ["https:", "http:"];
  if (!allowed.includes(url.protocol)) {
    return {ok: false, reason: "يجب أن يبدأ رابط الـ Webhook بـ https://"};
  }
  if (url.username || url.password) {
    return {ok: false, reason: "لا يمكن وضع اسم مستخدم أو كلمة مرور داخل الرابط"};
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return {ok: false, reason: "لا يمكن استخدام عنوان داخلي"};
  }
  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, {all: true})).map((entry) => entry.address);
    } catch {
      return {ok: false, reason: "تعذر العثور على النطاق في الرابط"};
    }
  }
  if (!addresses.length || addresses.some(isNonPublicAddress)) {
    return {ok: false, reason: "لا يمكن استخدام عنوان داخلي"};
  }
  return {ok: true, url};
};

/** One POST to the client's endpoint. Never throws. */
export const postClientWebhook = async (params: {
  url: string;
  token?: string | null;
  payload: WebhookPayload;
}): Promise<WebhookResult> => {
  // New URLs must be https (checked on save). When sending, still block internal
  // addresses (DNS may change later) but keep older http webhooks working.
  const check = await checkWebhookUrl(params.url, {requireHttps: false});
  if (!check.ok) return {ok: false, error: check.reason};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(check.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Albarq-Webhook/1.0",
        ...(params.token && {"x-api-key": params.token}),
      },
      body: JSON.stringify(params.payload),
      signal: controller.signal,
      // Don't follow redirects: they could point somewhere we wouldn't allow.
      redirect: "manual",
    });
    return {ok: res.ok, status: res.status, durationMs: Date.now() - started};
  } catch (err) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: timedOut ? "انتهت المهلة (10 ثوانٍ) دون رد" : "تعذر الاتصال بالرابط",
    };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Notify a client's external system that an order's status changed.
 * Fire-and-forget: never blocks or fails the caller.
 */
export const notifyClientWebhook = async (params: {
  clientId: number;
  receiptNumber: string;
  status: OrderStatus;
  note?: string;
}) => {
  const {clientId, receiptNumber, status, note} = params;

  try {
    const client = await prisma.client.findUnique({
      where: {id: clientId},
      select: {webhookUrl: true, status: true, token: true},
    });

    if (!client?.webhookUrl) return;

    const mappings = (client.status as unknown as StatusMapping[]) ?? [];
    const mapped = mappings.find((m) => m.internal === status);

    // client doesn't care about this status
    if (!mapped) return;

    const result = await postClientWebhook({
      url: client.webhookUrl,
      token: client.token,
      payload: {
        receiptNumber,
        status: mapped.external,
        ...(note && {note}),
      },
    });

    if (!result.ok) {
      console.error(
        `[webhook] ${client.webhookUrl} failed for ${receiptNumber}: ${result.status ?? result.error}`,
      );
    }
  } catch (err) {
    // never let a client's broken endpoint break our flow
    console.error("[webhook] failed:", err);
  }
};
