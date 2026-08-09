/* ============================================================
   shop.js — coins, titles, skins
============================================================ */

/* ---------- coins ---------- */
function addCoins(n) {
  S.coins = (S.coins || 0) + n;
  save();
  checkAchievements();
}

function hasItem(id) { return (S.shop.inventory || []).includes(id); }
function activeSkin() { return S.shop.activeSkin || "s1"; }
function activeTitle() { return S.shop.activeTitle || "t1"; }

function itemName(item) { return item.name[S.lang] || item.name.ru; }
function itemDesc(item) { return item.desc[S.lang] || item.desc.ru; }
function applySkin() {
  const s = skinById(activeSkin()) || SHOP_SKINS[0];
  if (!s) return;
  document.documentElement.style.setProperty("--skin1", s.c1);
  document.documentElement.style.setProperty("--skin2", s.c2);
}
function applyTitle() {
  const t = SHOP_TITLES.find(x => x.id === activeTitle()) || SHOP_TITLES[0];
  const el = $("#hunterTitle");
  if (el) el.textContent = t ? t.icon + " " + itemName(t) : "";
}

function buyShopItem(kind, id) {
  const list = kind === "t" ? SHOP_TITLES : SHOP_SKINS;
  const item = list.find(x => x.id === id);
  if (!item) return;
  if (hasItem(id)) return;
  if (S.coins < item.price) {
    toast("🪙 " + t("notEnough"));
    AudioSys.minus();
    return;
  }
  S.coins -= item.price;
  S.itemsBought = (S.itemsBought || 0) + 1;
  S.shop.inventory.push(id);
  AudioSys.complete();
  toast("🛒 " + t("bought") + ": " + itemName(item) + (item.icon ? " " + item.icon : ""));
  save();
  renderShop();
  checkAchievements();
}

function equipItem(kind, id) {
  if (!hasItem(id)) return;
  if (kind === "t") S.shop.activeTitle = id;
  else S.shop.activeSkin = id;
  AudioSys.click();
  applySkin(); applyTitle();
  save();
  renderShop();
  renderHeader();
}

function renderShop() {
  const grid = $("#shopGrid");
  if (!grid) return;
  const coin = $("#coinBadge");
  if (coin) coin.textContent = S.coins;
  const wal = $("#shopCoins");
  if (wal) wal.textContent = S.coins;
  const wl = $("#shopCoinsLabel");
  if (wl) wl.textContent = t("shopCoins");
  const sk = $("#skillPoints");
  if (sk) sk.textContent = "💡 " + (S.skillPoints || 0);

  const titleCards = SHOP_TITLES.map(t => {
    const owned = hasItem(t.id);
    const active = activeTitle() === t.id;
    return `<div class="shop-item ${owned ? "owned" : ""} ${active ? "active" : ""}">
      <div class="shop-ic">${t.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${itemName(t)}</div>
        <div class="shop-desc">${itemDesc(t)}</div>
      </div>
      <div class="shop-ctrl">
        ${active ? `<span class="shop-eq">${t("titleEquipped")}</span>`
          : owned ? `<button class="btn-sm" onclick="equipItem('t','${t.id}')">${t("equip")}</button>`
          : `<button class="btn-sm buy" onclick="buyShop('t','${t.id}')">🪙 ${t.price}</button>`}
      </div>
    </div>`;
  }).join("");

  const skinRow = SHOP_SKINS.map(s => {
    const owned = hasItem(s.id);
    const active = activeSkin() === s.id;
    return `<div class="shop-item ${owned ? "owned" : ""} ${active ? "active" : ""}">
      <div class="shop-swatch" style="background:linear-gradient(135deg,${s.c1},${s.c2})"></div>
      <div class="shop-name">${t("shopSkins").includes("ТЕМЫ") ? "Тема: " : "Theme: "}${itemName(s)}</div>
        <div class="shop-desc">${t("skinDesc")}</div>
      </div>
      <div class="shop-ctrl">
        ${active ? `<span class="shop-eq">${t("skinActive")}</span>`
          : owned ? `<button class="btn-sm" onclick="equipItem('s','${s.id}')">${t("apply")}</button>`
          : `<button class="btn-sm buy" onclick="buyShop('s','${s.id}')">🪙 ${s.price}</button>`}
      </div>
    </div>`;
  }).join("");

  grid.innerHTML = `<div class="shop-sec">${t("shopTitles")}</div>${titleCards}<div class="shop-sec">${t("shopSkins")}</div>${skinRow}`;
}

function buyShop(kind, id) { buyShopItem(kind, id); }