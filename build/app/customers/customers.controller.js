"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const customers_dto_1 = require("./customers.dto");
const customers_repository_1 = require("./customers.repository");
const repository = new customers_repository_1.CustomersRepository();
class CustomersController {
    lookup = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const phone = (0, customers_dto_1.assertPhone)(req.query.phone);
        const data = await repository.lookup(res.locals.user, phone);
        res.status(200).json({ status: "success", data });
    });
}
exports.CustomersController = CustomersController;
//# sourceMappingURL=customers.controller.js.map