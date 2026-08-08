/* ============================================================
   app.js — main app logic
============================================================ */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

let S = null;
function load() { S = loadStore() || JSON.parse(JSON.stringify(S_STORE)); }
function save() {
  try { if (S && S.name) localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* quota */ }
}

/* ---------- date ---------- */
function todayStr() { return dayKey(new Date()); }
function shiftDay(n) { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); }
function locDate() {
  const o = { weekday: "long", day: "numeric", month: "long" };
  return new Date().toLocaleDateString(S.lang === "en" ? "en-US" : "ru-RU", o);
}

/* ---------- xp / level / ranks ---------- */
function lvl() { return levelFromXp(S.xp); }
function rankIdx() { return rankIndexFromXp(S.xp); }
function rank() { return RANKS[rankIdx()]; }

/* ---------- quest counters ---------- */
function dayDone() {
  if (!S.doneToday[todayStr()]) S.doneToday[todayStr()] = {};
  return S.doneToday[todayStr()];
}
function qCount(qid) { return (dayDone()[qid] || 0); }
function qSet(qid, v) { dayDone()[qid] = v; }
function questsDoneTodayCount() { return (S.quests || []).filter(q => qCount(q.id) >= q.target).length; }

/* ---------- stats ---------- */
function hunterStats() {
  const c = S.counters || {};
  const lv = lvl();
  return {
    power: Math.round(lv * 3 + (c.pushup || 0) * 0.2 + (c.pullup || 0) * 0.5 + (c.squat || 0) * 0.15),
    speed: Math.round(lv * 2.5 + (c.run || 0) * 1.5),
    endur: Math.round(lv * 3 + (c.situp || 0) * 0.2 + (c.stretch || 0) * 0.3),
    intl: Math.round(lv * 2 + (c.read || 0) * 0.4),
  };
}

