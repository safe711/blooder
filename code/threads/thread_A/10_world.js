function generateTrees() {
      const trees = [];
      const maxTrees = 320;
      let tries = 0;
      while (trees.length < maxTrees && tries < 16000) {
        tries += 1;
        const x = rand() * WORLD_W;
        const y = rand() * WORLD_H;
        if (hash2(Math.floor(x / 104), Math.floor(y / 104)) < 0.12) continue;
        const spawnDx = wrapDelta(x - state.player.x, WORLD_W);
        const spawnDy = wrapDelta(y - state.player.y, WORLD_H);
        if (Math.hypot(spawnDx, spawnDy) < 85) continue;

        let blocked = false;
        const minDist = 22 + rand() * 10;
        for (let i = 0; i < trees.length; i += 1) {
          const t = trees[i];
          if (Math.hypot(wrapDelta(x - t.x, WORLD_W), wrapDelta(y - t.y, WORLD_H)) < minDist) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        trees.push({ x, y, size: 0.86 + rand() * 0.34 });
      }
      return trees;
    }

    function aabbOverlap(ax, ay, asize, bx, by, bsize, wrapW, wrapH) {
      const ah = asize * 0.5;
      const bh = bsize * 0.5;
      const dx = Math.abs(wrapDelta(ax - bx, wrapW));
      const dy = Math.abs(wrapDelta(ay - by, wrapH));
      return dx < ah + bh && dy < ah + bh;
    }

    function collidesWithAnyTree(pxPos, pyPos) {
      for (let i = 0; i < state.trees.length; i += 1) {
        const tree = state.trees[i];
        if (aabbOverlap(pxPos, pyPos, PLAYER_COLLIDER_SIZE, tree.x, tree.y, TREE_COLLIDER_SIZE, WORLD_W, WORLD_H)) {
          return true;
        }
      }
      return false;
    }

    function createGoblin(now) {
      for (let attempts = 0; attempts < 100; attempts += 1) {
        const angle = rand() * Math.PI * 2;
        const dist = 70 + rand() * 120;
        const x = wrap(state.player.x + Math.cos(angle) * dist, WORLD_W);
        const y = wrap(state.player.y + Math.sin(angle) * dist, WORLD_H);
        if (collidesWithAnyTree(x, y)) continue;
        return {
          id: state.nextGoblinId++,
          x,
          y,
          hp: 20,
          maxHp: 20,
          alive: true,
          respawnAt: 0,
          cooldownUntil: now + 300 + Math.floor(rand() * 300),
          hitFlashUntil: 0,
          knockback: null,
        };
      }

      return {
        id: state.nextGoblinId++,
        x: wrap(state.player.x + 100, WORLD_W),
        y: wrap(state.player.y + 100, WORLD_H),
        hp: 20,
        maxHp: 20,
        alive: true,
        respawnAt: 0,
        cooldownUntil: now + 300,
        hitFlashUntil: 0,
        knockback: null,
      };
    }

    function initGoblins(now) {
      state.goblins = [];
      for (let i = 0; i < GOBLIN_COUNT; i += 1) state.goblins.push(createGoblin(now));
    }

    function startReload(now) {
      const w = state.weapon;
      if (w.isReloading || w.ammo >= w.magazineSize) return;
      w.isReloading = true;
      w.reloadStart = now;
      w.currentReloadDuration = typeof getCurrentReloadDurationMs === "function" ? getCurrentReloadDurationMs() : w.reloadDuration;
      playReloadSound();
    }

    function updateWeapon(now) {
      const w = state.weapon;
      if (w.isReloading) {
        const activeReloadDuration = Math.max(100, Number(w.currentReloadDuration) || Number(w.reloadDuration) || 2000);
        if (now - w.reloadStart >= activeReloadDuration) {
          w.isReloading = false;
          w.ammo = w.magazineSize;
          w.lastShotAt = now;
          w.currentReloadDuration = w.reloadDuration;
          if (typeof handleReloadCompleted === "function") handleReloadCompleted(now);
        }
        return;
      }
      if (w.ammo <= 0) {
        startReload(now);
        return;
      }
      if (w.ammo < w.magazineSize && now - w.lastShotAt >= w.idleReloadDelay) startReload(now);
    }

    function drawGround() {
      px(0, 0, W, H, palette.groundA);
      const tile = 8;
      const ox = Math.floor(state.player.x) % tile;
      const oy = Math.floor(state.player.y) % tile;

      for (let sy = -oy - tile; sy < H + tile; sy += tile) {
        for (let sx = -ox - tile; sx < W + tile; sx += tile) {
          const wx = Math.floor(state.player.x + sx - CX);
          const wy = Math.floor(state.player.y + sy - CY);
          const tx = Math.floor(wx / tile);
          const ty = Math.floor(wy / tile);
          const noise = hash2(tx, ty);
          const dirtBand = hash2(Math.floor(tx / 3) + 710, Math.floor(ty / 3) + 410);

          if (dirtBand < 0.15) {
            if (noise < 0.4) px(sx, sy, tile, tile, palette.mudA);
            else if (noise < 0.75) px(sx, sy, tile, tile, palette.mudB);
            else px(sx, sy, tile, tile, palette.mudC);
            continue;
          }

          if (dirtBand < 0.2) {
            px(sx, sy, tile, tile, palette.moss);
            continue;
          }

          if (noise < 0.16) px(sx, sy, tile, tile, palette.groundB);
          else if (noise > 0.9) px(sx, sy, tile, tile, palette.groundC);
        }
      }
    }

    function drawTree(sx, sy, size, sway) {
      const s = size;
      px(sx - 6 * s, sy + 2 * s, 12 * s, 2 * s, palette.shadow);
      px(sx - 1 * s, sy - 2 * s, 2 * s, 6 * s, palette.trunk);

      const offset = Math.round(sway);
      px(sx - 8 * s + offset, sy - 9 * s, 16 * s, 5 * s, palette.leafA);
      px(sx - 9 * s + offset, sy - 5 * s, 18 * s, 5 * s, palette.leafB);
      px(sx - 7 * s + offset, sy - 1 * s, 14 * s, 4 * s, palette.leafA);
      px(sx - 3 * s + offset, sy - 12 * s, 6 * s, 3 * s, palette.leafC);
    }

    const playerPortraitPaletteCache = {};
    const playerAutoHeroCache = {};

    function hashString(v) {
      const str = String(v || "");
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function normalizePortraitPath(src) {
      if (typeof src !== "string") return "";
      return src.trim().replace(/\\/g, "/");
    }

    function hexFromRgb(r, g, b) {
      const toHex = (v) => {
        const n = Math.max(0, Math.min(255, Math.round(v)));
        return n.toString(16).padStart(2, "0");
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function avgRegionColor(data, w, h, x0, y0, x1, y1) {
      const sx = Math.max(0, Math.min(w - 1, Math.floor(x0)));
      const ex = Math.max(0, Math.min(w, Math.ceil(x1)));
      const sy = Math.max(0, Math.min(h - 1, Math.floor(y0)));
      const ey = Math.max(0, Math.min(h, Math.ceil(y1)));
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let n = 0;

      for (let y = sy; y < ey; y += 1) {
        for (let x = sx; x < ex; x += 1) {
          const idx = (y * w + x) * 4;
          const a = data[idx + 3];
          if (a < 18) continue;
          rs += data[idx + 0];
          gs += data[idx + 1];
          bs += data[idx + 2];
          n += 1;
        }
      }

      if (!n) return null;
      return hexFromRgb(rs / n, gs / n, bs / n);
    }
    function rgbToHsv(r, g, b) {
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const d = max - min;
      let h = 0;
      const s = max === 0 ? 0 : d / max;
      const v = max;

      if (d !== 0) {
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h /= 6;
        if (h < 0) h += 1;
      }

      return { h, s, v };
    }

    function colorDistL1(r1, g1, b1, r2, g2, b2) {
      return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
    }

    function quantizeHex(r, g, b) {
      const q = (v) => Math.max(0, Math.min(255, Math.round(v / 32) * 32));
      return hexFromRgb(q(r), q(g), q(b));
    }

    function buildSpriteRectsFromGrid(grid, gridW, gridH) {
      const rects = [];
      let active = {};

      for (let y = 0; y < gridH; y += 1) {
        const next = {};
        let x = 0;
        while (x < gridW) {
          const key = grid[y * gridW + x];
          if (!key) {
            x += 1;
            continue;
          }

          let x2 = x + 1;
          while (x2 < gridW && grid[y * gridW + x2] === key) x2 += 1;
          const w = x2 - x;
          const sig = `${x}|${w}|${key}`;

          if (active[sig]) {
            active[sig].h += 1;
            next[sig] = active[sig];
          } else {
            const r = { x, y, w, h: 1, key };
            rects.push(r);
            next[sig] = r;
          }

          x = x2;
        }
        active = next;
      }

      const ox = Math.floor(gridW / 2);
      const oy = gridH - 1;
      return rects.map((r) => [r.x - ox, r.y - oy, r.w, r.h, `@${r.key}`]);
    }

    function buildSpriteVisualFromPortraitImage(img) {
      const side = 52;
      const gridW = 16;
      const gridH = 16;
      const cvs = document.createElement("canvas");
      cvs.width = side;
      cvs.height = side;
      const ctx = cvs.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;

      ctx.clearRect(0, 0, side, side);
      ctx.imageSmoothingEnabled = true;
      const scale = Math.max(side / iw, side / ih);
      const dw = Math.max(1, Math.floor(iw * scale));
      const dh = Math.max(1, Math.floor(ih * scale));
      const dx = Math.floor((side - dw) * 0.5);
      const dy = Math.floor((side - dh) * 0.5);
      ctx.drawImage(img, dx, dy, dw, dh);

      const image = ctx.getImageData(0, 0, side, side);
      const d = image.data;

      const corners = [
        [0, 0], [side - 1, 0], [0, side - 1], [side - 1, side - 1],
        [Math.floor(side * 0.5), 0], [Math.floor(side * 0.5), side - 1],
      ];
      let br = 0; let bg = 0; let bb = 0; let bn = 0;
      for (let i = 0; i < corners.length; i += 1) {
        const x = corners[i][0];
        const y = corners[i][1];
        const idx = (y * side + x) * 4;
        br += d[idx + 0];
        bg += d[idx + 1];
        bb += d[idx + 2];
        bn += 1;
      }
      const bgr = bn ? br / bn : 0;
      const bgg = bn ? bg / bn : 0;
      const bgb = bn ? bb / bn : 0;

      const fgMask = new Array(side * side).fill(false);
      let fgCount = 0;
      let minX = side; let minY = side; let maxX = -1; let maxY = -1;
      for (let y = 0; y < side; y += 1) {
        for (let x = 0; x < side; x += 1) {
          const idx = (y * side + x) * 4;
          const a = d[idx + 3];
          if (a < 24) continue;
          const r = d[idx + 0];
          const g = d[idx + 1];
          const b = d[idx + 2];
          const dist = colorDistL1(r, g, b, bgr, bgg, bgb);
          const fg = dist > 48 || a > 168;
          if (!fg) continue;

          const pos = y * side + x;
          fgMask[pos] = true;
          fgCount += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (fgCount < 30) {
        minX = side; minY = side; maxX = -1; maxY = -1;
        fgCount = 0;
        for (let y = 0; y < side; y += 1) {
          for (let x = 0; x < side; x += 1) {
            const idx = (y * side + x) * 4;
            if (d[idx + 3] < 32) continue;
            const pos = y * side + x;
            fgMask[pos] = true;
            fgCount += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (fgCount < 20 || maxX < minX || maxY < minY) return null;

      const bw = Math.max(1, maxX - minX + 1);
      const bh = Math.max(1, maxY - minY + 1);
      const grid = new Array(gridW * gridH).fill("");
      let filled = 0;

      for (let gy = 0; gy < gridH; gy += 1) {
        for (let gx = 0; gx < gridW; gx += 1) {
          const sx = Math.max(0, Math.min(side - 1, Math.floor(minX + ((gx + 0.5) / gridW) * bw)));
          const sy = Math.max(0, Math.min(side - 1, Math.floor(minY + ((gy + 0.5) / gridH) * bh)));
          const srcPos = sy * side + sx;
          if (!fgMask[srcPos]) continue;

          const idx = srcPos * 4;
          const r = d[idx + 0];
          const g = d[idx + 1];
          const b = d[idx + 2];
          const key = quantizeHex(r, g, b);
          grid[gy * gridW + gx] = key;
          filled += 1;
        }
      }

      if (filled < 12) return null;

      const rects = buildSpriteRectsFromGrid(grid, gridW, gridH);
      if (!rects.length) return null;

      let footMin = gridW;
      let footMax = -1;
      for (let gy = gridH - 3; gy < gridH; gy += 1) {
        for (let gx = 0; gx < gridW; gx += 1) {
          if (!grid[gy * gridW + gx]) continue;
          if (gx < footMin) footMin = gx;
          if (gx > footMax) footMax = gx;
        }
      }
      if (footMax < footMin) {
        footMin = Math.floor(gridW * 0.3);
        footMax = Math.floor(gridW * 0.7);
      }

      const ox = Math.floor(gridW / 2);
      const shadowX = (footMin - ox) - 1;
      const shadowW = Math.max(8, (footMax - footMin + 1) + 2);

      return {
        palette: {},
        shadow: [shadowX, 1, shadowW, 2],
        rects,
      };
    }

    function extractPortraitAnalysis(img) {
      const side = 40;
      const cvs = document.createElement("canvas");
      cvs.width = side;
      cvs.height = side;
      const ctx = cvs.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, side, side);

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;

      const scale = Math.min(side / iw, side / ih);
      const dw = Math.max(1, Math.floor(iw * scale));
      const dh = Math.max(1, Math.floor(ih * scale));
      const dx = Math.floor((side - dw) * 0.5);
      const dy = Math.floor((side - dh) * 0.5);
      ctx.drawImage(img, dx, dy, dw, dh);

      const image = ctx.getImageData(0, 0, side, side);
      const d = image.data;

      const all = avgRegionColor(d, side, side, 0, 0, side, side) || "#6d7d9a";
      const hair = avgRegionColor(d, side, side, 9, 2, 31, 12) || all;
      const skin = avgRegionColor(d, side, side, 12, 10, 28, 20) || mixHex(all, "#f0c7a0", 0.45);
      const body = avgRegionColor(d, side, side, 10, 19, 30, 31) || mixHex(all, "#3f5784", 0.45);
      const accent = avgRegionColor(d, side, side, 6, 24, 34, 39) || mixHex(all, "#b94a58", 0.35);
      const gear = avgRegionColor(d, side, side, 2, 16, 11, 31) || mixHex(body, "#d8dee9", 0.45);

      let topDark = 0;
      let topCount = 0;
      let lowerSat = 0;
      let lowerCount = 0;
      let leftDark = 0;
      let rightDark = 0;
      let minX = side;
      let maxX = -1;
      let warm = 0;
      let lumSum = 0;
      let lum2Sum = 0;
      let lumCount = 0;

      for (let y = 0; y < side; y += 1) {
        for (let x = 0; x < side; x += 1) {
          const idx = (y * side + x) * 4;
          const a = d[idx + 3];
          if (a < 18) continue;

          const r = d[idx + 0];
          const g = d[idx + 1];
          const b = d[idx + 2];
          const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
          const hsv = rgbToHsv(r, g, b);

          if (y < side * 0.42) {
            topCount += 1;
            if (lum < 0.34) topDark += 1;
          }
          if (y >= side * 0.5) {
            lowerSat += hsv.s;
            lowerCount += 1;
          }
          if (x < side * 0.35 && lum < 0.4) leftDark += 1;
          if (x > side * 0.65 && lum < 0.4) rightDark += 1;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;

          warm += (r - b) / 255;
          lumSum += lum;
          lum2Sum += lum * lum;
          lumCount += 1;
        }
      }

      const valid = Math.max(1, lumCount);
      const variance = Math.max(0, lum2Sum / valid - (lumSum / valid) * (lumSum / valid));
      const outlineSpread = (maxX >= minX) ? (maxX - minX + 1) / side : 0.6;

      const profile = {
        topDarkRatio: topDark / Math.max(1, topCount),
        lowerSat: lowerSat / Math.max(1, lowerCount),
        edgeDarkBias: (leftDark - rightDark) / Math.max(1, leftDark + rightDark),
        outlineSpread,
        warmth: warm / valid,
        contrast: Math.sqrt(variance),
      };

      return {
        palette: { hair, skin, body, accent, gear },
        profile,
      };
    }
    function ensurePortraitPaletteEntry(src) {
      const key = normalizePortraitPath(src);
      if (!key) return null;

      let entry = playerPortraitPaletteCache[key];
      if (entry) return entry;

      entry = { status: "loading", palette: null, analysis: null };
      playerPortraitPaletteCache[key] = entry;

      const img = new Image();
      img.onload = () => {
        entry.analysis = extractPortraitAnalysis(img);
        entry.palette = entry.analysis ? entry.analysis.palette : null;
        entry.status = entry.analysis ? "ready" : "error";
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("hero-visual-updated", { detail: { src: key } }));
        }
      };
      img.onerror = () => {
        entry.status = "error";
      };
      img.src = encodeURI(key);

      return entry;
    }
    function detectHeroSilhouetteFeature(baseHero, portraitSrc) {
      const id = String((baseHero && baseHero.id) || "").toLowerCase();
      const name = String((baseHero && baseHero.name) || "").toLowerCase();
      const src = String(portraitSrc || "").toLowerCase();
      const token = `${id}|${name}|${src}`;

      if (/(章鱼|克苏|触须|zhangyu|octo|cthul|tentacle|squid)/.test(token)) return "one_eye_octopus";
      if (/(科学家|轮椅|喷射|scientist|wheelchair|jet|hojin|techchair)/.test(token)) return "jet_wheelchair";
      if (/(恶魔|红魔|demon|devil|inferno|hell)/.test(token)) return "red_demon";
      if (/(johney|john|baron|伯爵|初代|经典主角)/.test(token) || id === "baron") return "original_hero";
      if (/(墨镜|雪茄|机械臂|cyborg|arm|cigar|shade)/.test(token)) return "sunglasses_cigar_arm";
      if (id === "hunter") return "one_eye_octopus";
      if (id === "duelist") return "jet_wheelchair";
      return "classic";
    }

    function buildIconicLowResHeroSprite(baseHero, portraitSrc, analysis) {
      const basePalette = baseHero && baseHero.palette ? baseHero.palette : {};
      const sampled = analysis && analysis.palette ? analysis.palette : null;
      const feature = detectHeroSilhouetteFeature(baseHero, portraitSrc);

      let body = sampled && sampled.body ? sampled.body : (basePalette.body || palette.cloth);
      let cape = sampled && sampled.accent ? sampled.accent : (basePalette.cape || palette.cape);
      let skin = sampled && sampled.skin ? sampled.skin : (basePalette.skin || palette.skin);
      let hair = sampled && sampled.hair ? sampled.hair : (basePalette.hair || palette.hair);
      let gear = sampled && sampled.gear ? sampled.gear : (basePalette.gear || "#c5c2b8");
      let eye = basePalette.eye || palette.eye;

      if (feature === "original_hero") {
        body = "#3d4f7e";
        cape = "#c13f49";
        skin = "#edbb92";
        hair = "#34231d";
        gear = "#d8d4c9";
        eye = "#f6f1df";
      } else if (feature === "red_demon") {
        body = mixHex(body, "#9a2e2e", 0.64);
        cape = mixHex(cape, "#cf4343", 0.7);
        skin = mixHex(skin, "#b54242", 0.62);
        hair = mixHex(hair, "#3a0f0f", 0.66);
        eye = "#ffe4a2";
      }

      const leg = mixHex(body, "#1e2435", 0.42);
      const trim = mixHex(cape, "#ddd2ba", 0.26);
      let shadow = [-5, 1, 10, 2];
      let rects = [
        [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
        [-3, -7, 6, 6, "body"],
        [-4, -6, 1, 4, "cape"], [3, -6, 1, 4, "cape"],
        [-4, -12, 8, 5, "skin"],
        [-4, -14, 8, 2, "hair"],
        [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
        [4, -9, 1, 6, "gear"],
      ];

      if (feature === "original_hero") {
        shadow = [-4, 1, 8, 2];
        rects = [
          [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
          [-3, -7, 6, 6, "body"],
          [-4, -6, 1, 4, "cape"], [3, -6, 1, 4, "cape"],
          [-4, -12, 8, 5, "skin"],
          [-4, -14, 8, 2, "hair"],
          [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
          [4, -9, 1, 6, "gear"],
        ];
      } else if (feature === "sunglasses_cigar_arm") {
        shadow = [-6, 1, 12, 2];
        rects = [
          [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
          [-3, -7, 6, 6, "body"],
          [-4, -12, 8, 5, "skin"],
          [-4, -14, 8, 2, "hair"],
          [-3, -11, 6, 2, "gear"],
          [1, -9, 2, 1, "@b98044"], [3, -9, 1, 1, "@f5d8aa"],
          [4, -8, 3, 1, "gear"], [6, -7, 1, 4, "gear"], [5, -6, 2, 2, "gear"],
          [-5, -6, 1, 4, "cape"],
          [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
        ];
      } else if (feature === "one_eye_octopus") {
        shadow = [-7, 1, 14, 2];
        rects = [
          [-5, -12, 10, 5, "hair"],
          [-4, -8, 8, 6, "body"],
          [-1, -10, 3, 2, "skin"],
          [0, -10, 1, 1, "eye"],
          [-6, -2, 2, 4, "cape"], [-4, 0, 2, 3, "cape"],
          [-2, 1, 2, 3, "cape"], [0, 1, 2, 3, "cape"],
          [2, 0, 2, 3, "cape"], [4, -2, 2, 4, "cape"],
          [-5, -1, 1, 1, "@cfd8e2"], [4, -1, 1, 1, "@cfd8e2"],
        ];
      } else if (feature === "jet_wheelchair") {
        shadow = [-10, 1, 20, 2];
        rects = [
          [-2, -11, 4, 4, "skin"],
          [-3, -13, 6, 2, "hair"],
          [-3, -7, 6, 4, "body"],
          [-5, -4, 10, 2, "gear"],
          [-8, -1, 4, 4, "gear"], [4, -1, 4, 4, "gear"],
          [-6, 0, 2, 2, "hair"], [4, 0, 2, 2, "hair"],
          [-9, 1, 1, 1, "@f08436"], [-10, 1, 1, 1, "@ffd38f"],
          [8, 1, 1, 1, "@f08436"], [9, 1, 1, 1, "@ffd38f"],
          [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
        ];
      } else if (feature === "red_demon") {
        shadow = [-8, 1, 16, 2];
        rects = [
          [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
          [-3, -7, 6, 6, "body"],
          [-4, -12, 8, 5, "skin"],
          [-5, -15, 2, 2, "hair"], [3, -15, 2, 2, "hair"],
          [-8, -10, 3, 6, "cape"], [5, -10, 3, 6, "cape"],
          [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
          [-6, -5, 2, 1, "cape"], [4, -5, 2, 1, "cape"],
        ];
      }

      return {
        palette: { leg, body, cape, skin, hair, eye, gear, trim },
        shadow,
        rects,
      };
    }

    function buildAutoHeroSprite(baseHero, portraitSrc, analysis) {
      const basePalette = baseHero && baseHero.palette ? baseHero.palette : {};
      const sampled = analysis && analysis.palette ? analysis.palette : null;
      const profile = analysis && analysis.profile ? analysis.profile : null;
      const seed = hashString(`${baseHero && baseHero.id ? baseHero.id : "hero"}|${portraitSrc || "none"}`);
      const bodySeed = hashString(`${baseHero && baseHero.id ? baseHero.id : "hero"}|form|${portraitSrc || "none"}`);

      const body = sampled && sampled.body ? sampled.body : (basePalette.body || palette.cloth);
      const cape = sampled && sampled.accent ? sampled.accent : (basePalette.cape || palette.cape);
      const skin = sampled && sampled.skin ? sampled.skin : (basePalette.skin || palette.skin);
      const hair = sampled && sampled.hair ? sampled.hair : (basePalette.hair || palette.hair);
      const gear = sampled && sampled.gear ? sampled.gear : (basePalette.gear || "#c5c2b8");
      const eye = basePalette.eye || palette.eye;
      const leg = mixHex(body, "#1e2435", 0.42);
      const trim = mixHex(cape, "#e6d9bf", 0.28);

      let archetype = bodySeed % 5;
      if (profile) {
        if (profile.topDarkRatio > 0.52 && profile.lowerSat > 0.26) archetype = 1;
        else if (profile.outlineSpread > 0.82 || profile.contrast > 0.28) archetype = 2;
        else if (profile.lowerSat < 0.2 && profile.warmth < 0.02) archetype = 3;
        else if (Math.abs(profile.edgeDarkBias) > 0.12) archetype = 4;
        else archetype = 0;
      }

      const headW = archetype === 2 ? 9 : archetype === 3 ? 7 : 8;
      const bodyW = archetype === 2 ? 8 : archetype === 3 ? 6 : archetype === 1 ? 5 : 6 + (seed % 2);
      const bodyH = archetype === 3 ? 5 : archetype === 1 ? 7 : 6 + ((seed >> 2) % 2);
      const hairMode = (seed >> 7) % 3;
      const gearSide = (seed >> 9) % 2 === 0 ? 1 : -1;

      const rects = [
        [-2, -1, 2, 2, "leg"],
        [1, -1, 2, 2, "leg"],
        [-Math.floor(bodyW / 2), -7, bodyW, bodyH, "body"],
        [-4, -12, headW, 5, "skin"],
        [-4, -14, headW, 2, "hair"],
        [-1, -10, 1, 1, "eye"],
        [1, -10, 1, 1, "eye"],
      ];

      if (archetype === 0) {
        rects.push([-Math.floor(bodyW / 2) - 1, -6, 1, 5, "cape"]);
        rects.push([Math.floor(bodyW / 2), -6, 1, 5, "cape"]);
      } else if (archetype === 1) {
        rects.push([-Math.floor(bodyW / 2) - 2, -7, 2, 5, "cape"]);
        rects.push([-Math.floor(bodyW / 2) - 3, -5, 1, 4, "cape"]);
        rects.push([Math.floor(bodyW / 2), -6, 1, 3, "trim"]);
      } else if (archetype === 2) {
        rects.push([-Math.floor(bodyW / 2) - 2, -7, 2, 3, "gear"]);
        rects.push([Math.floor(bodyW / 2), -7, 2, 3, "gear"]);
        rects.push([-Math.floor(bodyW / 2), -3, bodyW, 1, "trim"]);
      } else if (archetype === 3) {
        rects.push([-5, -4, 10, 1, "body"]);
        rects.push([-4, -3, 8, 2, "cape"]);
        rects.push([-3, -1, 6, 2, "cape"]);
        rects.push([-2, 1, 4, 1, "trim"]);
      } else {
        rects.push([gearSide > 0 ? Math.floor(bodyW / 2) : -Math.floor(bodyW / 2) - 2, -8, 2, 6, "cape"]);
        rects.push([gearSide > 0 ? -Math.floor(bodyW / 2) - 2 : Math.floor(bodyW / 2), -7, 1, 3, "gear"]);
      }

      if (hairMode === 0) {
        rects.push([-5, -13, 1, 3, "hair"]);
      } else if (hairMode === 1) {
        rects.push([3, -13, 2, 3, "hair"]);
      } else {
        rects.push([-5, -13, 1, 2, "hair"]);
        rects.push([4, -13, 1, 2, "hair"]);
      }

      rects.push([gearSide > 0 ? Math.floor(bodyW / 2) + 1 : -Math.floor(bodyW / 2) - 2, -9, 1, 6, "gear"]);

      const feature = detectHeroSilhouetteFeature(baseHero, portraitSrc);
      let shadow = [-(Math.floor(bodyW / 2) + 2), 1, bodyW + 4, 2];

      if (feature === "octopus") {
        rects.push([-4, -10, 2, 2, "eye"]);
        rects.push([2, -10, 2, 2, "eye"]);
        rects.push([-3, -9, 1, 1, "hair"]);
        rects.push([3, -9, 1, 1, "hair"]);

        rects.push([-6, -1, 2, 3, "cape"]);
        rects.push([-4, 0, 2, 3, "cape"]);
        rects.push([-2, 1, 2, 3, "cape"]);
        rects.push([0, 1, 2, 3, "cape"]);
        rects.push([2, 0, 2, 3, "cape"]);
        rects.push([4, -1, 2, 3, "cape"]);

        rects.push([-5, -2, 1, 1, "trim"]);
        rects.push([4, -2, 1, 1, "trim"]);
        shadow = [-7, 1, 14, 2];
      } else if (feature === "wheelchair") {
        rects.push([-5, -6, 2, 6, "gear"]);
        rects.push([-3, -4, 7, 2, "body"]);
        rects.push([3, -5, 2, 4, "gear"]);

        rects.push([-7, -1, 4, 4, "gear"]);
        rects.push([3, -1, 4, 4, "gear"]);
        rects.push([-6, 0, 2, 2, "hair"]);
        rects.push([4, 0, 2, 2, "hair"]);
        rects.push([-2, 1, 4, 1, "trim"]);
        shadow = [-8, 1, 16, 2];
      }

      return {
        palette: { leg, body, cape, skin, hair, eye, gear, trim },
        shadow,
        rects,
      };
    }

    function cloneHeroVisual(baseHero) {
      if (!baseHero || typeof baseHero !== "object") return null;
      const paletteSrc = (baseHero.palette && typeof baseHero.palette === "object") ? baseHero.palette : {};
      const rectsSrc = Array.isArray(baseHero.rects) ? baseHero.rects : [];
      const shadowSrc = Array.isArray(baseHero.shadow) ? baseHero.shadow : [-4, 1, 8, 2];

      const rects = [];
      for (let i = 0; i < rectsSrc.length; i += 1) {
        const r = rectsSrc[i];
        if (!Array.isArray(r) || r.length < 5) continue;
        rects.push([
          Number(r[0]) || 0,
          Number(r[1]) || 0,
          Math.max(1, Number(r[2]) || 1),
          Math.max(1, Number(r[3]) || 1),
          String(r[4] || "body"),
        ]);
      }

      return {
        palette: {
          leg: paletteSrc.leg || "#1e2435",
          body: paletteSrc.body || palette.cloth,
          cape: paletteSrc.cape || palette.cape,
          skin: paletteSrc.skin || palette.skin,
          hair: paletteSrc.hair || palette.hair,
          eye: paletteSrc.eye || palette.eye,
          gear: paletteSrc.gear || "#c5c2b8",
          trim: paletteSrc.trim || paletteSrc.gear || "#c5c2b8",
        },
        shadow: [
          Number(shadowSrc[0]) || -4,
          Number(shadowSrc[1]) || 1,
          Math.max(1, Number(shadowSrc[2]) || 8),
          Math.max(1, Number(shadowSrc[3]) || 2),
        ],
        rects,
      };
    }

    function buildHeroVisualFromDefinition(baseHero, portraitSrc, analysis) {
      return buildIconicLowResHeroSprite(baseHero, portraitSrc, analysis);
    }

    function resolveHeroVisualForDefinition(hero) {
      if (!hero) return null;
      const src = normalizePortraitPath(hero.attributes && hero.attributes.portrait_file_a ? hero.attributes.portrait_file_a : "");
      const key = `${hero.id || "hero"}|${src || "none"}`;
      let entry = playerAutoHeroCache[key];

      if (!entry) {
        entry = {
          visual: buildHeroVisualFromDefinition(hero, src, null),
          appliedFromImage: false,
        };
        playerAutoHeroCache[key] = entry;
      }

      if (src) {
        const paletteEntry = ensurePortraitPaletteEntry(src);
        if (paletteEntry && paletteEntry.status === "ready" && paletteEntry.analysis && !entry.appliedFromImage) {
          entry.visual = buildHeroVisualFromDefinition(hero, src, paletteEntry.analysis);
          entry.appliedFromImage = true;
          if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new CustomEvent("hero-visual-updated", { detail: { heroId: hero.id || "", src } }));
          }
        }
      }

      return entry.visual || null;
    }

    if (typeof window !== "undefined") {
      window.resolveHeroVisualForDefinition = resolveHeroVisualForDefinition;
    }

    function resolvePlayerHero() {
      const fallback = {
        palette: {
          leg: "#1e2435",
          body: palette.cloth,
          cape: palette.cape,
          skin: palette.skin,
          hair: palette.hair,
          eye: palette.eye,
          gear: "#c5c2b8",
        },
        shadow: [-4, 1, 8, 2],
        rects: [
          [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
          [-3, -7, 6, 6, "body"],
          [-4, -6, 1, 4, "cape"], [3, -6, 1, 4, "cape"],
          [-4, -12, 8, 5, "skin"],
          [-4, -14, 8, 2, "hair"],
          [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
          [4, -9, 1, 6, "gear"],
        ],
      };

      if (typeof getCurrentHeroDefinition !== "function") return fallback;
      const hero = getCurrentHeroDefinition();
      if (!hero) return fallback;

      const visual = resolveHeroVisualForDefinition(hero);
      return visual || fallback;
    }

    function getHeroPartColor(hero, part, hitTint) {
      if (typeof part === "string" && part.startsWith("@")) {
        const direct = part.slice(1);
        const strength = hitTint * 0.55;
        return mixHex(direct, palette.hitRed, strength);
      }
      const base = (hero.palette && hero.palette[part]) || "#ffffff";
      if (part === "eye") return base;

      let strength = hitTint * 0.7;
      if (part === "skin") strength = hitTint * 0.55;
      else if (part === "hair") strength = hitTint * 0.45;
      else if (part === "gear") strength = hitTint * 0.5;

      return mixHex(base, palette.hitRed, strength);
    }

    function drawHeroRects(hero, sx, y, hitTint) {
      const shadow = hero.shadow || [-4, 1, 8, 2];
      px(sx + shadow[0], y + shadow[1], shadow[2], shadow[3], palette.shadow);

      const rects = hero.rects || [];
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        const color = getHeroPartColor(hero, r[4], hitTint);
        px(sx + r[0], y + r[1], r[2], r[3], color);
      }
    }

    function drawPlayer(sx, sy, hitTint, t, glowStrength) {
      const bob = Math.sin(t * 0.007) * 0.9;
      const y = sy + bob;
      const hero = resolvePlayerHero();

      const shotAge = t - Number(state.weapon && state.weapon.lastFireAt);
      const firePose = Number.isFinite(shotAge) ? Math.max(0, 1 - shotAge / 120) : 0;
      const recoilX = (Number(state.player && state.player.lastShotDirX) || 0) * -2 * firePose;
      const recoilY = (Number(state.player && state.player.lastShotDirY) || 0) * -1.5 * firePose;

      if (glowStrength > 0) {
        const a = Math.max(0.12, glowStrength * 0.45);
        px(sx - 9, y - 17, 18, 18, `rgba(255,239,141,${a.toFixed(3)})`);
      }

      drawHeroRects(hero, sx + recoilX, y + recoilY, hitTint);

      if (firePose > 0.12) {
        const fx = sx + (Number(state.player && state.player.lastShotDirX) || 0) * 7;
        const fy = y + (Number(state.player && state.player.lastShotDirY) || 0) * 5 - 8;
        px(fx - 1, fy - 1, 3, 3, "rgba(255,233,170,0.9)");
      }

      if (glowStrength > 0.1) {
        const sparkPhase = Math.sin(t * 0.03);
        px(sx - 7 + sparkPhase * 2, y - 12, 2, 2, palette.levelSpark);
        px(sx + 5 - sparkPhase * 2, y - 15, 2, 2, palette.levelSpark);
      }
    }

    function drawGoblin(sx, sy, t, hitFlash) {
      const lean = Math.sin(t * 0.015) * 0.16;
      const tint = Math.max(0, Math.min(1, hitFlash));

      const gMid = mixHex(palette.gMid, palette.hitRed, tint * 0.55);
      const gDark = mixHex(palette.gDark, palette.hitRed, tint * 0.45);
      const gLight = mixHex(palette.gLight, palette.hitRed, tint * 0.5);
      const gDirty = mixHex(palette.gDirty, palette.hitRed, tint * 0.35);

      px(sx - 4, sy + 1, 8, 2, palette.shadow);

      bctx.save();
      bctx.translate(Math.round(sx), Math.round(sy - 10));
      bctx.rotate(lean);

      const gp = (ix, iy, iw, ih, c) => {
        bctx.fillStyle = c;
        bctx.fillRect(Math.round(ix), Math.round(iy), Math.round(iw), Math.round(ih));
      };

      gp(-3, 0, 6, 3, gMid);
      gp(-2, -2, 4, 2, gLight);
      gp(-1, -3, 2, 1, gDirty);
      gp(-2, 1, 1, 1, gDark);
      gp(1, 1, 1, 1, gDark);
      gp(-2, 2, 1, 1, "#f3f0dc");
      gp(1, 2, 1, 1, "#f3f0dc");
      gp(-3, 3, 6, 4, gDark);
      gp(-4, 4, 1, 2, gMid);
      gp(3, 4, 1, 2, gMid);
      gp(-1, 6, 2, 1, gLight);
      gp(-3, 7, 2, 2, gDark);
      gp(1, 7, 2, 2, gDark);

      bctx.restore();
    }

    function drawOrbs(now) {
      for (let i = 0; i < state.orbs.length; i += 1) {
        const orb = state.orbs[i];
        const p = worldToScreen(orb.x, orb.y);
        const tw = Math.sin(now * 0.01 + orb.seed) * 0.5 + 0.5;
        px(p.x - 2, p.y - 2, 5, 5, palette.orbEdge);
        px(p.x - 1, p.y - 1, 3, 3, palette.orb);
        if (tw > 0.45) px(p.x, p.y, 1, 1, palette.orbCore);
      }
    }

    function drawReloadBar(now) {
      if (!state.weapon.isReloading) return;
      const activeReloadDuration = Math.max(100, Number(state.weapon.currentReloadDuration) || Number(state.weapon.reloadDuration) || 2000);
      const p = Math.max(0, Math.min(1, (now - state.weapon.reloadStart) / activeReloadDuration));
      const barW = 24;
      const barH = 4;
      const x = CX - Math.floor(barW / 2);
      const y = CY - 22;
      px(x - 1, y - 1, barW + 2, barH + 2, palette.reloadEdge);
      px(x, y, barW, barH, palette.reloadBg);
      px(x, y, Math.max(1, Math.floor(barW * p)), barH, palette.reloadFill);
    }

    
    function drawShockwave(now) {
      const remain = (state.player.shockwaveUntil || 0) - now;
      if (remain <= 0) return;

      const duration = Math.max(1, Number(state.player.shockwaveDurationMs) || Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDurationMs) || 320);
      const radiusLimit = Math.max(0, Number(state.player.shockwaveVisualRadiusPx) || Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDistancePx) || 100);
      const startAt = Number(state.player.shockwaveStartedAt) || (state.player.shockwaveUntil - duration);
      const p = Math.max(0, Math.min(1, (now - startAt) / duration));
      const radius = 6 + p * radiusLimit;
      const alpha = (1 - p) * 0.5;

      bctx.save();
      bctx.strokeStyle = `rgba(248,220,164,${alpha.toFixed(3)})`;
      bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.arc(CX, CY, radius, 0, Math.PI * 2);
      bctx.stroke();
      bctx.restore();
    }
    function drawBullets() {
      for (let i = 0; i < state.bullets.length; i += 1) {
        const bullet = state.bullets[i];
        const p = worldToScreen(bullet.x, bullet.y);
        px(p.x - 1, p.y - 1, 2, 2, palette.bullet);
        px(p.x, p.y, 1, 1, palette.bulletCore);
      }
    }

    function pushFloatingDamage(x, y, value) {
      state.floatingDamage.push({ x, y, value, start: performance.now(), duration: 1000 });
    }

    function drawFloatingDamage(now) {
      const next = [];
      for (let i = 0; i < state.floatingDamage.length; i += 1) {
        const item = state.floatingDamage[i];
        const elapsed = now - item.start;
        if (elapsed > item.duration) continue;

        const p = elapsed / item.duration;
        const wp = worldToScreen(item.x, item.y);
        const ty = wp.y - p * 16;
        const alpha = 1 - p;
        const text = `-${item.value}`;

        bctx.globalAlpha = alpha;
        bctx.font = 'bold 9px "Courier New", monospace';
        bctx.fillStyle = "rgba(12,17,24,0.95)";
        bctx.fillText(text, Math.round(wp.x - 7 + 1), Math.round(ty + 1));
        bctx.fillStyle = "#f8fbff";
        bctx.fillText(text, Math.round(wp.x - 7), Math.round(ty));
        bctx.globalAlpha = 1;

        next.push(item);
      }
      state.floatingDamage = next;
    }
    function drawHitMarkers(now) {
      if (!Array.isArray(state.hitMarkers) || !state.hitMarkers.length) return;

      const next = [];
      for (let i = 0; i < state.hitMarkers.length; i += 1) {
        const item = state.hitMarkers[i];
        const elapsed = now - item.start;
        if (elapsed > item.duration) continue;

        const p = elapsed / item.duration;
        const wp = worldToScreen(item.x, item.y);
        const sx = Math.round(wp.x);
        const sy = Math.round(wp.y - 6 - p * 5);
        const alpha = 1 - p;

        bctx.globalAlpha = alpha;
        if (item.type === "skull") {
          px(sx - 4, sy - 5, 8, 6, "#511015");
          px(sx - 3, sy - 4, 6, 4, "#d73d49");
          px(sx - 3, sy + 1, 6, 2, "#b11d28");
          px(sx - 2, sy + 3, 4, 2, "#d73d49");
          px(sx - 2, sy - 2, 1, 1, "#140407");
          px(sx + 1, sy - 2, 1, 1, "#140407");
          px(sx - 1, sy - 1, 2, 1, "#140407");
          px(sx - 1, sy + 2, 1, 2, "#140407");
          px(sx + 0, sy + 2, 1, 2, "#140407");
        } else {
          px(sx - 1, sy - 1, 2, 2, "#ff9aa3");
          px(sx - 6, sy - 1, 3, 2, "#d02832");
          px(sx + 3, sy - 1, 3, 2, "#d02832");
          px(sx - 1, sy - 6, 2, 3, "#d02832");
          px(sx - 1, sy + 3, 2, 3, "#d02832");
          px(sx - 4, sy - 4, 2, 1, "#7f1218");
          px(sx + 2, sy - 4, 2, 1, "#7f1218");
          px(sx - 4, sy + 3, 2, 1, "#7f1218");
          px(sx + 2, sy + 3, 2, 1, "#7f1218");
        }
        bctx.globalAlpha = 1;

        next.push(item);
      }

      state.hitMarkers = next;
    }

    function drawVignette() {
      const grad = bctx.createRadialGradient(CX, CY, 60, CX, CY, 250);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(3,8,14,0.24)");
      bctx.fillStyle = grad;
      bctx.fillRect(0, 0, W, H);
    }

    function drawTentacle(sx, sy, now, tentacle) {
      const colors = {
        outline: "#1c2724",
        dark: "#3a4b43",
        mid: "#5c7065",
        light: "#93a396",
        tip: "#cad4c9",
      };
      const scale = 2;
      const idleFrame = Math.floor((now + (tentacle.swaySeed || 0) * 100) / 260) % 2;
      const attackFrame = (Number(tentacle.attackPose) || 0) % 2;
      const frameIndex = tentacle.attackAnimUntil > now ? 2 + attackFrame : idleFrame;
      const frames = [
        [
          [-2, 14, 3, 2, "dark"], [-3, 11, 3, 4, "mid"], [-2, 11, 2, 3, "light"],
          [-2, 8, 3, 4, "mid"], [-1, 8, 2, 3, "light"], [-1, 5, 3, 4, "mid"],
          [0, 5, 1, 3, "light"], [0, 2, 2, 4, "mid"], [1, 2, 1, 2, "light"], [1, 0, 1, 2, "tip"],
        ],
        [
          [-1, 14, 3, 2, "dark"], [0, 11, 3, 4, "mid"], [1, 11, 2, 3, "light"],
          [-1, 8, 3, 4, "mid"], [0, 8, 2, 3, "light"], [-2, 5, 3, 4, "mid"],
          [-1, 5, 1, 3, "light"], [-3, 2, 2, 4, "mid"], [-2, 2, 1, 2, "light"], [-3, 0, 1, 2, "tip"],
        ],
        [
          [-2, 14, 3, 2, "dark"], [-3, 11, 3, 4, "mid"], [-4, 8, 4, 4, "mid"],
          [-5, 8, 2, 3, "light"], [-6, 5, 4, 4, "mid"], [-6, 5, 2, 3, "light"],
          [-6, 2, 3, 3, "mid"], [-5, 2, 2, 2, "light"], [-5, 0, 2, 2, "tip"],
        ],
        [
          [-1, 14, 3, 2, "dark"], [0, 11, 3, 4, "mid"], [0, 8, 4, 4, "mid"],
          [2, 8, 2, 3, "light"], [2, 5, 4, 4, "mid"], [4, 5, 2, 3, "light"],
          [3, 2, 3, 3, "mid"], [3, 2, 2, 2, "light"], [3, 0, 2, 2, "tip"],
        ],
      ];

      px(sx - 8, sy + 2, 16, 4, "rgba(18,24,30,0.38)");
      bctx.save();
      bctx.translate(Math.round(sx), Math.round(sy - 32));
      bctx.scale(scale, scale);
      const frame = frames[frameIndex] || frames[0];
      for (let i = 0; i < frame.length; i += 1) {
        const rect = frame[i];
        bctx.fillStyle = colors[rect[4]] || colors.mid;
        bctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
      }
      const tip = frame[frame.length - 1];
      bctx.fillStyle = colors.outline;
      bctx.fillRect(tip[0] - 1, tip[1], 1, tip[3]);
      bctx.restore();
    }

    function drawActors(now) {
      const hitElapsed = now - state.player.lastHitAt;
      const hitTint = hitElapsed < 1000 ? 1 - hitElapsed / 1000 : 0;
      const glowStrength = state.player.levelUpUntil > now ? (state.player.levelUpUntil - now) / 900 : 0;

      const toDraw = [];

      for (let i = 0; i < state.trees.length; i += 1) {
        const tree = state.trees[i];
        const p = worldToScreen(tree.x, tree.y);
        if (p.x < -26 || p.x > W + 26 || p.y < -30 || p.y > H + 30) continue;
        toDraw.push({ type: "tree", x: p.x, y: p.y, size: tree.size, sway: Math.sin(now * 0.003 + i) * 1.1 });
      }

      for (let i = 0; i < state.tentacles.length; i += 1) {
        const tentacle = state.tentacles[i];
        const tp = worldToScreen(tentacle.x, tentacle.y);
        if (tp.x < -40 || tp.x > W + 40 || tp.y < -44 || tp.y > H + 44) continue;
        toDraw.push({ type: "tentacle", x: tp.x, y: tp.y, tentacle });
      }

      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) continue;
        const gp = worldToScreen(g.x, g.y);
        const flash = g.hitFlashUntil > now ? (g.hitFlashUntil - now) / 120 : 0;
        toDraw.push({ type: "goblin", x: gp.x, y: gp.y, flash });
      }

      toDraw.push({ type: "player", x: CX, y: CY, hitTint, glowStrength });
      toDraw.sort((a, b) => a.y - b.y);

      for (let i = 0; i < toDraw.length; i += 1) {
        const item = toDraw[i];
        if (item.type === "tree") drawTree(item.x, item.y, item.size, item.sway);
        else if (item.type === "tentacle") drawTentacle(item.x, item.y, now, item.tentacle);
        else if (item.type === "goblin") drawGoblin(item.x, item.y, now, item.flash);
        else drawPlayer(item.x, item.y, item.hitTint, now, item.glowStrength);
      }
    }

    function drawMarkedTargets(now) {
      const markedIds = Array.isArray(state.player.markedTargetIds) ? state.player.markedTargetIds : [];
      if (!markedIds.length) return;

      for (let i = 0; i < markedIds.length; i += 1) {
        const id = markedIds[i];
        let goblin = null;
        for (let j = 0; j < state.goblins.length; j += 1) {
          if (state.goblins[j].alive && state.goblins[j].id === id) {
            goblin = state.goblins[j];
            break;
          }
        }
        if (!goblin) continue;

        const aimY = wrap(goblin.y - 10, WORLD_H);
        const p = worldToScreen(goblin.x, aimY);
        const pulse = Math.sin(now * 0.012 + i * 0.8) * 0.5 + 0.5;
        const radius = 7 + pulse * 2;
        const alpha = 0.45 + pulse * 0.3;

        bctx.save();
        bctx.strokeStyle = `rgba(255,214,128,${alpha.toFixed(3)})`;
        bctx.lineWidth = 1.5;
        bctx.beginPath();
        bctx.arc(Math.round(p.x), Math.round(p.y), radius, 0, Math.PI * 2);
        bctx.stroke();
        bctx.beginPath();
        bctx.moveTo(Math.round(p.x - radius - 3), Math.round(p.y));
        bctx.lineTo(Math.round(p.x - radius + 1), Math.round(p.y));
        bctx.moveTo(Math.round(p.x + radius - 1), Math.round(p.y));
        bctx.lineTo(Math.round(p.x + radius + 3), Math.round(p.y));
        bctx.moveTo(Math.round(p.x), Math.round(p.y - radius - 3));
        bctx.lineTo(Math.round(p.x), Math.round(p.y - radius + 1));
        bctx.moveTo(Math.round(p.x), Math.round(p.y + radius - 1));
        bctx.lineTo(Math.round(p.x), Math.round(p.y + radius + 3));
        bctx.stroke();
        bctx.restore();
      }
    }














