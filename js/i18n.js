/* ============================================================
   SOLO LEVELING SYSTEM WORKOUT — i18n RU/EN
============================================================ */
const I18N = {
  ru: {
    tabQuests: "Задачи", tabRank: "Ранг", tabAch: "Награды", tabSet: "Настройки",
    questXp: "XP",
    today: "Сегодня:",
    qsLabel: "ДНЕВНОЕ ЗАДАНИЕ",
    addQuest: "+ Новое задание",
    noQuests: "Заданий нет. Добавьте первое задание.",
    finish: "Завершить",
    questDone: "Задание выполнено",
    perfectDay: "ИДЕАЛЬНЫЙ ДЕНЬ",
    perfectBonus: "+200 XP",
    lvUpTitle: "УРОВЕНЬ ПОВЫШЕН",
    rankUpTitle: "РАНГ ПОВЫШЕН",
    rankUpText: "Получен ранг",
    levelNew: "Новый уровень",
    toNext: "до ранга",
    exportOk: "Данные экспортированы",
    importOk: "Данные импортированы",
    importFail: "Ошибка импорта",
    newBest: "Новый рекорд серии",
    confirmReset: "Сбросить весь прогресс? Это необратимо.",
    awak: "ПРОСНУТЬСЯ",
    awakTitle: "Система пробуждена",
    hunterPh: "Введите имя...",
    contTitle: "Продолжить как",
    continueBtn: "Продолжить",
    homeHint: "Каждый день — шанс стать сильнее.",
    beginnerTitle: "Система пробуждена",
    headerLv: "Уровень",
    expShort: "EXP",
    streakChip: "серия",
    aRank: "ранг",
    wireless: "Путь охотника",
    names: { E: "E-ранг", D: "D-ранг", C: "C-ранг", B: "B-ранг", A: "A-ранг", S: "S-ранг", SS: "Monarch" },
  },
  en: {
    tabQuests: "Quests", tabRank: "Rank", tabAch: "Rewards", tabSet: "Settings",
    questXp: "XP",
    today: "Today:",
    qsLabel: "DAILY QUEST",
    addQuest: "+ New quest",
    noQuests: "No quests yet. Add your first one.",
    finish: "Complete",
    questDone: "Quest completed",
    perfectDay: "PERFECT DAY",
    perfectBonus: "+200 XP",
    lvUpTitle: "LEVEL UP",
    rankUpTitle: "RANK UP",
    rankUpText: "Rank obtained",
    levelNew: "New level",
    toNext: "to rank",
    exportOk: "Data exported",
    importOk: "Data imported",
    importFail: "Import failed",
    newBest: "New best streak",
    confirmReset: "Reset all progress? This can't be undone.",
    awak: "AWAKEN",
    contTitle: "Continue as",
    continueBtn: "Continue",
    homeHint: "Every day is a chance to get stronger.",
    hudLevel: "Level",
    expShort: "EXP",
    streakChip: "streak",
    ranksidual: "Hunter's Path",
    names: { "E": "E-Rank", "D": "D-Rank", "C": "C-Rank", "B": "B-Rank", "A": "A-Rank", "S": "S-Rank", "SS": "Monarch" },
  }
};

function t(key) {
  const lang = (typeof S !== "undefined" && S && S.lang) || "ru";
  const dict = I18N[lang] || I18N.ru;
  const val = dict && dict[key];
  if (val === undefined) return I18N.ru[key] || key;
  return val;
}