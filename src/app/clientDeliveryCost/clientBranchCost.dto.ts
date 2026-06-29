import {z} from "zod";

export const ClientBranchCostUpsertSchema = z.object({
  branchID: z.number().int().positive(),
  deliveryAgentProfit: z.number().int().min(0).optional().default(0),
  mainBranchProfit: z.number().int().min(0).optional().default(0),
  forwardedBranchProfit: z.number().int().min(0).optional().default(0),
  receivingBranchProfit: z.number().int().min(0).optional().default(0),
  activeProfit: z.boolean().optional().default(false),
});

export type ClientBranchCostUpsertType = z.infer<
  typeof ClientBranchCostUpsertSchema
>;
