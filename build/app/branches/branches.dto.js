"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchUpdateOpenAPISchema = exports.BranchUpdateSchema = exports.BranchCreateOpenAPISchema = exports.BranchCreateSchema = void 0;
// // import { generateMock } from "@anatine/zod-mock";
const zod_openapi_1 = require("@anatine/zod-openapi");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.BranchCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    parentBranchId: zod_1.z.number().optional(),
    governorate: zod_1.z.nativeEnum(client_1.Governorate),
    forwardedDeliveryCosts: zod_1.z
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
    receivingDeliveryCosts: zod_1.z
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
});
exports.BranchCreateOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.BranchCreateSchema);
// export const BranchCreateMock = generateMock(BranchCreateSchema);
exports.BranchUpdateSchema = exports.BranchCreateSchema.partial();
exports.BranchUpdateOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.BranchUpdateSchema);
// export const BranchUpdateMock = generateMock(BranchUpdateSchema);
//# sourceMappingURL=branches.dto.js.map