/* ============================================================
   data.js — state, storage, ranks, quest defs, achievements,
             shop items, hidden quests
============================================================ */
const STORE_KEY = "slsw_state_v2";

const QUEST_TYPES = { counter: "counter", toggle: "toggle" };

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
    q("plank", "⏱️", "Планка", 120, "сек", 25),
    q("read", "📖", "Чтение", 20, "стр", 25),
    q("cold", "🧊", "Контрастный душ", 1, "раз", 20, "toggle"),
    q("stretch", "🤸", "Растяжка", 15, "мин", 15),
  ];
}

/* rank ladder: E -> D -> C -> B -> A -> S -> SS */
const RANKS = [
  { id: "E", xp: 0, name: { ru: "E-ранга", en: "E-Rank" }, color: "var(--rE)" },
  { id: "D", xp: 600, name: { ru: "D-ранга", en: "D-Rank" }, color: "var(--rD)" },
  { id: "C", xp: 1600, name: { ru: "C-ранга", en: "C-Rank" }, color: "var(--rC)" },
  { id: "B", xp: 3800, name: { ru: "B-ранга", en: "B-Rank" }, color: "var(--rB)" },
  { id: "A", xp: 8500, name: { ru: "A-ранга", en: "A-Rank" }, color: "var(--rA)" },
  { id: "S", xp: 18000, name: { ru: "S-ранга", en: "S-Rank" }, color: "var(--rS)" },
  { id: "SS", xp: 45000, name: { ru: "Монарх", en: "Monarch" }, color: "var(--rSS)" },
];

function xpForLevel(lv) { return Math.round(100 * Math.pow(lv, 1.72)); }
function totalXpForLevel(lv) { let s = 0; for (let i = 1; i < lv; i++) s += xpForLevel(i); return s; }
function levelFromXp(xp) { let lv = 1; while (totalXpForLevel(lv + 1) <= xp) lv++; return lv; }
function rankIndexFromXp(xp) { let idx = 0; RANKS.forEach((r, i) => { if (xp >= r.xp) idx = i; }); return idx; }

/* ---------- default state ---------- */
const S_STORE = {
  name: "", lang: "ru", sound: true, vibr: true, awakenedAt: null,
  xp: 0, totalXp: 0, coins: 0,
  questsDone: 0, perfectDays: 0, hiddenDone: 0, focusSessions: 0,
  setsLogged: 0, prCount: 0, itemsBought: 0,
  streaks: { current: 0, best: 0 },
  counters: {},        // exerciseId -> lifetime total
  skills: {},          // statId -> allocated points
  skillPoints: 0,      // unspent
  history: {},         // "YYYY-MM-DD" -> { xp, quests, perfect, sets }
  workouts: {},        // "YYYY-MM-DD" -> { exId: [ { reps, t } ] }
  prs: {},             // exId -> { set, total }
  quests: defaultQuests(),
  doneToday: {},       // "YYYY-MM-DD" -> { qid: count }
  ach: {},
  shop: { inventory: ["t1", "s1"], activeSkin: "s1", activeTitle: "t1" },
  hidden: null,        // active hidden quest
  hiddenToday: {},     // date -> count spawned
  focus: null,         // { endsAt, mins, startedAt }
  daily: null,         // daily system quest { id, date, progress, done }
  dailyDone: 0,        // lifetime daily quests completed
  study: true,         // show daily system tip
  lastVisit: "",
};

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S_STORE)); } catch (e) { /* quota */ }
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const old = localStorage.getItem("slsw_state_v1");
      if (old) return migrateV1(JSON.parse(old));
      return null;
    }
    const saved = JSON.parse(raw);
    const base = JSON.parse(JSON.stringify(S_STORE));
    const merged = Object.assign(base, saved);
    merged.doneToday = saved.doneToday || {};
    merged.ach = saved.ach || {};
    merged.history = saved.history || {};
    merged.counters = saved.counters || {};
    merged.workouts = saved.workouts || {};
    if (!merged.shop) merged.shop = { inventory: ["s1", "t1"], activeTitle: "t1", activeSkin: "s1" };
    if (!Array.isArray(merged.shop.inventory)) merged.shop.inventory = ["s1", "t1"];
    return merged;
  } catch (e) { return null; }
}

