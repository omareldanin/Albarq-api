// // import { generateMock } from "@anatine/zod-mock";
import { generateSchema } from "@anatine/zod-openapi";
import { Governorate } from "@prisma/client";
import { z } from "zod";

/*******************************************************************************
 * Empty string needs to be converted to null
 *******************************************************************************/
export const CompanyCreateSchema = z.preprocess(
  (data) => {
    return {
      // @ts-expect-error
      companyData: JSON.parse(data.companyData),
      // @ts-expect-error
      companyManager: JSON.parse(data.companyManager),
    };
  },
  z.object({
    companyData: z.object({
      name: z.string().min(3),
      phone: z.string().min(6),
      companyID: z.string().optional(),
      isExternal: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
      }, z.boolean().optional()),
      logo: z.preprocess((_data) => {
        return "";
      }, z.string().optional()),
      registrationText: z.preprocess(
        (data) => (data === "" ? undefined : data),
        z.string().optional(),
      ),
      governoratesDeliveryCosts: z
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
    }),
    companyManager: z.object({
      username: z.string().min(3),
      name: z.string().min(3),
      password: z.string().min(6),
      phone: z.string().min(6),
      avatar: z.preprocess((_data) => {
        return "";
      }, z.string().optional()),
    }),
  }),
);

export type CompanyCreateType = z.infer<typeof CompanyCreateSchema>;

export const CompanyCreateOpenAPISchema = generateSchema(CompanyCreateSchema);

// export const CompanyCreateMock = generateMock(CompanyCreateSchema);

//---------------------------------------------------------------

export const CompanyUpdateSchema = z
  .object({
    companyManagerID: z.number().optional(),
    name: z.string().min(3),
    phone: z.string().min(6),
    logo: z.string().optional(),
    registrationText: z.string().optional(),
    password: z.string().min(6).optional(),
    companyID: z.string().optional(),
    isExternal: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean().optional()),
    governoratesDeliveryCosts: z
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
  })
  .partial();

export type CompanyUpdateType = z.infer<typeof CompanyUpdateSchema>;

export const CompanyUpdateOpenAPISchema = generateSchema(CompanyUpdateSchema);

// export const CompanyUpdateMock = generateMock(CompanyUpdateSchema);
