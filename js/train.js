/* ============================================================
   train.js — workout journal, PRs, focus timer
============================================================ */

/* ---------- workout journal ---------- */
function todaysWorkouts() {
  const k = todayStr();
  if (!S.workouts[k]) S.workouts[k] = {};
  return S.workouts[k];
}
function todaySets(exId) { return todaysWorkouts()[exId] || []; }

function logSet(exId, reps) {
  const ex = exerciseById(exId);
  if (!ex || !(reps > 0)) return;
  const day = todaysWorkouts();
  if (!day[exId]) day[exId] = [];
  day[exId].push({ reps, t: Date.now() });

  S.counters[exId] = (S.counters[exId] || 0) + reps;
  S.setsLogged = (S.setsLogged || 0) + 1;

  const xp = xpForSet(ex, reps);
  addXp(xp);

  // sync with daily quest of same id
  const qid = questIdForExercise(exId);
  if (qid && (S.quests || []).find(q => q.id === qid)) {
    const q = questById(qid);
    const cur = qCount(qid);
    const nv = Math.min(q.target, cur + reps);
    if (nv > cur) {
      qSet(qid, nv);
      if (nv >= q.target) {
        tryFinishQuest(q);
      }
    }
  }

  // PRs
  const pr = S.prs[exId] || { set: 0, total: 0 };
  let isPr = false;
  if (reps > pr.set) { pr.set = reps; isPr = true; }
  const tot = todaySets(exId).reduce((a, s) => a + s.reps, 0);
  if (tot > pr.total) { pr.total = tot; isPr = true; }
  if (isPr) {
    S.prCount = (S.prCount || 0) + 1;
    toast("🏅 " + ex.icon + " " + ex.name + " — PR (" + reps + ")");
  }
  S.prs[exId] = pr;

  // history
  const hk = todayStr();
  if (!S.history[hk]) S.history[hk] = { xp: 0, quests: 0, perfect: false, sets: 0 };
  S.history[hk].sets = (S.history[hk].sets || 0) + 1;
  S.history[hk].xp += xp;

  AudioSys.complete();
  save();
  render();
  checkAchievements();
}

function undoSet(exId) {
  const day = todaysWorkouts();
  if (!day[exId] || !day[exId].length) return;
  const last = day[exId].pop();
  S.setsLogged = Math.max(0, (S.setsLogged || 0) - 1);
  S.counters[exId] = Math.max(0, (S.counters[exId] || 0) - last.reps);
  const hk = todayStr();
  if (S.history[hk]) S.history[hk].sets = Math.max(0, (S.history[hk].sets || 0) - 1);
  AudioSys.minus();
  save(); render();
}

