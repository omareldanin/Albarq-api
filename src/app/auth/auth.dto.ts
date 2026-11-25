// import { generateMock } from "@anatine/zod-mock";
import { generateSchema } from "@anatine/zod-openapi";
import { z } from "zod";

export const UserSigninSchema = z.object({
    username: z.string(),
    password: z.string(),
    fcm: z.string().optional(),
    ip: z.string().optional(),
    location: z.string().optional(),
    device: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional()
    // type: z.nativeEnum(LoginType).optional()
});

export type UserSigninType = z.infer<typeof UserSigninSchema>;

export const UserSigninOpenAPISchema = generateSchema(UserSigninSchema);

// export const UserSigninMock = generateMock(UserSigninSchema);

export const RefreshTokenSchema = z.object({
    refreshToken: z.string()
});

export type RefreshTokenType = z.infer<typeof RefreshTokenSchema>;

// export const RefreshTokenOpenAPISchema = generateSchema(RefreshTokenSchema);

// export const RefreshTokenMock = generateMock(RefreshTokenSchema);

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
    newPassword: z
      .string()
      .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
      .max(100),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
    path: ["newPassword"],
  });
