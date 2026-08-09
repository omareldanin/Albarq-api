"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPostponedDateId = toPostponedDateId;
exports.sendStatusUpdateToJenni = sendStatusUpdateToJenni;
exports.updateExternalOrderStatus = updateExternalOrderStatus;
const axios_1 = __importDefault(require("axios"));
const AppError_1 = require("../lib/AppError");
const externalStatus_1 = require("./externalStatus");
const JENNI_API_URL = process.env.JENNI_API_URL ?? "https://rover.jenni.systems/api";
const JENNI_USERNAME = process.env.JENNI_USERNAME ?? "";
const JENNI_PASSWORD = process.env.JENNI_PASSWORD ?? "";
const JENNI_SYSTEM_CODE = process.env.JENNI_SYSTEM_CODE ?? "";
// ── Token cache ────────────────────────────────────────────────
let authToken = null;
let tokenExpiry = 0;
async function loginToJenni(url) {
    const { gotScraping } = await import("got-scraping");
    try {
        const { body } = (await gotScraping.post(`${url}/v2/auth/login`, {
            json: { username: JENNI_USERNAME, password: JENNI_PASSWORD },
            responseType: "json",
        }));
        authToken = body.token;
        tokenExpiry = Date.now() + body.expires_in * 1000;
        return authToken;
    }
    catch (error) {
        console.log(error);
        throw new AppError_1.AppError(`فشل تسجيل الدخول إلى النظام الخارجي: ${error?.response?.data?.message ?? error?.message ?? "unknown"}`, 502);
    }
}
async function ensureValidToken(url) {
    // refresh 5 minutes before expiry
    if (!authToken || Date.now() > tokenExpiry - 5 * 60 * 1000) {
        await loginToJenni(url);
    }
}
const POSTPONED_DATE_ID_MAP = {
    "مؤجل غدا": 1, // tomorrow
    "مؤجل ليلا": 1, // tonight → treat as tomorrow (soonest bucket)
    "مؤجل لأكثر من يوم": 3, // more than a day → 3+ days
};
function toPostponedDateId(value) {
    if (!value)
        return undefined;
    return POSTPONED_DATE_ID_MAP[value];
}
/** Remove keys whose value is undefined (or null) so they aren't sent in the payload. */
function stripEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
}
// ── Core sender ────────────────────────────────────────────────
/**
 * Send a single status update to Jenni using an already-resolved action code.
 * Prefer `updateExternalOrderStatus` which maps from the internal OrderStatus.
 */
async function sendStatusUpdateToJenni(shipmentId, url, actionCode, details = {}) {
    await ensureValidToken(url);
    const payload = {
        system_code: JENNI_SYSTEM_CODE,
        updates: [
            {
                shipment_id: shipmentId,
                action_code: actionCode,
                ...stripEmpty(details),
            },
        ],
    };
    try {
        const { gotScraping } = await import("got-scraping");
        const { body } = await gotScraping.post(`${url}/v2/push/update-status`, {
            json: payload,
            responseType: "json",
            headers: {
                Authorization: `${authToken}`,
                "Content-Type": "application/json",
            },
        });
        return body;
    }
    catch (error) {
        // token may have expired mid-flight — retry once after re-login
        if (error?.response?.status === 401) {
            await loginToJenni(url);
            const { data } = await axios_1.default.post(`${JENNI_API_URL}/v2/push/update-status`, { ...payload }, {
                headers: {
                    Authorization: `${authToken}`,
                    "Content-Type": "application/json",
                },
            });
            return data;
        }
        throw new AppError_1.AppError(`فشل إرسال تحديث الحالة إلى النظام الخارجي: ${error?.response?.data?.message ?? error?.message ?? "unknown"}`, 502);
    }
}
// ── Public API (maps internal status -> external action) ───────
/**
 * Update an order's status in the external (Jenni) system.
 * @param shipmentId  the external shipment_id (stored on your order as receiptNumber)
 * @param status      the internal OrderStatus
 * @param details     extra fields required by some actions
 * @returns the external response, or null if this status has no external action
 */
async function updateExternalOrderStatus(shipmentId, url, status, details = {}) {
    const actionCode = (0, externalStatus_1.toExternalAction)(status);
    if (!actionCode) {
        // REGISTERED / CHANGE_ADDRESS — nothing to push
        return null;
    }
    return sendStatusUpdateToJenni(+shipmentId, url, actionCode, details);
}
//# sourceMappingURL=updateGeniStatus.js.map