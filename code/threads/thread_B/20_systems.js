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
    }

    function killGoblin(goblin, now) {
      goblin.alive = false;
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
            g.cooldownUntil = now + 900;
            pushFloatingDamage(state.player.x, state.player.y - 8, damage);
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

      // drawGoblin() uses translate(sx, sy - 10), then rotate(lean), then local pixel rects.
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

          g.hp -= 5;
          g.hitFlashUntil = now + 120;
          pushFloatingDamage(g.x, g.y - 9, 5);
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
      const speed = 260;

      state.bullets.push({
        x: wrap(state.player.x + dirX * 6, WORLD_W),
        y: wrap(state.player.y + dirY * 6, WORLD_H),
        vx: dirX * speed,
        vy: dirY * speed,
        born: now,
      });

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
        setCurrentHeroIndex(idx);
        e.preventDefault();
        return;
      }

      if (e.code in state.keys) {
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
      ensureAudioContext();
      shootAtClientPoint(e.clientX, e.clientY);
      e.preventDefault();
    });

    syncUI();
    state.trees = generateTrees();
    initGoblins(performance.now());

    let last = performance.now();
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      updateWorld(dt, now);
      drawScene(now);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);