/* migrate a v1 save into v2 shape */
function migrateV1(old) {
  if (!old) return null;
  const merged = JSON.parse(JSON.stringify(S_STORE));
  const map = {
    name: old.name, lang: old.lang, sound: old.sound, vibr: old.vibr,
    awakenedAt: old.awakenedAt, xp: old.xp || 0, totalXp: old.totalXp || 0,
    questsDone: old.questsDone || 0, perfectDays: old.perfectDays || 0,
    streaks: old.streaks || { current: 0, best: 0 },
    history: old.history || {}, quests: old.quests || defaultQuests(),
    doneToday: old.doneToday || {}, ach: old.ach || {}, counters: old.counters || {},
  };
  Object.assign(merged, map);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)); } catch (e) { /* noop */ }
  return merged;
}

/* ---------- exercises library ---------- */
const EXERCISES = [
  { id: "pushup", icon: "💪", name: "Отжимания", unit: "раз", stat: "power" },
  { id: "situp", icon: "🤸", name: "Пресс", unit: "раз", stat: "endur" },
  { id: "squat", icon: "🦵", name: "Приседания", unit: "раз", stat: "power" },
  { id: "pullup", icon: "🧗", name: "Подтягивания", unit: "раз", stat: "power" },
  { id: "plank", icon: "⏱️", name: "Планка", unit: "сек", stat: "endur" },
  { id: "run", icon: "🏃", name: "Бег", unit: "км", stat: "speed" },
  { id: "walk", icon: "🚶", name: "Прогулка", unit: "шагов", stat: "endur" },
  { id: "burpee", icon: "🔥", name: "Бёрпи", unit: "раз", stat: "speed" },
  { id: "read", icon: "📖", name: "Чтение", unit: "стр", stat: "intl" },
];
function exerciseById(id) { return EXERCISES.find(e => e.id === id); }

/* ---------- hunter stats (skill allocation) ---------- */
const STATS = {
  power: { icon: "⚔️", name: { ru: "Сила", en: "Strength" } },
  speed: { icon: "🏃", name: { ru: "Скорость", en: "Speed" } },
  endur: { icon: "🛡️", name: { ru: "Выносливость", en: "Endurance" } },
  intl: { icon: "🧠", name: { ru: "Интеллект", en: "Intellect" } },
};

/* XP derived from a logged set */
function xpForSet(ex, reps) {
  const per = { "раз": 0.5, "сек": 0.1, "км": 12, "шагов": 0.004, "стр": 1.5 }[ex.unit] || 0.5;
  return Math.round(reps * per);
}
function questIdForExercise(exId) {
  return ["pushup", "situp", "squat", "pullup", "plank", "run", "read"].includes(exId) ? exId : null;
}

/* ---------- shop ---------- */
const SHOP_TITLES = [
  { id: "t1", icon: "🎯", name: { ru: "Новичок", en: "Beginner" }, desc: { ru: "Базовый титул", en: "Basic title" }, price: 0 },
  { id: "t2", icon: "⚔️", name: { ru: "Грайнд", en: "Grinder" }, desc: { ru: "Настойчивость", en: "Persistence" }, price: 150 },
  { id: "t3", icon: "🌑", name: { ru: "Тень", en: "Shadow" }, desc: { ru: "Скрытность", en: "Stealth" }, price: 400 },
  { id: "t4", icon: "👑", name: { ru: "Монарх", en: "Monarch" }, desc: { ru: "Верховный", en: "Supreme" }, price: 1000 },
];
const SHOP_SKINS = [
  { id: "s1", name: { ru: "Неон", en: "Neon" }, c1: "#4fc3f7", c2: "#7c4dff", price: 0 },
  { id: "s2", name: { ru: "Фиолет", en: "Violet" }, c1: "#b388ff", c2: "#5e2d91", price: 300 },
  { id: "s3", name: { ru: "Багровый", en: "Crimson" }, c1: "#ff5f57", c2: "#7d1d1d", price: 450 },
  { id: "s4", name: { ru: "Изумруд", en: "Emerald" }, c1: "#4bd37b", c2: "#146b46", price: 350 },
  { id: "s5", name: { ru: "Золотой", en: "Golden" }, c1: "#ffd54f", c2: "#a9841f", price: 600 },
];
function skinById(id) { return SHOP_SKINS.find(s => s.id === id); }

/* ---------- hidden quests ---------- */
const HIDDEN_POOL = [
  { title: { ru: "Быстрая пробежка", en: "Quick run" }, unit: "раз", amount: 30, xp: 60, icon: "🏃" },
  { title: { ru: "Сто отжиманий", en: "One hundred push-ups" }, unit: "раз", amount: 100, xp: 50, icon: "💪" },
  { title: { ru: "Планка на сосредоточение", en: "Focus plank" }, unit: "сек", amount: 90, xp: 40, icon: "⏱️" },
  { title: { ru: "50 приседаний", en: "50 squats" }, unit: "раз", amount: 50, xp: 40, icon: "🦵" },
  { title: { ru: "Тихий час без экрана", en: "Screen-free hour" }, unit: "мин", amount: 30, xp: 50, icon: "🧘" },
  { title: { ru: "Быстрая медитация", en: "Quick meditation" }, unit: "мин", amount: 5, xp: 45, icon: "💆" },
];

