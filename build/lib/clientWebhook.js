"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyClientWebhook = exports.postClientWebhook = exports.checkWebhookUrl = void 0;
const promises_1 = __importDefault(require("node:dns/promises"));
const node_net_1 = __importDefault(require("node:net"));
const db_1 = require("../database/db");
const WEBHOOK_TIMEOUT_MS = 10_000;
/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved ranges. */
const isNonPublicAddress = (ip) => {
    if (node_net_1.default.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);
        return (a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a >= 224);
    }
    if (node_net_1.default.isIPv6(ip)) {
        const value = ip.toLowerCase();
        const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped)
            return isNonPublicAddress(mapped[1]);
        return (value === "::" ||
            value === "::1" ||
            value.startsWith("fc") ||
            value.startsWith("fd") ||
            value.startsWith("fe8") ||
            value.startsWith("fe9") ||
            value.startsWith("fea") ||
            value.startsWith("feb") ||
            value.startsWith("ff"));
    }
    return true;
};
/**
 * Clients choose their own webhook URL, and our server calls it.
 * Only allow public https endpoints so the URL can't reach our internal network.
 */
const checkWebhookUrl = async (raw, options = { requireHttps: true }) => {
    let url;
    try {
        url = new URL(raw.trim());
    }
    catch {
        return { ok: false, reason: "رابط الـ Webhook غير صالح" };
    }
    const allowed = options.requireHttps ? ["https:"] : ["https:", "http:"];
    if (!allowed.includes(url.protocol)) {
        return { ok: false, reason: "يجب أن يبدأ رابط الـ Webhook بـ https://" };
    }
    if (url.username || url.password) {
        return { ok: false, reason: "لا يمكن وضع اسم مستخدم أو كلمة مرور داخل الرابط" };
    }
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal")) {
        return { ok: false, reason: "لا يمكن استخدام عنوان داخلي" };
    }
    let addresses;
    if (node_net_1.default.isIP(host)) {
        addresses = [host];
    }
    else {
        try {
            addresses = (await promises_1.default.lookup(host, { all: true })).map((entry) => entry.address);
        }
        catch {
            return { ok: false, reason: "تعذر العثور على النطاق في الرابط" };
        }
    }
    if (!addresses.length || addresses.some(isNonPublicAddress)) {
        return { ok: false, reason: "لا يمكن استخدام عنوان داخلي" };
    }
    return { ok: true, url };
};
exports.checkWebhookUrl = checkWebhookUrl;
/** One POST to the client's endpoint. Never throws. */
const postClientWebhook = async (params) => {
    // New URLs must be https (checked on save). When sending, still block internal
    // addresses (DNS may change later) but keep older http webhooks working.
    const check = await (0, exports.checkWebhookUrl)(params.url, { requireHttps: false });
    if (!check.ok)
        return { ok: false, error: check.reason };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const started = Date.now();
    try {
        const res = await fetch(check.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Albarq-Webhook/1.0",
                ...(params.token && { "x-api-key": params.token }),
            },
            body: JSON.stringify(params.payload),
            signal: controller.signal,
            // Don't follow redirects: they could point somewhere we wouldn't allow.
            redirect: "manual",
        });
        return { ok: res.ok, status: res.status, durationMs: Date.now() - started };
    }
    catch (err) {
        const timedOut = controller.signal.aborted;
        return {
            ok: false,
            durationMs: Date.now() - started,
            error: timedOut ? "انتهت المهلة (10 ثوانٍ) دون رد" : "تعذر الاتصال بالرابط",
        };
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.postClientWebhook = postClientWebhook;
/**
 * Notify a client's external system that an order's status changed.
 * Fire-and-forget: never blocks or fails the caller.
 */
const notifyClientWebhook = async (params) => {
    const { clientId, receiptNumber, status, note } = params;
    try {
        const client = await db_1.prisma.client.findUnique({
            where: { id: clientId },
            select: { webhookUrl: true, status: true, token: true },
        });
        if (!client?.webhookUrl)
            return;
        const mappings = client.status ?? [];
        const mapped = mappings.find((m) => m.internal === status);
        // client doesn't care about this status
        if (!mapped)
            return;
        const result = await (0, exports.postClientWebhook)({
            url: client.webhookUrl,
            token: client.token,
            payload: {
                receiptNumber,
                status: mapped.external,
                ...(note && { note }),
            },
        });
        if (!result.ok) {
            console.error(`[webhook] ${client.webhookUrl} failed for ${receiptNumber}: ${result.status ?? result.error}`);
        }
    }
    catch (err) {
        // never let a client's broken endpoint break our flow
        console.error("[webhook] failed:", err);
    }
};
exports.notifyClientWebhook = notifyClientWebhook;
//# sourceMappingURL=clientWebhook.js.map