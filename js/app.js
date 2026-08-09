/* ============================================================
   app.js — main app logic (v2: skills, coins, hidden, shop)
============================================================ */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

let S = null;

/* ---------- persistence ---------- */
function save() {
  try { if (S && S.name) localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* quota */ }
}

/* ---------- date ---------- */
function todayStr() { return dayKey(new Date()); }

function locDate() {
  const o = { weekday: "long", day: "numeric", month: "long" };
  return new Date().toLocaleDateString(S.lang === "en" ? "en-US" : "ru-RU", o);
}

/* ---------- level / ranks ---------- */
function lvl() { return levelFromXp(S.xp); }
function rankIdx() { return rankIndexFromXp(S.xp); }
function rank() { return RANKS[rankIdx()]; }

/* ---------- quest counters ---------- */
function dayDone() {
  const k = todayStr();
  if (!S.doneToday[k]) S.doneToday[k] = {};
  return S.doneToday[k];
}
function qCount(qid) { return dayDone()[qid] || 0; }
function qSet(qid, v) { dayDone()[qid] = v; }
function questById(qid) { return (S.quests || []).find(q => q.id === qid); }
function questDoneToday(qid) { return !!(dayDone()[qid + "_d"]); }
function markQuestDoneToday(qid) { dayDone()[qid + "_d"] = true; }
/* award quest completion only once per day */
function tryFinishQuest(q) {
  if (questDoneToday(q.id)) return;
  markQuestDoneToday(q.id);
  finishQuest(q);
}

/* ---------- stats with skills ---------- */
function hunterStats() {
  const c = S.counters || {};
  const lv = lvl();
  const sk = S.skills || {};
  return {
    power: Math.round(lv * 3 + (c.pushup || 0) * 0.2 + (c.pullup || 0) * 0.4 + (c.squat || 0) * 0.1 + (sk.power || 0) * 5),
    speed: Math.round(lv * 2.5 + (c.run || 0) * 1.2 + (sk.speed || 0) * 5),
    endur: Math.round(lv * 3 + (c.situp || 0) * 0.2 + (c.plank || 0) * 0.05 + (sk.endur || 0) * 5),
    intl: Math.round(lv * 2 + (c.read || 0) * 0.3 + (sk.intl || 0) * 5),
  };
}
function statFromExercise(exId) {
  const ex = exerciseById(exId);
  return ex ? ex.stat : "endur";
}

/* ---------- streak ---------- */
function computeStreak() {
  const h = S.history || {};
  let d = new Date();
  const tk = dayKey(d);
  const recToday = h[tk];
  const todayActive = (recToday && (recToday.quests > 0 || recToday.perfect || recToday.sets)) || questsDoneTodayCount() > 0;
  if (!todayActive) d.setDate(d.getDate() - 1);
  let s = 0;
  for (let i = 0; i < 4000; i++) {
    const k = dayKey(d);
    const rec = h[k];
    if (!rec || (!rec.quests && !rec.perfect && !rec.sets)) break;
    s++; d.setDate(d.getDate() - 1);
  }
  return s;
}
function syncStreak() {
  const prev = S.streaks.current || 0;
  const cur = computeStreak();
  if (cur > (S.streaks.best || 0)) S.streaks.best = cur;
  S.streaks.current = cur;
  if (cur > prev && cur > 0 && cur % 7 === 0) {
    addCoins(25);
    AudioSys.perfect();
    toast("🏆 " + t("streakRewarded") + " " + cur + " " + t("daysOn"));
    confettiBurst();
  }
  save();
}

