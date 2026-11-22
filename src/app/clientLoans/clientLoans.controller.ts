import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    ClientLoanCreateSchema,
    ClientLoanParamsSchema,
    ClientLoansListSchema,
    ClientLoanUpdateSchema
} from "./clientLoans.dto";
import { ClientLoansRepository } from "./clientLoans.repository";

const repository = new ClientLoansRepository();

export class ClientLoansController {
    createLoan = catchAsync(async (req, res) => {
        const data = ClientLoanCreateSchema.parse(req.body);
        const loan = await repository.createLoan(res.locals.user as loggedInUserType, data);
        res.status(201).json({ status: "success", data: loan });
    });

    updateLoan = catchAsync(async (req, res) => {
        const { loanID } = ClientLoanParamsSchema.parse(req.params);
        const data = ClientLoanUpdateSchema.parse(req.body);
        const loan = await repository.updateLoan(res.locals.user as loggedInUserType, loanID, data);
        res.status(200).json({ status: "success", data: loan });
    });

    deleteLoan = catchAsync(async (req, res) => {
        const { loanID } = ClientLoanParamsSchema.parse(req.params);
        await repository.deleteLoan(res.locals.user as loggedInUserType, loanID);
        res.status(200).json({ status: "success" });
    });

    getLoans = catchAsync(async (req, res) => {
        const filters = ClientLoansListSchema.parse(req.query);
        const result = await repository.getLoans(res.locals.user as loggedInUserType, filters);
        res.status(200).json({ status: "success", ...result });
    });
}
