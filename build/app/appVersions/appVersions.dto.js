"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionNotifySchema = exports.AppVersionUpsertSchema = exports.AppVersionQuerySchema = exports.compareVersions = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
/** Compares dotted versions numerically: "2.10.0" > "2.9.3". */
const compareVersions = (a, b) => {
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0)
            return diff > 0 ? 1 : -1;
    }
    return 0;
};
exports.compareVersions = compareVersions;
const versionSchema = zod_1.z
    .string()
    .trim()
    .regex(/^\d+(\.\d+){0,3}$/, "صيغة الإصدار غير صحيحة، مثال: 2.3.1");
// Accepts "ios" / "IOS" / "android" / "ANDROID"
const platformSchema = zod_1.z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(zod_1.z.nativeEnum(client_1.AppPlatform));
exports.AppVersionQuerySchema = zod_1.z.object({
    platform: platformSchema.optional(),
});
exports.AppVersionUpsertSchema = zod_1.z
    .object({
    platform: platformSchema,
    latestVersion: versionSchema,
    // Below this the app shows a forced (non-dismissible) update dialog.
    minVersion: versionSchema.optional(),
    // e.g. https://apps.apple.com/app/id123456789
    //      https://play.google.com/store/apps/details?id=com.delivery.iq
    storeUrl: zod_1.z.string().trim().url().optional(),
    releaseNotes: zod_1.z.string().trim().max(1000).optional(),
})
    .strict()
    .refine((data) => !data.minVersion ||
    (0, exports.compareVersions)(data.minVersion, data.latestVersion) <= 0, {
    message: "الحد الأدنى للإصدار يجب ألا يتجاوز آخر إصدار",
    path: ["minVersion"],
});
exports.AppVersionNotifySchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(100).optional(),
    content: zod_1.z.string().trim().min(1).max(300).optional(),
})
    .strict();
//# sourceMappingURL=appVersions.dto.js.map