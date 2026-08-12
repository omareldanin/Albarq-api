"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPostponedDateId = toPostponedDateId;
exports.sendStatusUpdateToJenni = sendStatusUpdateToJenni;
exports.updateExternalOrderStatus = updateExternalOrderStatus;
const AppError_1 = require("../lib/AppError");
const externalStatus_1 = require("./externalStatus");
const tokenCache = new Map();
const cacheKey = (url, username) => `${url}::${username}`;
async function loginToJenni(url, username, password) {
    const { gotScraping } = await import("got-scraping");
    try {
        const { body } = (await gotScraping.post(`${url}/v2/auth/login`, {
            json: { username, password },
            responseType: "json",
        }));
        tokenCache.set(cacheKey(url, username), {
            token: body.token,
            expiry: Date.now() + body.expires_in * 1000,
        });
        return body.token;
    }
    catch (error) {
        throw new AppError_1.AppError(`فشل تسجيل الدخول إلى النظام الخارجي: ${error?.response?.data?.message ?? error?.message ?? "unknown"}`, 502);
    }
}
async function ensureValidToken(url, username, password) {
    const key = cacheKey(url, username);
    const cached = tokenCache.get(key);
    // refresh 5 minutes before expiry
    if (cached && Date.now() < cached.expiry - 5 * 60 * 1000) {
        return cached.token;
    }
    return loginToJenni(url, username, password);
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
async function sendStatusUpdateToJenni(shipmentId, url, actionCode, details = {}, username, password, registrationText) {
    let token = await ensureValidToken(url, username, password);
    const payload = {
        system_code: registrationText,
        updates: [
            {
                shipment_id: shipmentId,
                action_code: actionCode,
                ...stripEmpty(details),
            },
        ],
    };
    const post = async (bearer) => {
        const { gotScraping } = await import("got-scraping");
        const { body } = await gotScraping.post(`${url}/v2/push/update-status`, {
            json: payload,
            responseType: "json",
            headers: {
                Authorization: `${bearer}`,
                "Content-Type": "application/json",
            },
        });
        return body;
    };
    try {
        return await post(token);
    }
    catch (error) {
        // token may have expired mid-flight — re-login once and retry
        if (error?.response?.statusCode === 401 ||
            error?.response?.status === 401) {
            tokenCache.delete(cacheKey(url, username));
            token = await loginToJenni(url, username, password);
            return await post(token);
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
async function updateExternalOrderStatus(shipmentId, url, username, password, registrationText, status, details = {}) {
    const actionCode = (0, externalStatus_1.toExternalAction)(status);
    if (!actionCode) {
        // REGISTERED / CHANGE_ADDRESS — nothing to push
        return null;
    }
    return sendStatusUpdateToJenni(+shipmentId, url, actionCode, details, username, password, registrationText);
}
//# sourceMappingURL=updateGeniStatus.js.map