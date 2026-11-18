"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientLoansController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const clientLoans_dto_1 = require("./clientLoans.dto");
const clientLoans_repository_1 = require("./clientLoans.repository");
const repository = new clientLoans_repository_1.ClientLoansRepository();
class ClientLoansController {
    createLoan = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = clientLoans_dto_1.ClientLoanCreateSchema.parse(req.body);
        const loan = await repository.createLoan(res.locals.user, data);
        res.status(201).json({ status: "success", data: loan });
    });
    getLoans = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const filters = clientLoans_dto_1.ClientLoansListSchema.parse(req.query);
        const result = await repository.getLoans(res.locals.user, filters);
        res.status(200).json({ status: "success", ...result });
    });
}
exports.ClientLoansController = ClientLoansController;
//# sourceMappingURL=clientLoans.controller.js.map