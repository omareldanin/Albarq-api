"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTERNAL_ACTION_TO_ORDER_STATUS = exports.ORDER_STATUS_TO_EXTERNAL = void 0;
exports.toExternalAction = toExternalAction;
exports.fromExternalAction = fromExternalAction;
const client_1 = require("@prisma/client");
/**
 * Internal status -> external action.
 * `null` means there is no matching action in the external system
 * (e.g. an initial state, or a state the external system does not track).
 */
exports.ORDER_STATUS_TO_EXTERNAL = {
    [client_1.OrderStatus.REGISTERED]: null,
    [client_1.OrderStatus.READY_TO_SEND]: {
        code: "BACK_TO_READY_FOR_PRINT",
        nameEn: "Return to ready for printing stage",
        nameAr: "إرجاع لمرحلة جاهز للطبع",
    }, // NOTE: verify — may need READY_FOR_PICKUP for forward transition
    [client_1.OrderStatus.WITH_DELIVERY_AGENT]: {
        code: "ASSIGN_TO_AGENT",
        nameEn: "Assign shipment to delivery agent",
        nameAr: "أسناد إلى مندوب",
    },
    [client_1.OrderStatus.DELIVERED]: {
        code: "SUCCESSFUL_DELIVERY",
        nameEn: "Successfully delivered",
        nameAr: "تسليم بنجاح",
    },
    [client_1.OrderStatus.REPLACED]: {
        code: "PARTIAL_DELIVERY",
        nameEn: "Partial delivery or exchange",
        nameAr: "تسليم جزئي أو استبدال",
    }, // NOTE: verify — external system does not distinguish replace vs partial return
    [client_1.OrderStatus.PARTIALLY_RETURNED]: {
        code: "PARTIAL_DELIVERY",
        nameEn: "Partial delivery or exchange",
        nameAr: "تسليم جزئي أو استبدال",
    }, // NOTE: verify — same code as REPLACED
    [client_1.OrderStatus.RETURNED]: {
        code: "RETURNED_WITH_AGENT",
        nameEn: "Return confirmed/approved",
        nameAr: "تأكيد الراجع",
    }, // NOTE: verify — could be RETURN_TO_STORE or RETURNED_WITH_AGENT
    [client_1.OrderStatus.POSTPONED]: {
        code: "POSTPONED",
        nameEn: "Postponed by customer request",
        nameAr: "مؤجل",
    },
    [client_1.OrderStatus.CHANGE_ADDRESS]: {
        code: "RESEND",
        nameEn: "Resend shipment",
        nameAr: "إعادة إرسال",
    }, // NOTE: no external equivalent
    [client_1.OrderStatus.RESEND]: {
        code: "RESEND",
        nameEn: "Resend shipment",
        nameAr: "إعادة إرسال",
    },
    [client_1.OrderStatus.WITH_RECEIVING_AGENT]: {
        code: "HANDOVER_TO_LIAISON_AGENT",
        nameEn: "Handover to liaison agent",
        nameAr: "تسليم لمندوب الارتباط",
    }, // NOTE: verify — assumes receiving agent == liaison agent
    [client_1.OrderStatus.PROCESSING]: {
        code: "RTO_WITH_DA",
        nameEn: "Returned shipment with delivery agent",
        nameAr: "راجع عند المندوب",
    }, // NOTE: verify
    [client_1.OrderStatus.IN_MAIN_REPOSITORY]: {
        code: "MOVE_TO_STORE",
        nameEn: "Move to warehouse",
        nameAr: "نقل إلى داخل المخزن",
    }, // NOTE: verify — external system has no main/gov warehouse split
    [client_1.OrderStatus.IN_GOV_REPOSITORY]: {
        code: "MOVE_TO_STORE",
        nameEn: "Return to branch returns in warehouse - waiting liaison",
        nameAr: "إرجاع إلى رواجع الفروع في المخزن",
    }, // NOTE: verify — best guess for governorate/branch warehouse
};
/**
 * External action code -> internal status (reverse lookup, for incoming updates).
 * Only includes codes that map back to a single internal status.
 */
exports.EXTERNAL_ACTION_TO_ORDER_STATUS = {
    BACK_TO_READY_FOR_PRINT: client_1.OrderStatus.READY_TO_SEND,
    ASSIGN_TO_AGENT: client_1.OrderStatus.WITH_DELIVERY_AGENT,
    SUCCESSFUL_DELIVERY: client_1.OrderStatus.DELIVERED,
    RETURN_APPROVED: client_1.OrderStatus.RETURNED,
    POSTPONED: client_1.OrderStatus.POSTPONED,
    RESEND: client_1.OrderStatus.RESEND,
    HANDOVER_TO_LIAISON_AGENT: client_1.OrderStatus.WITH_RECEIVING_AGENT,
    TREATED: client_1.OrderStatus.PROCESSING,
    MOVE_TO_STORE: client_1.OrderStatus.IN_MAIN_REPOSITORY,
    RETURN_IN_STORE_WAITING_LIAISON: client_1.OrderStatus.IN_GOV_REPOSITORY,
    // PARTIAL_DELIVERY is intentionally omitted: it maps to both REPLACED and
    // PARTIALLY_RETURNED, so a reverse lookup would be ambiguous.
};
/** Convert an internal status to its external action code (or null if unmapped). */
function toExternalAction(status) {
    return exports.ORDER_STATUS_TO_EXTERNAL[status]?.code ?? null;
}
/** Convert an external action code back to the internal status (or undefined if unknown). */
function fromExternalAction(code) {
    return exports.EXTERNAL_ACTION_TO_ORDER_STATUS[code];
}
//# sourceMappingURL=externalStatus.js.map