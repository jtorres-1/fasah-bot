"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MORNING_PREFERRED_HOURS = void 0;
exports.isMorningHour = isMorningHour;
exports.slotHour = slotHour;
exports.formatScheduleLocal = formatScheduleLocal;
exports.formatScheduleFromRiyadh = formatScheduleFromRiyadh;
exports.parseOptionalInt = parseOptionalInt;
exports.possessiveLabel = possessiveLabel;
exports.sortSlotsByStart = sortSlotsByStart;
exports.compareSlotsByStart = compareSlotsByStart;
exports.applyTierFilter = applyTierFilter;
exports.MORNING_PREFERRED_HOURS = [0, 1, 2, 3, 4, 5, 6];
function isMorningHour(h) {
    return h >= 0 && h <= 12;
}
function slotHour(slot) {
    slot._parsedFromMs ??= new Date(slot.schedule_from).getTime();
    return new Date(slot._parsedFromMs).getHours();
}
function formatScheduleLocal(scheduleFrom) {
    const ms = Date.parse(scheduleFrom);
    if (Number.isNaN(ms))
        return scheduleFrom;
    const d = new Date(ms);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${da} ${h}:${mi}`;
}
function formatScheduleFromRiyadh(scheduleFrom) {
    const ms = Date.parse(scheduleFrom);
    if (Number.isNaN(ms))
        return scheduleFrom;
    const d = new Date(ms);
    const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Riyadh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(d);
    const g = (t) => p.find((x) => x.type === t)?.value ?? "";
    return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}
function parseOptionalInt(raw) {
    const n = parseInt(raw.trim(), 10);
    return !isNaN(n) && n >= 0 && n <= 23 ? n : null;
}
function possessiveLabel(name) {
    const t = name.trim();
    if (!t)
        return "Driver";
    return t.endsWith("s") || t.endsWith("S") ? `${t}'` : `${t}'s`;
}
function sortSlotsByStart(slots) {
    return [...slots].sort((a, b) => {
        a._parsedFromMs ??= new Date(a.schedule_from).getTime();
        b._parsedFromMs ??= new Date(b.schedule_from).getTime();
        return a._parsedFromMs - b._parsedFromMs;
    });
}
function compareSlotsByStart(a, b) {
    a._parsedFromMs ??= new Date(a.schedule_from).getTime();
    b._parsedFromMs ??= new Date(b.schedule_from).getTime();
    return a._parsedFromMs - b._parsedFromMs;
}
function applyTierFilter(slots, prefs) {
    const sorted = sortSlotsByStart(slots);
    if (sorted.length === 0)
        return { candidates: [], tier: 3 };
    const t1 = [];
    const t2 = [];
    const rest = [];
    for (const s of sorted) {
        const h = slotHour(s);
        if (prefs.tier1 !== null && h === prefs.tier1) {
            t1.push(s);
        }
        else if (prefs.tier2Start !== null &&
            prefs.tier2End !== null &&
            h >= prefs.tier2Start &&
            h <= prefs.tier2End) {
            t2.push(s);
        }
        else {
            rest.push(s);
        }
    }
    const noHourPrefs = prefs.tier1 === null && prefs.tier2Start === null;
    let orderedRest;
    if (noHourPrefs) {
        const morningRest = rest.filter((s) => isMorningHour(slotHour(s)));
        morningRest.sort((a, b) => {
            const ha = slotHour(a);
            const hb = slotHour(b);
            if (ha !== hb)
                return ha - hb;
            return compareSlotsByStart(a, b);
        });
        const otherRest = rest.filter((s) => !isMorningHour(slotHour(s)));
        otherRest.sort(compareSlotsByStart);
        orderedRest = [...morningRest, ...otherRest];
    }
    else {
        const morningPref = rest.filter((s) => exports.MORNING_PREFERRED_HOURS.includes(slotHour(s)));
        morningPref.sort((a, b) => {
            const pa = exports.MORNING_PREFERRED_HOURS.indexOf(slotHour(a));
            const pb = exports.MORNING_PREFERRED_HOURS.indexOf(slotHour(b));
            if (pa !== pb)
                return pa - pb;
            return compareSlotsByStart(a, b);
        });
        const otherRest = rest.filter((s) => !exports.MORNING_PREFERRED_HOURS.includes(slotHour(s)));
        orderedRest = [...morningPref, ...otherRest];
    }
    const combined = [...t1, ...t2, ...orderedRest];
    const bestTier = t1.length > 0 ? 1 : t2.length > 0 ? 2 : 3;
    return { candidates: combined, tier: bestTier };
}
