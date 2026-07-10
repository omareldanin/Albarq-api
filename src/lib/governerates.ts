/**
 * Mapping between the internal `Governorate` enum and the external system's
 * governorate entries (code / global_name / arabic_name).
 *
 * Notes:
 *  - BABIL_COMPANIES has no external counterpart (internal-only).
 *  - Some names differ across systems (e.g. BABIL ↔ BABYLON, BASRA ↔ BASRAH).
 *  - Some governorates have MULTIPLE external codes (e.g. MAYSAN -> MYS, AMA).
 *    The FIRST entry in each array is treated as the primary/default code used
 *    when sending data to the external system. All codes are accepted when
 *    reading from the external system.
 */

export enum Governorate {
  AL_ANBAR = "AL_ANBAR",
  BABIL = "BABIL",
  BABIL_COMPANIES = "BABIL_COMPANIES",
  BAGHDAD = "BAGHDAD",
  BASRA = "BASRA",
  DHI_QAR = "DHI_QAR",
  AL_QADISIYYAH = "AL_QADISIYYAH",
  DIYALA = "DIYALA",
  DUHOK = "DUHOK",
  ERBIL = "ERBIL",
  KARBALA = "KARBALA",
  KIRKUK = "KIRKUK",
  MAYSAN = "MAYSAN",
  MUTHANNA = "MUTHANNA",
  NAJAF = "NAJAF",
  NINAWA = "NINAWA",
  SALAH_AL_DIN = "SALAH_AL_DIN",
  SULAYMANIYAH = "SULAYMANIYAH",
  WASIT = "WASIT",
}

export interface ExternalGovernorate {
  code: string;
  globalName: string;
  arabicName: string;
}

/**
 * Internal enum -> list of external system entries.
 * An empty array means there is no matching entry in the external system.
 * The first element is the primary code.
 */
export const GOVERNORATE_TO_EXTERNAL: Record<
  Governorate,
  ExternalGovernorate[]
> = {
  [Governorate.AL_ANBAR]: [
    {code: "ANB", globalName: "ANBAR", arabicName: "الأنبار"},
  ],
  [Governorate.BABIL]: [
    {code: "BBL", globalName: "BABYLON", arabicName: "بابل"},
  ],
  [Governorate.BABIL_COMPANIES]: [],
  [Governorate.BAGHDAD]: [
    {code: "BGD", globalName: "BAGHDAD", arabicName: "بغداد"},
  ],
  [Governorate.BASRA]: [
    {code: "BAS", globalName: "BASRAH", arabicName: "البصرة"},
  ],
  [Governorate.DHI_QAR]: [
    {code: "DHI", globalName: "DHI_QAR", arabicName: "ذي قار"},
    {code: "NAS", globalName: "DHI_QAR", arabicName: "ذي قار"},
  ],
  [Governorate.AL_QADISIYYAH]: [
    {code: "QAD", globalName: "QADISIYYAH", arabicName: "القادسية"},
    {code: "DWN", globalName: "QADISIYYAH", arabicName: "القادسية"},
  ],
  [Governorate.DIYALA]: [
    {code: "DYL", globalName: "DIYALA", arabicName: "ديالى"},
  ],
  [Governorate.DUHOK]: [{code: "DOH", globalName: "DUHOK", arabicName: "دهوك"}],
  [Governorate.ERBIL]: [
    {code: "ARB", globalName: "ERBIL", arabicName: "أربيل"},
  ],
  [Governorate.KARBALA]: [
    {code: "KRB", globalName: "KARBALA", arabicName: "كربلاء"},
  ],
  [Governorate.KIRKUK]: [
    {code: "KRK", globalName: "KIRKUK", arabicName: "كركوك"},
  ],
  [Governorate.MAYSAN]: [
    {code: "MYS", globalName: "MAYSAN", arabicName: "ميسان"},
    {code: "AMA", globalName: "MAYSAN", arabicName: "ميسان"},
  ],
  [Governorate.MUTHANNA]: [
    {code: "MTH", globalName: "MUTHANNA", arabicName: "المثنى"},
  ],
  [Governorate.NAJAF]: [
    {code: "NJF", globalName: "NAJAF", arabicName: "النجف"},
  ],
  [Governorate.NINAWA]: [
    {code: "NIN", globalName: "NINEVEH", arabicName: "نينوى"},
    {code: "MOS", globalName: "NINAWA", arabicName: "نينوى"},
  ],
  [Governorate.SALAH_AL_DIN]: [
    {code: "SAH", globalName: "SALAH_AL_DIN", arabicName: "صلاح الدين"},
  ],
  [Governorate.SULAYMANIYAH]: [
    {code: "SMH", globalName: "SULAYMANIYAH", arabicName: "السليمانية"},
  ],
  [Governorate.WASIT]: [
    {code: "WST", globalName: "WASIT", arabicName: "واسط"},
    {code: "KOT", globalName: "WASIT", arabicName: "واسط"},
  ],
};

/**
 * External code -> internal enum (reverse lookup).
 * Built automatically from GOVERNORATE_TO_EXTERNAL so every alias resolves.
 */
export const EXTERNAL_CODE_TO_GOVERNORATE: Record<string, Governorate> =
  Object.entries(GOVERNORATE_TO_EXTERNAL).reduce(
    (acc, [governorate, entries]) => {
      for (const entry of entries) {
        acc[entry.code] = governorate as Governorate;
      }
      return acc;
    },
    {} as Record<string, Governorate>,
  );

/** All external codes for a governorate (empty array if unmapped). */
export function toExternalCodes(g: Governorate): string[] {
  return GOVERNORATE_TO_EXTERNAL[g].map((e) => e.code);
}

/** The primary external code for a governorate (or null if unmapped). */
export function toExternalCode(g: Governorate): string | null {
  return GOVERNORATE_TO_EXTERNAL[g][0]?.code ?? null;
}

/** Convert an external code back to the internal enum (or undefined if unknown). */
export function fromExternalCode(code: string): Governorate | undefined {
  return EXTERNAL_CODE_TO_GOVERNORATE[code];
}