/* ---------- streak ---------- */
function computeStreak() {
  const h = S.history || {};
  let d = new Date();
  let todayActive = false;
  const tk = dayKey(d);
  if ((h[tk] && (h[tk].quests > 0 || h[tk].perfect)) || questsDoneToday() > 0) todayActive = true;
  if (!todayActive) d.setDate(d.getDate() - 1);
  let s = 0;
  for (let i = 0; i < 4000; i++) {
    const k = dayKey(d);
    const rec = h[k];
    if (!rec || (!rec.quests && !rec.perfect)) break;
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}
function syncStreak() {
  const cur = computeStreak();
  S.streaks = S.streaks || { current: 0, best: 0 };
  if (cur > (S.streaks.best || 0)) {
    S.streaks.best = cur;
    if (cur > 1) toast(`${t("newBest")}: ${cur} 🔥`);
  }
  S.streaks.current = cur;
  save();
}

/* ---------- xp flow ---------- */
function addXp(n) {
  if (!(n > 0)) return;
  const wasRank = rankIndexFromXp(S.xp);
  const wasLv = levelFromXp(S.xp);
  S.xp += n;
  if (S.xp > (S.totalXp || 0)) S.totalXp = S.xp;
  const nowLv = levelFromXp(S.xp);
  const nowRank = rankIndexFromXp(S.xp);
  if (nowRank > wasRank) {
    rankUp();
  } else if (nowLv > wasLv) {
    levelUp(nowLv);
  } else {
    AudioSys.complete();
  }
  historyAddXp(n);
  save();
  render();
}
function historyAddXp(amount) {
  const k = todayStr();
  if (!S.history[k]) S.history[k] = { xp: 0, quests: 0, perfect: false };
  S.history[k].xp += amount;
  S.history[k].quests = questsDoneToday();
}

/* ---------- quest actions ---------- */
function doAdd(q, step) {
  const cur = qCount(q.id);
  const nv = Math.min(q.target, cur + (step || 1));
  if (nv <= cur) return;
  qSet(q.id, nv);
  S.counters[q.id] = (S.counters[q.id] || 0) + (nv - cur);
  if (nv >= q.target) finishQuest(q);
  else { AudioSys.plus(); save(); render(); }
}
function doMinus(q) {
  const cur = qCount(q.id);
  if (cur <= 0) return;
  qSet(q.id, cur - 1);
  if (S.counters[q.id] > 0) S.counters[q.id] -= 1;
  AudioSys.minus();
  save(); render();
}
function doToggle(q) {
  const cur = qCount(q.id);
  if (cur > 0) { qSet(q.id, 0); AudioSys.minus(); save(); render(); }
  else { qSet(q.id, 1); S.counters[q.id] = (S.counters[q.id] || 0) + 1; finishQuest(q); }
}
function finishQuest(q) {
  S.questsDone = (S.questsDone || 0) + 1;
  addXp(q.xp);
  toast("✅ " + q.title + " — " + t("questDone") + " +" + q.xp + " XP");
  checkPerfectDay();
  checkAchievements();
  syncStreak();
}
function checkPerfectDay() {
  const all = S.quests.length > 0 && S.quests.every(q => qCount(q.id) >= q.target);
  const hist = S.history[todayStr()] || (S.history[todayStr()] = { xp: 0, quests: 0, perfect: false });
  if (all && !hist.perfect) {
    hist.perfect = true;
    S.perfectDays = (S.perfectDays || 0) + 1;
    addXp(200);
    AudioSys.perfect();
    toast("🌟 " + t("perfectDay") + " " + t("perfectBonus") + "!");
    confettiBurst();
  }
}

/* ---------- overlays ---------- */
function showOverlay(mode, meta) {
  const ov = $("#overlay");
  $("#lvTitle").textContent = mode === "rank" ? RANKS[meta.idx].id : "LV " + meta.lv;
  $("#lvKicker").textContent = mode === "rank" ? t("rankUpTitle") : t("lvUpTitle");
  $("#lvSub").textContent = mode === "rank"
    ? t("rankUpText") + " — " + RANKS[meta.idx].name
    : t("levelNew") + ": " + meta.lv;
  $("#lvStars").innerHTML = "✦".repeat(mode === "rank" ? 5 : 3);
  ov.hidden = false;
  if (mode === "rank") {
    AudioSys.rankup();
    confettiBurst();
    if (S.vibr && navigator.vibrate) navigator.vibrate([90, 50, 90]);
  } else {
    AudioSys.levelup();
  }
}
function levelUp(lv) { showOverlay("lv", { lv }); }
function rankUp() { showOverlay("rank", { idx: rankIdx() }); }
function closeOverlay() { $("#overlay").hidden = true; }

/* ---------- achievements ---------- */
function checkAchievements() {
  const lv = lvl();
  const c = S.counters || {};
  const tests = {
    first_quest: (S.questsDone || 0) >= 1,
    perfect_day: (S.perfectDays || 0) >= 1,
    lv5: lv >= 5, lv10: lv >= 10, lv20: lv >= 20,
    rank_d: rankIdx() >= 1, rank_c: rankIdx() >= 2, rank_b: rankIdx() >= 3,
    rank_a: rankIdx() >= 4, rank_s: rankIdx() >= 5,
    streak3: (S.streaks.best || 0) >= 3,
    streak7: (S.streaks.best || 0) >= 7,
    streak30: (S.streaks.best || 0) >= 30,
    push1000: (c.pushup || 0) >= 1000,
    push5000: (c.pushup || 0) >= 5000,
    read100: (c.read || 0) >= 100,
  };
  let fresh = 0;
  ACHIEVEMENTS.forEach(a => {
    if (tests[a.id] && !S.ach[a.id]) {
      S.ach[a.id] = true;
      toast("🏅 " + a.name);
      fresh++;
    }
  });
  if (fresh) {
    AudioSys.rankup();
    if (S.vibr && navigator.vibrate) navigator.vibrate([60, 40, 60]);
    save();
  }
}
function doneAchCount() { return ACHIEVEMENTS.filter(a => S.ach[a.id]).length; }

/* ---------- toast ---------- */
function toast(msg) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="t-dot">SYSTEM</span><span>${msg}</span>`;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0"; el.style.transition = "opacity .35s";
    setTimeout(() => el.remove(), 380);
  }, 3000);
}

/* ---------- confetti ---------- */
let confRaf = 0;
function confettiBurst() {
  const cv = $("#confetti");
  if (!cv) return;
  cv.width = innerWidth; cv.height = innerHeight;
  const ctx = cv.getContext("2d");
  const colors = ["#4fc3f7", "#7c4dff", "#ffd54f", "#ff8a65", "#4bd37b"];
  const parts = Array.from({ length: 130 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    s: Math.random() * 6 + 3,
    c: colors[Math.floor(Math.random() * 5)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  let t = 0;
  cancelAnimationFrame(confRaf);
  (function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rot += p.vr;
      if (p.y < innerHeight + 30) alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
      ctx.restore();
    });
    if (alive && t++ < 140) confRaf = requestAnimationFrame(frame);
    else setTimeout(() => ctx.clearRect(0, 0, cv.width, cv.height), 400);
  })();
}

/* ---------- render ---------- */
function render() {
  if (!$("#app") || $("#app").hidden) return;
  renderHeader();
  renderQuests();
  renderRank();
  renderAchievements();
  renderChart();
}
function renderHeader() {
  const lv = lvl();
  $("#lvlNum").textContent = lv;
  const cur = totalXpForLevel(lv);
  const need = xpForLevel(lv);
  $("#xpText").textContent = Math.round(S.xp - cur) + " / " + need;
  $("#xpFill").style.width = Math.min(100, ((S.xp - cur) / need) * 100) + "%";
  $("#streakChip").textContent = "🔥 " + (S.streaks.current || 0);
  $("#hunterName").textContent = S.name || "Хантер";
  setRankColors();
}
function setRankColors() {
  const r = rank();
  const c = r.color;
  document.documentElement.style.setProperty("--rc", c);
  const badge = $("#rankBadge");
  badge.textContent = r.id;
  badge.style.setProperty("--rc", c);
}
function renderQuests() {
  const list = $("#questsList");
  const qs = S.quests || [];
  $("#qsTitle").textContent = `${t("today")} ${locDate()}`;
  list.innerHTML = "";
  if (!qs.length) list.innerHTML = `<div class="empty">${t("noQuests")}</div>`;
  let done = 0;
  qs.forEach(q => {
    const cur = qCount(q.id);
    const pct = Math.min(100, (cur / q.target) * 100);
    const isDone = cur >= q.target;
    if (isDone) done++;
    list.insertAdjacentHTML("beforeend", `
      <div class="quest ${isDone ? "done" : ""}">
        <div class="quest-head">
          <div class="quest-icon">${q.icon}</div>
          <div class="quest-name">${escapeHtml(q.title)}<div class="quest-desc">${q.target} ${q.unit}</div></div>
          <div class="quest-xp">+${q.xp} ${t("questXp")}</div>
          <div class="quest-done-badge">✓</div>
        </div>
        <div class="quest-bar"><i class="${isDone ? "" : "low"}" style="width:${pct}%"></i></div>
        <div class="quest-controls">
          <button class="q-btn minus" data-id="${q.id}" data-act="-">−</button>
          <div class="q-value"><b>${fmtQ(cur, q)}</b><em>/ ${fmtQ(q.target, q)} ${q.unit}</em></div>
          <button class="q-btn plus" data-id="${q.id}" data-act="+">+</button>
        </div>
        <div class="q-add">
          ${q.type === "toggle"
            ? `<button class="q-btn" data-id="${q.id}" data-act="toggle">${isDone ? "✓ " + t("finish") : t("finish")}</button>`
            : (isDone
                ? `<button class="q-btn done-st" data-id="${q.id}" data-act="x">—</button>`
                : quickSteps(q).map(s => `<button class="q-btn" data-id="${q.id}" data-act="step" data-step="${s}">+${s}</button>`).join(""))}
        </div>
      </div>`);
  });
  const total = qs.length;
  const pctAll = total ? Math.round((done / total) * 100) : 0;
  const ring = $("#qsRing");
  ring.style.setProperty("--p", pctAll);
  ring.style.setProperty("--pc", pctAll === 100 ? "var(--green)" : "var(--purple)");
  $("#qsPct").textContent = pctAll + "%";
  $("#qsPct").style.color = pctAll === 100 ? "var(--green)" : "";
}
function fmtQ(v, q) {
  v = Math.round(v * 10) / 10;
  if (q.unit === "км") return (Math.round(v * 10) / 10) % 1 === 0 ? Math.round(v) : v.toFixed(1);
  return Math.round(v);
}
function quickSteps(q) {
  if (q.unit === "км") return [0.5, 1, 2];
  if (q.unit === "мин") return [5, 10, 15];
  if (q.type === "toggle") return [];
  if (q.target > 500) return [10, 25, 50];
  return [10, 25, 50].filter(s => s <= q.target);
}
function renderRank() {
  const idx = rankIdx();
  const r = RANKS[idx];
  const next = RANKS[idx + 1];
  $("#rankBadge").textContent = r.id;
  $("#rankBig").textContent = r.id;
  $("#rankName").textContent = r.name;
  setRankColors();
  if (next) {
    const need = next.xp - r.xp;
    const have = S.xp - r.xp;
    $("#rankDesc").textContent = `${Math.max(0, need - have)} XP ${t("toNext")} ${next.id}`;
    $("#rankXpFill").style.width = Math.min(100, (have / need) * 100) + "%";
    $("#rankProgress").textContent = `${Math.round(have)} / ${need} XP`;
  } else {
    $("#rankDesc").textContent = r.name + " ● " + "MAX";
    $("#rankXpFill").style.width = "100%";
    $("#rankProgress").textContent = "🜲 MAX";
  }
  $("#rankPath").innerHTML = RANKS.map((rr, i) => `
    <div class="rp-item ${i === idx ? "current" : ""}">
      <div class="rp-letter ${i < idx ? "done" : ""} ${i === idx ? "active" : ""}">${rr.id}</div>
      <span class="rp-name">${rr.name}</span>
    </div>`).join("");
  const st = hunterStats();
  $("#stStrength").textContent = st.power;
  $("#stSpeed").textContent = st.speed;
  $("#stEndurance").textContent = st.endur;
  $("#stWisdom").textContent = st.intl;
  $("#sTotalXp").textContent = Math.round(S.xp);
  $("#sQuestsDone").textContent = S.questsDone || 0;
  $("#sWorkouts").textContent = Object.values(S.history || {}).reduce((a, h) => a + (h.quests || 0), 0);
  $("#sPages").textContent = S.counters?.read || 0;
  $("#sStreak").textContent = S.streaks.current || 0;
  $("#sBestStreak").textContent = S.streaks.best || 0;
  $("#sPerfect").textContent = S.perfectDays || 0;
}
function renderStats() { renderAchievements(); }
function renderAchievements() {
  const grid = $("#achGrid");
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!S.ach[a.id];
    return `<div class="ach ${done ? "" : "locked"}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info"><div class="ach-name">${escapeHtml(a.name)}</div><div class="ach-desc">${escapeHtml(a.desc)}</div></div>
    </div>`;
  }).join("");
  $("#achCounter").textContent = doneAchCount() + "/" + ACHIEVEMENTS.length;
}
function renderChart() {
  const cv = $("#chart");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const w = cv.offsetWidth, H = 130, dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, H);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ k: dayKey(d), label: d.getDate() });
  }
  const maxXp = Math.max(100, ...days.map(d => (S.history[d.k] && S.history[d.k].xp) || 0));
  const pad = 4, gw = w / days.length;
  days.forEach((d, i) => {
    const v = (S.history[d.k] && S.history[d.k].xp) || 0;
    const h = Math.max(2, (v / maxXp) * (H - 58));
    const x = i * gw + gw * 0.15, y = H - 40 - h;
    ctx.fillStyle = (S.history[d.k] && S.history[d.k].perfect) ? "rgba(75,211,123,.85)" : "rgba(124,77,255,.55)";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, gw * 0.7, h, 4); ctx.fill(); }
    else { ctx.fillRect(x, y, gw * 0.7, h); }
    if (v > 0) { ctx.fillStyle = "#9aa4cf"; ctx.font = "10px 'Share Tech Mono'"; ctx.fillText(v > 999 ? "1k+" : Math.round(v), x - 1, y - 5); }
    ctx.fillStyle = "#6d77a3"; ctx.font = "9px 'Share Tech Mono'";
    ctx.fillText(d.label, x, H - 22);
  });
}

/* ---------- i18n apply ---------- */
function applyI18n() {
  document.documentElement.lang = S.lang;
  $$(".tab span").forEach((el, i) => {
    const keys = ["tabQuests", "tabRank", "tabAch", "tabSet"];
    el.textContent = t(keys[i]);
  });
  const qs = $("#qsLabel");
  if (qs) qs.textContent = t("qsLabel");
  $("#hudDate").textContent = locDate();
}
function applyLang() {
  applyI18n();
  render();
}

/* ---------- quest modal ---------- */
function showQuestModal() {
  const title = prompt(t("addQuest") + " — название:");
  if (!title) return;
  const target = parseFloat(prompt("Цель (число):", "100"));
  if (!(target > 0)) return;
  const unit = prompt("Единица (раз, км, мин, стр):", "раз") || "раз";
  const xp = parseInt(prompt("XP за выполнение:", "20"), 10) || 20;
  S.quests.push({
    id: "custom_" + Date.now(),
    icon: "⚔️",
    title: title.trim(),
    desc: target + " " + unit,
    unit, target, xp,
    type: "counter",
  });
  save(); render();
}

/* ---------- export/import/reset ---------- */
function exportData() {
  const blob = new Blob(
    [JSON.stringify({
      app: "slsw", version: 1, saved: new Date().toISOString(),
      note: "Solo Leveling System Workout backup", data: S
    }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "slsw-save-" + todayStr() + ".json";
  a.click();
  toast("💾 " + t("exportOk"));
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(String(r.result));
      const d = o.data || o;
      if (!d || typeof d !== "object" || !d.quests || !Array.isArray(d.quests)) throw new Error("bad");
      S = Object.assign({}, JSON.parse(JSON.stringify(S_STORE)), d);
      S = Object.assign(S, { lang: S.lang || "ru" });
      save();
      render();
      applyLang();
      toast("✔ " + t("importOk"));
    } catch (err) { toast("✖ " + t("importFail")); }
  };
  r.readAsText(file);
  e.target.value = "";
}
function resetAll() {
  if (!confirm(t("confirmReset"))) return;
  localStorage.removeItem(STORE_KEY);
  load();
  S.name = ""; S.awakenedAt = null;
  save();
  $("#wake").hidden = false;
  $("#app").hidden = true;
  $("#hunterNameInput").value = "";
  $("#btnContinue").hidden = true;
}

/* ---------- wake ---------- */
function awaken() {
  const inp = $("#hunterNameInput");
  const name = (inp.value || "").trim();
  if (!name) return;
  S.name = name;
  S.awakenedAt = Date.now();
  if (!(S.quests && S.quests.length)) S.quests = defaultQuests();
  save();
  AudioSys.init();
  enterApp();
  AudioSys.rankup();
  toast("⚡ " + t("awakTitle"));
}
function enterApp() {
  $("#hunterNameInput").value = S.name || "";
  $("#wake").hidden = true;
  $("#app").hidden = false;
  $("#setName").value = S.name || "";
  $("#setSound").checked = !!S.sound;
  $("#setVibr").checked = !!S.vibr;
  $("#setLang").value = S.lang || "ru";
  S.lastVisit = todayStr();
  syncStreak();
  save();
  applyI18n();
  switchTab("quests");
  render();
  AudioSys.setMuted(!S.sound);
  if (S.sound) AudioSys.init();
  checkAchievements();
}

/* ---------- boot ---------- */
function init() {
  const saved = loadStore();
  if (saved && saved.awakenedAt && saved.name) {
    S = saved;
    enterApp();
  } else {
    S = JSON.parse(JSON.stringify(S_STORE));
    if (saved && saved.name) {
      $("#btnContinue").hidden = false;
      $("#btnContinue b").textContent = saved.name;
      S.name = saved.name;
      S.quests = saved.quests && saved.quests.length ? saved.quests : defaultQuests();
    }
    $("#wake").hidden = false;
    $("#app").hidden = true;
  }

  $("#btnAwaken").addEventListener("click", awaken);
  $("#btnContinue").addEventListener("click", () => {
    const saved = loadStore();
    if (saved && saved.name) { S = saved; enterApp(); }
  });
  $("#hunterNameInput").addEventListener("input", () => {
    $("#btnAwaken").disabled = !$("#hunterNameInput").value.trim();
  });
  $("#hunterNameInput").addEventListener("keydown", e => { if (e.key === "Enter") awaken(); });
  $("#btnAddQuest").addEventListener("click", showQuestModal);
  $("#questsList").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const q = (S.quests || []).find(x => x.id === btn.dataset.id);
    if (!q) return;
    const act = btn.dataset.act;
    if (act === "+") doAdd(q, 1);
    else if (act === "-") doMinus(q);
    else if (act === "toggle") doToggle(q);
    else if (act === "step") doAdd(q, parseFloat(btn.dataset.step));
  });
  $$(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  $("#btnExport").addEventListener("click", exportData);
  $("#btnImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", importData);
  $("#btnReset").addEventListener("click", resetAll);
  $("#setName").addEventListener("change", e => { S.name = e.target.value.trim() || S.name; save(); renderHeader(); });
  $("#setSound").addEventListener("change", e => {
    S.sound = e.target.checked;
    if (S.sound) AudioSys.init(); else AudioSys.setMuted(true);
    save();
  });
  $("#setVibr").addEventListener("change", e => { S.vibr = e.target.checked; save(); });
  $("#setLang").addEventListener("change", e => { S.lang = e.target.value; save(); applyLang(); });
  $("#btnOverlayClose").addEventListener("click", closeOverlay);
  setInterval(() => {
    const k = todayStr();
    if (S.lastVisit !== k) {
      S.lastVisit = k;
      save();
      render();
    }
  }, 60000);
}
function switchTab(name) {
  $$(".view").forEach(v => v.style.display = "none");
  const el = $("#view-" + name);
  if (el) el.style.display = "";
  $$(".tab").forEach(tb => tb.classList.toggle("active", tb.dataset.tab === name));
  if (name === "rank") setTimeout(renderChart, 30);
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

document.addEventListener("DOMContentLoaded", init);