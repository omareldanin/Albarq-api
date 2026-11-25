"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordSchema = exports.RefreshTokenSchema = exports.UserSigninOpenAPISchema = exports.UserSigninSchema = void 0;
// import { generateMock } from "@anatine/zod-mock";
const zod_openapi_1 = require("@anatine/zod-openapi");
const zod_1 = require("zod");
exports.UserSigninSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
    fcm: zod_1.z.string().optional(),
    ip: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    device: zod_1.z.string().optional(),
    platform: zod_1.z.string().optional(),
    browser: zod_1.z.string().optional()
    // type: z.nativeEnum(LoginType).optional()
});
exports.UserSigninOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.UserSigninSchema);
// export const UserSigninMock = generateMock(UserSigninSchema);
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string()
});
// export const RefreshTokenOpenAPISchema = generateSchema(RefreshTokenSchema);
// export const RefreshTokenMock = generateMock(RefreshTokenSchema);
exports.ChangePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, "أدخل كلمة المرور الحالية"),
    newPassword: zod_1.z
        .string()
        .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
        .max(100),
})
    .refine((d) => d.newPassword !== d.currentPassword, {
    message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
    path: ["newPassword"],
});
//# sourceMappingURL=auth.dto.js.map