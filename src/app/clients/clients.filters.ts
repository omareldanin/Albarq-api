import type {Prisma} from "@prisma/client";
import {z} from "zod";

export const ClientListFilterSchema = z
  .object({
    created_from: z.string().date().optional(),
    created_to: z.string().date().optional(),
    activeProfit: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .refine(
    ({created_from, created_to}) =>
      !created_from || !created_to || created_from <= created_to,
    {
      message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
      path: ["created_to"],
    },
  );

export type ClientListFilters = z.infer<typeof ClientListFilterSchema>;

export function clientListFilterWhere(
  filters: ClientListFilters,
): Prisma.ClientWhereInput {
  // Client accounts store their creation timestamp on User. Calendar dates
  // use Baghdad time, with an exclusive upper bound to include the entire end day.
  const from = filters.created_from
    ? new Date(`${filters.created_from}T00:00:00+03:00`)
    : undefined;
  const until = filters.created_to
    ? new Date(`${filters.created_to}T00:00:00+03:00`)
    : undefined;
  if (until) until.setUTCDate(until.getUTCDate() + 1);

  return {
    activeProfit: filters.activeProfit,
    user: from || until ? {createdAt: {gte: from, lt: until}} : undefined,
  };
}