/* ---------- render workout tab ---------- */
function renderTrain() {
  const iface = $("#trainIface");
  if (!iface) return;
  const exId = ($("#exSel") && $("#exSel").value) || "pushup";
  const ex = exerciseById(exId);
  const sets = todaySets(exId);
  const total = sets.reduce((a, s) => a + s.reps, 0);
  const pr = S.prs[exId] || { set: 0, total: 0 };
  const qid = questIdForExercise(exId);
  const quest = qid ? questById(qid) : null;

  iface.innerHTML = `
    <div class="train-top">
      <select id="exSel" class="train-select">${EXERCISES.map(e =>
        `<option value="${e.id}" ${e.id === exId ? "selected" : ""}>${e.icon} ${e.name}</option>`).join("")}
      </select>
    </div>
    <div class="train-stats">
      <div class="t-stat"><em>${t("todayLabel")}</em><b>${total} ${ex.unit}</b></div>
      <div class="t-stat"><em>${t("focusSets")}</em><b>${sets.length}</b></div>
      <div class="t-stat"><em class="pr">${t("prSet")}</em><b>${pr.set || "—"}</b></div>
      <div class="t-stat"><em class="pr">${t("prDay")}</em><b>${pr.total || "—"}</b></div>
    </div>
    <div class="t-input">
      <input type="number" id="repInput" min="1" step="1" value="${quickRep(ex)}" class="rep-input">
      <button class="btn-primary t-add" id="btnLogReps">${t("btnLog")}</button>
      <button class="q-btn undo" id="btnUndo" title="Отменить">↩</button>
    </div>
    ${quest ? `<div class="train-hint">${t("syncedQuest")}: ${quest.icon} ${quest.title} — ${qCount(quest.id)}/${quest.target}</div>` : ""}
    <div class="train-sets">${sets.length
      ? sets.map((s, i) => `<div class="set-chip">#${i + 1} · <b>${s.reps}</b> ${ex.unit}</div>`).join("")
      : `<div class="empty">${t("noSets")}</div>`}
    </div>
  `;
  $("#exSel").onchange = () => { S.trainSel = $("#exSel").value; save(); renderTrain(); };
  $("#btnLogReps").onclick = () => {
    const v = parseFloat($("#repInput").value);
    if (v > 0) logSet($("#exSel").value, v);
  };
  $("#btnUndo").onclick = () => undoSet($("#exSel").value);
  $("#repInput").onkeydown = e => { if (e.key === "Enter") $("#btnLogReps").click(); };
}

function quickRep(ex) {
  return { "раз": 10, "сек": 30, "км": 1, "шагов": 1000, "стр": 10 }[ex.unit] || 10;
}

/* ---------- focus timer ---------- */
function focusStart(mins) {
  S.focus = { endsAt: Date.now() + mins * 60000, mins, running: true };
  AudioSys.click();
  save();
  renderFocus();
  tickFocus();
}
function focusPause() {
  if (!S.focus) return;
  S.focus.remaining = Math.max(1, focusLeft());
  S.focus.running = false;
  save(); renderFocus();
}
function focusResume() {
  if (!S.focus) return;
  const remaining = S.focus.remaining || Math.max(1, Math.round((S.focus.endsAt - Date.now()) / 1000));
  S.focus.endsAt = Date.now() + remaining * 1000;
  S.focus.running = true;
  save(); renderFocus(); tickFocus();
}
function focusCancel() {
  S.focus = null;
  save(); renderFocus();
}
function focusLeft() {
  if (!S.focus) return 0;
  const left = Math.round((S.focus.endsAt - Date.now()) / 1000);
  return Math.max(0, left);
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
function renderFocus() {
  const box = $("#focusBox");
  if (!box) return;
  if (S.focus) {
    const total = S.focus.mins * 60;
    const left = focusLeft();
    const pct = Math.max(0, Math.min(100, (left / total) * 100));
    box.innerHTML = `
      <div class="focus-running">
        <div class="focus-time" id="focusTime">${fmtTime(left)}</div>
        <div class="focus-track"><i id="focusBar" style="width:${pct}%"></i></div>
        <div class="focus-acts">
          <button class="btn-sm" onclick="${S.focus.running ? 'focusPause()' : 'focusResume()'}">${S.focus.running ? t("pause") : t("resume")}</button>
          <button class="btn-sm danger" onclick="focusCancel()">${t("cancelFocus")}</button>
        </div>
      </div>`;
    if (S.focus.running) tickFocus();
  } else {
    box.innerHTML = `
      <div class="focus-idle">
        <i class="focus-orb">⏳</i>
        <div class="focus-presets">
          <button class="btn-sm" data-mins="15">${t("min15")}</button>
          <button class="btn-sm" data-mins="25">${t("min25")}</button>
          <button class="btn-sm" data-mins="45">${t("min45")}</button>
        </div>
        <div class="train-hint">${t("focusHint")}</div>
      </div>`;
  }
}
function tickFocus() {
  if (!S.focus || !S.focus.running) return;
  const left = focusLeft();
  if (left <= 0) {
    S.focusSessions = (S.focusSessions || 0) + 1;
    AudioSys.perfect();
    toast("🎯 " + t("focusDone") + " +40 XP");
    addXp(40);
    S.focus = null;
    save();
    renderFocus();
    checkAchievements();
    return;
  }
  const el = $("#focusTime"), bar = $("#focusBar");
  if (el) el.textContent = fmtTime(left);
  if (bar && S.focus.mins) bar.style.width = (left / (S.focus.mins * 60)) * 100 + "%";
}
setInterval(() => { if (S && S.focus && S.focus.running) tickFocus(); }, 1000);