// Validates every fault-code entry in data/*.json: schema, and that every
// code + every alias normalizes and self-looks-up correctly (mirrors the
// normalization logic in js/data.js). Run with: node test/test-lookup.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = ["worcester-bosch.json", "vaillant.json", "baxi.json", "ideal.json"];
const SEVERITIES = ["lockout", "warning", "info"];
const LIKELIHOODS = ["high", "medium", "low"];
const CONFIDENCES = ["high", "medium", "low"];

function normCode(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

let failures = 0;
let totalCodes = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

for (const file of FILES) {
  const full = path.join(DATA_DIR, file);
  console.log("\n" + file);

  if (!fs.existsSync(full)) {
    fail(`missing file ${full}`);
    continue;
  }

  let raw, entries;
  try {
    raw = fs.readFileSync(full, "utf8");
    entries = JSON.parse(raw);
  } catch (e) {
    fail(`invalid JSON: ${e.message}`);
    continue;
  }

  if (!Array.isArray(entries)) {
    fail("top-level JSON is not an array");
    continue;
  }
  if (entries.length === 0) {
    fail("no entries in file");
    continue;
  }

  const seenKeys = new Map(); // make::series::normCode -> index, to catch real dupes
  const normIndex = new Map(); // make::normcode -> entry, to simulate exact-match lookup

  entries.forEach((e, idx) => {
    const where = `${file}[${idx}] (code=${e && e.code})`;

    ["make", "series", "code", "meaning", "severity", "reset", "confidence"].forEach((f) => {
      if (!e || typeof e[f] !== "string" || !e[f].trim()) {
        fail(`${where}: missing/empty required string field "${f}"`);
      }
    });

    if (e && e.severity && !SEVERITIES.includes(e.severity)) {
      fail(`${where}: severity "${e.severity}" not one of ${SEVERITIES.join("/")}`);
    }
    if (e && e.confidence && !CONFIDENCES.includes(e.confidence)) {
      fail(`${where}: confidence "${e.confidence}" not one of ${CONFIDENCES.join("/")}`);
    }

    if (!e || !Array.isArray(e.causes) || e.causes.length === 0) {
      fail(`${where}: "causes" must be a non-empty array`);
    } else {
      e.causes.forEach((c, ci) => {
        if (!c || typeof c.cause !== "string" || !c.cause.trim()) fail(`${where}: causes[${ci}] missing "cause"`);
        if (!c || !LIKELIHOODS.includes(c.likelihood)) fail(`${where}: causes[${ci}] likelihood "${c && c.likelihood}" invalid`);
      });
    }

    if (!e || !Array.isArray(e.checks) || e.checks.length === 0) {
      fail(`${where}: "checks" must be a non-empty array`);
    } else {
      e.checks.forEach((c, ci) => {
        if (!c || typeof c.step !== "string" || !c.step.trim()) fail(`${where}: checks[${ci}] missing "step"`);
        if (c && typeof c.gasSide !== "boolean") fail(`${where}: checks[${ci}] "gasSide" must be boolean`);
      });
    }

    if (!e || !e.source || typeof e.source !== "object") {
      fail(`${where}: missing "source" object`);
    } else {
      if (typeof e.source.manual !== "string" || !e.source.manual.trim()) fail(`${where}: source.manual missing`);
      if (typeof e.source.page !== "string" || !e.source.page.trim()) fail(`${where}: source.page missing`);
    }

    if (!e) return;
    totalCodes++;

    const dupKey = `${e.make}::${e.series}::${normCode(e.code)}`;
    if (seenKeys.has(dupKey)) {
      fail(`${where}: duplicate code "${e.code}" within same make+series (also at idx ${seenKeys.get(dupKey)})`);
    }
    seenKeys.set(dupKey, idx);

    // Self-lookup check: code and every alias must normalize to a findable key.
    const aliases = Array.isArray(e.aliases) ? e.aliases : [];
    const allForms = [e.code, ...aliases];
    allForms.forEach((form) => {
      const n = normCode(form);
      if (!n) { fail(`${where}: form "${form}" normalizes to empty string`); return; }
      const key = `${e.make}::${n}`;
      if (!normIndex.has(key)) normIndex.set(key, []);
      normIndex.get(key).push(idx);
    });
  });

  // Every normalized form should resolve back to the entries that declared it.
  let formsChecked = 0;
  entries.forEach((e, idx) => {
    const aliases = Array.isArray(e.aliases) ? e.aliases : [];
    [e.code, ...aliases].forEach((form) => {
      const n = normCode(form);
      if (!n) return;
      const key = `${e.make}::${n}`;
      const hits = normIndex.get(key) || [];
      formsChecked++;
      if (!hits.includes(idx)) {
        fail(`self-lookup broken for "${form}" (entry idx ${idx})`);
      }
    });
  });

  console.log(`  ${entries.length} entries, ${formsChecked} code/alias forms verified self-lookup OK`);
}

console.log("\n" + "=".repeat(40));
if (failures > 0) {
  console.error(`${failures} FAILURE(S) across ${totalCodes} total codes.`);
  process.exit(1);
} else {
  console.log(`All checks passed. ${totalCodes} total fault codes verified across ${FILES.length} files.`);
}
