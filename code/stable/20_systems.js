function getAvailableHeroes() {
      if (typeof HERO_DEFINITIONS === "undefined" || !Array.isArray(HERO_DEFINITIONS)) return [];
      return HERO_DEFINITIONS;
    }

    function getHeroAt(index) {
      const heroes = getAvailableHeroes();
      if (!heroes.length) return null;
      const i = ((index % heroes.length) + heroes.length) % heroes.length;
      return heroes[i];
    }

    function getPortraitIdsForHero(hero) {
      if (typeof getHeroPortraitIds === "function") {
        const ids = getHeroPortraitIds(hero);
        if (Array.isArray(ids) && ids.length) return ids;
      }
      if (!hero || !hero.attributes) return ["portrait_a", "portrait_b"];
      return [
        hero.attributes.portrait_id_a || `${hero.id || "hero"}_portrait_a`,
        hero.attributes.portrait_id_b || `${hero.id || "hero"}_portrait_b`,
      ];
    }

    function getPortraitSourcesForHero(hero) {
      const ids = getPortraitIdsForHero(hero);
      const idBased = ids.map((id) => heroPortraitAssetMap[id]).filter((src) => typeof src === "string" && src.length > 0);
      if (idBased.length >= 2) return [idBased[0], idBased[1]];
      if (idBased.length === 1) return [idBased[0], idBased[0]];

      if (typeof getHeroPortraitSources === "function") {
        const sources = getHeroPortraitSources(hero);
        if (Array.isArray(sources) && sources.length >= 2) return [sources[0], sources[1]];
        if (Array.isArray(sources) && sources.length === 1) return [sources[0], sources[0]];
      }

      if (!hero || !hero.attributes) return ["", ""];
      const a = hero.attributes.portrait_file_a || "";
      const b = hero.attributes.portrait_file_b || "";
      if (a && b) return [a, b];
      if (a) return [a, a];
      if (b) return [b, b];
      return ["", ""];
    }

    let heroPortraitAssetMap = {};

    function applyHeroJsonConfigToHeroes(config) {
      if (!config || typeof config !== "object") return;

      if (config.portraitAssets && typeof config.portraitAssets === "object") {
        heroPortraitAssetMap = { ...config.portraitAssets };
      }

      if (!config.heroes || typeof config.heroes !== "object") return;
      if (typeof HERO_DEFINITIONS === "undefined" || !Array.isArray(HERO_DEFINITIONS)) return;

      for (let i = 0; i < HERO_DEFINITIONS.length; i += 1) {
        const hero = HERO_DEFINITIONS[i];
        const fromJson = config.heroes[hero.id];
        if (!fromJson || typeof fromJson !== "object") continue;

        if (typeof fromJson.name === "string" && fromJson.name.length > 0) {
          hero.name = fromJson.name;
        }

        if (fromJson.attributes && typeof fromJson.attributes === "object") {
          hero.attributes = {
            ...(hero.attributes || {}),
            ...fromJson.attributes,
          };
        }
      }
    }

    async function loadHeroJsonConfig() {
      try {
        const res = await fetch("code/config/heroes.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        applyHeroJsonConfigToHeroes(data);
      } catch (err) {
        // file:// 环境可能无法 fetch，本地回退到 05_heroes.js 内置配置。
      }
    }

    function applyCombatJsonConfig(config) {
      if (!config || typeof config !== "object") return;
      const combat = (config.combat && typeof config.combat === "object") ? config.combat : config;

      const duration = Number(combat.goblinKnockbackDurationMs ?? combat.goblin_knockback_duration_ms);
      if (Number.isFinite(duration) && duration > 0) {
        COMBAT_TUNING.goblinKnockbackDurationMs = Math.max(1, Math.floor(duration));
      }

      const distance = Number(combat.goblinKnockbackDistancePx ?? combat.goblin_knockback_distance_px);
      if (Number.isFinite(distance) && distance >= 0) {
        COMBAT_TUNING.goblinKnockbackDistancePx = Math.max(0, Math.floor(distance));
      }
    }

    async function loadCombatJsonConfig() {
      try {
        const res = await fetch("code/config/game_constants.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        applyCombatJsonConfig(data);
      } catch (err) {
        // file:// 环境可能无法 fetch，本地回退到 00_core.js 默认常量。
      }
    }

    function applyCurrentHeroAttributesToState(resetHealth) {
      const attrs = typeof getCurrentHeroAttributes === "function" ? getCurrentHeroAttributes() : null;
      if (!attrs) return;

      const moveSpeed = Number(attrs.move_speed);
      if (Number.isFinite(moveSpeed) && moveSpeed > 0) state.player.speed = moveSpeed;

      const hp = Number(attrs.hp);
      if (Number.isFinite(hp) && hp > 0) {
        state.player.maxHp = Math.floor(hp);
        if (resetHealth || !Number.isFinite(state.player.hp)) state.player.hp = state.player.maxHp;
        if (state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp;
      }

      const shotInterval = Number(attrs.shot_interval_ms);
      if (Number.isFinite(shotInterval) && shotInterval >= 0) state.weapon.fireCooldown = shotInterval;

      const bulletSpeed = Number(attrs.bullet_speed);
      if (Number.isFinite(bulletSpeed) && bulletSpeed > 0) state.weapon.bulletSpeed = bulletSpeed;

      const bulletCount = Number(attrs.bullet_count);
      if (Number.isFinite(bulletCount) && bulletCount > 0) state.weapon.bulletCount = Math.max(1, Math.floor(bulletCount));

      const spread = Number(attrs.bullet_spread_deg);
      if (Number.isFinite(spread) && spread >= 0) state.weapon.bulletSpreadDeg = spread;

      const attack = Number(attrs.attack);
      if (Number.isFinite(attack) && attack > 0) state.weapon.bulletDamage = Math.max(1, Math.floor(attack));
    }

    const heroSelectState = {
      selectedIndex: 0,
      portraitIndex: 0,
      portraitIndexByHero: {},
      dragStartX: 0,
      dragPointerId: null,
    };

    let heroSelectRefs = null;

    function ensureHeroSelectUI() {
      if (heroSelectRefs) return heroSelectRefs;

      if (!document.getElementById("heroSelectStyle")) {
        const style = document.createElement("style");
        style.id = "heroSelectStyle";
        style.textContent = `
#heroSelectOverlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background:
    radial-gradient(circle at 12% 18%, rgba(58, 85, 125, 0.42), transparent 32%),
    radial-gradient(circle at 85% 75%, rgba(116, 62, 94, 0.35), transparent 36%),
    linear-gradient(165deg, rgba(9, 15, 28, 0.96), rgba(19, 27, 43, 0.95));
  display: grid;
  place-items: center;
  padding: 24px;
}

#heroSelectOverlay.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.hero-select-shell {
  width: min(1160px, 100%);
  min-height: min(652px, 88vh);
  border: 1px solid #2f3f57;
  border-radius: 14px;
  background: linear-gradient(170deg, #1a2234 0%, #141d2f 55%, #12172a 100%);
  box-shadow: 0 28px 62px rgba(0, 0, 0, 0.48);
  display: grid;
  grid-template-columns: 320px 1fr;
  overflow: hidden;
}

.hero-select-left {
  padding: 20px 20px 16px;
  border-right: 1px solid rgba(102, 128, 166, 0.22);
  background: linear-gradient(165deg, #202b43 0%, #1a2439 100%);
}

.hero-select-left h2 {
  margin: 0;
  color: #ff6d84;
  font-size: 24px;
  letter-spacing: 1px;
}

.hero-select-left p {
  margin: 6px 0 12px;
  color: #9fb1cf;
  font-size: 13px;
}

.hero-select-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.hero-card {
  border: 1px solid rgba(97, 121, 156, 0.45);
  background: rgba(15, 22, 38, 0.86);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  text-align: center;
  color: #d6deef;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}

.hero-card:hover {
  transform: translateY(-1px);
  border-color: #96b9ea;
  background: rgba(26, 36, 59, 0.9);
}

.hero-card.active {
  border-color: #f5d5a0;
  box-shadow: 0 0 0 1px rgba(245, 213, 160, 0.2) inset;
}

.hero-card canvas {
  position: static;
  inset: auto;
  display: block;
  width: 56px;
  height: 56px;
  image-rendering: pixelated;
  margin: 0 auto 2px;
  border: none;
  border-radius: 0;
  background: transparent;
}

.hero-card-name {
  display: block;
  font-weight: 700;
  font-size: 12px;
  color: #ffe0aa;
  margin-top: 2px;
}

.hero-select-right {
  padding: 20px;
  display: grid;
  grid-template-rows: auto auto auto auto auto 1fr;
  align-content: start;
  gap: 6px;
  background: linear-gradient(160deg, #191f33 0%, #151a2d 100%);
}

.hero-portrait-frame {
  border: 1px solid rgba(101, 120, 152, 0.56);
  border-radius: 12px;
  background: #10182a;
  padding: 8px;
  position: relative;
}

.hero-portrait-inner {
  display: grid;
  grid-template-columns: 28px 1fr 28px;
  align-items: center;
  gap: 6px;
}

.hero-portrait-nav {
  height: 100%;
  border: 1px solid rgba(106, 124, 156, 0.55);
  border-radius: 8px;
  background: rgba(18, 28, 45, 0.95);
  color: #d7e1f7;
  font-size: 12px;
  cursor: pointer;
}

.hero-portrait-nav:hover {
  border-color: #f6d9a8;
  color: #f6d9a8;
}

#heroPortraitCanvas {
  position: static;
  inset: auto;
  display: block;
  width: 100%;
  aspect-ratio: 800 / 500;
  image-rendering: auto;
  border: 1px solid rgba(83, 103, 136, 0.55);
  border-radius: 8px;
  background: #0f1626;
  cursor: grab;
}

#heroPortraitCanvas:active { cursor: grabbing; }

.hero-portrait-id {
  margin-top: 8px;
  color: #8fa4c7;
  font-size: 11px;
  text-align: center;
}

.hero-select-name {
  font-size: 22px;
  color: #ff6d84;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.hero-select-meta {
  font-size: 13px;
  color: #c7d5ec;
  line-height: 1.55;
}

.hero-select-passive {
  font-size: 12px;
  color: #a8bbda;
  line-height: 1.5;
  min-height: 38px;
}

.hero-select-tip {
  font-size: 11px;
  color: #8ba1c6;
}

.hero-start-btn {
  margin-top: 6px;
  width: 180px;
  height: 36px;
  border: 1px solid rgba(111, 140, 178, 0.75);
  border-radius: 8px;
  background: linear-gradient(180deg, #223658, #192840);
  color: #ffe2ad;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.hero-start-btn:hover {
  border-color: #f5d7a7;
  box-shadow: 0 0 0 1px rgba(245, 215, 167, 0.22) inset;
}

@media (max-width: 980px) {
  .hero-select-shell {
    grid-template-columns: 1fr;
    max-height: 96vh;
    overflow-y: auto;
  }

  .hero-select-left {
    border-right: none;
    border-bottom: 1px solid rgba(102, 128, 166, 0.22);
  }

  .hero-select-cards {
    grid-template-columns: 1fr;
  }

  .hero-start-btn {
    width: 100%;
  }
}
`;
        document.head.appendChild(style);
      }

      let overlay = document.getElementById("heroSelectOverlay");
      if (!overlay) {
        overlay = document.createElement("section");
        overlay.id = "heroSelectOverlay";
        overlay.innerHTML = `
<div class="hero-select-shell">
  <div class="hero-select-left">
    <h2>选择角色</h2>
    <p>左侧是游戏内像素形象。点击角色后直接进入游戏。</p>
    <div id="heroSelectCards" class="hero-select-cards"></div>
  </div>
  <div class="hero-select-right">
    <div class="hero-portrait-frame" id="heroPortraitFrame">
      <div class="hero-portrait-inner">
        <button type="button" class="hero-portrait-nav" id="heroPortraitPrev">◀</button>
        <canvas id="heroPortraitCanvas" width="800" height="500"></canvas>
        <button type="button" class="hero-portrait-nav" id="heroPortraitNext">▶</button>
      </div>
      <div id="heroPortraitId" class="hero-portrait-id">-</div>
    </div>
    <div id="heroSelectName" class="hero-select-name">-</div>
    <div id="heroSelectMeta" class="hero-select-meta">-</div>
    <div id="heroSelectPassive" class="hero-select-passive">-</div>
    <div class="hero-select-tip">在右侧头像区域按住鼠标左右滑动，可查看该角色的不同大头像。</div>
    <button type="button" id="heroStartBtn" class="hero-start-btn">进入游戏</button>
  </div>
</div>`;
        document.body.appendChild(overlay);
      }

      heroSelectRefs = {
        overlay,
        cards: document.getElementById("heroSelectCards"),
        portraitCanvas: document.getElementById("heroPortraitCanvas"),
        portraitId: document.getElementById("heroPortraitId"),
        name: document.getElementById("heroSelectName"),
        meta: document.getElementById("heroSelectMeta"),
        passive: document.getElementById("heroSelectPassive"),
        prevBtn: document.getElementById("heroPortraitPrev"),
        nextBtn: document.getElementById("heroPortraitNext"),
        startBtn: document.getElementById("heroStartBtn"),
      };

      return heroSelectRefs;
    }

    function drawHeroCardSprite(canvas, hero) {
      const ctx = canvas.getContext("2d");
      if (!ctx || !hero) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = 3;
      const ox = Math.floor(canvas.width * 0.5);
      const oy = Math.floor(canvas.height * 0.72);
      const shadow = hero.shadow || [-4, 1, 8, 2];

      ctx.fillStyle = "rgba(16, 23, 34, 0.75)";
      ctx.fillRect(ox + shadow[0] * scale, oy + shadow[1] * scale, shadow[2] * scale, shadow[3] * scale);

      const rects = Array.isArray(hero.rects) ? hero.rects : [];
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        const c = (hero.palette && hero.palette[r[4]]) || "#ffffff";
        ctx.fillStyle = c;
        ctx.fillRect(ox + r[0] * scale, oy + r[1] * scale, r[2] * scale, r[3] * scale);
      }
    }

    function stringHash(v) {
      const str = String(v || "");
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    const portraitImageCache = {};

    
    function drawPortraitPlaceholder(canvas, text) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f1626";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#8fa4c7";
      ctx.font = "14px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text || "未配置头像", Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.5));
    }
    function drawGeneratedPortrait(canvas, hero, portraitId) {
      const ctx = canvas.getContext("2d");
      if (!ctx || !hero) return;
      ctx.imageSmoothingEnabled = false;

      const pw = 96;
      const ph = 96;
      const off = document.createElement("canvas");
      off.width = pw;
      off.height = ph;
      const pctx = off.getContext("2d");
      pctx.imageSmoothingEnabled = false;

      const h = stringHash(`${hero.id || "hero"}-${portraitId || "portrait"}`);
      const variant = h % 3;
      const hairShift = variant === 0 ? 0 : variant === 1 ? -2 : 2;
      const eyeShift = ((h >> 3) % 2) === 0 ? 0 : 1;

      const bodyColor = (hero.palette && hero.palette.body) || "#4a5c85";
      const capeColor = (hero.palette && hero.palette.cape) || "#b34b56";
      const skinColor = (hero.palette && hero.palette.skin) || "#dfb78f";
      const hairColor = (hero.palette && hero.palette.hair) || "#2f2520";
      const eyeColor = (hero.palette && hero.palette.eye) || "#f5f1e3";
      const bgA = mixHex(bodyColor, "#1a2234", 0.55);
      const bgB = mixHex(capeColor, "#0f1627", 0.55);

      pctx.fillStyle = bgA;
      pctx.fillRect(0, 0, pw, ph);

      pctx.fillStyle = bgB;
      for (let y = 0; y < ph; y += 6) {
        pctx.fillRect((y / 2 + (h % 7)) % 9, y, pw, 3);
      }

      pctx.fillStyle = "rgba(8, 12, 22, 0.44)";
      pctx.fillRect(0, 64, pw, 32);

      pctx.fillStyle = bodyColor;
      pctx.fillRect(32, 58, 28, 26);
      pctx.fillRect(26, 64, 40, 24);

      pctx.fillStyle = capeColor;
      pctx.fillRect(20, 66, 26, 20);
      pctx.fillRect(45, 68, 27, 18);
      pctx.fillRect(18, 82, 58, 8);

      pctx.fillStyle = skinColor;
      pctx.fillRect(39, 44, 14, 16);
      pctx.fillRect(32, 24, 28, 24);

      pctx.fillStyle = hairColor;
      pctx.fillRect(28 + hairShift, 18, 36, 10);
      pctx.fillRect(26 + hairShift, 24, 10, 22);
      pctx.fillRect(58 + hairShift, 24, 8, 20);
      if (variant === 2) pctx.fillRect(42 + hairShift, 28, 10, 16);

      pctx.fillStyle = eyeColor;
      pctx.fillRect(39 + eyeShift, 34, 3, 2);
      pctx.fillRect(49 + eyeShift, 34, 3, 2);

      pctx.fillStyle = "#1a2233";
      pctx.fillRect(40 + eyeShift, 40, 10, 2);

      drawPortraitImageToCanvas(canvas, off);
    }

    function drawPortraitImageToCanvas(canvas, img) {
      const ctx = canvas.getContext("2d");
      if (!ctx || !img) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;

      const scale = Math.min(cw / iw, ch / ih);
      const dw = Math.max(1, Math.floor(iw * scale));
      const dh = Math.max(1, Math.floor(ih * scale));
      const dx = Math.floor((cw - dw) * 0.5);
      const dy = Math.floor((ch - dh) * 0.5);

      ctx.fillStyle = "#0f1626";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function drawHeroPortrait(canvas, hero, portraitId, portraitSrc) {
      if (!canvas || !hero) return;
      const src = String(portraitSrc || "").trim();
      const token = `${hero.id || "hero"}|${portraitId || "portrait"}|${src}`;
      canvas.dataset.portraitToken = token;

      if (!src) {
        drawPortraitPlaceholder(canvas, "未配置头像");
        return;
      }

      const safeSrc = encodeURI(src);
      let img = portraitImageCache[safeSrc];
      if (!img) {
        img = new Image();
        portraitImageCache[safeSrc] = img;
      }

      const drawIfCurrent = () => {
        if (canvas.dataset.portraitToken !== token) return;
        if (img.complete && img.naturalWidth > 0) {
          drawPortraitImageToCanvas(canvas, img);
        } else {
          drawPortraitPlaceholder(canvas, "头像加载失败");
        }
      };

      img.onload = drawIfCurrent;
      img.onerror = () => {
        if (canvas.dataset.portraitToken !== token) return;
        drawPortraitPlaceholder(canvas, "头像加载失败");
      };

      if (img.src !== safeSrc) {
        img.src = safeSrc;
      }

      if (img.complete && img.naturalWidth > 0) {
        drawPortraitImageToCanvas(canvas, img);
      } else {
        drawPortraitPlaceholder(canvas, "头像加载失败");
      }
    }

    function refreshHeroCardActiveState() {
      if (!heroSelectRefs || !heroSelectRefs.cards) return;
      const cards = heroSelectRefs.cards.querySelectorAll(".hero-card");
      cards.forEach((card) => {
        const idx = Number(card.dataset.heroIndex || "0");
        card.classList.toggle("active", idx === heroSelectState.selectedIndex);
      });
    }

    function updateHeroSelectDetail() {
      if (!heroSelectRefs) return;
      const hero = getHeroAt(heroSelectState.selectedIndex);
      if (!hero) return;
      const attrs = hero.attributes || {};
      const portraitIds = getPortraitIdsForHero(hero);
      const portraitSources = getPortraitSourcesForHero(hero);

      const count = Math.max(portraitIds.length || 1, portraitSources.length || 1);
      heroSelectState.portraitIndex = ((heroSelectState.portraitIndex % count) + count) % count;
      heroSelectState.portraitIndexByHero[heroSelectState.selectedIndex] = heroSelectState.portraitIndex;

      const portraitId = portraitIds[heroSelectState.portraitIndex] || portraitIds[0] || "portrait_a";
      const portraitSrc = portraitSources[heroSelectState.portraitIndex] || portraitSources[0] || "";

      heroSelectRefs.name.textContent = hero.name || hero.id || "未命名主角";
      heroSelectRefs.meta.innerHTML = [
        `攻击: <b>${attrs.attack ?? "-"}</b>`,
        `射击间隔: <b>${attrs.shot_interval_ms ?? "-"}ms</b>`,
        `弹道速度: <b>${attrs.bullet_speed ?? "-"}</b>`,
        `子弹数量: <b>${attrs.bullet_count ?? "-"}</b>`,
        `散射角: <b>${attrs.bullet_spread_deg ?? "-"}deg</b>`,
        `移动速度: <b>${attrs.move_speed ?? "-"}</b>`,
        `生命: <b>${attrs.hp ?? "-"}</b>`,
      ].join("<br>");

      const passives = Array.isArray(attrs.passives) ? attrs.passives : [];
      heroSelectRefs.passive.textContent = passives.length
        ? `被动: ${passives.map((p) => p.desc || p.id).join(" / ")}`
        : "被动: -";

      const fileText = portraitSrc ? portraitSrc : "未配置图片";
      heroSelectRefs.portraitId.textContent = `头像ID: ${portraitId} | 文件: ${fileText} (${heroSelectState.portraitIndex + 1}/${count})`;

      drawHeroPortrait(heroSelectRefs.portraitCanvas, hero, portraitId, portraitSrc);
      refreshHeroCardActiveState();
    }

    function previewHeroSelectIndex(index) {
      const heroes = getAvailableHeroes();
      if (!heroes.length) return;
      const normalized = ((index % heroes.length) + heroes.length) % heroes.length;
      heroSelectState.selectedIndex = normalized;
      const remembered = heroSelectState.portraitIndexByHero[normalized];
      heroSelectState.portraitIndex = Number.isFinite(remembered) ? remembered : 0;
      if (typeof setCurrentHeroIndex === "function") setCurrentHeroIndex(normalized);
      applyCurrentHeroAttributesToState(false);
      updateHeroSelectDetail();
    }

    function shiftHeroPortrait(step) {
      const hero = getHeroAt(heroSelectState.selectedIndex);
      if (!hero) return;

      const count = Math.max(getPortraitIdsForHero(hero).length || 1, getPortraitSourcesForHero(hero).length || 1);
      if (count <= 1) return;

      heroSelectState.portraitIndex =
        ((heroSelectState.portraitIndex + step) % count + count) % count;
      heroSelectState.portraitIndexByHero[heroSelectState.selectedIndex] = heroSelectState.portraitIndex;
      updateHeroSelectDetail();
    }

    function startGameWithHero(index) {
      const heroes = getAvailableHeroes();
      if (!heroes.length) {
        state.gameStarted = true;
        return;
      }

      const normalized = ((index % heroes.length) + heroes.length) % heroes.length;
      if (typeof setCurrentHeroIndex === "function") setCurrentHeroIndex(normalized);
      heroSelectState.selectedIndex = normalized;
      applyCurrentHeroAttributesToState(true);

      state.weapon.isReloading = false;
      state.weapon.ammo = state.weapon.magazineSize;
      state.weapon.lastFireAt = performance.now() - state.weapon.fireCooldown;
      state.weapon.lastShotAt = performance.now();

      state.gameStarted = true;
      Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });
      if (heroSelectRefs && heroSelectRefs.overlay) heroSelectRefs.overlay.classList.add("hidden");
      ensureAudioContext();
    }

    function initHeroSelectOverlay() {
      const heroes = getAvailableHeroes();
      if (!heroes.length) {
        state.gameStarted = true;
        return;
      }

      const refs = ensureHeroSelectUI();
      if (!refs || !refs.cards) {
        state.gameStarted = true;
        return;
      }

      refs.cards.innerHTML = "";
      heroes.forEach((hero, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "hero-card";
        card.dataset.heroIndex = String(index);

        const icon = document.createElement("canvas");
        icon.width = 72;
        icon.height = 72;
        drawHeroCardSprite(icon, hero);

        const textWrap = document.createElement("div");
        const name = document.createElement("span");
        name.className = "hero-card-name";
        name.textContent = hero.name || hero.id || `Hero-${index + 1}`;
        textWrap.appendChild(name);

        card.appendChild(icon);
        card.appendChild(textWrap);

        card.addEventListener("mouseenter", () => previewHeroSelectIndex(index));
        card.addEventListener("focus", () => previewHeroSelectIndex(index));
        card.addEventListener("click", () => startGameWithHero(index));

        refs.cards.appendChild(card);
      });

      refs.prevBtn.addEventListener("click", () => shiftHeroPortrait(-1));
      refs.nextBtn.addEventListener("click", () => shiftHeroPortrait(1));

      refs.startBtn.addEventListener("click", () => startGameWithHero(heroSelectState.selectedIndex));

      refs.portraitCanvas.addEventListener("pointerdown", (e) => {
        heroSelectState.dragStartX = e.clientX;
        heroSelectState.dragPointerId = e.pointerId;
        refs.portraitCanvas.setPointerCapture(e.pointerId);
      });

      refs.portraitCanvas.addEventListener("pointerup", (e) => {
        if (heroSelectState.dragPointerId !== e.pointerId) return;
        const dx = e.clientX - heroSelectState.dragStartX;
        if (Math.abs(dx) >= 24) shiftHeroPortrait(dx < 0 ? 1 : -1);
        heroSelectState.dragPointerId = null;
      });

      refs.portraitCanvas.addEventListener("pointercancel", () => {
        heroSelectState.dragPointerId = null;
      });

      refs.overlay.classList.remove("hidden");
      heroSelectState.selectedIndex = state.player.heroIndex || 0;
      heroSelectState.portraitIndex = 0;
      previewHeroSelectIndex(heroSelectState.selectedIndex);
    }

    
    function getKnockbackDurationMs() {
      return Math.max(1, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDurationMs) || 320);
    }

    function getKnockbackDistancePx() {
      return Math.max(0, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDistancePx) || 100);
    }

    function startGoblinKnockback(goblin, now, distancePx, durationMs) {
      if (!goblin || !goblin.alive) return;

      let dx = wrapDelta(goblin.x - state.player.x, WORLD_W);
      let dy = wrapDelta(goblin.y - state.player.y, WORLD_H);
      let dist = Math.hypot(dx, dy);

      if (dist < 0.001) {
        const angle = ((goblin.id * 47) % 360) * (Math.PI / 180);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 1;
      }

      goblin.knockback = {
        fromX: goblin.x,
        fromY: goblin.y,
        dirX: dx / dist,
        dirY: dy / dist,
        startAt: now,
        durationMs,
        distancePx,
      };
    }

    function updateGoblinKnockback(goblin, now) {
      const kb = goblin && goblin.knockback;
      if (!kb) return false;

      const duration = Math.max(1, Number(kb.durationMs) || 1);
      const t = Math.max(0, Math.min(1, (now - kb.startAt) / duration));
      const eased = 1 - (1 - t) * (1 - t);

      goblin.x = wrap(kb.fromX + kb.dirX * kb.distancePx * eased, WORLD_W);
      goblin.y = wrap(kb.fromY + kb.dirY * kb.distancePx * eased, WORLD_H);

      if (t >= 1) {
        goblin.knockback = null;
        return false;
      }

      return true;
    }

    function triggerPlayerShockwave(now) {
      const distancePx = getKnockbackDistancePx();
      const durationMs = getKnockbackDurationMs();
      state.player.shockwaveUntil = now + durationMs;

      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) continue;
        startGoblinKnockback(g, now, distancePx, durationMs);
      }
    }
    function updatePlayer(dt) {
      let mx = 0;
      let my = 0;
      if (state.keys.KeyW) my -= 1;
      if (state.keys.KeyS) my += 1;
      if (state.keys.KeyA) mx -= 1;
      if (state.keys.KeyD) mx += 1;
      if (mx === 0 && my === 0) return;

      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;

      const tryX = wrap(state.player.x + mx * state.player.speed * dt, WORLD_W);
      if (!collidesWithAnyTree(tryX, state.player.y)) state.player.x = tryX;

      const tryY = wrap(state.player.y + my * state.player.speed * dt, WORLD_H);
      if (!collidesWithAnyTree(state.player.x, tryY)) state.player.y = tryY;
    }

    function respawnGoblin(goblin, now) {
      const fresh = createGoblin(now);
      goblin.x = fresh.x;
      goblin.y = fresh.y;
      goblin.hp = goblin.maxHp;
      goblin.alive = true;
      goblin.cooldownUntil = fresh.cooldownUntil;
      goblin.hitFlashUntil = 0;
      goblin.knockback = null;
    }

    function killGoblin(goblin, now) {
      goblin.alive = false;
      goblin.knockback = null;
      goblin.respawnAt = now + 1400 + Math.floor(rand() * 400);
      state.orbs.push({ x: goblin.x, y: goblin.y, seed: rand() * Math.PI * 2 });
    }

    function updateGoblins(dt, now) {
      state.inContact = false;
      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) {
          if (now >= g.respawnAt) respawnGoblin(g, now);
          continue;
        }

        const inKnockback = updateGoblinKnockback(g, now);
        if (inKnockback) continue;

        const dx = wrapDelta(state.player.x - g.x, WORLD_W);
        const dy = wrapDelta(state.player.y - g.y, WORLD_H);
        const dist = Math.hypot(dx, dy);
        const speed = 56;

        if (dist > 0.001) {
          g.x = wrap(g.x + (dx / dist) * speed * dt, WORLD_W);
          g.y = wrap(g.y + (dy / dist) * speed * dt, WORLD_H);
        }

        const hitPlayer = aabbOverlap(
          state.player.x,
          state.player.y,
          PLAYER_COLLIDER_SIZE,
          g.x,
          g.y,
          GOBLIN_COLLIDER_SIZE,
          WORLD_W,
          WORLD_H
        );

        if (hitPlayer) {
          state.inContact = true;
          if (now >= g.cooldownUntil) {
            const damage = Math.floor(rand() * 5) + 3;
            state.lastDamage = damage;
            state.player.lastHitAt = now;
            state.player.hp = Math.max(0, (state.player.hp || 0) - damage);
            g.cooldownUntil = now + 900;
            pushFloatingDamage(state.player.x, state.player.y - 8, damage);
            triggerPlayerShockwave(now);
          }
        }
      }
    }
    const GOBLIN_PIXEL_RECTS = [
      [-3, 0, 6, 3],
      [-2, -2, 4, 2],
      [-1, -3, 2, 1],
      [-2, 1, 1, 1],
      [1, 1, 1, 1],
      [-2, 2, 1, 1],
      [1, 2, 1, 1],
      [-3, 3, 6, 4],
      [-4, 4, 1, 2],
      [3, 4, 1, 2],
      [-1, 6, 2, 1],
      [-3, 7, 2, 2],
      [1, 7, 2, 2],
    ];

    function pointHitsGoblinPixels(pxWorld, pyWorld, goblin, now) {
      const lean = Math.sin(now * 0.015) * 0.16;
      const dx = wrapDelta(pxWorld - goblin.x, WORLD_W);
      const dy = wrapDelta(pyWorld - goblin.y, WORLD_H);

      const tx = dx;
      const ty = dy + 10;

      const cosA = Math.cos(lean);
      const sinA = Math.sin(lean);

      const lx = tx * cosA + ty * sinA;
      const ly = -tx * sinA + ty * cosA;

      for (let i = 0; i < GOBLIN_PIXEL_RECTS.length; i += 1) {
        const rect = GOBLIN_PIXEL_RECTS[i];
        const rx = rect[0];
        const ry = rect[1];
        const rw = rect[2];
        const rh = rect[3];

        if (lx >= rx && lx < rx + rw && ly >= ry && ly < ry + rh) {
          return true;
        }
      }

      return false;
    }

    function bulletHitsGoblinSprite(bullet, goblin, now) {
      const samples = [
        [0, 0],
        [-0.6, 0],
        [0.6, 0],
        [0, -0.6],
        [0, 0.6],
      ];

      for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i];
        if (pointHitsGoblinPixels(bullet.x + s[0], bullet.y + s[1], goblin, now)) {
          return true;
        }
      }

      return false;
    }

    function updateBullets(dt, now) {
      const next = [];
      for (let i = 0; i < state.bullets.length; i += 1) {
        const bullet = state.bullets[i];
        bullet.x = wrap(bullet.x + bullet.vx * dt, WORLD_W);
        bullet.y = wrap(bullet.y + bullet.vy * dt, WORLD_H);

        if (now - bullet.born > 1200) continue;

        let consumed = false;
        for (let j = 0; j < state.goblins.length; j += 1) {
          const g = state.goblins[j];
          if (!g.alive) continue;

          const hitGoblin = bulletHitsGoblinSprite(bullet, g, now);
          if (!hitGoblin) continue;

          const damage = Math.max(1, Math.floor(Number(bullet.damage) || 5));
          g.hp -= damage;
          g.hitFlashUntil = now + 120;
          pushFloatingDamage(g.x, g.y - 9, damage);
          consumed = true;

          if (g.hp <= 0) killGoblin(g, now);
          break;
        }

        if (!consumed) next.push(bullet);
      }

      state.bullets = next;
    }

    function updateOrbs(dt, now) {
      const next = [];
      for (let i = 0; i < state.orbs.length; i += 1) {
        const orb = state.orbs[i];

        const dx = wrapDelta(state.player.x - orb.x, WORLD_W);
        const dy = wrapDelta(state.player.y - orb.y, WORLD_H);
        const dist = Math.hypot(dx, dy);

        if (dist <= ORB_MAGNET_RADIUS && dist > 0.001) {
          const speed = 190;
          const step = Math.min(dist, speed * dt);
          orb.x = wrap(orb.x + (dx / dist) * step, WORLD_W);
          orb.y = wrap(orb.y + (dy / dist) * step, WORLD_H);
        }

        const dx2 = wrapDelta(state.player.x - orb.x, WORLD_W);
        const dy2 = wrapDelta(state.player.y - orb.y, WORLD_H);
        if (Math.hypot(dx2, dy2) <= 1.2) {
          addExp(1, now);
          continue;
        }

        next.push(orb);
      }

      state.orbs = next;
    }

    function shootAtClientPoint(clientX, clientY) {
      const now = performance.now();
      const w = state.weapon;
      if (w.isReloading || w.ammo <= 0) return;
      if (now - w.lastFireAt < w.fireCooldown) return;

      const rect = viewport.getBoundingClientRect();
      const sx = ((clientX - rect.left) / rect.width) * W;
      const sy = ((clientY - rect.top) / rect.height) * H;
      const dx = sx - CX;
      const dy = sy - CY;
      const len = Math.hypot(dx, dy);
      if (len < 2) return;

      const dirX = dx / len;
      const dirY = dy / len;
      const speed = Number(w.bulletSpeed) > 0 ? Number(w.bulletSpeed) : 260;
      const count = Math.max(1, Math.floor(Number(w.bulletCount) || 1));
      const spreadRad = (Number(w.bulletSpreadDeg) || 0) * (Math.PI / 180);
      const damage = Math.max(1, Math.floor(Number(w.bulletDamage) || 5));

      for (let i = 0; i < count; i += 1) {
        const offset = count === 1
          ? 0
          : ((i - (count - 1) * 0.5) / Math.max(1, count - 1)) * spreadRad;

        const cosO = Math.cos(offset);
        const sinO = Math.sin(offset);
        const shotDirX = dirX * cosO - dirY * sinO;
        const shotDirY = dirX * sinO + dirY * cosO;

        state.bullets.push({
          x: wrap(state.player.x + shotDirX * 6, WORLD_W),
          y: wrap(state.player.y + shotDirY * 6, WORLD_H),
          vx: shotDirX * speed,
          vy: shotDirY * speed,
          damage,
          born: now,
        });
      }

      w.ammo -= 1;
      w.lastShotAt = now;
      w.lastFireAt = now;
      if (w.ammo <= 0) startReload(now);
    }

    function updateWorld(dt, now) {
      updatePlayer(dt);
      updateGoblins(dt, now);
      updateBullets(dt, now);
      updateOrbs(dt, now);
      updateWeapon(now);
    }

    function drawBlurLayers() {
      const blurPx = Number(ui.blurRange.value);
      [tctx, dctx].forEach((ctx) => {
        ctx.clearRect(0, 0, W, H);
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(base, 0, 0);
        ctx.filter = "none";
      });
    }

    function updatePanel(now) {
      ui.coordVal.textContent = `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
      ui.contactVal.textContent = state.inContact ? "碰撞中" : "分离";
      ui.damageVal.textContent = state.lastDamage == null ? "-" : `-${state.lastDamage}`;

      let alive = 0;
      for (let i = 0; i < state.goblins.length; i += 1) if (state.goblins[i].alive) alive += 1;
      ui.goblinCountVal.textContent = `${alive}/${GOBLIN_COUNT}`;

      const ammoText = `${state.weapon.ammo}/${state.weapon.magazineSize}`;
      ui.ammoVal.textContent = ammoText;
      ui.ammoHudVal.textContent = `${state.weapon.ammo}`;
      const maxHp = Math.max(1, Math.floor(state.player.maxHp || 1));
      const curHp = Math.max(0, Math.floor(state.player.hp || 0));
      const heartUnit = 10;
      const totalHearts = Math.max(1, Math.ceil(maxHp / heartUnit));
      const filledHearts = Math.max(0, Math.min(totalHearts, Math.ceil(curHp / heartUnit)));

      if (ui.hpFilled) ui.hpFilled.textContent = "♥".repeat(filledHearts);
      if (ui.hpEmpty) ui.hpEmpty.textContent = "♡".repeat(Math.max(0, totalHearts - filledHearts));
      if (ui.hpVal) ui.hpVal.textContent = `${curHp}/${maxHp}`;
      if (ui.knockbackDurationVal) ui.knockbackDurationVal.textContent = `${Math.round(getKnockbackDurationMs())}`;
      if (ui.knockbackDistanceVal) ui.knockbackDistanceVal.textContent = `${Math.round(getKnockbackDistancePx())}`;


      if (state.weapon.isReloading) {
        const p = Math.max(0, Math.min(1, (now - state.weapon.reloadStart) / state.weapon.reloadDuration));
        ui.reloadVal.textContent = `换弹 ${Math.round(p * 100)}%`;
      } else {
        ui.reloadVal.textContent = "待机";
      }

      const need = expNeededForLevel(state.progress.level);
      const xpCur = state.progress.level >= state.progress.maxLevel ? need : state.progress.xpInLevel;
      const ratio = need > 0 ? Math.max(0, Math.min(1, xpCur / need)) : 1;

      ui.levelHud.textContent = `Lv.${state.progress.level}`;
      ui.expFill.style.width = `${Math.round(ratio * 100)}%`;
      ui.expHudVal.textContent = `${xpCur}/${need}`;
      ui.levelPanelVal.textContent = `Lv.${state.progress.level} ${xpCur}/${need}`;
    }

    function drawScene(now) {
      bctx.clearRect(0, 0, W, H);
      drawGround();
      drawOrbs(now);
      drawActors(now);
      drawShockwave(now);
      drawReloadBar(now);
      drawBullets();
      drawFloatingDamage(now);
      drawVignette();
      drawBlurLayers();
      updatePanel(now);
    }

    function syncUI() {
      const top = Number(ui.topRange.value);
      const bottom = Number(ui.bottomRange.value);
      if (bottom <= top + 6) ui.bottomRange.value = top + 6;

      document.documentElement.style.setProperty("--focus-top", `${ui.topRange.value}%`);
      document.documentElement.style.setProperty("--focus-bottom", `${ui.bottomRange.value}%`);
      ui.blurVal.textContent = `${Number(ui.blurRange.value).toFixed(1)}px`;
      ui.topVal.textContent = `${ui.topRange.value}%`;
      ui.bottomVal.textContent = `${ui.bottomRange.value}%`;
    }

    [ui.blurRange, ui.topRange, ui.bottomRange].forEach((input) => {
      input.addEventListener("input", syncUI);
    });

    window.addEventListener("keydown", (e) => {
      if (/^Digit[1-6]$/.test(e.code) && typeof setCurrentHeroIndex === "function") {
        const idx = Number(e.code.replace("Digit", "")) - 1;
        if (!state.gameStarted) previewHeroSelectIndex(idx);
        else {
          setCurrentHeroIndex(idx);
          applyCurrentHeroAttributesToState(false);
        }
        e.preventDefault();
        return;
      }

      if (e.code in state.keys) {
        if (!state.gameStarted) return;
        state.keys[e.code] = true;
        ensureAudioContext();
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code in state.keys) {
        state.keys[e.code] = false;
        e.preventDefault();
      }
    });

    window.addEventListener("blur", () => {
      Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });
    });

    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!state.gameStarted) return;
      ensureAudioContext();
      shootAtClientPoint(e.clientX, e.clientY);
      e.preventDefault();
    });

    let last = performance.now();
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (state.gameStarted) updateWorld(dt, now);
      drawScene(now);
      requestAnimationFrame(loop);
    }

    async function bootstrapGame() {
      syncUI();
      state.trees = generateTrees();
      initGoblins(performance.now());
      applyCurrentHeroAttributesToState(true);
      await loadHeroJsonConfig();
      await loadCombatJsonConfig();
      applyCurrentHeroAttributesToState(true);
      initHeroSelectOverlay();
      last = performance.now();
      requestAnimationFrame(loop);
    }

    bootstrapGame();





















