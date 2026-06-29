"use strict";
/**
 * Mapping between the internal `Governorate` enum and the external system's
 * governorate entries (code / global_name / arabic_name).
 *
 * Notes:
 *  - BABIL_COMPANIES has no external counterpart (internal-only).
 *  - Some names differ across systems (e.g. BABIL ↔ BABYLON, BASRA ↔ BASRAH).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTERNAL_CODE_TO_GOVERNORATE = exports.GOVERNORATE_TO_EXTERNAL = exports.Governorate = void 0;
exports.toExternalCode = toExternalCode;
exports.fromExternalCode = fromExternalCode;
var Governorate;
(function (Governorate) {
    Governorate["AL_ANBAR"] = "AL_ANBAR";
    Governorate["BABIL"] = "BABIL";
    Governorate["BABIL_COMPANIES"] = "BABIL_COMPANIES";
    Governorate["BAGHDAD"] = "BAGHDAD";
    Governorate["BASRA"] = "BASRA";
    Governorate["DHI_QAR"] = "DHI_QAR";
    Governorate["AL_QADISIYYAH"] = "AL_QADISIYYAH";
    Governorate["DIYALA"] = "DIYALA";
    Governorate["DUHOK"] = "DUHOK";
    Governorate["ERBIL"] = "ERBIL";
    Governorate["KARBALA"] = "KARBALA";
    Governorate["KIRKUK"] = "KIRKUK";
    Governorate["MAYSAN"] = "MAYSAN";
    Governorate["MUTHANNA"] = "MUTHANNA";
    Governorate["NAJAF"] = "NAJAF";
    Governorate["NINAWA"] = "NINAWA";
    Governorate["SALAH_AL_DIN"] = "SALAH_AL_DIN";
    Governorate["SULAYMANIYAH"] = "SULAYMANIYAH";
    Governorate["WASIT"] = "WASIT";
})(Governorate || (exports.Governorate = Governorate = {}));
/**
 * Internal enum -> external system entry.
 * `null` means there is no matching entry in the external system.
 */
exports.GOVERNORATE_TO_EXTERNAL = {
    [Governorate.AL_ANBAR]: {
        code: "ANB",
        globalName: "ANBAR",
        arabicName: "الأنبار",
    },
    [Governorate.BABIL]: { code: "BBL", globalName: "BABYLON", arabicName: "بابل" },
    [Governorate.BABIL_COMPANIES]: null,
    [Governorate.BAGHDAD]: {
        code: "BGD",
        globalName: "BAGHDAD",
        arabicName: "بغداد",
    },
    [Governorate.BASRA]: {
        code: "BAS",
        globalName: "BASRAH",
        arabicName: "البصرة",
    },
    [Governorate.DHI_QAR]: {
        code: "DHI",
        globalName: "DHI_QAR",
        arabicName: "ذي قار",
    },
    [Governorate.AL_QADISIYYAH]: {
        code: "QAD",
        globalName: "QADISIYYAH",
        arabicName: "القادسية",
    },
    [Governorate.DIYALA]: {
        code: "DYL",
        globalName: "DIYALA",
        arabicName: "ديالى",
    },
    [Governorate.DUHOK]: { code: "DOH", globalName: "DUHOK", arabicName: "دهوك" },
    [Governorate.ERBIL]: { code: "ARB", globalName: "ERBIL", arabicName: "أربيل" },
    [Governorate.KARBALA]: {
        code: "KRB",
        globalName: "KARBALA",
        arabicName: "كربلاء",
    },
    [Governorate.KIRKUK]: {
        code: "KRK",
        globalName: "KIRKUK",
        arabicName: "كركوك",
    },
    [Governorate.MAYSAN]: {
        code: "MYS",
        globalName: "MAYSAN",
        arabicName: "ميسان",
    },
    [Governorate.MUTHANNA]: {
        code: "MTH",
        globalName: "MUTHANNA",
        arabicName: "المثنى",
    },
    [Governorate.NAJAF]: { code: "NJF", globalName: "NAJAF", arabicName: "النجف" },
    [Governorate.NINAWA]: {
        code: "NIN",
        globalName: "NINEVEH",
        arabicName: "نينوى",
    },
    [Governorate.SALAH_AL_DIN]: {
        code: "SAH",
        globalName: "SALAH_AL_DIN",
        arabicName: "صلاح الدين",
    },
    [Governorate.SULAYMANIYAH]: {
        code: "SMH",
        globalName: "SULAYMANIYAH",
        arabicName: "السليمانية",
    },
    [Governorate.WASIT]: { code: "WST", globalName: "WASIT", arabicName: "واسط" },
};
/** External code -> internal enum (reverse lookup). */
exports.EXTERNAL_CODE_TO_GOVERNORATE = {
    ANB: Governorate.AL_ANBAR,
    BBL: Governorate.BABIL,
    BGD: Governorate.BAGHDAD,
    BAS: Governorate.BASRA,
    DHI: Governorate.DHI_QAR,
    QAD: Governorate.AL_QADISIYYAH,
    DYL: Governorate.DIYALA,
    DOH: Governorate.DUHOK,
    ARB: Governorate.ERBIL,
    KRB: Governorate.KARBALA,
    KRK: Governorate.KIRKUK,
    MYS: Governorate.MAYSAN,
    MTH: Governorate.MUTHANNA,
    NJF: Governorate.NAJAF,
    NIN: Governorate.NINAWA,
    SAH: Governorate.SALAH_AL_DIN,
    SMH: Governorate.SULAYMANIYAH,
    WST: Governorate.WASIT,
};
/** Convert an internal enum value to its external code (or null if unmapped). */
function toExternalCode(g) {
    return exports.GOVERNORATE_TO_EXTERNAL[g]?.code ?? null;
}
/** Convert an external code back to the internal enum (or undefined if unknown). */
function fromExternalCode(code) {
    return exports.EXTERNAL_CODE_TO_GOVERNORATE[code];
}
//# sourceMappingURL=governerates.js.map