// // import { generateMock } from "@anatine/zod-mock";
import {generateSchema} from "@anatine/zod-openapi";
import {Governorate} from "@prisma/client";
import {z} from "zod";

export const BranchCreateSchema = z.object({
  name: z.string().min(3),
  parentBranchId: z.number().optional(),
  governorate: z.nativeEnum(Governorate),
  forwardedDeliveryCosts: z
    .preprocess(
      (data) => {
        if (typeof data === "string") {
          return JSON.parse(data);
        }
        return data;
      },
      z.array(
        z.object({
          governorate: z.nativeEnum(Governorate),
          cost: z.coerce.number().max(100000).default(0),
        }),
      ),
    )
    .optional(),
  receivingDeliveryCosts: z
    .preprocess(
      (data) => {
        if (typeof data === "string") {
          return JSON.parse(data);
        }
        return data;
      },
      z.array(
        z.object({
          governorate: z.nativeEnum(Governorate),
          cost: z.coerce.number().max(100000).default(0),
        }),
      ),
    )
    .optional(),
});

export type BranchCreateType = z.infer<typeof BranchCreateSchema>;

export const BranchCreateOpenAPISchema = generateSchema(BranchCreateSchema);

// export const BranchCreateMock = generateMock(BranchCreateSchema);

export const BranchUpdateSchema = BranchCreateSchema.partial();

export type BranchUpdateType = z.infer<typeof BranchUpdateSchema>;

export const BranchUpdateOpenAPISchema = generateSchema(BranchUpdateSchema);

// export const BranchUpdateMock = generateMock(BranchUpdateSchema);
