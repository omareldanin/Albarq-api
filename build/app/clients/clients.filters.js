"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientListFilterSchema = void 0;
exports.clientListFilterWhere = clientListFilterWhere;
const zod_1 = require("zod");
exports.ClientListFilterSchema = zod_1.z.object({
    created_from: zod_1.z.string().date().optional(),
    created_to: zod_1.z.string().date().optional(),
    activeProfit: zod_1.z.enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
}).refine(({ created_from, created_to }) => !created_from || !created_to || created_from <= created_to, { message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", path: ["created_to"] });
function clientListFilterWhere(filters) {
    // Client accounts store their creation timestamp on User. Calendar dates
    // use Baghdad time, with an exclusive upper bound to include the entire end day.
    const from = filters.created_from
        ? new Date(`${filters.created_from}T00:00:00+03:00`)
        : undefined;
    const until = filters.created_to
        ? new Date(`${filters.created_to}T00:00:00+03:00`)
        : undefined;
    if (until)
        until.setUTCDate(until.getUTCDate() + 1);
    return {
        activeProfit: filters.activeProfit,
        user: from || until ? { createdAt: { gte: from, lt: until } } : undefined,
    };
}
//# sourceMappingURL=clients.filters.js.map