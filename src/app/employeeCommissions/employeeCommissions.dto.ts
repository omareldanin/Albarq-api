import {z} from "zod";

export const EmployeeClientCommissionUpsertSchema = z.object({
  clientID: z.number().int().positive(),
  govOrderCost: z.number().min(0),
  baghdadOrderCost: z.number().min(0),
  active: z.boolean().optional().default(true),
});

export type EmployeeClientCommissionUpsertType = z.infer<
  typeof EmployeeClientCommissionUpsertSchema
>;
