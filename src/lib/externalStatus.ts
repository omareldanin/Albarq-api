import {OrderStatus} from "@prisma/client";

/**
 * Mapping between the internal `OrderStatus` enum and the external system's
 * action codes.
 *
 * IMPORTANT: The internal enum describes *states*, while the external system
 * exposes *actions/transitions*. Each entry below picks the external action
 * that moves a shipment INTO the given internal state.
 *
 * Several mappings are marked as unverified (see NOTE comments) — confirm the
 * business meaning before relying on them:
 *  - READY_TO_SEND: uses BACK_TO_READY_FOR_PRINT (a return-to action). If you
 *    need the forward transition, READY_FOR_PICKUP may be more appropriate.
 *  - REPLACED and PARTIALLY_RETURNED both collapse to PARTIAL_DELIVERY — the
 *    external system does not distinguish them.
 *  - RETURNED could be RETURN_APPROVED / RETURN_TO_STORE / RETURNED_WITH_AGENT
 *    depending on which stage the return sits at.
 *  - IN_MAIN_REPOSITORY / IN_GOV_REPOSITORY: the external system has no clear
 *    "main vs governorate warehouse" split.
 *  - REGISTERED and CHANGE_ADDRESS have no external equivalent (null).
 */

export interface ExternalAction {
  code: string;
  nameEn: string;
  nameAr: string;
}

/**
 * Internal status -> external action.
 * `null` means there is no matching action in the external system
 * (e.g. an initial state, or a state the external system does not track).
 */
export const ORDER_STATUS_TO_EXTERNAL: Record<
  OrderStatus,
  ExternalAction | null
> = {
  [OrderStatus.REGISTERED]: null,
  [OrderStatus.READY_TO_SEND]: {
    code: "BACK_TO_READY_FOR_PRINT",
    nameEn: "Return to ready for printing stage",
    nameAr: "إرجاع لمرحلة جاهز للطبع",
  }, // NOTE: verify — may need READY_FOR_PICKUP for forward transition
  [OrderStatus.WITH_DELIVERY_AGENT]: {
    code: "ASSIGN_TO_AGENT",
    nameEn: "Assign shipment to delivery agent",
    nameAr: "أسناد إلى مندوب",
  },
  [OrderStatus.DELIVERED]: {
    code: "SUCCESSFUL_DELIVERY",
    nameEn: "Successfully delivered",
    nameAr: "تسليم بنجاح",
  },
  [OrderStatus.REPLACED]: {
    code: "PARTIAL_DELIVERY",
    nameEn: "Partial delivery or exchange",
    nameAr: "تسليم جزئي أو استبدال",
  }, // NOTE: verify — external system does not distinguish replace vs partial return
  [OrderStatus.PARTIALLY_RETURNED]: {
    code: "PARTIAL_DELIVERY",
    nameEn: "Partial delivery or exchange",
    nameAr: "تسليم جزئي أو استبدال",
  }, // NOTE: verify — same code as REPLACED
  [OrderStatus.RETURNED]: {
    code: "RETURNED_WITH_AGENT",
    nameEn: "Return confirmed/approved",
    nameAr: "تأكيد الراجع",
  }, // NOTE: verify — could be RETURN_TO_STORE or RETURNED_WITH_AGENT
  [OrderStatus.POSTPONED]: {
    code: "POSTPONED",
    nameEn: "Postponed by customer request",
    nameAr: "مؤجل",
  },
  [OrderStatus.CHANGE_ADDRESS]: {
    code: "RESEND",
    nameEn: "Resend shipment",
    nameAr: "إعادة إرسال",
  }, // NOTE: no external equivalent
  [OrderStatus.RESEND]: {
    code: "RESEND",
    nameEn: "Resend shipment",
    nameAr: "إعادة إرسال",
  },
  [OrderStatus.WITH_RECEIVING_AGENT]: {
    code: "HANDOVER_TO_LIAISON_AGENT",
    nameEn: "Handover to liaison agent",
    nameAr: "تسليم لمندوب الارتباط",
  }, // NOTE: verify — assumes receiving agent == liaison agent
  [OrderStatus.PROCESSING]: {
    code: "RTO_WITH_DA",
    nameEn: "Returned shipment with delivery agent",
    nameAr: "راجع عند المندوب",
  }, // NOTE: verify
  [OrderStatus.IN_MAIN_REPOSITORY]: {
    code: "MOVE_TO_STORE",
    nameEn: "Move to warehouse",
    nameAr: "نقل إلى داخل المخزن",
  }, // NOTE: verify — external system has no main/gov warehouse split
  [OrderStatus.IN_GOV_REPOSITORY]: {
    code: "MOVE_TO_STORE",
    nameEn: "Return to branch returns in warehouse - waiting liaison",
    nameAr: "إرجاع إلى رواجع الفروع في المخزن",
  }, // NOTE: verify — best guess for governorate/branch warehouse
};

/**
 * External action code -> internal status (reverse lookup, for incoming updates).
 * Only includes codes that map back to a single internal status.
 */
export const EXTERNAL_ACTION_TO_ORDER_STATUS: Record<string, OrderStatus> = {
  BACK_TO_READY_FOR_PRINT: OrderStatus.READY_TO_SEND,
  ASSIGN_TO_AGENT: OrderStatus.WITH_DELIVERY_AGENT,
  SUCCESSFUL_DELIVERY: OrderStatus.DELIVERED,
  RETURN_APPROVED: OrderStatus.RETURNED,
  POSTPONED: OrderStatus.POSTPONED,
  RESEND: OrderStatus.RESEND,
  HANDOVER_TO_LIAISON_AGENT: OrderStatus.WITH_RECEIVING_AGENT,
  TREATED: OrderStatus.PROCESSING,
  MOVE_TO_STORE: OrderStatus.IN_MAIN_REPOSITORY,
  RETURN_IN_STORE_WAITING_LIAISON: OrderStatus.IN_GOV_REPOSITORY,
  // PARTIAL_DELIVERY is intentionally omitted: it maps to both REPLACED and
  // PARTIALLY_RETURNED, so a reverse lookup would be ambiguous.
};

/** Convert an internal status to its external action code (or null if unmapped). */
export function toExternalAction(status: OrderStatus): string | null {
  return ORDER_STATUS_TO_EXTERNAL[status]?.code ?? null;
}

/** Convert an external action code back to the internal status (or undefined if unknown). */
export function fromExternalAction(code: string): OrderStatus | undefined {
  return EXTERNAL_ACTION_TO_ORDER_STATUS[code];
}
