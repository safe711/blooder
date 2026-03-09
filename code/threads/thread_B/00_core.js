const base = document.getElementById("base");
    const blurTop = document.getElementById("blurTop");
    const blurBottom = document.getElementById("blurBottom");
    const viewport = document.getElementById("viewport");

    const bctx = base.getContext("2d");
    const tctx = blurTop.getContext("2d");
    const dctx = blurBottom.getContext("2d");
    [bctx, tctx, dctx].forEach((ctx) => { ctx.imageSmoothingEnabled = false; });

    const ui = {
      blurRange: document.getElementById("blurRange"),
      topRange: document.getElementById("topRange"),
      bottomRange: document.getElementById("bottomRange"),
      blurVal: document.getElementById("blurVal"),
      topVal: document.getElementById("topVal"),
      bottomVal: document.getElementById("bottomVal"),
      coordVal: document.getElementById("coordVal"),
      contactVal: document.getElementById("contactVal"),
      damageVal: document.getElementById("damageVal"),
      goblinCountVal: document.getElementById("goblinCountVal"),
      ammoVal: document.getElementById("ammoVal"),
      ammoHudVal: document.getElementById("ammoHudVal"),
      reloadVal: document.getElementById("reloadVal"),
      levelHud: document.getElementById("levelHud"),
      expFill: document.getElementById("expFill"),
      expHudVal: document.getElementById("expHudVal"),
      levelPanelVal: document.getElementById("levelPanelVal"),
    };

    const W = 426;
    const H = 240;
    const CX = Math.floor(W / 2);
    const CY = Math.floor(H / 2);
    const WORLD_W = 1536;
    const WORLD_H = 1536;

    const PLAYER_COLLIDER_SIZE = 8;
    const TREE_COLLIDER_SIZE = 8;
    const GOBLIN_COLLIDER_SIZE = 2;
    const BULLET_COLLIDER_SIZE = 2;
    const ORB_MAGNET_RADIUS = 10;
    const GOBLIN_COUNT = 5;

    const palette = {
      groundA: "#4a5d48", groundB: "#556b50", groundC: "#3e523f", moss: "#66674b",
      mudA: "#8f7a4c", mudB: "#a58f5d", mudC: "#756440",
      trunk: "#744c2f", leafA: "#3d8f44", leafB: "#4da65a", leafC: "#73c276",
      shadow: "rgba(20,28,38,0.44)", cape: "#c1414d", cloth: "#36466a", skin: "#edbb92", hair: "#34231d",
      eye: "#f6f1df", outline: "#101720", hitRed: "#dc4242",
      gDark: "#3b5c33", gMid: "#5f9150", gLight: "#79b564", gDirty: "#9bc27d",
      bullet: "#f3d56d", bulletCore: "#fff6d3",
      orb: "#f8c75f", orbCore: "#fff2a8", orbEdge: "#d1932f",
      reloadBg: "#1e2a3f", reloadFill: "#f1bf6f", reloadEdge: "#0f1724", levelSpark: "rgba(255,252,206,0.85)"
    };

    const state = {
      keys: { KeyW: false, KeyA: false, KeyS: false, KeyD: false },
      player: { x: 768, y: 768, speed: 132, lastHitAt: -10000, levelUpUntil: 0, heroIndex: 0 },
      weapon: {
        magazineSize: 12,
        ammo: 12,
        fireCooldown: 500,
        lastFireAt: -10000,
        reloadDuration: 2000,
        idleReloadDelay: 2000,
        isReloading: false,
        reloadStart: 0,
        lastShotAt: performance.now(),
      },
      progress: { level: 1, maxLevel: 100, xpInLevel: 0, totalXp: 0 },
      goblins: [], bullets: [], orbs: [], floatingDamage: [], trees: [],
      inContact: false, lastDamage: null,
      rngSeed: 20260309, nextGoblinId: 1,
    };

    let audioCtx = null;

    function ensureAudioContext() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    }

    function playReloadSound() {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const steps = [420, 340, 270];
      const start = ctx.currentTime;
      for (let i = 0; i < steps.length; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = start + i * 0.1;
        osc.type = "square";
        osc.frequency.setValueAtTime(steps[i], t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.14);
      }
    }

    function playLevelUpSound() {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const notes = [390, 520, 680, 820];
      const start = ctx.currentTime;
      for (let i = 0; i < notes.length; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = start + i * 0.055;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(notes[i], t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.09, t + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.14);
      }
    }

    function rand() {
      state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
      return state.rngSeed / 4294967296;
    }

    function wrap(v, size) { return ((v % size) + size) % size; }

    function wrapDelta(delta, size) {
      let d = delta;
      if (d > size / 2) d -= size;
      if (d < -size / 2) d += size;
      return d;
    }

    function hash2(a, b) {
      let x = (a * 374761393 + b * 668265263) >>> 0;
      x = (x ^ (x >> 13)) >>> 0;
      x = (x * 1274126177) >>> 0;
      return ((x ^ (x >> 16)) >>> 0) / 4294967295;
    }

    function px(x, y, w, h, c) {
      bctx.fillStyle = c;
      bctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }

    function mixHex(a, b, t) {
      const n = Math.max(0, Math.min(1, t));
      const ah = a.replace("#", "");
      const bh = b.replace("#", "");
      const ar = parseInt(ah.slice(0, 2), 16);
      const ag = parseInt(ah.slice(2, 4), 16);
      const ab = parseInt(ah.slice(4, 6), 16);
      const br = parseInt(bh.slice(0, 2), 16);
      const bg = parseInt(bh.slice(2, 4), 16);
      const bb = parseInt(bh.slice(4, 6), 16);
      const r = Math.round(ar + (br - ar) * n).toString(16).padStart(2, "0");
      const g = Math.round(ag + (bg - ag) * n).toString(16).padStart(2, "0");
      const b2 = Math.round(ab + (bb - ab) * n).toString(16).padStart(2, "0");
      return `#${r}${g}${b2}`;
    }

    function worldToScreen(wx, wy) {
      const dx = wrapDelta(wx - state.player.x, WORLD_W);
      const dy = wrapDelta(wy - state.player.y, WORLD_H);
      return { x: CX + dx, y: CY + dy };
    }

    function expNeededForLevel(level) { return Math.min(5 + (level - 1), 20); }

    function onLevelUp(now) {
      state.player.levelUpUntil = now + 900;
      playLevelUpSound();
    }

    function addExp(amount, now) {
      for (let i = 0; i < amount; i += 1) {
        if (state.progress.level >= state.progress.maxLevel) {
          state.progress.xpInLevel = expNeededForLevel(state.progress.level);
          return;
        }

        state.progress.totalXp += 1;
        state.progress.xpInLevel += 1;

        let need = expNeededForLevel(state.progress.level);
        while (state.progress.xpInLevel >= need && state.progress.level < state.progress.maxLevel) {
          state.progress.xpInLevel -= need;
          state.progress.level += 1;
          onLevelUp(now);
          need = expNeededForLevel(state.progress.level);
        }

        if (state.progress.level >= state.progress.maxLevel) {
          state.progress.xpInLevel = expNeededForLevel(state.progress.level);
        }
      }
    }


