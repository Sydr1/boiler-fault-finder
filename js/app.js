(function () {
  "use strict";

  let currentTab = "lookup";
  let currentMakeFilter = "";
  let currentModelFilter = "";
  let detailReturnTab = "lookup";
  let symptomPath = []; // stack of node ids visited, for crumbs/back

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // ---------- Theme ----------
  function applyTheme() {
    const t = Store.getTheme();
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  function initThemeToggle() {
    applyTheme();
    $("#theme-toggle").addEventListener("click", () => {
      const current = Store.getTheme();
      const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
      Store.setTheme(next);
      applyTheme();
      showToast("Theme: " + next);
    });
  }

  // ---------- Tab switching ----------
  function switchTab(tab) {
    currentTab = tab;
    $$(".tab-panel").forEach((p) => { p.hidden = p.dataset.tab !== tab; });
    $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    window.scrollTo(0, 0);
  }
  function initTabbar() {
    $$(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    $("#detail-back").addEventListener("click", () => {
      switchTab(detailReturnTab);
      if (detailReturnTab === "lookup") { renderChips(); renderResults(); }
      if (detailReturnTab === "notes") renderNotes();
    });
  }

  // ---------- Lookup tab ----------
  function initFilters() {
    const makeSel = $("#filter-make");
    FaultDB.makes().forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      makeSel.appendChild(opt);
    });
    makeSel.addEventListener("change", () => {
      currentMakeFilter = makeSel.value;
      currentModelFilter = "";
      populateModelFilter();
      renderResults();
    });
    $("#filter-model").addEventListener("change", (e) => {
      currentModelFilter = e.target.value;
      renderResults();
    });
  }
  function populateModelFilter() {
    const modelSel = $("#filter-model");
    modelSel.innerHTML = '<option value="">All models</option>';
    if (!currentMakeFilter) { modelSel.disabled = true; return; }
    modelSel.disabled = false;
    FaultDB.seriesForMake(currentMakeFilter).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      modelSel.appendChild(opt);
    });
  }

  function initSearch() {
    const input = $("#search-input");
    const clearBtn = $("#search-clear");
    input.addEventListener("input", () => {
      clearBtn.hidden = !input.value;
      renderResults();
    });
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.hidden = true;
      renderResults();
      input.focus();
    });
  }

  function setSearchQuery(q, make) {
    $("#search-input").value = q || "";
    $("#search-clear").hidden = !q;
    if (make) {
      currentMakeFilter = make;
      $("#filter-make").value = make;
      populateModelFilter();
    }
    renderResults();
  }

  function renderChips() {
    const favIds = Store.getFavs();
    const recentIds = Store.getRecents();
    const favWrap = $("#fav-chips");
    const recentWrap = $("#recent-chips");
    favWrap.innerHTML = "";
    recentWrap.innerHTML = "";

    const favEntries = favIds.map((id) => FaultDB.getById(id)).filter(Boolean);
    const recentEntries = recentIds.map((id) => FaultDB.getById(id)).filter(Boolean);

    $("#lookup-chips").hidden = favEntries.length === 0 && recentEntries.length === 0;
    $("#lookup-chips").querySelector(".chips-group:nth-child(1)").hidden = favEntries.length === 0;
    $("#lookup-chips").querySelector(".chips-group:nth-child(2)").hidden = recentEntries.length === 0;

    favEntries.forEach((e) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = `${e.code} · ${e.make}`;
      chip.addEventListener("click", () => openDetail(e._id, "lookup"));
      favWrap.appendChild(chip);
    });
    recentEntries.forEach((e) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = `${e.code} · ${e.make}`;
      chip.addEventListener("click", () => openDetail(e._id, "lookup"));
      recentWrap.appendChild(chip);
    });
  }

  function subLabel(e) {
    const series = e.series || "";
    if (series.toLowerCase().startsWith(e.make.toLowerCase())) return series;
    return `${e.make} · ${series}`;
  }

  function sevBadge(sev) {
    const label = sev === "lockout" ? "Lockout" : sev === "warning" ? "Warning" : "Info";
    return `<span class="sev-badge sev-${sev || "info"}">${label}</span>`;
  }

  function renderResults() {
    const q = $("#search-input").value;
    const list = $("#results-list");
    const results = FaultDB.search(q, { make: currentMakeFilter, series: currentModelFilter });

    list.innerHTML = "";
    $("#results-empty").hidden = results.length !== 0;
    $("#results-count").hidden = !q && results.length === 0;
    if (q || currentMakeFilter) {
      $("#results-count").hidden = false;
      $("#results-count").textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
    } else {
      $("#results-count").hidden = true;
    }

    const favIds = Store.getFavs();
    const toShow = q || currentMakeFilter ? results : results.slice(0, 40);

    toShow.forEach((e) => {
      const li = document.createElement("li");
      const row = document.createElement("button");
      const isNamedFault = e.code.length > 8 || /\s/.test(e.code);
      row.className = "result-row" + (isNamedFault ? " named-fault" : "");
      row.innerHTML = isNamedFault ? `
        <span class="result-main">
          <span class="result-code result-code-inline">${escapeHtml(e.code)}</span>
          <span class="result-meaning">${escapeHtml(e.meaning || "")}</span>
          <span class="result-sub">${escapeHtml(subLabel(e))}</span>
        </span>
        ${sevBadge(e.severity)}
        <button class="fav-star" aria-label="Toggle favourite">${favIds.includes(e._id) ? "★" : "☆"}</button>
      ` : `
        <span class="result-code">${escapeHtml(e.code)}</span>
        <span class="result-main">
          <span class="result-meaning">${escapeHtml(e.meaning || "")}</span>
          <span class="result-sub">${escapeHtml(subLabel(e))}</span>
        </span>
        ${sevBadge(e.severity)}
        <button class="fav-star" aria-label="Toggle favourite">${favIds.includes(e._id) ? "★" : "☆"}</button>
      `;
      row.addEventListener("click", (ev) => {
        if (ev.target.closest(".fav-star")) return;
        openDetail(e._id, "lookup");
      });
      row.querySelector(".fav-star").addEventListener("click", (ev) => {
        ev.stopPropagation();
        Store.toggleFav(e._id);
        renderResults();
        renderChips();
      });
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Detail view ----------
  function openDetail(entryId, returnTab) {
    const e = FaultDB.getById(entryId);
    if (!e) { showToast("Not found"); return; }
    detailReturnTab = returnTab || currentTab;
    Store.pushRecent(e._id);
    renderDetail(e);
    switchTab("detail");
  }

  function renderDetail(e) {
    const isFav = Store.isFav(e._id);
    const progress = Store.getProgress(e._id);
    const checks = Array.isArray(e.checks) ? e.checks : [];
    const doneCount = checks.filter((c, i) => progress[i]).length;
    const pct = checks.length ? Math.round((doneCount / checks.length) * 100) : 0;

    const causesHtml = (e.causes || []).map((c) => `
      <div class="cause-row">
        <span>${escapeHtml(c.cause)}</span>
        <span class="likelihood likelihood-${(c.likelihood || "low")}">${escapeHtml(c.likelihood || "")}</span>
      </div>
    `).join("") || `<p class="muted">check manual</p>`;

    const checksHtml = checks.map((c, i) => `
      <li class="check-item ${progress[i] ? "done" : ""}">
        <input type="checkbox" data-idx="${i}" ${progress[i] ? "checked" : ""} aria-label="Mark step done">
        <span>
          ${c.gasSide ? '<span class="gas-badge">GAS</span>' : ""}
          <span class="check-step">${escapeHtml(c.step)}</span>
          ${c.expected ? `<div class="check-expected">Expected: ${escapeHtml(c.expected)}</div>` : ""}
        </span>
      </li>
    `).join("") || `<li class="muted" style="padding:10px;">check manual</li>`;

    const src = e.source || {};
    const confClass = "conf-" + (e.confidence || "low");

    $("#detail-content").innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-code">${escapeHtml(e.code)}</div>
          <div class="detail-make">${escapeHtml(e.make)} · ${escapeHtml(e.series || "")}</div>
        </div>
        <button id="detail-fav" class="fav-star" aria-label="Toggle favourite" style="font-size:1.8rem;">${isFav ? "★" : "☆"}</button>
      </div>
      ${sevBadge(e.severity)}
      <div class="detail-meaning">${escapeHtml(e.meaning || "check manual")}</div>

      <div class="card">
        <h3>Likely causes (ranked)</h3>
        ${causesHtml}
      </div>

      <div class="card">
        <h3>Checklist</h3>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${doneCount} / ${checks.length} done</div>
        <ul class="checklist" id="detail-checklist">${checksHtml}</ul>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-secondary" id="reset-checklist">Reset checklist</button>
        </div>
      </div>

      <div class="card">
        <h3>Reset method</h3>
        <p>${escapeHtml(e.reset || "check manual")}</p>
      </div>

      <div class="card">
        <h3>Source</h3>
        <p class="source-line">
          ${escapeHtml(src.manual || "check manual")}${src.page ? ", p." + escapeHtml(src.page) : ""}
          <span class="confidence-tag ${confClass}">${escapeHtml(e.confidence || "low")} confidence</span>
        </p>
        ${src.url ? `<p class="source-line"><a href="${escapeHtml(src.url)}" target="_blank" rel="noopener">View source</a></p>` : ""}
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" id="add-note-for-code">Add job note for this fault</button>
      </div>
    `;

    $("#detail-fav").addEventListener("click", () => {
      Store.toggleFav(e._id);
      renderDetail(e);
      renderChips();
    });
    $$('#detail-checklist input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const p = Store.getProgress(e._id);
        p[cb.dataset.idx] = cb.checked;
        Store.setProgress(e._id, p);
        renderDetail(e);
      });
    });
    $("#reset-checklist").addEventListener("click", () => {
      Store.setProgress(e._id, {});
      renderDetail(e);
    });
    $("#add-note-for-code").addEventListener("click", () => {
      switchTab("notes");
      $("#note-job").value = `${e.make} ${e.code}`;
      $("#note-text").focus();
    });
  }

  // ---------- Firing sequence ----------
  function renderSequence() {
    const list = $("#sequence-list");
    list.innerHTML = FIRING_SEQUENCE.map((stage, i) => `
      <li class="seq-stage">
        <div class="seq-stage-head">
          <span class="seq-num">${i + 1}</span>
          <span class="seq-title">${escapeHtml(stage.title)}</span>
        </div>
        <div class="seq-body">
          <p>${escapeHtml(stage.body)}</p>
          <h4>Checks at this stage</h4>
          <ul>${stage.checks.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
          <h4>Related fault lookups</h4>
          ${stage.faultKeywords.map((k) => `<button class="seq-fault-link" data-kw="${escapeHtml(k)}">${escapeHtml(k)}</button>`).join("")}
        </div>
      </li>
    `).join("");

    $$(".seq-fault-link", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        currentMakeFilter = ""; currentModelFilter = "";
        $("#filter-make").value = "";
        populateModelFilter();
        setSearchQuery(btn.dataset.kw);
        switchTab("lookup");
      });
    });
  }

  // ---------- Symptom tree ----------
  function renderSymptom(nodeId) {
    const node = SYMPTOM_TREE.nodes[nodeId];
    const wrap = $("#symptom-tree");
    if (!node) { wrap.innerHTML = ""; return; }

    const crumbsHtml = symptomPath.length ? `
      <div class="symptom-crumbs">
        <button class="crumb" id="symptom-restart">Start over</button>
        ${symptomPath.map((id) => `<span class="crumb">${escapeHtml(SYMPTOM_TREE.nodes[id].question)}</span>`).join("")}
      </div>` : "";

    wrap.innerHTML = `
      <div class="symptom-card">
        ${crumbsHtml}
        <div class="symptom-question">${escapeHtml(node.question)}</div>
        <div class="symptom-options">
          ${node.options.map((opt, i) => `<button class="symptom-opt" data-idx="${i}"><span>${escapeHtml(opt.label)}</span><span>›</span></button>`).join("")}
        </div>
      </div>
    `;

    const restartBtn = $("#symptom-restart");
    if (restartBtn) restartBtn.addEventListener("click", () => {
      symptomPath = [];
      renderSymptom(SYMPTOM_TREE.start);
    });

    $$(".symptom-opt", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = node.options[Number(btn.dataset.idx)];
        if (opt.next) {
          symptomPath.push(nodeId);
          renderSymptom(opt.next);
        } else if (opt.result) {
          handleSymptomResult(opt.result, nodeId);
        }
      });
    });
  }

  function handleSymptomResult(result, nodeId) {
    if (result.type === "gotoLookup") {
      symptomPath = [];
      switchTab("lookup");
      $("#search-input").focus();
      return;
    }
    if (result.type === "search") {
      symptomPath = [];
      setSearchQuery(result.keyword);
      switchTab("lookup");
      return;
    }
    if (result.type === "generic") {
      const wrap = $("#symptom-tree");
      wrap.innerHTML = `
        <div class="symptom-card">
          <div class="symptom-crumbs">
            <button class="crumb" id="symptom-restart">Start over</button>
          </div>
          <div class="symptom-question">${escapeHtml(result.title)}</div>
          <p class="muted small">General good-practice checks — not from a specific manufacturer manual.</p>
          <ul class="symptom-result-list">
            ${result.steps.map((s) => `<li class="check-item"><span class="check-step">${escapeHtml(s)}</span></li>`).join("")}
          </ul>
        </div>
      `;
      $("#symptom-restart").addEventListener("click", () => {
        symptomPath = [];
        renderSymptom(SYMPTOM_TREE.start);
      });
    }
  }

  // ---------- Tools ----------
  function renderTools() {
    const wrap = $("#tools-list");
    wrap.innerHTML = `
      <details class="tool-card" open>
        <summary>NTC thermistor: resistance ↔ temperature</summary>
        <div class="tool-body">
          <p class="muted small">Generic B-parameter estimate. Use the exact table in the appliance manual if it gives one — sensors vary by manufacturer.</p>
          <div class="field-grid">
            <div class="field-row"><label>R₀ (Ω at T₀)</label><input id="ntc-r0" type="number" value="10000"></div>
            <div class="field-row"><label>T₀ (°C)</label><input id="ntc-t0" type="number" value="25"></div>
          </div>
          <div class="field-row"><label>Beta</label><input id="ntc-beta" type="number" value="3977"></div>
          <div class="field-row"><label>Resistance (Ω) → temperature</label><input id="ntc-r-in" type="number" inputmode="decimal" placeholder="e.g. 12000"></div>
          <div id="ntc-r-result" class="tool-result" hidden></div>
          <div class="field-row"><label>Temperature (°C) → resistance</label><input id="ntc-t-in" type="number" inputmode="decimal" placeholder="e.g. 40"></div>
          <div id="ntc-t-result" class="tool-result" hidden></div>
        </div>
      </details>

      <details class="tool-card">
        <summary>Gas rate (timed meter test)</summary>
        <div class="tool-body">
          <p class="muted small">Standard Gas Safe timed-test method. Confirm CV with current supply if known.</p>
          <div class="field-row">
            <label>Time for one revolution (seconds)</label>
            <input id="gas-seconds" type="number" inputmode="decimal" placeholder="e.g. 32">
          </div>
          <div class="field-grid">
            <div class="field-row"><label>Volume per revolution</label><input id="gas-volrev" type="number" inputmode="decimal" value="0.01"></div>
            <div class="field-row"><label>Unit</label>
              <select id="gas-unit"><option value="m3">m³</option><option value="ft3">ft³</option></select>
            </div>
          </div>
          <div class="field-grid">
            <div class="field-row"><label>CV (MJ/m³)</label><input id="gas-cv" type="number" inputmode="decimal" value="38.76"></div>
            <div class="field-row"><label>Net/Gross ratio</label><input id="gas-ratio" type="number" inputmode="decimal" value="0.901"></div>
          </div>
          <div id="gas-result" class="tool-result" hidden></div>
        </div>
      </details>

      <details class="tool-card">
        <summary>Flow / return delta T</summary>
        <div class="tool-body">
          <div class="field-grid">
            <div class="field-row"><label>Flow temp (°C)</label><input id="dt-flow" type="number" inputmode="decimal"></div>
            <div class="field-row"><label>Return temp (°C)</label><input id="dt-return" type="number" inputmode="decimal"></div>
          </div>
          <div id="dt-result" class="tool-result" hidden></div>
        </div>
      </details>

      <details class="tool-card">
        <summary>Typical values reference</summary>
        <div class="tool-body">
          <table class="ref-table">
            <thead><tr><th>Item</th><th>Typical</th><th>Note</th></tr></thead>
            <tbody>
              ${TYPICAL_VALUES.map((v) => `<tr><td>${escapeHtml(v.item)}</td><td>${escapeHtml(v.value)}</td><td class="muted">${escapeHtml(v.note)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;

    function recalcNtc() {
      const r0 = Number($("#ntc-r0").value) || 10000;
      const t0 = Number($("#ntc-t0").value) || 25;
      const beta = Number($("#ntc-beta").value) || 3977;
      const rIn = $("#ntc-r-in").value;
      const tIn = $("#ntc-t-in").value;
      const rRes = $("#ntc-r-result");
      const tRes = $("#ntc-t-result");
      if (rIn) {
        const t = Tools.ntcResistanceToTemp(rIn, r0, t0, beta);
        rRes.hidden = false;
        rRes.innerHTML = t === null ? "Enter a valid resistance" : `≈ <strong>${t.toFixed(1)}°C</strong>`;
      } else rRes.hidden = true;
      if (tIn) {
        const r = Tools.ntcTempToResistance(tIn, r0, t0, beta);
        tRes.hidden = false;
        tRes.innerHTML = r === null ? "Enter a valid temperature" : `≈ <strong>${Math.round(r).toLocaleString()} Ω</strong>`;
      } else tRes.hidden = true;
    }
    ["ntc-r0", "ntc-t0", "ntc-beta", "ntc-r-in", "ntc-t-in"].forEach((id) => $("#" + id).addEventListener("input", recalcNtc));

    function recalcGas() {
      const seconds = $("#gas-seconds").value;
      const volumePerRev = $("#gas-volrev").value;
      const volumeUnit = $("#gas-unit").value;
      const cvMJm3 = Number($("#gas-cv").value) || 38.76;
      const netGrossRatio = Number($("#gas-ratio").value) || 0.901;
      const res = $("#gas-result");
      if (!seconds || !volumePerRev) { res.hidden = true; return; }
      const r = Tools.gasRate({ seconds, volumePerRev, volumeUnit, cvMJm3, netGrossRatio });
      if (!r) { res.hidden = true; return; }
      res.hidden = false;
      res.innerHTML = `Gas rate: <strong>${r.volumeRateM3h.toFixed(4)} m³/h</strong><br>
        Gross: <strong>${r.grossKW.toFixed(2)} kW</strong> · Net: <strong>${r.netKW.toFixed(2)} kW</strong>`;
    }
    ["gas-seconds", "gas-volrev", "gas-unit", "gas-cv", "gas-ratio"].forEach((id) => $("#" + id).addEventListener("input", recalcGas));

    function recalcDt() {
      const res = $("#dt-result");
      const flow = $("#dt-flow").value, ret = $("#dt-return").value;
      if (flow === "" || ret === "") { res.hidden = true; return; }
      const dt = Tools.deltaT(flow, ret);
      res.hidden = false;
      res.innerHTML = dt === null ? "Enter valid temperatures" : `Delta T: <strong>${dt.toFixed(1)}°C</strong>`;
    }
    ["dt-flow", "dt-return"].forEach((id) => $("#" + id).addEventListener("input", recalcDt));
  }

  // ---------- Notes ----------
  function renderNotes() {
    const notes = Store.getNotes();
    const list = $("#notes-list");
    $("#notes-empty").hidden = notes.length !== 0;
    list.innerHTML = notes.map((n) => `
      <li class="note-item" data-id="${n.id}">
        <div class="note-meta">
          <span>${new Date(n.ts).toLocaleString()}</span>
          ${n.job ? `<span>${escapeHtml(n.job)}</span>` : ""}
        </div>
        <div class="note-text">${escapeHtml(n.text)}</div>
        <div class="note-row-actions">
          <button data-action="copy">Copy</button>
          <button data-action="delete">Delete</button>
        </div>
      </li>
    `).join("");

    $$(".note-item", list).forEach((li) => {
      const id = li.dataset.id;
      const note = notes.find((n) => n.id === id);
      li.querySelector('[data-action="copy"]').addEventListener("click", () => {
        copyToClipboard(formatNoteForExport(note));
        showToast("Note copied");
      });
      li.querySelector('[data-action="delete"]').addEventListener("click", () => {
        Store.deleteNote(id);
        renderNotes();
        showToast("Note deleted");
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function initNotes() {
    $("#note-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = $("#note-text").value.trim();
      if (!text) return;
      Store.saveNote({ id: makeNoteId(), ts: Date.now(), job: $("#note-job").value.trim(), text });
      $("#note-text").value = "";
      $("#note-job").value = "";
      renderNotes();
      showToast("Note saved");
    });
    $("#notes-export").addEventListener("click", () => {
      const notes = Store.getNotes();
      if (!notes.length) { showToast("No notes to export"); return; }
      const text = notes.map(formatNoteForExport).join("\n\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "boiler-job-notes-" + new Date().toISOString().slice(0, 10) + ".txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    $("#notes-copy-all").addEventListener("click", () => {
      const notes = Store.getNotes();
      if (!notes.length) { showToast("No notes to copy"); return; }
      copyToClipboard(notes.map(formatNoteForExport).join("\n\n"));
      showToast("All notes copied");
    });
  }

  // ---------- Init ----------
  async function init() {
    initThemeToggle();
    initTabbar();
    initSearch();
    initNotes();

    await FaultDB.load();
    initFilters();
    renderResults();
    renderChips();
    renderSequence();
    renderSymptom(SYMPTOM_TREE.start);
    renderTools();
    renderNotes();

    $$(".tab-btn").forEach((btn) => {
      const original = btn.onclick;
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "notes") renderNotes();
        if (btn.dataset.tab === "lookup") { renderChips(); renderResults(); }
      });
    });

    if (FaultDB.loadError && FaultDB.loadError.length) {
      showToast("Some data failed to load: " + FaultDB.loadError.join(", "));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