/* ---------- daily system quest ---------- */
const DAILY_POOL = [
  { id: "d_plank", icon: "⏱️", title: { ru: "Планка 3 минуты", en: "3-minute plank" }, unit: "сек", amount: 180, xp: 60 },
  { id: "d_water", icon: "💧", title: { ru: "Выпить 2 литра воды", en: "Drink 2L of water" }, unit: "раз", amount: 8, xp: 40 },
  { id: "d_walk", icon: "🚶", title: { ru: "Прогулка 8000 шагов", en: "Walk 8000 steps" }, unit: "шагов", amount: 8000, xp: 60 },
  { id: "d_pull", icon: "🧗", title: { ru: "20 подтягиваний", en: "20 pull-ups" }, unit: "раз", amount: 20, xp: 50 },
  { id: "d_screen", icon: "📵", title: { ru: "Час без телефона", en: "Phone-free hour" }, unit: "мин", amount: 60, xp: 55 },
  { id: "d_stretch", icon: "🤸", title: { ru: "Растяжка 15 минут", en: "15-min stretch" }, unit: "мин", amount: 15, xp: 45 },
  { id: "d_read", icon: "📖", title: { ru: "Прочитать 30 страниц", en: "Read 30 pages" }, unit: "стр", amount: 30, xp: 45 },
  { id: "d_sleep", icon: "😴", title: { ru: "Спать 8 часов", en: "Sleep 8 hours" }, unit: "раз", amount: 1, xp: 70, toggle: true },
  { id: "d_squats", icon: "🦵", title: { ru: "100 приседаний", en: "100 squats" }, unit: "раз", amount: 100, xp: 55 },
  { id: "d_greens", icon: "🥗", title: { ru: "Порция овощей", en: "A serving of greens" }, unit: "раз", amount: 1, xp: 30, toggle: true },
];
function dailyQuestDef(id) { return DAILY_POOL.find(x => x.id === id); }
/* deterministic pseudo-random pick per date key (FNV-1a) */
function hashDate(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function dailyQuestForDate(k) { return DAILY_POOL[hashDate(k) % DAILY_POOL.length]; }
function dqSteps(dq) {
  if (dq.unit === "сек") return [30, 60];
  if (dq.unit === "мин") return [5, 10];
  if (dq.unit === "стр") return [10, 20];
  if (dq.unit === "шагов") return [1000, 2000];
  return [1, 5, 10];
}

/* ---------- streak rewards ---------- */
const STREAK_REWARDS = [
  { days: 7, coins: 25 },
  { days: 14, coins: 50 },
  { days: 21, coins: 75 },
  { days: 28, coins: 100 },
  { days: 35, coins: 150 },
  { days: 45, coins: 200 },
  { days: 60, coins: 300 },
  { days: 90, coins: 500 },
];
function streakCoinsFor(streak) {
  let coins = 25;
  STREAK_REWARDS.forEach(x => { if (streak >= x.days) coins = x.coins; });
  return coins;
}

/* ---------- daily tips (study mode) ---------- */
const TIPS = [
  { ru: "Один подход — уже победа над вчерашним собой.", en: "One set is already a victory over yesterday's you." },
  { ru: "Система не награждает тех, кто ждёт. Действуй первым.", en: "The System doesn't reward those who wait. Move first." },
  { ru: "Серость — это состояние. Тёмная аура — выбор.", en: "Grey is a state. A shadow aura is a choice." },
  { ru: "Маленькие шаги каждый день превращаются в ранг.", en: "Small steps every day turn into a rank." },
  { ru: "Тело слушается того, кто не отступает в воскресенье.", en: "The body obeys the one who doesn't quit on Sundays." },
  { ru: "Уровень — это не цифра, это твоя цена.", en: "A level isn't a number — it's your price." },
  { ru: "Пей воду, спи, поднимайся раньше. Система смотрит.", en: "Drink water, sleep, wake early. The System watches." },
  { ru: "Отличный день начинается с первого подхода.", en: "A great day starts with the first set." },
  { ru: "Ошибки — это XP. Не выключайся.", en: "Mistakes are XP. Don't shut down." },
  { ru: "Строгость к себе сегодня — мощный ты завтра.", en: "Discipline today is a stronger you tomorrow." },
];
function tipForDate(k) { return TIPS[hashDate("tip:" + k) % TIPS.length]; }

/* ---------- achievements ---------- */
const ACHIEVEMENTS = [
  { id: "first_quest", icon: "🌀", name: { ru: "Пробуждение", en: "Awakening" }, desc: { ru: "Выполните первое задание", en: "Complete your first quest" } },
  { id: "perfect_day", icon: "🌟", name: { ru: "Идеальный день", en: "Perfect day" }, desc: { ru: "Все задания за один день", en: "All quests in one day" } },
  { id: "lv5", icon: "🎚️", name: { ru: "Серебряный охотник", en: "Silver Hunter" }, desc: { ru: "Достигните 5 уровня", en: "Reach level 5" } },
  { id: "lv10", icon: "🔥", name: { ru: "Золотой охотник", en: "Golden Hunter" }, desc: { ru: "Достигните 10 уровня", en: "Reach level 10" } },
  { id: "lv20", icon: "⚡", name: { ru: "Легенда", en: "Legend" }, desc: { ru: "Достигните 20 уровня", en: "Reach level 20" } },
  { id: "rank_d", icon: "🟢", name: { ru: "Ранг D", en: "D Rank" }, desc: { ru: "Получите ранг D", en: "Reach D rank" } },
  { id: "rank_c", icon: "🔵", name: { ru: "Ранг C", en: "C Rank" }, desc: { ru: "Получите ранг C", en: "Reach C rank" } },
  { id: "rank_b", icon: "🟣", name: { ru: "Ранг B", en: "B Rank" }, desc: { ru: "Получите ранг B", en: "Reach B rank" } },
  { id: "rank_a", icon: "🟠", name: { ru: "Ранг A", en: "A Rank" }, desc: { ru: "Получите ранг A", en: "Reach A rank" } },
  { id: "rank_s", icon: "🔴", name: { ru: "Ранг S", en: "S Rank" }, desc: { ru: "Получите ранг S", en: "Reach S rank" } },
  { id: "streak3", icon: "📅", name: { ru: "Стабильность", en: "Steady" }, desc: { ru: "Серия 3 дня", en: "3-day streak" } },
  { id: "streak7", icon: "🗓️", name: { ru: "Неделя", en: "A Week" }, desc: { ru: "Серия 7 дней", en: "7-day streak" } },
  { id: "streak30", icon: "🏔️", name: { ru: "Месяц", en: "A Month" }, desc: { ru: "Серия 30 дней", en: "30-day streak" } },
  { id: "push1000", icon: "💪", name: { ru: "Тысяча", en: "A Thousand" }, desc: { ru: "1000 отжиманий суммарно", en: "1000 push-ups total" } },
  { id: "push5000", icon: "🧱", name: { ru: "Железный", en: "Iron" }, desc: { ru: "5000 отжиманий суммарно", en: "5000 push-ups total" } },
  { id: "read100", icon: "📚", name: { ru: "Книжный червь", en: "Bookworm" }, desc: { ru: "Прочитано 100 страниц", en: "100 pages read" } },
  { id: "sets30", icon: "📝", name: { ru: "Тренировщик", en: "Trainer" }, desc: { ru: "Записано 30 подходов", en: "30 sets logged" } },
  { id: "focus5", icon: "🎯", name: { ru: "Фокус", en: "Deep Focus" }, desc: { ru: "5 сессий фокуса", en: "5 focus sessions" } },
  { id: "hidden3", icon: "🌀", name: { ru: "Тень заданий", en: "Quest Shadow" }, desc: { ru: "3 скрытых квеста", en: "3 hidden quests" } },
  { id: "coins500", icon: "🪙", name: { ru: "Богач", en: "Rich" }, desc: { ru: "Накопите 500 монет", en: "Save 500 coins" } },
  { id: "invent5", icon: "🛒", name: { ru: "Коллекционер", en: "Collector" }, desc: { ru: "5 предметов рынка", en: "5 shop items" } },
  { id: "pr10", icon: "📈", name: { ru: "Рекордсмен", en: "Record Breaker" }, desc: { ru: "10 личных рекордов", en: "10 personal records" } },
  { id: "skills10", icon: "🎓", name: { ru: "Стратег", en: "Strategist" }, desc: { ru: "Потрачено 10 очков навыков", en: "Spend 10 skill points" } },
  { id: "speedA", icon: "🌪️", name: { ru: "Ветер", en: "Wind" }, desc: { ru: "10 км бега суммарно", en: "10 km of running total" } },
  { id: "daily7", icon: "⚙️", name: { ru: "Слуга Системы", en: "System's Servant" }, desc: { ru: "Выполнено 7 заданий дня", en: "Complete 7 daily quests" } },
];