"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventDuplicateRequests = preventDuplicateRequests;
const requestCache = new Map();
const TIMEOUT = 5000; // milliseconds
function preventDuplicateRequests(req, res, next) {
    const user = res.locals.user;
    const key = `${user.id}:${req.originalUrl}:${JSON.stringify(req.body)}`;
    const now = Date.now();
    const lastRequestTime = requestCache.get(key);
    if (lastRequestTime && now - lastRequestTime < TIMEOUT) {
        return res
            .status(429)
            .json({ error: "Please wait before sending the same request again." });
    }
    requestCache.set(key, now);
    // Optional: auto-clean to prevent memory leak
    setTimeout(() => requestCache.delete(key), TIMEOUT);
    next();
}
//# sourceMappingURL=preventDuplicateRequests.js.map