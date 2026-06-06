import type { Prisma } from "@prisma/client";

export const companySelect = {
  id: true,
  name: true,
  phone: true,
  logo: true,
  registrationText: true,
  isExternal: true,
  targetCompanyId: true,
  governoratesDeliveryCosts: true,
} satisfies Prisma.CompanySelect;
