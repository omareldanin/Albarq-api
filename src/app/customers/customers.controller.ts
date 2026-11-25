import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {assertPhone} from "./customers.dto";
import {CustomersRepository} from "./customers.repository";

const repository = new CustomersRepository();

export class CustomersController {
  lookup = catchAsync(async (req, res) => {
    const phone = assertPhone(req.query.phone);
    const data = await repository.lookup(res.locals.user as loggedInUserType, phone);
    res.status(200).json({status: "success", data});
  });
}
