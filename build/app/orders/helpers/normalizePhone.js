"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
function normalizePhone(raw) {
    if (!raw)
        return null;
    // أزل أي رموز غير الأرقام
    let phone = raw.replace(/[^\d]/g, "");
    // ---------- العراق ----------
    // 07xxxxxxxx -> 9647xxxxxxxx
    if (/^07\d{8,9}$/.test(phone)) {
        phone = "964" + phone.slice(1);
        return phone;
    }
    // 9647xxxxxxxx (صحيح)
    if (/^9647\d{8,9}$/.test(phone)) {
        return phone;
    }
    // ---------- مصر ----------
    // 01xxxxxxxxx -> 201xxxxxxxxx
    if (/^01[0-5]\d{8}$/.test(phone)) {
        phone = "20" + phone;
        return phone;
    }
    // 201xxxxxxxxx (صحيح)
    if (/^201[0-5]\d{8}$/.test(phone)) {
        return phone;
    }
    // ---------- دول عامة ----------
    // لو بدأ بـ 00 (مثال 00964...)
    if (phone.startsWith("00") && phone.length >= 10) {
        return phone.slice(2);
    }
    // كحالة أخيرة: لو طوله بين 10 و 15 رقم (E.164 بدون +)
    if (phone.length >= 10 && phone.length <= 15) {
        return phone;
    }
    return null; // غير صالح
}
//# sourceMappingURL=normalizePhone.js.map