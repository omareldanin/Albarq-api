import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    ClientProcessingListSchema,
    ClientProcessingParamsSchema,
    ClientProcessOrderSchema
} from "./clientProcessing.dto";
import { ClientProcessingRepository } from "./clientProcessing.repository";

const repository = new ClientProcessingRepository();

export class ClientProcessingController {
    getOrders = catchAsync(async (req, res) => {
        const filters = ClientProcessingListSchema.parse(req.query);
        const result = await repository.getOrders(res.locals.user as loggedInUserType, filters);
        res.status(200).json({ status: "success", ...result });
    });

    processOrder = catchAsync(async (req, res) => {
        const { orderID } = ClientProcessingParamsSchema.parse(req.params);
        const data = ClientProcessOrderSchema.parse(req.body);
        const result = await repository.processOrder(res.locals.user as loggedInUserType, orderID, data);
        res.status(200).json({ status: "success", data: result });
    });
}
