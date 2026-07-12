"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyUpdateOpenAPISchema = exports.CompanyUpdateSchema = exports.CompanyCreateOpenAPISchema = exports.CompanyCreateSchema = void 0;
// // import { generateMock } from "@anatine/zod-mock";
const zod_openapi_1 = require("@anatine/zod-openapi");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
/*******************************************************************************
 * Empty string needs to be converted to null
 *******************************************************************************/
exports.CompanyCreateSchema = zod_1.z.preprocess((data) => {
    return {
        // @ts-expect-error
        companyData: JSON.parse(data.companyData),
        // @ts-expect-error
        companyManager: JSON.parse(data.companyManager),
    };
}, zod_1.z.object({
    companyData: zod_1.z.object({
        name: zod_1.z.string().min(3),
        phone: zod_1.z.string().min(6),
        companyID: zod_1.z.string().optional(),
        activeProfit: zod_1.z.preprocess((val) => {
            if (val === "true")
                return true;
            if (val === "false")
                return false;
            return val;
        }, zod_1.z.boolean().optional()),
        isExternal: zod_1.z.preprocess((val) => {
            if (val === "true")
                return true;
            if (val === "false")
                return false;
            return val;
        }, zod_1.z.boolean().optional()),
        logo: zod_1.z.preprocess((_data) => {
            return "";
        }, zod_1.z.string().optional()),
        registrationText: zod_1.z.preprocess((data) => (data === "" ? undefined : data), zod_1.z.string().optional()),
        governoratesDeliveryCosts: zod_1.z
            .preprocess((data) => {
            if (typeof data === "string") {
                return JSON.parse(data);
            }
            return data;
        }, zod_1.z.array(zod_1.z.object({
            governorate: zod_1.z.nativeEnum(client_1.Governorate),
            cost: zod_1.z.coerce.number().max(100000).default(0),
        })))
            .optional(),
    }),
    companyManager: zod_1.z.object({
        username: zod_1.z.string().min(3),
        name: zod_1.z.string().min(3),
        password: zod_1.z.string().min(6),
        phone: zod_1.z.string().min(6),
        avatar: zod_1.z.preprocess((_data) => {
            return "";
        }, zod_1.z.string().optional()),
    }),
}));
exports.CompanyCreateOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.CompanyCreateSchema);
// export const CompanyCreateMock = generateMock(CompanyCreateSchema);
//---------------------------------------------------------------
exports.CompanyUpdateSchema = zod_1.z
    .object({
    companyManagerID: zod_1.z.number().optional(),
    name: zod_1.z.string().min(3),
    phone: zod_1.z.string().min(6),
    logo: zod_1.z.string().optional(),
    registrationText: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6).optional(),
    companyID: zod_1.z.string().optional(),
    activeProfit: zod_1.z.preprocess((val) => {
        if (val === "true")
            return true;
        if (val === "false")
            return false;
        return val;
    }, zod_1.z.boolean().optional()),
    isExternal: zod_1.z.preprocess((val) => {
        if (val === "true")
            return true;
        if (val === "false")
            return false;
        return val;
    }, zod_1.z.boolean().optional()),
    governoratesDeliveryCosts: zod_1.z
        .preprocess((data) => {
        if (typeof data === "string") {
            return JSON.parse(data);
        }
        return data;
    }, zod_1.z.array(zod_1.z.object({
        governorate: zod_1.z.nativeEnum(client_1.Governorate),
        cost: zod_1.z.coerce.number().max(100000).default(0),
    })))
        .optional(),
})
    .partial();
exports.CompanyUpdateOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.CompanyUpdateSchema);
// export const CompanyUpdateMock = generateMock(CompanyUpdateSchema);
//# sourceMappingURL=companies.dto.js.map