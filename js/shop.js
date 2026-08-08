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

function applySkin() {
  const s = skinById(activeSkin()) || SHOP_SKINS[0];
  if (!s) return;
  document.documentElement.style.setProperty("--skin1", s.c1);
  document.documentElement.style.setProperty("--skin2", s.c2);
}
function applyTitle(title) {
  const t = SHOP_TITLES.find(x => x.id === activeTitle()) || SHOP_TITLES[0];
  const el = $("#hunterTitle");
  if (el) el.textContent = t ? t.icon + " " + t.name : "";
}

function buyShopItem(kind, id) {
  const list = kind === "t" ? SHOP_TITLES : SHOP_SKINS;
  const item = list.find(x => x.id === id);
  if (!item) return;
  if (hasItem(id)) return;
  if (S.coins < item.price) {
    toast("🪙 Не хватает монет");
    AudioSys.minus();
    return;
  }
  S.coins -= item.price;
  S.itemsBought = (S.itemsBought || 0) + 1;
  S.shop.inventory.push(id);
  AudioSys.complete();
  toast("🛒 Куплено: " + item.name + (item.icon ? " " + item.icon : ""));
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
        <div class="shop-name">${t.name}</div>
        <div class="shop-desc">${t.desc}</div>
      </div>
      <div class="shop-ctrl">
        ${active ? `<span class="shop-eq">Титул надет</span>`
          : owned ? `<button class="btn-sm" onclick="equipItem('t','${t.id}')">Надеть</button>`
          : `<button class="btn-sm buy" onclick="buyShop('t','${t.id}')">🪙 ${t.price}</button>`}
      </div>
    </div>`;
  }).join("");

  const skinRow = SHOP_SKINS.map(s => {
    const owned = hasItem(s.id);
    const active = activeSkin() === s.id;
    return `<div class="shop-item ${owned ? "owned" : ""} ${active ? "active" : ""}">
      <div class="shop-swatch" style="background:linear-gradient(135deg,${s.c1},${s.c2})"></div>
      <div class="shop-info">
        <div class="shop-name">Тема: ${s.name}</div>
        <div class="shop-desc">Цвет портала</div>
      </div>
      <div class="shop-ctrl">
        ${active ? `<span class="shop-eq">Активна</span>`
          : owned ? `<button class="btn-sm" onclick="equipItem('s','${s.id}')">Применить</button>`
          : `<button class="btn-sm buy" onclick="buyShop('s','${s.id}')">🪙 ${s.price}</button>`}
      </div>
    </div>`;
  }).join("");

  grid.innerHTML = `<div class="shop-sec">ТИТУЛЫ</div>${titleCards}<div class="shop-sec">ТЕМЫ ПОРТАЛА</div>${skinRow}`;
}

function buyShop(kind, id) { buyShopItem(kind, id); }