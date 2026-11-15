"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientProcessingController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const clientProcessing_dto_1 = require("./clientProcessing.dto");
const clientProcessing_repository_1 = require("./clientProcessing.repository");
const repository = new clientProcessing_repository_1.ClientProcessingRepository();
class ClientProcessingController {
    getOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const filters = clientProcessing_dto_1.ClientProcessingListSchema.parse(req.query);
        const result = await repository.getOrders(res.locals.user, filters);
        res.status(200).json({ status: "success", ...result });
    });
    processOrder = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { orderID } = clientProcessing_dto_1.ClientProcessingParamsSchema.parse(req.params);
        const data = clientProcessing_dto_1.ClientProcessOrderSchema.parse(req.body);
        const result = await repository.processOrder(res.locals.user, orderID, data);
        res.status(200).json({ status: "success", data: result });
    });
}
exports.ClientProcessingController = ClientProcessingController;
//# sourceMappingURL=clientProcessing.controller.js.map