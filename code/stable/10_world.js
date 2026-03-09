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
      playReloadSound();
    }

    function updateWeapon(now) {
      const w = state.weapon;
      if (w.isReloading) {
        if (now - w.reloadStart >= w.reloadDuration) {
          w.isReloading = false;
          w.ammo = w.magazineSize;
          w.lastShotAt = now;
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
      return hero || fallback;
    }

    function getHeroPartColor(hero, part, hitTint) {
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

      if (glowStrength > 0) {
        const a = Math.max(0.12, glowStrength * 0.45);
        px(sx - 9, y - 17, 18, 18, `rgba(255,239,141,${a.toFixed(3)})`);
      }

      drawHeroRects(hero, sx, y, hitTint);

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
      const p = Math.max(0, Math.min(1, (now - state.weapon.reloadStart) / state.weapon.reloadDuration));
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

      const duration = Math.max(1, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDurationMs) || 320);
      const distance = Math.max(0, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDistancePx) || 100);
      const p = Math.max(0, Math.min(1, 1 - remain / duration));
      const radius = 6 + p * distance;
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

    function drawVignette() {
      const grad = bctx.createRadialGradient(CX, CY, 60, CX, CY, 250);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(3,8,14,0.24)");
      bctx.fillStyle = grad;
      bctx.fillRect(0, 0, W, H);
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
        else if (item.type === "goblin") drawGoblin(item.x, item.y, now, item.flash);
        else drawPlayer(item.x, item.y, item.hitTint, now, item.glowStrength);
      }
    }