/* ---------- XP flow ---------- */
function addXp(n) {
  if (!(n > 0)) return;
  const wasRank = rankIndexFromXp(S.xp);
  const wasLv = levelFromXp(S.xp);
  S.xp += n;
  if (S.xp > (S.totalXp || 0)) S.totalXp = S.xp;
  const nowLv = levelFromXp(S.xp);
  const nowRank = rankIndexFromXp(S.xp);
  const newSkillPts = nowLv - wasLv;
  if (newSkillPts > 0) {
    S.skillPoints = (S.skillPoints || 0) + newSkillPts;
    toast("💡 +" + newSkillPts + " " + t("skillPts"));
  }
  if (nowRank > wasRank) rankUp();
  else if (nowLv > wasLv) levelUp(nowLv);
  else AudioSys.complete();
  historyAddXp(n);
  save();
  render();
}
function historyAddXp(amount) {
  const k = todayStr();
  if (!S.history[k]) S.history[k] = { xp: 0, quests: 0, perfect: false, sets: 0 };
  S.history[k].xp += amount;
}
function markQuestDone() {
  const k = todayStr();
  if (!S.history[k]) S.history[k] = { xp: 0, quests: 0, perfect: false, sets: 0 };
  S.history[k].quests = (S.history[k].quests || 0) + 1;
}
function questsDoneTodayCount() {
  return (S.quests || []).filter(q => qCount(q.id) >= q.target).length;
}

/* ---------- skills allocation ---------- */
/* (allocateSkill defined below, near boot section) */

/* ---------- daily quest complete ---------- */
function finishQuest(q) {
  S.questsDone = (S.questsDone || 0) + 1;
  markQuestDone();
  addXp(q.xp, true);
  addCoins(10);
  toast("✅ " + q.title + " — " + t("questDone") + " +" + q.xp + " XP");
  checkPerfectDay();
  checkAchievements();
  syncStreak();
  tryHiddenSpawn();
}
function checkPerfectDay() {
  const all = S.quests.length > 0 && S.quests.every(q => qCount(q.id) >= q.target);
  const hist = S.history[todayStr()] || (S.history[todayStr()] = { xp: 0, quests: 0, perfect: false, sets: 0 });
  if (all && !hist.perfect) {
    hist.perfect = true;
    S.perfectDays = (S.perfectDays || 0) + 1;
    addXp(200, true);
    addCoins(50);
    AudioSys.perfect();
    toast("🌟 " + t("perfectDay") + " " + t("perfectBonus") + "!");
    confettiBurst();
  }
  historyAddXp(0); // refresh quest count
}

/* ---------- hidden quests ---------- */
function tryHiddenSpawn() {
  const k = todayStr();
  if (S.hidden) return;
  if (S.hiddenToday && S.hiddenToday[k] >= 1) return;
  if (Math.random() < 0.25) {
    const tpl = HIDDEN_POOL[Math.floor(Math.random() * HIDDEN_POOL.length)];
    S.hidden = { ...tpl, progress: 0, spawned: Date.now() };
    S.hiddenToday = S.hiddenToday || {};
    S.hiddenToday[k] = (S.hiddenToday[k] || 0) + 1;
    AudioSys.rankup();
    toast("🌀 " + t("hiddenQuest") + ": " + (tpl.title[S.lang] || tpl.title.ru));
    save();
    renderQuests();
  }
}
function addHiddenProgress(n) {
  if (!S.hidden) return;
  S.hidden.progress += n;
  if (S.hidden.progress >= S.hidden.amount) {
    S.hiddenDone = (S.hiddenDone || 0) + 1;
    addXp(S.hidden.xp, true);
    addCoins(25);
    AudioSys.perfect();
    toast("🌀 " + t("hiddenDone") + " +" + S.hidden.xp + " XP");
    S.hidden = null;
    checkAchievements();
    confettiBurst();
  }
  save();
  renderQuests();
}
function dismissHidden() { S.hidden = null; save(); renderQuests(); }
function delQuest(q) {
  if (!confirm(t("delQuest"))) return;
  S.quests = (S.quests || []).filter(x => x.id !== q.id);
  delete dayDone()[q.id];
  delete dayDone()[q.id + "_d"];
  AudioSys.minus();
  save();
  render();
}
function restoreQuests() {
  S.quests = defaultQuests();
  AudioSys.plus();
  save();
  render();
}

