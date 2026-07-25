import {z} from "zod";
import {TransactionType} from "@prisma/client";

export const TransactionCreateSchema = z.object({
  type: z.nativeEnum(TransactionType),
  for: z.string().min(1),
  employeeID: z.number().int().positive().optional(),
  reportID: z.number().int().positive().optional(),
  branchID: z.number().int().positive().optional(),
  paidAmount: z.number().optional().default(0),
  branchNet: z.number().optional().default(0),
  clientNet: z.number().optional().default(0),
  totalPaidAmount: z.number().optional().default(0),
  deliveryAgentNet: z.number().optional().default(0),
  forwardedBranchNet: z.number().optional().default(0),
  receivingBranchNet: z.number().optional().default(0),
  insideBranchNet: z.number().optional().default(0),
  approved: z.boolean().optional().default(false),
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial();

export type TransactionCreateType = z.infer<typeof TransactionCreateSchema>;
export type TransactionUpdateType = z.infer<typeof TransactionUpdateSchema>;
