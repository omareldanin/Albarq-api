import axios from "axios";
import {OrderStatus} from "@prisma/client";
import {AppError} from "../lib/AppError";
import {toExternalAction} from "./externalStatus";

const JENNI_API_URL =
  process.env.JENNI_API_URL ?? "https://rover.jenni.systems/api";
const JENNI_USERNAME = process.env.JENNI_USERNAME ?? "";
const JENNI_PASSWORD = process.env.JENNI_PASSWORD ?? "";
const JENNI_SYSTEM_CODE = process.env.JENNI_SYSTEM_CODE ?? "";

/**
 * Extra fields sent alongside a status update. Which ones are required
 * depends on the action:
 *  - POSTPONED            -> postponed_date_id is required (1=tomorrow, 2=2 days, 3=3+ days)
 *  - RETURNED_WITH_AGENT  -> return_reason(_en/_ku) recommended
 *  - PARTIAL_DELIVERY     -> quantity_delivered / quantity_returned
 *  - SUCCESSFUL_DELIVERY  -> proof_image_url, received_by_name, GPS (optional)
 */
export interface StatusUpdateDetails {
  note?: string;
  // delivery
  proof_image_url?: string;
  received_by_name?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  // postponed
  postponed_reason?: string;
  postponed_reason_en?: string;
  postponed_reason_ku?: string;
  postponed_date_id?: number;
  // return
  return_reason?: string;
  return_reason_en?: string;
  return_reason_ku?: string;
  treated_message?: string;
  // partial
  is_partial?: boolean;
  quantity_delivered?: number;
  quantity_returned?: number;
  partial_return_action?: string;
  [key: string]: unknown;
}

// ── Token cache ────────────────────────────────────────────────
let authToken: string | null = null;
let tokenExpiry = 0;

async function loginToJenni(): Promise<string> {
  try {
    const {data} = await axios.post(`${JENNI_API_URL}/v2/auth/login`, {
      username: JENNI_USERNAME,
      password: JENNI_PASSWORD,
    });
    authToken = data.token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return authToken as string;
  } catch (error: any) {
    throw new AppError(
      `فشل تسجيل الدخول إلى النظام الخارجي: ${
        error?.response?.data?.message ?? error?.message ?? "unknown"
      }`,
      502,
    );
  }
}

async function ensureValidToken(): Promise<void> {
  // refresh 5 minutes before expiry
  if (!authToken || Date.now() > tokenExpiry - 5 * 60 * 1000) {
    await loginToJenni();
  }
}

const POSTPONED_DATE_ID_MAP: Record<string, number> = {
  "مؤجل غدا": 1, // tomorrow
  "مؤجل ليلا": 1, // tonight → treat as tomorrow (soonest bucket)
  "مؤجل لأكثر من يوم": 3, // more than a day → 3+ days
};

export function toPostponedDateId(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  return POSTPONED_DATE_ID_MAP[value];
}

/** Remove keys whose value is undefined (or null) so they aren't sent in the payload. */
function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;
}

// ── Core sender ────────────────────────────────────────────────
/**
 * Send a single status update to Jenni using an already-resolved action code.
 * Prefer `updateExternalOrderStatus` which maps from the internal OrderStatus.
 */
export async function sendStatusUpdateToJenni(
  shipmentId: number,
  actionCode: string,
  details: StatusUpdateDetails = {},
) {
  await ensureValidToken();

  const payload = {
    system_code: JENNI_SYSTEM_CODE,
    updates: [
      {
        shipment_id: shipmentId,
        action_code: actionCode,
        timestamp: new Date().toISOString(),
        ...stripEmpty(details),
      },
    ],
  };

  try {
    const {data} = await axios.post(
      `${JENNI_API_URL}/v2/push/update-status`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    return data;
  } catch (error: any) {
    // token may have expired mid-flight — retry once after re-login

    if (error?.response?.status === 401) {
      await loginToJenni();
      const {data} = await axios.post(
        `${JENNI_API_URL}/v2/push/update-status`,
        {...payload},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      return data;
    }
    throw new AppError(
      `فشل إرسال تحديث الحالة إلى النظام الخارجي: ${
        error?.response?.data?.message ?? error?.message ?? "unknown"
      }`,
      502,
    );
  }
}

// ── Public API (maps internal status -> external action) ───────
/**
 * Update an order's status in the external (Jenni) system.
 * @param shipmentId  the external shipment_id (stored on your order as receiptNumber)
 * @param status      the internal OrderStatus
 * @param details     extra fields required by some actions
 * @returns the external response, or null if this status has no external action
 */
export async function updateExternalOrderStatus(
  shipmentId: number | string,
  status: OrderStatus,
  details: StatusUpdateDetails = {},
) {
  const actionCode = toExternalAction(status);
  if (!actionCode) {
    // REGISTERED / CHANGE_ADDRESS — nothing to push
    return null;
  }
  return sendStatusUpdateToJenni(+shipmentId, actionCode, details);
}