/* ---------- overlay ---------- */
function showOverlay(mode, meta) {
  $("#lvTitle").textContent = mode === "rank" ? RANKS[meta.idx].id : "LV " + meta.lv;
  $("#lvKicker").textContent = mode === "rank" ? t("rankUpTitle") : t("lvUpTitle");
  $("#lvSub").textContent = mode === "rank" ? t("rankUpText") + " — " + (RANKS[meta.idx].name[S.lang] || RANKS[meta.idx].name.ru) : t("levelNew") + ": " + meta.lv;
  $("#lvStars").innerHTML = "✦".repeat(mode === "rank" ? 5 : 3);
  $("#overlay").hidden = false;
  if (mode === "rank") { AudioSys.rankup(); confettiBurst(); if (S.vibr && navigator.vibrate) navigator.vibrate([90, 50, 90]); }
  else AudioSys.levelup();
}
function levelUp(lv) { showOverlay("lv", { lv }); }
function rankUp() { showOverlay("rank", { idx: rankIdx() }); }

/* ---------- achievements ---------- */
function checkAchievements() {
  const lv = lvl();
  const c = S.counters || {};
  const spentSkills = (S.skills && Object.values(S.skills).reduce((a, b) => a + b, 0)) || 0;
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
    sets30: (S.setsLogged || 0) >= 30,
    focus5: (S.focusSessions || 0) >= 5,
    hidden3: (S.hiddenDone || 0) >= 3,
    coins500: (S.coins || 0) >= 500,
    invent5: (S.itemsBought || 0) >= 5,
    pr10: (S.prCount || 0) >= 10,
    skills10: spentSkills >= 10,
    speedA: (c.run || 0) >= 10,
  };
  let fresh = 0;
  ACHIEVEMENTS.forEach(a => {
    if (tests[a.id] && !S.ach[a.id]) {
      S.ach[a.id] = true;
      toast("🏅 " + (a.name[S.lang] || a.name.ru));
      AudioSys.complete();
      fresh++;
    }
  });
  if (fresh) { if (S.vibr && navigator.vibrate) navigator.vibrate([60, 40, 60]); save(); renderAchievements(); }
}
function doneAchCount() { return ACHIEVEMENTS.filter(a => S.ach[a.id]).length; }

/* ---------- toast ---------- */
function toast(msg) {
  const box = $("#toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="t-dot">SYSTEM</span><span>${msg}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .35s"; setTimeout(() => el.remove(), 380); }, 3000);
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
    vy: -Math.random() * 12 - 5,
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
  renderCalendar();
  renderTrain();
  renderFocus();
  renderShop();
}

function renderHeader() {
  const lv = lvl();
  $("#lvlNum").textContent = lv;
  const cur = totalXpForLevel(lv);
  const need = xpForLevel(lv);
  $("#xpText").textContent = Math.round(S.xp - cur) + " / " + need;
  $("#xpFill").style.width = Math.min(100, ((S.xp - cur) / need) * 100) + "%";
  $("#streakChip").textContent = "🔥 " + (S.streaks.current || 0);
  $("#coinBadge").textContent = "🪙 " + (S.coins || 0);
  $("#hunterName").textContent = S.name || "Хантер";
  applyTitle();
  setRankColors();
}
function setRankColors() {
  const r = rank();
  const badge = $("#rankBadge");
  badge.textContent = r.id;
  badge.style.setProperty("--rc", r.color);
  document.documentElement.style.setProperty("--rc", r.color);
  const title = $("#hudTitle");
  if (title) title.textContent = r.id + "-Rank";
}

