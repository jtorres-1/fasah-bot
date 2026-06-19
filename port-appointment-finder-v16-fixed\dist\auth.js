"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleTooManyRequestsMessage = exports.SCHEDULE_429_MAX_BACKOFF_MS = exports.SCHEDULE_429_MIN_BACKOFF_MS = exports.commonHeaders = void 0;
exports.fasahApiOrigin = fasahApiOrigin;
exports.fasahHttpReferer = fasahHttpReferer;
exports.fasahScheduleLandBase = fasahScheduleLandBase;
exports.fasahAppointmentCreateUrl = fasahAppointmentCreateUrl;
exports.getAuthToken = getAuthToken;
exports.setAuthToken = setAuthToken;
exports.checkIsLoggedIn = checkIsLoggedIn;
exports.parseRetryAfterMs = parseRetryAfterMs;
exports.probeScheduleToken = probeScheduleToken;
exports.commonHeaders = {
    accept: "application/json",
    "accept-language": "en",
    "content-type": "application/json; charset=UTF-8",
    "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
};
function fasahApiOrigin() {
    const raw = process.env["FASAH_API_ORIGIN"]?.trim();
    if (raw && /^https:\/\/.+/i.test(raw)) {
        return raw.replace(/\/+$/, "");
    }
    return "https://fasah.zatca.gov.sa";
}
function fasahHttpReferer() {
    const raw = process.env["FASAH_HTTP_REFERER"]?.trim();
    if (raw)
        return raw;
    return `${fasahApiOrigin()}/en/broker/2.0/`;
}
function fasahScheduleLandBase() {
    return `${fasahApiOrigin()}/api/zatca-tas/v2/zone/schedule/land`;
}
function fasahAppointmentCreateUrl() {
    return `${fasahApiOrigin()}/api/zatca-tas/v2/appointment/transit/create`;
}
function scheduleLandUrl(port_code) {
    return `${fasahScheduleLandBase()}?departure=AGF&arrival=${encodeURIComponent(port_code)}&type=TRANSIT&economicOperator=`;
}
let authTokenValue = "";
function getAuthToken() {
    return authTokenValue;
}
function setAuthToken(raw) {
    const t = raw.trim();
    authTokenValue = /^bearer\s/i.test(t)
        ? t.replace(/^bearer\s+/i, "Bearer ")
        : `Bearer ${t}`;
}
async function checkIsLoggedIn(port_code = "95") {
    try {
        const response = await fetch(scheduleLandUrl(port_code), {
            headers: {
                ...exports.commonHeaders,
                token: getAuthToken(),
            },
            referrer: fasahHttpReferer(),
            body: null,
            method: "GET",
            mode: "cors",
            credentials: "include",
        });
        if (!response.ok) {
            return false;
        }
        const data = (await response.json());
        if (data.success === false) {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
const RATE_LIMIT_BACKOFF_MS = 5_000;
exports.SCHEDULE_429_MIN_BACKOFF_MS = 1_000;
exports.SCHEDULE_429_MAX_BACKOFF_MS = 10_000;
exports.scheduleTooManyRequestsMessage = "You have exceeded the maximum tries";
function parseRetryAfterMs(res, now = Date.now()) {
    const raw = res.headers.get("retry-after")?.trim();
    if (!raw)
        return undefined;
    const secs = parseInt(raw, 10);
    if (!Number.isNaN(secs))
        return secs * 1000;
    const until = Date.parse(raw);
    if (!Number.isNaN(until))
        return Math.max(0, until - now);
    return undefined;
}
function throwScheduleProbeRateLimited(response) {
    const ra = parseRetryAfterMs(response);
    const ms = ra !== undefined
        ? Math.min(Math.max(ra, exports.SCHEDULE_429_MIN_BACKOFF_MS), exports.SCHEDULE_429_MAX_BACKOFF_MS)
        : RATE_LIMIT_BACKOFF_MS;
    const e = new Error(exports.scheduleTooManyRequestsMessage);
    e.scheduleBackoffMs = ms;
    throw e;
}
async function probeScheduleToken(port_code, token) {
    try {
        const response = await fetch(scheduleLandUrl(port_code), {
            headers: {
                ...exports.commonHeaders,
                token,
            },
            referrer: fasahHttpReferer(),
            body: null,
            method: "GET",
            mode: "cors",
            credentials: "include",
        });
        if (response.status === 429) {
            throwScheduleProbeRateLimited(response);
        }
        if (!response.ok) {
            return false;
        }
        const data = (await response.json());
        if (data.success === false) {
            return false;
        }
        return true;
    }
    catch (e) {
        if (e instanceof Error &&
            e.message === exports.scheduleTooManyRequestsMessage) {
            throw e;
        }
        return false;
    }
}
