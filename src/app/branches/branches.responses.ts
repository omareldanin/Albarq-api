import type {Prisma} from "@prisma/client";

export const branchSelect = {
  id: true,
  name: true,
  governorate: true,
  forwardedDeliveryCosts: true,
  receivingDeliveryCosts: true,
  parentBranch: {
    select: {
      id: true,
      name: true,
    },
  },
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BranchSelect;

// const branchReform = (branch: any) => {
//     return {
//         // TODO
//         id: branch.id,
//         name: branch.name,
//         email: branch.email,
//         phone: branch.phone,
//         governorate: branch.governorate,
//         company: branch.company
//     };
// };
