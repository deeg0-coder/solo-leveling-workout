/* ============================================================
   data.js — state, storage, ranks, quest defs, achievements
============================================================ */
const STORE_KEY = "slsw_state_v1";

const QUEST_TYPES = {
  counter: "counter",
  toggle: "toggle",
};

/* default quest pack (daily quests, like the System) */
function defaultQuests() {
  const q = (id, icon, title, target, unit, xp, type = "counter") => ({
    id, icon, title, desc: `${target} ${unit}`, target, unit, xp, type,
  });
  return [
    q("pushup", "💪", "Отжимания", 100, "раз", 30),
    q("situp", "🤸", "Пресс", 100, "раз", 30),
    q("squat", "🦵", "Приседания", 100, "раз", 30),
    q("pullup", "🧗", "Подтягивания", 10, "раз", 40),
    q("run", "🏃", "Бег", 5, "км", 50),
    q("read", "📖", "Чтение", 20, "стр", 25),
    q("cold", "🧊", "Контрастный душ/воды", 1, "раз", 20, "toggle"),
    q("stretch", "🤸", "Растяжка", 15, "мин", 15),
  ];
}

/* rank ladder: E -> D -> C -> B -> A -> S -> SS via cumulative XP */
const RANKS = [
  { id: "E", "xp": 0, color: "var(--rE)", name: "E-ранга" },
  { id: "D", "xp": 400, color: "var(--rD)", name: "D-ранга" },
  { id: "C", "xp": 1200, color: "var(--rC)", name: "C-ранга" },
  { id: "B", "xp": 3000, color: "var(--rB)", name: "B-ранга" },
  { id: "A", "xp": 7000, color: "var(--rA)", name: "A-ранга" },
  { id: "S", "xp": 16000, color: "var(--rS)", name: "S-ранга" },
  { id: "SS", "xp": 40000, color: "var(--rSS)", name: "Monarch" },
];

function xpForLevel(lv) {
  return Math.round(100 * Math.pow(lv, 1.7));
}
function totalXpForLevel(lv) {
  let s = 0;
  for (let i = 1; i < lv; i++) s += xpForLevel(i);
  return s;
}
function levelFromXp(xp) {
  let lv = 1;
  while (totalXpForLevel(lv + 1) <= xp) lv++;
  return lv;
}
function rankIndexFromXp(xp) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.xp) idx = i; });
  return idx;
}

let S_STORE = {
  name: "",
  lang: "ru",
  sound: true,
  vibr: true,
  awakenedAt: null,
  xp: 0,
  totalXp: 0,
  questsDone: 0,
  perfectDays: 0,
  streaks: { current: 0, best: 0, lastDay: "" },
  stats: { power: 0, speed: 0, endur: 0, intl: 0 },
  counters: {},       // id -> total executed over all time
  history: {},        // "YYYY-MM-DD" -> { xp, questsDone, perfect }
  quests: defaultQuests(),
  doneToday: {},      // id -> true
  ach: {},
  lastVisit: "",
};

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- persistence ---------- */
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S_STORE)); } catch (e) { /* quota */ }
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign({}, S_STORE, s);
  } catch (e) { return null; }
}
function resetStore() {
  S_STORE = JSON.parse(JSON.stringify({
    ...S_STORE,
    xp: 0, totalXp: 0, questsDone: 0, perfectDays: 0,
    counters: {}, history: {}, quests: defaultQuests(), doneToday: {}, ach: {},
  }));
  saveStore();
}

/* ---------- achievements (generic to app.js) ---------- */
const ACHIEVEMENTS = [
  { id: "first_quest", icon: "🌀", name: "Пробуждение", desc: "Выполните первое задание" },
  { id: "perfect_day", icon: "🌟", name: "Идеальный день", desc: "Все задания за один день" },
  { id: "lv5", icon: "🎚️", name: "Серебряный охотник", desc: "Достигните 5 уровня" },
  { id: "lv10", icon: "🔥", name: "Золотой охотник", desc: "Достигните 10 уровня" },
  { id: "lv20", icon: "⚡", name: "Легенда", desc: "Достигните 20 уровня" },
  { id: "rank_d", icon: "🟢", name: "Ранг D", desc: "Получите ранг D" },
  { id: "rank_c", icon: "🔵", name: "Ранг C", desc: "Получите ранг C" },
  { id: "rank_b", icon: "🟣", name: "Ранг B", desc: "Получите ранг B" },
  { id: "rank_a", icon: "🟠", name: "Ранг A", desc: "Получите ранг A" },
  { id: "rank_s", icon: "🔴", name: "Ранг S", desc: "Получите ранг S" },
  { id: "streak3", icon: "📅", name: "Стабильность", desc: "Серия 3 дня" },
  { id: "streak7", icon: "🗓️", name: "Неделя", desc: "Серия 7 дней" },
  { id: "streak30", icon: "🏔️", name: "Месяц", desc: "Серия 30 дней" },
  { id: "push1000", icon: "💪", name: "Тысяча", desc: "1000 отжиманий суммарно" },
  { id: "push5000", icon: "🧱", name: "Железный", desc: "5000 отжиманий суммарно" },
  { id: "read100", icon: "📚", name: "Книжный червь", desc: "Прочитано 100 страниц" },
];

function todayKey() { return dayKey(); }
const DAY = dayKey();