function renderQuests() {
  const list = $("#questsList");
  const qs = S.quests || [];
  $("#qsTitle").textContent = `${t("today")} ${locDate()}`;
  list.innerHTML = "";

  // hidden quest banner
  const hq = $("#hiddenQuest");
  if (S.hidden) {
    const h = S.hidden;
    hq.hidden = false;
    const pct = Math.min(100, (h.progress / h.amount) * 100);
    hq.innerHTML = `
      <div class="hq-banner">
        <div class="hq-head"><span class="hq-icon">${h.icon}</span>
          <div class="hq-body">
            <div class="hq-kicker">🌀 ${t("hiddenQuestLabel")}</div>
            <div class="hq-title">${h.title[S.lang] || h.title.ru}</div>
            <div class="hq-bar"><i style="width:${pct}%"></i></div>
            <div class="hq-prog">${Math.min(h.progress, h.amount)} / ${h.amount} ${h.unit} · +${h.xp} XP</div>
          </div>
        </div>
        <div class="hq-acts">
          <button class="q-btn" data-hact="add1">+1</button>
          <button class="q-btn" data-hact="add5">+5</button>
          <button class="q-btn" data-hact="add25">+25</button>
          <button class="q-btn minus" data-hact="dismiss" title="Отклонить">✕</button>
        </div>
      </div>`;
  } else {
    hq.hidden = true;
    hq.innerHTML = "";
  }

  if (!qs.length) {
    list.innerHTML = `<div class="empty">${t("noQuests")}</div><button class="btn-outline q-restore" id="btnRestoreQuests">🔄 ${t("resetQuest")}</button>`;
    const rb = $("#btnRestoreQuests");
    if (rb) rb.addEventListener("click", restoreQuests);
  }
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
          <div class="quest-xp">+${q.xp} XP</div>
          <div class="quest-done-badge">✓</div>
          <button class="q-del" data-id="${q.id}" data-act="del" title="✕">✕</button>
        </div>
        <div class="quest-bar"><i class="${isDone ? "" : "low"}" style="width:${pct}%"></i></div>
        <div class="quest-controls">
          <button class="q-btn minus" data-id="${q.id}" data-act="-">−</button>
          <div class="q-value"><b>${fmtQ(cur, q)}</b><em>/ ${fmtQ(q.target, q)} ${q.unit}</em></div>
          <button class="q-btn plus" data-id="${q.id}" data-act="+">+</button>
        </div>
        <div class="q-add">
          ${q.type === "toggle"
            ? `<button class="q-btn" data-id="${q.id}" data-act="toggle">${isDone ? "✓" : t("finish")}</button>`
            : (isDone
                ? ""
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
}
function fmtQ(v, q) {
  v = Math.round(v * 10) / 10;
  if (q.unit === "км") return v % 1 === 0 ? Math.round(v) : v.toFixed(1);
  return Math.round(v);
}
function quickSteps(q) {
  if (q.unit === "км") return [0.5, 1, 2];
  if (q.unit === "мин") return [1, 5, 10];
  if (q.unit === "сек") return [10, 30, 60];
  if (q.type === "toggle") return [];
  if (q.target > 500) return [10, 25, 50];
  return [10, 25, 50].filter(s => s <= q.target);
}

function renderRank() {
  const idx = rankIdx();
  const r = RANKS[idx];
  const next = RANKS[idx + 1];
  $("#rankBig").textContent = r.id;
  $("#rankName").textContent = r.name[S.lang] || r.name.ru;
  $("#rankName").style.color = r.color;
  $("#rankBig").style.background = "var(" + (['--rE', '--rD', '--rC', '--rB', '--rA', '--rS', '--rSS'][idx]) + ")";
  const big = $("#rankBig");
  big.textContent = r.id;
  big.style.setProperty("--rc", r.color);
  if (next) {
    const need = next.xp - r.xp, have = S.xp - r.xp;
    $("#rankDesc").textContent = `${need - have} XP ${t("toNext")} ${next.id}`;
    $("#rankXpFill").style.width = Math.min(100, (have / need) * 100) + "%";
    $("#rankProgress").textContent = `${Math.round(have)} / ${need} XP`;
  } else {
    $("#rankDesc").textContent = (r.name[S.lang] || r.name.ru) + " — " + (S.lang === "en" ? "MAX" : "МАКС");
    $("#rankXpFill").style.width = "100%";
    $("#rankProgress").textContent = "MAX";
  }
  $("#rankPath").innerHTML = RANKS.map((rr, i) => `
    <div class="rp-item ${i === idx ? "current" : ""}">
      <div class="rp-letter ${i < idx ? "done" : ""} ${i === idx ? "active" : ""}">${rr.id}</div>
      <span class="rp-name">${rr.id}-Rank</span>
    </div>`).join("");
  const st = hunterStats();
  $("#stStrength").textContent = st.power;
  $("#stSpeed").textContent = st.speed;
  $("#stEndurance").textContent = st.endur;
  $("#stWisdom").textContent = st.intl;
  $("#skillPoints").textContent = "💡 " + (S.skillPoints || 0);
  $("#sTotalXp").textContent = Math.round(S.xp);
  $("#sQuestsDone").textContent = S.questsDone || 0;
  $("#sWorkouts").textContent = Object.values(S.history || {}).reduce((a, h) => a + (h.quests || 0) + (h.sets || 0), 0);
  $("#sPages").textContent = S.counters?.read || 0;
  $("#sStreak").textContent = S.streaks.current || 0;
  $("#sBestStreak").textContent = S.streaks.best || 0;
  $("#sPerfect").textContent = S.perfectDays || 0;
  $("#sHidden").textContent = S.hiddenDone || 0;

  // skill rows
  const rows = $("#skillRows");
  if (rows) {
    rows.innerHTML = Object.entries(STATS).map(([id, st]) => `
      <div class="srow">
        <span>${st.icon} ${st.name[S.lang] || st.name.ru} <em class="sk-fine">+${S.skills[id] || 0}</em></span>
        <button class="btn-sm" data-alloc-target="${id}" ${S.skillPoints > 0 ? "" : "disabled style='opacity:.4'"}>+1 💡</button>
      </div>`).join("");
  }
}

function renderStats() { renderAchievements(); }

function renderAchievements() {
  const grid = $("#achGrid");
  if (!grid) return;
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!S.ach[a.id];
    return `<div class="ach ${done ? "" : "locked"}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info"><div class="ach-name">${escapeHtml(a.name[S.lang] || a.name.ru)}</div><div class="ach-desc">${escapeHtml(a.desc[S.lang] || a.desc.ru)}</div></div>
    </div>`;
  }).join("");
  $("#achCounter").textContent = doneAchCount() + "/" + ACHIEVEMENTS.length;
}

