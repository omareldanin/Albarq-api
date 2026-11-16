import {AppPlatform} from "@prisma/client";
import {z} from "zod";

/** Compares dotted versions numerically: "2.10.0" > "2.9.3". */
export const compareVersions = (a: string, b: string) => {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

const versionSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+){0,3}$/, "صيغة الإصدار غير صحيحة، مثال: 2.3.1");

// Accepts "ios" / "IOS" / "android" / "ANDROID"
const platformSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.nativeEnum(AppPlatform));

export const AppVersionQuerySchema = z.object({
  platform: platformSchema.optional(),
});

export const AppVersionUpsertSchema = z
  .object({
    platform: platformSchema,
    latestVersion: versionSchema,
    // Below this the app shows a forced (non-dismissible) update dialog.
    minVersion: versionSchema.optional(),
    // e.g. https://apps.apple.com/app/id123456789
    //      https://play.google.com/store/apps/details?id=com.delivery.iq
    storeUrl: z.string().trim().url().optional(),
    releaseNotes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (data) =>
      !data.minVersion ||
      compareVersions(data.minVersion, data.latestVersion) <= 0,
    {
      message: "الحد الأدنى للإصدار يجب ألا يتجاوز آخر إصدار",
      path: ["minVersion"],
    },
  );

export const AppVersionNotifySchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    content: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

export type AppVersionUpsertType = z.infer<typeof AppVersionUpsertSchema>;
export type AppVersionNotifyType = z.infer<typeof AppVersionNotifySchema>;
