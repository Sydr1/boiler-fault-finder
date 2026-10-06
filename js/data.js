// Loads per-make fault JSON, normalizes codes for tolerant search.
const DATA_FILES = [
  { make: "Worcester Bosch", file: "data/worcester-bosch.json" },
  { make: "Vaillant", file: "data/vaillant.json" },
  { make: "Baxi", file: "data/baxi.json" },
  { make: "Ideal", file: "data/ideal.json" },
];

// Strip everything but letters/digits, uppercase. "F.28" / "f28" / "F 28" -> "F28"
function normCode(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const FaultDB = {
  all: [],       // flat array of entries, each with _norm, _aliasNorms, _id
  byMake: {},    // make -> [entries]
  loaded: false,
  loadError: null,

  async load() {
    const results = await Promise.allSettled(
      DATA_FILES.map((d) => fetch(d.file).then((r) => {
        if (!r.ok) throw new Error(d.make + " HTTP " + r.status);
        return r.json();
      }))
    );

    results.forEach((res, i) => {
      const make = DATA_FILES[i].make;
      if (res.status !== "fulfilled" || !Array.isArray(res.value)) {
        this.loadError = this.loadError || [];
        this.loadError.push(make);
        return;
      }
      const entries = res.value.map((e, idx) => {
        const aliasList = Array.isArray(e.aliases) ? e.aliases : [];
        return Object.assign({}, e, {
          _id: make + "::" + (e.series || "") + "::" + e.code + "::" + idx,
          _norm: normCode(e.code),
          _aliasNorms: aliasList.map(normCode),
        });
      });
      this.byMake[make] = entries;
      this.all = this.all.concat(entries);
    });

    this.loaded = true;
    return this;
  },

  makes() {
    return DATA_FILES.map((d) => d.make).filter((m) => this.byMake[m] && this.byMake[m].length);
  },

  seriesForMake(make) {
    const entries = this.byMake[make] || [];
    const set = new Set();
    entries.forEach((e) => { if (e.series) set.add(e.series); });
    return Array.from(set).sort();
  },

  getById(id) {
    return this.all.find((e) => e._id === id);
  },

  getByMakeCode(make, code) {
    const n = normCode(code);
    return this.all.find((e) => e.make === make && (e._norm === n || e._aliasNorms.includes(n)));
  },

  // Tolerant search across code/alias/meaning/series, optional make+series filter.
  search(query, { make = "", series = "" } = {}) {
    const q = (query || "").trim();
    const qNorm = normCode(q);
    const qLower = q.toLowerCase();

    let pool = this.all;
    if (make) pool = pool.filter((e) => e.make === make);
    if (series) pool = pool.filter((e) => e.series === series);

    if (!q) return pool.slice().sort(sortBySeverityThenCode);

    const scored = [];
    for (const e of pool) {
      let score = -1;
      if (qNorm && (e._norm === qNorm || e._aliasNorms.includes(qNorm))) score = 100;
      else if (qNorm && qNorm.length >= 2 && (e._norm.includes(qNorm) || e._aliasNorms.some((a) => a.includes(qNorm)))) score = 60;
      else if (e.meaning && e.meaning.toLowerCase().includes(qLower)) score = 40;
      else if (e.series && e.series.toLowerCase().includes(qLower)) score = 30;
      else if (e.make.toLowerCase().includes(qLower)) score = 20;
      if (score > 0) scored.push([score, e]);
    }
    scored.sort((a, b) => b[0] - a[0] || sortBySeverityThenCode(a[1], b[1]));
    return scored.map((s) => s[1]);
  },
};

const SEV_ORDER = { lockout: 0, warning: 1, info: 2 };
function sortBySeverityThenCode(a, b) {
  const sa = SEV_ORDER[a.severity] ?? 3;
  const sb = SEV_ORDER[b.severity] ?? 3;
  if (sa !== sb) return sa - sb;
  return (a.code || "").localeCompare(b.code || "");
}