function renderCalendar() {
  const box = $("#calendar");
  if (!box) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let html = `<div class="cal-mon">${now.toLocaleDateString(S.lang === "en" ? "en-US" : "ru-RU", { month: "long", year: "numeric" })}</div><div class="cal-dow">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => `<span>${d}</span>`).join("")}</div><div class="cal-grid">`;
  for (let i = 0; i < offset; i++) html += `<span class="cal-cell dim"></span>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rec = S.history[k];
    let cls = "cal-cell";
    if (rec && rec.perfect) cls += " perfect";
    else if (rec && (rec.quests > 0 || rec.sets > 0)) cls += " done";
    if (k === todayStr()) cls += " today";
    html += `<span class="${cls}" title="${k}">${d}</span>`;
  }
  html += `</div>`;
  box.innerHTML = html;
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
  const maxXp = Math.max(100, ...days.map(d => (S.history[d.k]?.xp || 0)));
  const gw = w / days.length;
  days.forEach((d, i) => {
    const v = S.history[d.k]?.xp || 0;
    const h = Math.max(2, (v / maxXp) * (H - 58));
    const x = i * gw + gw * 0.15, y = H - 40 - h;
    ctx.fillStyle = (S.history[d.k] && S.history[d.k].perfect) ? "rgba(75,211,123,.85)" : "rgba(124,77,255,.55)";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, gw * 0.7, h, 4); ctx.fill(); }
    else ctx.fillRect(x, y, gw * 0.7, h);
    if (v > 0) { ctx.fillStyle = "#9aa4cf"; ctx.font = "10px 'Share Tech Mono'"; ctx.fillText(v > 999 ? "1k+" : Math.round(v), x - 1, y - 5); }
    ctx.fillStyle = "#6d77a3"; ctx.font = "9px 'Share Tech Mono'";
    ctx.fillText(d.label, x, H - 22);
  });
}

/* ---------- i18n ---------- */
function applyI18n() {
  document.documentElement.lang = S.lang;
  $$(".tab span").forEach((el, i) => {
    el.textContent = [t("tabQuests"), t("tabTrain"), t("tabRank"), t("tabShop"), t("tabSet")][i] || el.textContent;
  });
  const ids = {
    qsLabel: t("qsLabel"), curRankEl: t("curRank"), pathTitleEl: t("pathTitle"),
    statsTitleEl: t("statsTitle"), skillPtsTitleEl: t("skillPtsTitle"),
    persStatsEl: t("persStats"), chartTitleEl: t("chartTitle"), calTitleEl: t("calTitle"),
    achTitleEl: t("achievementsTitle"), walletTitleEl: t("walletTitle"),
    profileTitleEl: t("profileTitle"), settingsTitleEl: t("settingsTitle"), dataTitleEl: t("dataTitle"),
  };
  for (const id in ids) { const el = $("#" + id); if (el) el.textContent = ids[id]; }
  const pct = $("#qsPctLabel");
  if (pct) pct.textContent = t("donePct");
  $$("#view-rank .stat-rows .srow span").forEach((el, i) => {
    const labels = [t("totalXp"), t("questsDone"), t("workoutsDone"), t("pagesRead"), t("streakDays"), t("bestStreak"), t("perfectDays"), t("hiddenQuestsDone")];
    if (labels[i]) el.textContent = labels[i];
  });
  const foots = $$(".footnote");
  [t("footTrain"), t("footShop"), t("footMain")].forEach((s, i) => { if (foots[i]) foots[i].textContent = s; });
  const il = $("#installLbl"), idsc = $("#installDesc");
  if (il) il.textContent = t("install");
  if (idsc) idsc.textContent = t("installable");
  $("#hudDate").textContent = locDate();
}

/* ---------- quest modal ---------- */
function showQuestModal() {
  const title = prompt(t("newQuestName"));
  if (!title) return;
  const target = parseFloat(prompt(t("newQuestTarget"), "100"));
  if (!(target > 0)) return;
  const unit = prompt(t("newQuestUnit"), "раз") || "раз";
  const xp = parseInt(prompt(t("newQuestXp"), "20"), 10) || 20;
  S.quests.push({ id: "custom_" + Date.now(), icon: "⚔️", title: title.trim(),
    desc: target + " " + unit, unit, target, xp, type: "counter" });
  save(); render();
}

/* ---------- export / import / reset ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify({ app: "slsw", version: 2, saved: new Date().toISOString(), data: S }, null, 2)], { type: "application/json" });
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
      if (!d || typeof d !== "object" || !Array.isArray(d.quests)) throw new Error("bad");
      const base = JSON.parse(JSON.stringify(S_STORE));
      S = Object.assign(base, d);
      save();
      render();
      applyI18n();
      toast("✔ " + t("importOk"));
    } catch (err) { toast("✖ " + t("importFail")); }
  };
  r.readAsText(file);
  e.target.value = "";
}
function resetAll() {
  if (!confirm(t("confirmReset"))) return;
  localStorage.removeItem(STORE_KEY);
  S = JSON.parse(JSON.stringify(S_STORE));
  $("#wake").hidden = false;
  $("#app").hidden = true;
  $("#hunterNameInput").value = "";
}

/* ---------- wake ---------- */
function awaken() {
  const name = ($("#hunterNameInput").value || "").trim();
  if (!name) return;
  S.name = name;
  S.awakenedAt = Date.now();
  save();
  AudioSys.init();
  enterApp();
  AudioSys.rankup();
  toast("⚡ " + t("awakTitle"));
}
function enterApp() {
  const body = document.body;
  $("#hunterNameInput").value = S.name || "";
  $("#wake").hidden = true;
  $("#app").hidden = false;
  syncStreak();
  applySkin();
  save();
  applyI18n();
  switchTab("quests");
  render();
  applySkin();
  if (S.sound) AudioSys.init();
  checkAchievements();
  tryHiddenSpawn();
}

/* ---------- boot ---------- */
function init() {
  const saved = loadStore();
  if (saved && saved.awakenedAt && saved.name) { S = saved; enterApp(); }
  else {
    S = JSON.parse(JSON.stringify(S_STORE));
    if (saved && saved.name) { S.name = saved.name; S.quests = saved.quests || defaultQuests(); }
    $("#wake").hidden = false;
    $("#app").hidden = true;
  }

  $("#btnAwaken").addEventListener("click", awaken);
  $("#hunterNameInput").addEventListener("input", () => $("#btnAwaken").disabled = !$("#hunterNameInput").value.trim());
  $("#hunterNameInput").addEventListener("keydown", e => { if (e.key === "Enter") awaken(); });
  $("#btnAddQuest").addEventListener("click", showQuestModal);
  $("#questsList").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (btn) {
      const q = (S.quests || []).find(x => x.id === btn.dataset.id);
      if (!q) return;
      const act = btn.dataset.act;
      if (act === "+") doAdd(q, 1);
      else if (act === "-") doMinus(q);
      else if (act === "toggle") doToggle(q);
      else if (act === "step") doAdd(q, parseFloat(btn.dataset.step));
      else if (act === "del") delQuest(q);
      return;
    }
    const hbtn = e.target.closest("[data-hact]");
    if (hbtn) {
      const v = parseInt(hbtn.dataset.hact.replace("add", ""), 10) || 0;
      if (v > 0) addHiddenProgress(v);
      else dismissHidden();
    }
  });
  $("#hiddenQuest").addEventListener("click", e => {
    const hbtn = e.target.closest("[data-hact]");
    if (!hbtn) return;
    const v = parseInt(hbtn.dataset.hact.replace("add", ""), 10) || 0;
    if (v > 0) addHiddenProgress(v);
    else dismissHidden();
  });
  $$(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  $("#btnExport").addEventListener("click", exportData);
  $("#btnImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", importData);
  $("#btnReset").addEventListener("click", resetAll);
  $("#setName").addEventListener("change", e => { S.name = e.target.value.trim() || S.name; save(); renderHeader(); });
  $("#setSound").addEventListener("change", e => { S.sound = e.target.checked; AudioSys.setMuted(!S.sound); save(); });
  $("#setVibr").addEventListener("change", e => { S.vibr = e.target.checked; save(); });
  $("#setLang").addEventListener("change", e => { S.lang = e.target.value; save(); applyI18n(); render(); });
  $("#btnOverlayClose").addEventListener("click", () => $("#overlay").hidden = true);
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    const row = $("#installRow");
    if (row) row.hidden = false;
  });
  $("#btnInstall").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
  document.addEventListener("click", e => {
    const sk = e.target.closest("[data-alloc-target]");
    if (sk) { allocateSkill(sk.dataset.allocTarget); return; }
    const focusBtn = e.target.closest("[data-mins]");
    if (focusBtn) focusStart(parseInt(focusBtn.dataset.mins, 10));
  });
  setInterval(() => {
    const k = todayStr();
    if (S.lastVisit !== k) {
      S.lastVisit = k; save();
      S.doneToday = S.doneToday || {}; // fresh day
      syncStreak();
      render();
    }
  }, 60000);
}
function allocateSkill(stat) {
  if (!(S.skillPoints > 0)) { toast("😕 " + "Не хватает очков"); return; }
  S.skills[stat] = (S.skills[stat] || 0) + 1;
  S.skillPoints--;
  AudioSys.plus();
  save();
  checkAchievements();
  renderRank();
}
function switchTab(name) {
  $$(".view").forEach(v => v.style.display = "none");
  const el = $("#view-" + name);
  if (el) el.style.display = "";
  $$(".tab").forEach(tb => tb.classList.toggle("active", tb.dataset.tab === name));
  render();
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* quest actions (counter) */
function doAdd(q, step) {
  if (questDoneToday(q.id)) return;
  const cur = qCount(q.id);
  const nv = Math.min(q.target, cur + (step || 1));
  if (nv <= cur) return;
  qSet(q.id, nv);
  if (nv >= q.target) tryFinishQuest(q);
  else { AudioSys.plus(); save(); render(); }
}
function doMinus(q) {
  const cur = qCount(q.id);
  if (cur <= 0) return;
  qSet(q.id, cur - 1);
  AudioSys.minus(); save(); render();
}
function doToggle(q) {
  const cur = qCount(q.id);
  if (cur > 0) { qSet(q.id, 0); AudioSys.minus(); save(); render(); }
  else { if (!questDoneToday(q.id)) { qSet(q.id, 1); tryFinishQuest(q); } }
}

document.addEventListener("DOMContentLoaded", init);