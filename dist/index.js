"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readlinePromises = __importStar(require("node:readline/promises"));
const node_process_1 = require("node:process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const prompts_1 = __importDefault(require("prompts"));
const ports_1 = __importDefault(require("./ports"));
const scheduling_1 = require("./scheduling");
const auth_1 = require("./auth");
const SEARCH_SPAM_MODE = true;
const VERSION = "16 fixed";
const MAX_TRIES = 6000;
const _maxTriesOverride = Number(process.env["MAX_TRIES_OVERRIDE"]);
const EFFECTIVE_MAX_TRIES = Number.isFinite(_maxTriesOverride) && _maxTriesOverride > 0
    ? Math.floor(_maxTriesOverride)
    : MAX_TRIES;
const _pollEnv = Number(process.env["POLL_INTERVAL_MS"]);
const POLL_INTERVAL_MS = SEARCH_SPAM_MODE
    ? 150
    : Number.isFinite(_pollEnv) && _pollEnv >= 400 && _pollEnv <= 1500
        ? Math.floor(_pollEnv)
        : 500;
const SEARCH_GAP_MS = 50;
const RATE_LIMIT_BACKOFF_MS = 5000;
const NO_SLOTS_DELAY_MS = 1_000;
const BOOKING_MODE = (process.env["BOOKING_MODE"] ?? "smart").trim().toLowerCase();
const _maxConcurrent = Number(process.env["MAX_CONCURRENT_DRIVERS"]);
const MAX_CONCURRENT_DRIVERS = Number.isFinite(_maxConcurrent) && _maxConcurrent >= 1 && _maxConcurrent <= 5
    ? Math.floor(_maxConcurrent)
    : 2;
const _bookAttempts = Number(process.env["BOOK_ATTEMPTS_PER_WAVE"]);
const BOOK_ATTEMPTS_PER_WAVE = Number.isFinite(_bookAttempts) && _bookAttempts >= 1 && _bookAttempts <= 10
    ? Math.floor(_bookAttempts)
    : BOOKING_MODE === "sequential"
        ? 3
        : 5;
const _pbs = Number(process.env["PARALLEL_BOOK_SLOTS"]);
const PARALLEL_BOOK_COUNT = Number.isFinite(_pbs) && _pbs >= 1 && _pbs <= 10
    ? Math.floor(_pbs)
    : 5;
const _stagger = Number(process.env["BOOKING_STAGGER_MS"]);
const BOOKING_STAGGER_MS = Number.isFinite(_stagger) && _stagger >= 0 && _stagger <= 200
    ? Math.floor(_stagger)
    : 0;
const BOOKING_COOLDOWN_FALLBACK_MS = 15_000;
const MIN_BOOKING_COOLDOWN_MS = 2_000;
const MAX_BOOKING_COOLDOWN_MS = 34_999;
const BOOKING_VAGUE_MINUTE_COOLDOWN_MS = 20_000;
const BOOKING_POST_WINDOW_MS = 60_000;
const BOOKING_POST_MAX_PER_WINDOW = 10;
const JITTER_POLL_MS = 100;
const JITTER_NO_SLOTS_MS = 200;
const JITTER_RATE_LIMIT_MS = 400;
const _tokenWatchEnv = Number(process.env["TOKEN_WATCH_INTERVAL_MS"]);
const TOKEN_WATCH_INTERVAL_MS = Number.isFinite(_tokenWatchEnv) && _tokenWatchEnv > 0
    ? _tokenWatchEnv
    : 30_000;
const _tokenWatchForceAfter = Number(process.env["TOKEN_WATCH_FORCE_AFTER_ATTEMPT"]);
const TOKEN_WATCH_FORCE_AFTER_ATTEMPT = Number.isFinite(_tokenWatchForceAfter) && _tokenWatchForceAfter >= 1
    ? Math.floor(_tokenWatchForceAfter)
    : 3000;
const SECTION_WIDTH = 40;
const REGEX_RATE_LIMIT = /rate limit/i;
const REGEX_WAIT_MINUTE = /wait for a minute/i;
const REGEX_BOOKING_SECONDS = /(\d+)\s*(?:sec|seconds?)/i;
const REGEX_MINUTE_PHRASE = /\ba minute\b|one minute|try again in (?:a |one )?minute/i;
const c = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    prompt: "\x1b[36m",
};
const LOG_PATH = path.join(process.cwd(), "bot.log");
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
function logTs() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function logToFile(msg) {
    logStream.write(`[${logTs()}] ${msg}\n`);
}
function printRule() {
    console.log("=".repeat(SECTION_WIDTH));
}
function print(color, msg) {
    process.stdout.write(`${color}${msg}${c.reset}\n`);
    logToFile(msg);
}
let lastStatusLength = 0;
function writeStatus(msg) {
    const padded = msg.padEnd(lastStatusLength, " ");
    lastStatusLength = msg.length;
    process.stdout.write(`\r${c.cyan}${padded}${c.reset}`);
}
function clearStatus() {
    process.stdout.write(`\r${" ".repeat(lastStatusLength)}\r`);
    lastStatusLength = 0;
}
const errorMessages = {
    noAppointments: "No schedules available for the selected zone",
    tooManyRequests: auth_1.scheduleTooManyRequestsMessage,
    incorrectDeclarationNumber: "The transit declaration number is invalid or does not match the selected ports",
    bookingRateLimited: "__booking_rate_limited__",
};
function isBookingRateLimitMessage(msg) {
    return REGEX_RATE_LIMIT.test(msg) || REGEX_WAIT_MINUTE.test(msg);
}
function cooldownMsFromBookingMessage(msg) {
    const m = msg.match(REGEX_BOOKING_SECONDS);
    if (m)
        return parseInt(m[1], 10) * 1000;
    if (REGEX_MINUTE_PHRASE.test(msg)) {
        return BOOKING_VAGUE_MINUTE_COOLDOWN_MS;
    }
    return undefined;
}
function clampBookingCooldownMs(ms) {
    return Math.min(MAX_BOOKING_COOLDOWN_MS, Math.max(MIN_BOOKING_COOLDOWN_MS, Math.ceil(ms)));
}
function throwBookingRateLimited(res, errMsgForBody) {
    const fromHeader = (0, auth_1.parseRetryAfterMs)(res);
    const fromBody = cooldownMsFromBookingMessage(errMsgForBody);
    const ms = clampBookingCooldownMs(fromHeader ?? fromBody ?? BOOKING_COOLDOWN_FALLBACK_MS);
    const e = new Error(errorMessages.bookingRateLimited);
    e.retryAfterMs = ms;
    throw e;
}
function getBookingCooldownMs(err) {
    const e = err;
    if (typeof e.retryAfterMs === "number" && Number.isFinite(e.retryAfterMs)) {
        return clampBookingCooldownMs(e.retryAfterMs);
    }
    return clampBookingCooldownMs(BOOKING_COOLDOWN_FALLBACK_MS);
}
function throwScheduleRateLimited(response) {
    const ra = (0, auth_1.parseRetryAfterMs)(response);
    const ms = ra !== undefined
        ? Math.min(Math.max(ra, auth_1.SCHEDULE_429_MIN_BACKOFF_MS), auth_1.SCHEDULE_429_MAX_BACKOFF_MS)
        : RATE_LIMIT_BACKOFF_MS;
    const e = new Error(errorMessages.tooManyRequests);
    e.scheduleBackoffMs = ms;
    throw e;
}
function getScheduleBackoffMs(err) {
    const e = err;
    if (typeof e.scheduleBackoffMs === "number" &&
        Number.isFinite(e.scheduleBackoffMs)) {
        return Math.max(auth_1.SCHEDULE_429_MIN_BACKOFF_MS, Math.ceil(e.scheduleBackoffMs));
    }
    return RATE_LIMIT_BACKOFF_MS;
}
function jitteredDelayMs(base, jitterMax) {
    if (base <= 0)
        return 0;
    return base + Math.floor(Math.random() * (jitterMax + 1));
}
function activePorts() {
    return ports_1.default.filter((p) => p.IS_ACTIVE);
}
function isAbortError(e) {
    return e instanceof Error && e.name === "AbortError";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleepWithJitter(baseMs, jitterMax) {
    await sleep(jitteredDelayMs(baseMs, jitterMax));
}
class BookingPostBudget {
    timestamps = new Array(BOOKING_POST_MAX_PER_WINDOW);
    head = 0;
    count = 0;
    chain = Promise.resolve();
    take() {
        const p = this.chain.then(() => this.takeSerial());
        this.chain = p.catch(() => { });
        return p;
    }
    async takeSerial() {
        for (;;) {
            const now = Date.now();
            if (this.count === BOOKING_POST_MAX_PER_WINDOW) {
                const oldest = this.timestamps[this.head];
                if (now - oldest < BOOKING_POST_WINDOW_MS) {
                    const waitMs = BOOKING_POST_WINDOW_MS - (now - oldest) + 25;
                    await sleep(Math.min(Math.max(waitMs, 50), BOOKING_POST_WINDOW_MS));
                    continue;
                }
                this.head = (this.head + 1) % BOOKING_POST_MAX_PER_WINDOW;
                this.count--;
            }
            this.timestamps[(this.head + this.count) % BOOKING_POST_MAX_PER_WINDOW] = now;
            this.count++;
            return;
        }
    }
    remaining() {
        const now = Date.now();
        let used = 0;
        for (let i = 0; i < this.count; i++) {
            const idx = (this.head + i) % BOOKING_POST_MAX_PER_WINDOW;
            if (now - this.timestamps[idx] < BOOKING_POST_WINDOW_MS)
                used++;
        }
        return Math.max(0, BOOKING_POST_MAX_PER_WINDOW - used);
    }
}
const bookingBudgetByToken = new Map();
function bookingBudgetForToken(token) {
    let b = bookingBudgetByToken.get(token);
    if (!b) {
        b = new BookingPostBudget();
        bookingBudgetByToken.set(token, b);
    }
    return b;
}
function readHiddenLine(prompt) {
    return new Promise((resolve) => {
        if (!node_process_1.stdin.isTTY || typeof node_process_1.stdin.setRawMode !== "function") {
            resolve("");
            return;
        }
        node_process_1.stdout.write(prompt);
        node_process_1.stdin.setRawMode(true);
        let line = "";
        const finish = () => {
            node_process_1.stdin.setRawMode(false);
            node_process_1.stdin.removeListener("data", onData);
            node_process_1.stdout.write("\n");
            resolve(line.trim());
        };
        const onData = (buf) => {
            const s = buf.toString("utf8");
            for (let i = 0; i < s.length; i++) {
                const code = s.charCodeAt(i);
                if (code === 13 || code === 10) {
                    finish();
                    return;
                }
                if (code === 3) {
                    process.exit(130);
                }
                if (code === 127 || code === 8) {
                    if (line.length > 0) {
                        line = line.slice(0, -1);
                        node_process_1.stdout.write("\b \b");
                    }
                    continue;
                }
                line += s[i];
            }
        };
        node_process_1.stdin.on("data", onData);
    });
}
function useHiddenTokenInput() {
    return (process.platform !== "win32" &&
        node_process_1.stdin.isTTY &&
        typeof node_process_1.stdin.setRawMode === "function");
}
async function readTokenLine(rl, prompt) {
    if (!useHiddenTokenInput()) {
        return (await rl.question(prompt)).trim();
    }
    rl.pause();
    try {
        return await readHiddenLine(prompt);
    }
    finally {
        rl.resume();
    }
}
async function promptPortCode() {
    const list = activePorts();
    if (list.length === 0) {
        throw new Error("No active ports configured.");
    }
    const response = await (0, prompts_1.default)({
        type: "select",
        name: "port_code",
        message: "Select port",
        choices: list.map((p) => ({
            title: `${p.PORT_NAME} (${p.PORT_CODE})`,
            value: p.PORT_CODE,
        })),
    }, {
        onCancel: () => {
            process.exit(130);
        },
    });
    const port_code = response.port_code;
    if (typeof port_code !== "string" || port_code.length === 0) {
        throw new Error("No port selected.");
    }
    if (node_process_1.stdin.isTTY) {
        try {
            node_process_1.stdin.setRawMode(false);
        }
        catch { }
    }
    await new Promise((resolve) => setImmediate(resolve));
    node_process_1.stdin.resume();
    return port_code;
}
function normalizeBearer(raw) {
    const t = raw.trim();
    return /^bearer\s/i.test(t)
        ? t.replace(/^bearer\s+/i, "Bearer ")
        : `Bearer ${t}`;
}
async function tokenProbeOk(port_code, bearer) {
    if (process.env["SKIP_TOKEN_VALIDATION"] === "1")
        return true;
    if (await (0, auth_1.probeScheduleToken)(port_code, bearer))
        return true;
    if (port_code !== "95" && (await (0, auth_1.probeScheduleToken)("95", bearer)))
        return true;
    return (0, auth_1.checkIsLoggedIn)(port_code);
}
async function validateToken(rl, label, promptLabel, port_code, tokenRole = "search") {
    printRule();
    print(c.dim, label);
    if (useHiddenTokenInput()) {
        process.stdout.write(`${c.dim}Hidden input. Paste, then Enter.${c.reset}\n`);
    }
    else {
        process.stdout.write(`${c.dim}Paste at ${promptLabel} below (visible in this console), then Enter.${c.reset}\n`);
    }
    for (;;) {
        const raw = await readTokenLine(rl, `${c.prompt}${promptLabel}${c.reset}: `);
        const token = raw.trim();
        if (!token) {
            print(c.red, "Token is required.");
            continue;
        }
        const bearer = normalizeBearer(token);
        (0, auth_1.setAuthToken)(bearer);
        if (tokenRole === "booking") {
            print(c.green, `Token accepted (tail ${bearer.slice(-6)})`);
            return bearer;
        }
        print(c.dim, "Validating token...");
        if (await tokenProbeOk(port_code, bearer)) {
            print(c.green, `Token accepted (tail ${bearer.slice(-6)})`);
            return bearer;
        }
        print(c.yellow, `Token accepted (tail ${bearer.slice(-6)}), login probe failed — hunt will try anyway.`);
        return bearer;
    }
}
async function collectBookingTokens(rl, driverName, port_code) {
    const tokens = [];
    let adding = true;
    let idx = 1;
    while (adding) {
        const bearer = await validateToken(rl, `${driverName}: booking token ${idx}`, `BOOKING_TOKEN_${idx}`, port_code, "booking");
        tokens.push(bearer);
        idx++;
        const more = (await rl.question(`${c.prompt}Add another booking token? (Y/N):${c.reset} `))
            .trim()
            .toLowerCase();
        adding = more === "y";
    }
    return tokens;
}
async function collectDriverArgs(rl, ordinalLabel, port_code) {
    const ask = async (label) => {
        let value = "";
        while (!value) {
            value = (await rl.question(`${c.prompt}${label}:${c.reset} `)).trim();
            if (!value)
                print(c.dim, "This field is required.");
        }
        return value;
    };
    printRule();
    print(c.dim, `${ordinalLabel}: display name (for your logs only; not sent to the server)`);
    const driverName = await ask("Driver display name");
    printRule();
    print(c.dim, `${driverName}: vehicle and declaration`);
    const declaration_number = await ask("Declaration number");
    const licenseNo = await ask("License number");
    const residentCountry = await ask("Resident country code");
    const plateCountry = await ask("Plate country code");
    const vehicleSequenceNumber = await ask("Vehicle serial number");
    const chassisNo = await ask("Chassis number");
    printRule();
    print(c.dim, `${driverName}: hour preferences`);
    const rawTier1 = (await rl.question(`${c.prompt}Desired booking hour (0-23, leave blank to skip):${c.reset} `)).trim();
    const tier1 = (0, scheduling_1.parseOptionalInt)(rawTier1);
    let tier2Start = null;
    let tier2End = null;
    const rawT2Start = (await rl.question(`${c.prompt}Backup window start hour (0-23, leave blank to skip):${c.reset} `)).trim();
    tier2Start = (0, scheduling_1.parseOptionalInt)(rawT2Start);
    if (tier2Start !== null) {
        const rawT2End = (await rl.question(`${c.prompt}Backup window end hour (0-23):${c.reset} `)).trim();
        tier2End = (0, scheduling_1.parseOptionalInt)(rawT2End);
        if (tier2End === null || tier2End < tier2Start) {
            print(c.dim, "Invalid end hour. Backup window cleared.");
            tier2Start = null;
            tier2End = null;
        }
    }
    if (tier1 !== null)
        console.log(`${c.dim}Tier 1 (desired): ${tier1}:00${c.reset}`);
    if (tier2Start !== null && tier2End !== null) {
        console.log(`${c.dim}Tier 2 (backup): ${tier2Start}:00 - ${tier2End}:00${c.reset}`);
    }
    if (tier1 !== null || (tier2Start !== null && tier2End !== null)) {
        console.log(`${c.dim}Tier 3 fallback: night hours (19-23) first, then other hours.${c.reset}\n`);
    }
    else {
        console.log(`${c.dim}Tier 3 fallback: morning hours (0-12) first (no tier 1/2 set).${c.reset}\n`);
    }
    const bookingTokens = await collectBookingTokens(rl, driverName, port_code);
    return {
        driverName,
        bookingTokens,
        declaration_number,
        licenseNo,
        plateCountry,
        residentCountry,
        vehicleSequenceNumber,
        chassisNo,
        port_code,
        hourPrefs: { tier1, tier2Start, tier2End },
    };
}
async function collectSetup() {
    printRule();
    process.stdout.write(`${c.bold}Appointment setup${c.reset}\n`);
    print(c.dim, "All fields required.\n");
    const port_code = await promptPortCode();
    printRule();
    console.log(`${c.dim}Port code:${c.reset} ${port_code}\n`);
    const rl = readlinePromises.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
    const drivers = [];
    let searchToken = "";
    try {
        let adding = true;
        while (adding) {
            const driverNum = drivers.length + 1;
            const label = `Driver ${driverNum}`;
            printRule();
            process.stdout.write(`${c.bold}${label}${c.reset}\n`);
            const args = await collectDriverArgs(rl, label, port_code);
            drivers.push({ label: args.driverName, args });
            const more = (await rl.question(`${c.prompt}Add another driver? (Y/N):${c.reset} `))
                .trim()
                .toLowerCase();
            adding = more === "y";
        }
        searchToken = await validateToken(rl, "Search token (used for finding slots only)", "SEARCH_TOKEN", port_code);
        console.log("");
        printRule();
        console.log(`${c.bold}Ready to launch ${drivers.length} bot(s)${c.reset}\n`);
        console.log(`  Search token: ...${searchToken.slice(-6)}`);
        for (const { args } of drivers) {
            const t1 = args.hourPrefs.tier1 !== null ? `${args.hourPrefs.tier1}:00` : "-";
            const t2 = args.hourPrefs.tier2Start !== null
                ? `${args.hourPrefs.tier2Start}:00-${args.hourPrefs.tier2End}:00`
                : "-";
            const tails = args.bookingTokens.map((t) => `...${t.slice(-6)}`).join(", ");
            console.log(`  ${args.driverName}: license ${args.licenseNo} | serial ${args.vehicleSequenceNumber} | T1 ${t1} | T2 ${t2} | booking x${args.bookingTokens.length} (${tails})`);
        }
        printRule();
        console.log("");
        let ready = false;
        while (!ready) {
            const confirm = (await rl.question(`${c.prompt}Press Y to launch all:${c.reset} `))
                .trim()
                .toLowerCase();
            if (confirm === "y")
                ready = true;
            else
                print(c.dim, "Type Y to begin.");
        }
    }
    finally {
        rl.close();
    }
    return { searchToken, port_code, drivers };
}
async function getSchedule({ port_code = "95", token, }) {
    const base = (0, auth_1.fasahScheduleLandBase)();
    const response = await fetch(`${base}?departure=AGF&arrival=${port_code}&type=TRANSIT&economicOperator=`, {
        headers: {
            ...auth_1.commonHeaders,
            token,
        },
        referrer: (0, auth_1.fasahHttpReferer)(),
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
    });
    if (response.status === 429) {
        throwScheduleRateLimited(response);
    }
    if (!response.ok) {
        throw new Error(`Failed to get schedule: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json());
    if (data.success === false) {
        const errMsg = data.error?.[0]?.message ||
            data.errors?.[0]?.message ||
            data.message ||
            errorMessages.noAppointments;
        if (errMsg === errorMessages.noAppointments ||
            errMsg === errorMessages.tooManyRequests ||
            errMsg === errorMessages.incorrectDeclarationNumber) {
            throw new Error(errMsg);
        }
        throw new Error(errorMessages.noAppointments);
    }
    if (!data.schedules || data.schedules.length === 0) {
        throw new Error(errorMessages.noAppointments);
    }
    return data;
}
async function bookAppointment({ port_code, zone_schedule_id, token, licenseNo, plateCountry, residentCountry, vehicleSequenceNumber, chassisNo, declaration_number, bookingBudget, signal, }) {
    const appointmentUrl = (0, auth_1.fasahAppointmentCreateUrl)();
    const body = {
        port_code,
        zone_schedule_id,
        purpose: "6",
        cargo_type: "",
        fleet_info: [
            {
                licenseNo,
                plateCountry,
                residentCountry,
                vehicleSequenceNumber,
                chassisNo,
            },
        ],
        bayan_appointment: {},
        declaration_number,
    };
    try {
        await bookingBudget.take();
        const response = await fetch(appointmentUrl, {
            headers: {
                ...auth_1.commonHeaders,
                token,
            },
            referrer: (0, auth_1.fasahHttpReferer)(),
            body: JSON.stringify(body),
            method: "POST",
            mode: "cors",
            credentials: "include",
            signal,
        });
        if (response.status === 429) {
            throwBookingRateLimited(response, "");
        }
        if (!response.ok) {
            let rawBody = "";
            try {
                rawBody = await response.text();
            }
            catch { }
            logToFile(`Booking HTTP ${response.status} ${response.statusText} | body: ${rawBody.slice(0, 500)}`);
            return false;
        }
        const data = await response.json();
        if (data.success === false) {
            const errMsg = data.error?.[0]?.message ||
                data.errors?.[0]?.message ||
                data.message ||
                "Unknown error";
            process.stdout.write("\n");
            print(c.red, `Booking rejected: ${errMsg}`);
            if (errMsg === errorMessages.incorrectDeclarationNumber) {
                throw new Error(errorMessages.incorrectDeclarationNumber);
            }
            if (isBookingRateLimitMessage(errMsg)) {
                throwBookingRateLimited(response, errMsg);
            }
            return false;
        }
        return true;
    }
    catch (error) {
        if (isAbortError(error))
            return false;
        const msg = error.message;
        if (msg === errorMessages.tooManyRequests)
            throw error;
        if (msg === errorMessages.bookingRateLimited)
            throw error;
        if (msg === errorMessages.incorrectDeclarationNumber)
            throw error;
        logToFile(`Booking exception: ${msg}`);
        return false;
    }
}
async function tryBookSlot(slot, driver, tag) {
    const tokens = driver.args.bookingTokens;
    print(c.yellow, `${tag}Booking attempt - 1 slot x ${tokens.length} token(s)...`);
    let rateLimitedCount = 0;
    let maxCooldownMs = 0;
    for (let ti = 0; ti < tokens.length; ti++) {
        const token = tokens[ti];
        if (ti > 0 && BOOKING_STAGGER_MS > 0) {
            await sleep(BOOKING_STAGGER_MS);
        }
        try {
            const ok = await bookAppointment({
                token,
                licenseNo: driver.args.licenseNo,
                plateCountry: driver.args.plateCountry,
                residentCountry: driver.args.residentCountry,
                vehicleSequenceNumber: driver.args.vehicleSequenceNumber,
                chassisNo: driver.args.chassisNo,
                declaration_number: driver.args.declaration_number,
                port_code: slot.port_code,
                zone_schedule_id: slot.zone_schedule_id,
                bookingBudget: bookingBudgetForToken(token),
            });
            if (ok) {
                return {
                    booked: slot,
                    badDeclaration: false,
                    rateLimitedAll: false,
                    cooldownMs: 0,
                };
            }
        }
        catch (e) {
            const msg = e.message;
            if (msg === errorMessages.incorrectDeclarationNumber) {
                return { badDeclaration: true, rateLimitedAll: false, cooldownMs: 0 };
            }
            if (msg === errorMessages.bookingRateLimited ||
                msg === errorMessages.tooManyRequests) {
                rateLimitedCount++;
                const cd = getBookingCooldownMs(e);
                if (cd > maxCooldownMs)
                    maxCooldownMs = cd;
                continue;
            }
            throw e;
        }
    }
    if (rateLimitedCount >= tokens.length) {
        return {
            badDeclaration: false,
            rateLimitedAll: true,
            cooldownMs: maxCooldownMs || BOOKING_COOLDOWN_FALLBACK_MS,
        };
    }
    return { badDeclaration: false, rateLimitedAll: false, cooldownMs: 0 };
}
function minBudgetRemaining(driver) {
    let min = BOOKING_POST_MAX_PER_WINDOW;
    for (const token of driver.args.bookingTokens) {
        const left = bookingBudgetForToken(token).remaining();
        if (left < min)
            min = left;
    }
    return min;
}
function applyBookAttemptResult(idx, driver, result, tag, active, cooldownUntil) {
    if (result.booked) {
        console.log("");
        printBookingResult(true, driver.args, result.booked);
        active.delete(idx);
        cooldownUntil.delete(idx);
        return false;
    }
    if (result.badDeclaration) {
        print(c.red, `${tag}Declaration number invalid. Removing driver.`);
        printBookingResult(false, driver.args);
        active.delete(idx);
        cooldownUntil.delete(idx);
        return false;
    }
    if (result.rateLimitedAll) {
        print(c.yellow, `${tag}All booking tokens rate limited - ${Math.ceil(result.cooldownMs / 1000)}s cooldown`);
        cooldownUntil.set(idx, Date.now() + result.cooldownMs);
        return true;
    }
    print(c.dim, `${tag}Booking failed (slots may have been taken).`);
    return false;
}
async function roundRobinBookPass(jobs, active, cooldownUntil, multiMode, batchSize, smartState) {
    let rateLimitHits = 0;
    for (let pass = 0; pass < BOOK_ATTEMPTS_PER_WAVE; pass++) {
        const passJobs = jobs.filter((j) => active.has(j.idx));
        if (passJobs.length === 0)
            break;
        let concurrent = Math.max(1, Math.min(batchSize, passJobs.length));
        if (smartState && concurrent > 1) {
            const budgetOk = passJobs.every((j) => minBudgetRemaining(j.driver) >= 3);
            if (!budgetOk)
                concurrent = 1;
        }
        for (let i = 0; i < passJobs.length; i += concurrent) {
            const batch = passJobs.slice(i, i + concurrent);
            const settled = await Promise.allSettled(batch.map(async (job) => {
                const tag = multiMode ? `[${job.driver.label}] ` : "";
                const slot = job.candidates[pass];
                if (!slot) {
                    return { idx: job.idx, driver: job.driver, result: null, tag };
                }
                const result = await tryBookSlot(slot, job.driver, tag);
                return { idx: job.idx, driver: job.driver, result, tag };
            }));
            for (const s of settled) {
                if (s.status !== "fulfilled" || !s.value.result)
                    continue;
                const { idx, driver, result, tag } = s.value;
                const hit429 = applyBookAttemptResult(idx, driver, result, tag, active, cooldownUntil);
                if (hit429) {
                    rateLimitHits++;
                    if (smartState)
                        smartState.maxConcurrent = 1;
                }
            }
        }
    }
    return rateLimitHits;
}
async function raceBookBatches(candidates, startOffset, driver, tag) {
    const tokens = driver.args.bookingTokens;
    for (let offset = startOffset; offset < candidates.length; offset += PARALLEL_BOOK_COUNT) {
        const slotBatch = candidates.slice(offset, offset + PARALLEL_BOOK_COUNT);
        const batchNum = Math.floor(offset / PARALLEL_BOOK_COUNT) + 1;
        print(c.yellow, `${tag}Booking batch ${batchNum} - ${slotBatch.length} slot(s) x ${tokens.length} token(s)...`);
        const globalAbort = new AbortController();
        let bookedSlot;
        let badDeclaration = false;
        let rateLimitedCount = 0;
        let maxCooldownMs = 0;
        const totalPairs = tokens.length * slotBatch.length;
        const tasks = [];
        for (const token of tokens) {
            const budget = bookingBudgetForToken(token);
            for (const slot of slotBatch) {
                tasks.push((async () => {
                    if (globalAbort.signal.aborted)
                        return;
                    try {
                        const ok = await bookAppointment({
                            token,
                            licenseNo: driver.args.licenseNo,
                            plateCountry: driver.args.plateCountry,
                            residentCountry: driver.args.residentCountry,
                            vehicleSequenceNumber: driver.args.vehicleSequenceNumber,
                            chassisNo: driver.args.chassisNo,
                            declaration_number: driver.args.declaration_number,
                            port_code: slot.port_code,
                            zone_schedule_id: slot.zone_schedule_id,
                            bookingBudget: budget,
                            signal: globalAbort.signal,
                        });
                        if (ok && !bookedSlot) {
                            bookedSlot = slot;
                            globalAbort.abort();
                        }
                    }
                    catch (e) {
                        if (isAbortError(e))
                            return;
                        const msg = e.message;
                        if (msg === errorMessages.incorrectDeclarationNumber) {
                            badDeclaration = true;
                            globalAbort.abort();
                        }
                        else if (msg === errorMessages.bookingRateLimited ||
                            msg === errorMessages.tooManyRequests) {
                            rateLimitedCount++;
                            const cd = getBookingCooldownMs(e);
                            if (cd > maxCooldownMs)
                                maxCooldownMs = cd;
                        }
                    }
                })());
            }
        }
        await Promise.allSettled(tasks);
        if (bookedSlot) {
            return { booked: bookedSlot, badDeclaration: false, rateLimitedAll: false, cooldownMs: 0 };
        }
        if (badDeclaration) {
            return { badDeclaration: true, rateLimitedAll: false, cooldownMs: 0 };
        }
        if (rateLimitedCount >= totalPairs) {
            return { badDeclaration: false, rateLimitedAll: true, cooldownMs: maxCooldownMs || BOOKING_COOLDOWN_FALLBACK_MS };
        }
        print(c.dim, `${tag}Batch ${batchNum} failed, trying next slots...`);
    }
    return { badDeclaration: false, rateLimitedAll: false, cooldownMs: 0 };
}
function raceBookAllTokens(candidates, driver, tag) {
    return raceBookBatches(candidates, 0, driver, tag);
}
function printBookingResult(success, args, slot) {
    const sep = "=".repeat(40);
    console.log(sep);
    print(success ? c.green : c.red, `${(0, scheduling_1.possessiveLabel)(args.driverName)} appointment = ${success}`);
    console.log(`License number:        ${args.licenseNo}`);
    console.log(`Vehicle serial number: ${args.vehicleSequenceNumber}`);
    if (success && slot) {
        console.log(`Slot (local):          ${(0, scheduling_1.formatScheduleLocal)(slot.schedule_from)}`);
        console.log(`Zone schedule ID:      ${slot.zone_schedule_id}`);
    }
    console.log(sep + "\n");
}
const TIER_LABEL = {
    1: "tier 1 (exact hour)",
    2: "tier 2 (window)",
    3: "tier 3 (fallback)",
};
async function runTokenWatchOnce(port_code, searchTokenRef, lastSearchScheduleOkAt, options, attempt) {
    if (!options.interactive || !options.rl) {
        return { rateLimited: false };
    }
    const rl = options.rl;
    const forceProbe = attempt > TOKEN_WATCH_FORCE_AFTER_ATTEMPT;
    if (forceProbe ||
        Date.now() - lastSearchScheduleOkAt.at >= TOKEN_WATCH_INTERVAL_MS) {
        try {
            const ok = await (0, auth_1.probeScheduleToken)(port_code, searchTokenRef.current);
            if (!ok) {
                clearStatus();
                const next = await validateToken(rl, "Search token (used for finding slots only)", "SEARCH_TOKEN", port_code);
                searchTokenRef.current = next;
            }
        }
        catch (e) {
            const msg = e.message;
            if (msg === errorMessages.tooManyRequests) {
                return { rateLimited: true, rateLimitBackoffMs: getScheduleBackoffMs(e) };
            }
            throw e;
        }
    }
    return { rateLimited: false };
}
async function runOrchestrator(searchTokenRef, port_code, drivers, options) {
    const multiMode = drivers.length > 1;
    const active = new Map();
    drivers.forEach((d, i) => active.set(i, d));
    const cooldownUntil = new Map();
    let attempt = 0;
    let rateLimitCount = 0;
    let noSlotCount = 0;
    const startTime = Date.now();
    let lastTokenWatchAt = Date.now();
    const lastSearchScheduleOkAt = { at: 0 };
    let longRunTokenWatchLogged = false;
    while (attempt < EFFECTIVE_MAX_TRIES && active.size > 0) {
        attempt++;
        if (!longRunTokenWatchLogged &&
            attempt > TOKEN_WATCH_FORCE_AFTER_ATTEMPT &&
            options.interactive) {
            longRunTokenWatchLogged = true;
            print(c.yellow, "Long run: checking search token every 30s from now on.");
        }
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        writeStatus(`Searching... attempt ${attempt} | ${elapsed}s | rate-limited ${rateLimitCount}x | no slots ${noSlotCount}x | ${active.size} driver(s)`);
        if (!SEARCH_SPAM_MODE &&
            options.interactive &&
            Date.now() - lastTokenWatchAt >= TOKEN_WATCH_INTERVAL_MS) {
            const w = await runTokenWatchOnce(port_code, searchTokenRef, lastSearchScheduleOkAt, options, attempt);
            lastTokenWatchAt = Date.now();
            if (w.rateLimited) {
                rateLimitCount++;
                await sleepWithJitter(w.rateLimitBackoffMs ?? RATE_LIMIT_BACKOFF_MS, JITTER_RATE_LIMIT_MS);
                continue;
            }
        }
        let allSlots = [];
        try {
            const schedule = await getSchedule({
                port_code,
                token: searchTokenRef.current,
            });
            allSlots = schedule.schedules ?? [];
            lastSearchScheduleOkAt.at = Date.now();
        }
        catch (error) {
            const msg = error.message;
            if (msg === errorMessages.tooManyRequests) {
                rateLimitCount++;
                continue;
            }
            if (msg === errorMessages.noAppointments) {
                lastSearchScheduleOkAt.at = Date.now();
            }
            noSlotCount++;
            await sleepWithJitter(SEARCH_GAP_MS, 0);
            continue;
        }
        if (allSlots.length === 0) {
            noSlotCount++;
            await sleepWithJitter(SEARCH_GAP_MS, 0);
            continue;
        }
        clearStatus();
        const now = Date.now();
        const jobs = [];
        for (const [idx, driver] of active) {
            const cd = cooldownUntil.get(idx) ?? 0;
            if (now < cd) {
                const left = Math.ceil((cd - now) / 1000);
                const tag = multiMode ? `[${driver.label}] ` : "";
                print(c.dim, `${tag}Booking cooldown ${left}s remaining, skipping...`);
                continue;
            }
            const { candidates, tier } = (0, scheduling_1.applyTierFilter)(allSlots, driver.args.hourPrefs);
            if (candidates.length > 0) {
                jobs.push({ idx, driver, candidates, tier });
            }
        }
        if (jobs.length === 0) {
            writeStatus(`${allSlots.length} slot(s) open, none match prefs or all on cooldown | attempt ${attempt}`);
            await sleepWithJitter(SEARCH_GAP_MS, 0);
            continue;
        }
        const slotsDetectedAt = Date.now();
        print(c.dim, `Slots detected at ${new Date(slotsDetectedAt).toISOString()}`);
        for (const job of jobs) {
            const head = job.candidates[0];
            const tag = multiMode ? `[${job.driver.label}] ` : "";
            print(c.yellow, `${tag}Slots found (${job.candidates.length}) via ${TIER_LABEL[job.tier]}: best ${head.schedule_from} (${(0, scheduling_1.slotHour)(head)}:00), avail ${head.available_slot}`);
        }
        let rateLimitHits = 0;
        if (BOOKING_MODE === "burst") {
            for (const job of jobs) {
                if (!active.has(job.idx))
                    continue;
                const tag = multiMode ? `[${job.driver.label}] ` : "";
                try {
                    const result = await raceBookAllTokens(job.candidates, job.driver, tag);
                    if (applyBookAttemptResult(job.idx, job.driver, result, tag, active, cooldownUntil)) {
                        rateLimitHits++;
                    }
                }
                catch (reason) {
                    print(c.red, `${tag}Unexpected booking error: ${reason}`);
                }
                if (active.size === 0)
                    break;
            }
        }
        else if (BOOKING_MODE === "sequential") {
            rateLimitHits = await roundRobinBookPass(jobs, active, cooldownUntil, multiMode, 1);
        }
        else {
            const smartState = { maxConcurrent: MAX_CONCURRENT_DRIVERS };
            rateLimitHits = await roundRobinBookPass(jobs, active, cooldownUntil, multiMode, smartState.maxConcurrent, smartState);
        }
        if (rateLimitHits > 0)
            rateLimitCount += rateLimitHits;
        if (active.size === 0)
            break;
        await sleepWithJitter(POLL_INTERVAL_MS, 0);
    }
    if (active.size === 0) {
        return "all_booked";
    }
    for (const [, driver] of active) {
        const tag = multiMode ? `[${driver.label}] ` : "";
        print(c.red, `${tag}Max attempts (${EFFECTIVE_MAX_TRIES}) reached without a successful booking.`);
        printBookingResult(false, driver.args);
    }
    return "max_attempts";
}
void (async () => {
    try {
        logToFile("--- session start v" + VERSION + " ---");
        print(c.dim, `Port appointment finder v${VERSION}`);
        if (process.env["FASAH_API_ORIGIN"]?.trim() ||
            process.env["FASAH_HTTP_REFERER"]?.trim()) {
            print(c.dim, "FASAH_API_ORIGIN / FASAH_HTTP_REFERER are set.");
        }
        let searchToken;
        let port_code;
        let drivers;
        const uiConfigJson = process.env["BOT_CONFIG"];
        const uiMode = process.env["BOT_UI_MODE"] === "1" && !!uiConfigJson;
        const smokeSetup = process.env["SMOKE_SKIP_SETUP"] === "1";
        if (smokeSetup) {
            searchToken =
                process.env["SMOKE_SEARCH_TOKEN"] ?? "Bearer mock_search_smoke_token";
            port_code = process.env["SMOKE_PORT_CODE"] ?? "95";
            const rawDrivers = process.env["SMOKE_DRIVERS_JSON"];
            if (!rawDrivers) {
                throw new Error("SMOKE_DRIVERS_JSON is required for smoke setup");
            }
            const parsed = JSON.parse(rawDrivers);
            drivers = parsed.map((d) => ({ label: d.driverName, args: d }));
        }
        else if (uiMode) {
            const cfg = JSON.parse(uiConfigJson);
            searchToken = cfg.searchToken;
            port_code = cfg.port_code;
            drivers = cfg.drivers.map((d) => ({
                label: d.driverName,
                args: d,
            }));
        }
        else {
            const setup = await collectSetup();
            searchToken = setup.searchToken;
            port_code = setup.port_code;
            drivers = setup.drivers;
        }
        logToFile(`Setup: port=${port_code} drivers=${drivers.length}`);
        const searchTokenRef = { current: searchToken };
        if (uiMode && !smokeSetup) {
            await runOrchestrator(searchTokenRef, port_code, drivers, {
                interactive: false,
            });
        }
        else {
            const rl = readlinePromises.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
            try {
                for (;;) {
                    const outcome = await runOrchestrator(searchTokenRef, port_code, drivers, {
                        rl,
                        interactive: true,
                    });
                    if (outcome !== "max_attempts")
                        break;
                    clearStatus();
                    const envRetry = process.env["SMOKE_OUTER_RETRY_ANSWER"] ??
                        (smokeSetup ? "n" : undefined);
                    if (envRetry !== undefined) {
                        print(c.dim, `Run another search with same drivers? (Y/N): ${envRetry.trim()}`);
                    }
                    const again = (envRetry !== undefined
                        ? envRetry
                        : await rl.question(`${c.prompt}Run another search with same drivers? (Y/N):${c.reset} `))
                        .trim()
                        .toLowerCase();
                    if (again !== "y")
                        break;
                }
            }
            finally {
                rl.close();
            }
        }
        if (smokeSetup) {
            logStream.end(() => process.exit(0));
        }
    }
    catch (error) {
        clearStatus();
        print(c.red, `Fatal error: ${error.message}`);
        process.exit(1);
    }
})();
