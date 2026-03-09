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

    function normalizeAssetPath(src) {
      if (typeof src !== "string") return "";
      return src.trim().replace(/\\/g, "/");
    }

    function getPortraitSourcesForHero(hero) {
      if (!hero || !hero.attributes) return ["", ""];
      const a = normalizeAssetPath(hero.attributes.portrait_file_a || "");
      const b = normalizeAssetPath(hero.attributes.portrait_file_b || "");
      if (a && b) return [a, b];
      if (a) return [a, a];
      if (b) return [b, b];
      return ["", ""];
    }

    function getPortraitLabelFromSource(src, fallbackIndex) {
      const safe = normalizeAssetPath(src || "");
      if (!safe) return `portrait_${fallbackIndex + 1}`;
      const parts = safe.split("/");
      return parts[parts.length - 1] || `portrait_${fallbackIndex + 1}`;
    }

    function applyHeroJsonConfigToHeroes(config) {
      if (!config || typeof config !== "object") return;
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
        if (location.protocol === "file:") {
          console.warn("[heroes.json] 读取失败：当前是 file:// 打开。请用本地 HTTP 服务启动以读取 JSON 配置。", err);
        } else {
          console.warn("[heroes.json] 读取失败，已回退到 05_heroes.js 内置配置。", err);
        }
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
        if (location.protocol === "file:") {
          console.warn("[game_constants.json] 读取失败：当前是 file:// 打开。请用本地 HTTP 服务启动以读取 JSON 配置。", err);
        } else {
          console.warn("[game_constants.json] 读取失败，已回退到默认常量。", err);
        }
      }
    }
    function getRuntimeThreadId() {
      if (typeof getRuntimeThreadId.cached === "string") return getRuntimeThreadId.cached;
      const scripts = Array.from(document.querySelectorAll("script[src]"));
      let id = "";
      for (let i = 0; i < scripts.length; i += 1) {
        const src = normalizeAssetPath(scripts[i].getAttribute("src") || "");
        const m = src.match(/code\/threads\/([^/]+)\/20_systems\.js$/i);
        if (m && m[1]) {
          id = m[1];
          break;
        }
      }
      getRuntimeThreadId.cached = id;
      return id;
    }

    function getConfigPathCandidates(fileName) {
      const name = String(fileName || "").trim();
      if (!name) return [];

      const candidates = [];
      const threadId = getRuntimeThreadId();
      if (threadId) candidates.push(`code/threads/${threadId}/config/${name}`);
      candidates.push(`code/config/${name}`);
      return candidates;
    }

    async function fetchFirstAvailableJson(paths) {
      for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i];
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          return { data, path };
        } catch (err) {
          // continue trying next candidate path
        }
      }
      return null;
    }

    const UPGRADE_UI_SLOT_COUNT = 4;
    const UPGRADE_DEFAULT_RULES = {
      choicesPerLevel: UPGRADE_UI_SLOT_COUNT,
      autoPickFirst: false,
    };

    function normalizeUpgradeNode(node, levelIndex, nodeIndex) {
      if (!node || typeof node !== "object") return null;

      const level = Number(levelIndex);
      const safeLevel = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
      const nodeId = String(node.nodeId || node.id || `node_${safeLevel}_${nodeIndex + 1}`).trim();
      if (!nodeId) return null;

      const weight = Number(node.rollWeight ?? node.weight ?? 1);
      const nodeMinLv = Number(node.minPlayerLevel ?? node.min_level ?? node.requiredLevel ?? 1);

      return {
        nodeId,
        name: String(node.name || node.title || nodeId),
        description: String(node.description || node.desc || ""),
        rollWeight: Number.isFinite(weight) && weight > 0 ? weight : 1,
        requiresNodeId: typeof node.requiresNodeId === "string" ? node.requiresNodeId.trim() : "",
        minPlayerLevel: Number.isFinite(nodeMinLv) && nodeMinLv > 0 ? Math.floor(nodeMinLv) : 1,
        effects: Array.isArray(node.effects) ? node.effects.filter((e) => e && typeof e === "object") : [],
      };
    }

    function normalizeUpgradeTree(tree, fallbackId, group, heroId) {
      if (!tree || typeof tree !== "object") return null;

      const treeId = String(tree.treeId || tree.id || fallbackId || "").trim();
      if (!treeId) return null;

      const levelsRaw = Array.isArray(tree.levels) ? tree.levels : [];
      const levels = [];

      for (let i = 0; i < levelsRaw.length; i += 1) {
        const lv = levelsRaw[i];
        if (!lv || typeof lv !== "object") continue;

        const lvNum = Number(lv.level ?? i + 1);
        const level = Number.isFinite(lvNum) && lvNum >= 1 ? Math.floor(lvNum) : i + 1;
        const nodesRaw = Array.isArray(lv.nodes)
          ? lv.nodes
          : (lv.node && typeof lv.node === "object")
            ? [lv.node]
            : (Array.isArray(lv.effects) || lv.effect)
              ? [lv]
              : [];

        const nodes = [];
        for (let j = 0; j < nodesRaw.length; j += 1) {
          const node = normalizeUpgradeNode(nodesRaw[j], level, j);
          if (node) nodes.push(node);
        }

        if (!nodes.length) continue;
        levels.push({ level, nodes });
      }

      levels.sort((a, b) => a.level - b.level);
      if (!levels.length) return null;

      const rollWeight = Number(tree.rollWeight ?? tree.weight ?? 1);
      const minPlayerLevel = Number(tree.minPlayerLevel ?? tree.min_level ?? tree.requiredLevel ?? 1);
      return {
        treeId,
        group,
        heroId: heroId || "",
        name: String(tree.name || tree.title || treeId),
        description: String(tree.description || tree.desc || ""),
        rollWeight: Number.isFinite(rollWeight) && rollWeight > 0 ? rollWeight : 1,
        minPlayerLevel: Number.isFinite(minPlayerLevel) && minPlayerLevel > 0 ? Math.floor(minPlayerLevel) : 1,
        levels,
      };
    }

    function normalizeUpgradeConfig(config) {
      const raw = config && typeof config === "object" ? config : {};
      const rulesRaw = raw.rules && typeof raw.rules === "object" ? raw.rules : {};
      const choicesPerLevel = Number(rulesRaw.choicesPerLevel ?? rulesRaw.choice_count ?? UPGRADE_DEFAULT_RULES.choicesPerLevel);

      const normalized = {
        version: Number(raw.version || 1),
        rules: {
          choicesPerLevel: Number.isFinite(choicesPerLevel) && choicesPerLevel > 0 ? Math.floor(choicesPerLevel) : UPGRADE_DEFAULT_RULES.choicesPerLevel,
          autoPickFirst: Boolean(rulesRaw.autoPickFirst || rulesRaw.auto_pick_first || false),
        },
        trees: [],
      };

      const commonTrees = Array.isArray(raw.commonTrees) ? raw.commonTrees : [];
      for (let i = 0; i < commonTrees.length; i += 1) {
        const t = normalizeUpgradeTree(commonTrees[i], `common_${i + 1}`, "common", "");
        if (t) normalized.trees.push(t);
      }

      const heroTrees = raw.heroTrees && typeof raw.heroTrees === "object" ? raw.heroTrees : {};
      const heroIds = Object.keys(heroTrees);
      for (let i = 0; i < heroIds.length; i += 1) {
        const heroId = heroIds[i];
        const list = Array.isArray(heroTrees[heroId]) ? heroTrees[heroId] : [];
        for (let j = 0; j < list.length; j += 1) {
          const t = normalizeUpgradeTree(list[j], `${heroId}_tree_${j + 1}`, "hero", heroId);
          if (t) normalized.trees.push(t);
        }
      }

      return normalized;
    }

    function getCurrentHeroIdForUpgrade() {
      if (typeof getCurrentHeroDefinition !== "function") return "";
      const hero = getCurrentHeroDefinition();
      if (!hero || typeof hero.id !== "string") return "";
      return hero.id;
    }

    function canTriggerBaronHeadshot() {
      return getCurrentHeroIdForUpgrade() === "baron";
    }

    function rollBaronHeadshotEffect() {
      if (!canTriggerBaronHeadshot()) return null;
      const roll = rand();
      if (roll < 0.05) return { damageMultiplier: 10, markerType: "skull" };
      if (roll < 0.35) return { damageMultiplier: 2, markerType: "crosshair" };
      return null;
    }

    function pushHitMarker(x, y, type, now) {
      if (!Array.isArray(state.hitMarkers)) state.hitMarkers = [];
      state.hitMarkers.push({
        x,
        y,
        type: type === "skull" ? "skull" : "crosshair",
        start: now,
        duration: type === "skull" ? 640 : 520,
      });
      if (state.hitMarkers.length > 24) state.hitMarkers.splice(0, state.hitMarkers.length - 24);
    }

    function ensureUpgradeTreeSelectedNodeList(treeId) {
      if (!state.upgrades.treeSelectedNodes[treeId]) state.upgrades.treeSelectedNodes[treeId] = [];
      return state.upgrades.treeSelectedNodes[treeId];
    }

    function getUpgradeBonusBucket(stat) {
      const key = String(stat || "").trim();
      if (!key) return null;
      if (!state.upgrades.statBonuses[key]) {
        state.upgrades.statBonuses[key] = { add: 0, mul: 1, set: null };
      }
      return state.upgrades.statBonuses[key];
    }

    function applyUpgradeStatEffect(effect) {
      if (!effect || typeof effect !== "object") return;
      const stat = String(effect.stat || "").trim();
      if (!stat) return;

      const bucket = getUpgradeBonusBucket(stat);
      if (!bucket) return;

      const op = String(effect.op || "add").toLowerCase();
      const value = Number(effect.value);
      if (!Number.isFinite(value)) return;

      if (op === "set") bucket.set = value;
      else if (op === "mul" || op === "multiply") bucket.mul *= value;
      else bucket.add += value;
    }

    function getUpgradeRuntimeEffects() {
      if (!state.upgrades.runtimeEffects || typeof state.upgrades.runtimeEffects !== "object") {
        state.upgrades.runtimeEffects = {
          trailFlame: null,
          periodicShockwave: null,
          stationaryFreeShotChance: 0,
          executeLowHpThreshold: 0,
          deadeyeMarks: null,
          pierceDeadEnemies: false,
          reloadDamageBoost: null,
          reloadKillStack: null,
        };
      }
      return state.upgrades.runtimeEffects;
    }

    function getCurrentReloadDurationMs() {
      const baseDuration = Math.max(100, Math.round(Number(state.weapon.reloadDuration) || Number(state.weapon.baseReloadDuration) || 2000));
      const runtime = getUpgradeRuntimeEffects();
      const stackEffect = runtime.reloadKillStack;
      if (!stackEffect) return baseDuration;

      const stacks = Math.max(0, Math.floor(Number(stackEffect.stacks) || 0));
      if (!stacks) return baseDuration;

      const perKillMul = Math.max(0.1, Number(stackEffect.perKillMul) || 1);
      return Math.max(100, Math.round(baseDuration * Math.pow(perKillMul, stacks)));
    }

    function getCurrentDamageMultiplier(now) {
      const runtime = getUpgradeRuntimeEffects();
      const boost = runtime.reloadDamageBoost;
      if (!boost) return 1;

      const nowMs = Number.isFinite(Number(now)) ? Number(now) : performance.now();
      if ((Number(boost.activeUntil) || 0) <= nowMs) {
        boost.activeUntil = 0;
        return 1;
      }
      return Math.max(1, Number(boost.damageMul) || 1);
    }

    function handleReloadCompleted(now) {
      const runtime = getUpgradeRuntimeEffects();
      const nowMs = Number.isFinite(Number(now)) ? Number(now) : performance.now();

      if (runtime.reloadDamageBoost) {
        runtime.reloadDamageBoost.activeUntil = nowMs + Math.max(100, Number(runtime.reloadDamageBoost.durationMs) || 3000);
      }

      if (runtime.reloadKillStack) runtime.reloadKillStack.stacks = 0;
      state.weapon.currentReloadDuration = state.weapon.reloadDuration;
    }

    function handleGoblinKilled(now) {
      const runtime = getUpgradeRuntimeEffects();
      if (!runtime.reloadKillStack) return;

      runtime.reloadKillStack.stacks = Math.max(0, Math.floor(Number(runtime.reloadKillStack.stacks) || 0)) + 1;
      if (state.weapon.isReloading) state.weapon.currentReloadDuration = getCurrentReloadDurationMs();
    }

    function applyUpgradeSpecialEffect(effect, now) {
      if (!effect || typeof effect !== "object") return;

      const runtime = getUpgradeRuntimeEffects();
      const nowMs = Number.isFinite(Number(now)) ? Number(now) : performance.now();
      const type = String(effect.type || "").toLowerCase();

      if (type === "trail_flame") {
        runtime.trailFlame = {
          durationMs: Math.max(100, Number(effect.duration_ms ?? effect.durationMs) || 2000),
          tickMs: Math.max(100, Number(effect.tick_ms ?? effect.tickMs) || 1000),
          damage: Math.max(1, Math.floor(Number(effect.damage) || 5)),
          radiusPx: Math.max(4, Number(effect.radius_px ?? effect.radiusPx) || 10),
          spawnIntervalMs: Math.max(16, Number(effect.spawn_interval_ms ?? effect.spawnIntervalMs) || 80),
          nextSpawnAt: nowMs,
        };
      } else if (type === "periodic_shockwave") {
        const intervalMs = Math.max(250, Number(effect.interval_ms ?? effect.intervalMs) || 5000);
        runtime.periodicShockwave = {
          intervalMs,
          radiusPx: Math.max(1, Number(effect.radius_px ?? effect.radiusPx) || 20),
          knockbackDistancePx: Math.max(1, Number(effect.knockback_distance_px ?? effect.knockbackDistancePx) || 25),
          durationMs: Math.max(60, Number(effect.duration_ms ?? effect.durationMs) || 220),
          nextTriggerAt: nowMs + intervalMs,
        };
      } else if (type === "stationary_free_shot") {
        runtime.stationaryFreeShotChance = Math.max(0, Math.min(1, Number(effect.chance ?? effect.procChance) || 0));
      } else if (type === "execute_low_hp") {
        runtime.executeLowHpThreshold = Math.max(0, Math.min(1, Number(effect.threshold ?? effect.hpThreshold) || 0));
      } else if (type === "deadeye_marks") {
        runtime.deadeyeMarks = {
          radiusPx: Math.max(1, Number(effect.radius_px ?? effect.radiusPx) || 100),
          maxTargets: Math.max(1, Math.floor(Number(effect.max_targets ?? effect.maxTargets) || 6)),
        };
      } else if (type === "pierce_dead_enemies") {
        runtime.pierceDeadEnemies = true;
      } else if (type === "reload_damage_boost") {
        runtime.reloadDamageBoost = {
          durationMs: Math.max(100, Number(effect.duration_ms ?? effect.durationMs) || 3000),
          damageMul: Math.max(1, Number(effect.damage_mul ?? effect.damageMul) || 1.15),
          activeUntil: 0,
        };
      } else if (type === "reload_speed_kill_stack") {
        runtime.reloadKillStack = {
          perKillMul: Math.max(0.1, Number(effect.per_kill_mul ?? effect.perKillMul) || 0.952381),
          stacks: 0,
        };
      }
    }
    function applyUpgradeNodeEffects(node, now) {
      if (!node || !Array.isArray(node.effects)) return;
      for (let i = 0; i < node.effects.length; i += 1) {
        const effect = node.effects[i];
        if (!effect || typeof effect !== "object") continue;

        const type = String(effect.type || "stat_modifier").toLowerCase();
        if (type === "stat_modifier") applyUpgradeStatEffect(effect);
        else applyUpgradeSpecialEffect(effect, now);
      }
    }

    function applyUpgradeBonusesToState(resetHealth) {
      const bonuses = state.upgrades && state.upgrades.statBonuses ? state.upgrades.statBonuses : {};
      const applyValue = (baseValue, bucket, minValue, round) => {
        if (!bucket) return baseValue;
        let v = Number.isFinite(bucket.set) ? bucket.set : baseValue;
        v = (v + (Number(bucket.add) || 0)) * (Number(bucket.mul) || 1);
        if (Number.isFinite(minValue)) v = Math.max(minValue, v);
        if (round) v = Math.round(v);
        return v;
      };

      state.weapon.bulletDamage = applyValue(state.weapon.bulletDamage, bonuses.attack, 1, true);
      state.weapon.fireCooldown = applyValue(state.weapon.fireCooldown, bonuses.shot_interval_ms, 0, true);
      state.weapon.bulletSpeed = applyValue(state.weapon.bulletSpeed, bonuses.bullet_speed, 1, false);
      state.weapon.bulletCount = applyValue(state.weapon.bulletCount, bonuses.bullet_count, 1, true);
      state.weapon.bulletSize = applyValue(state.weapon.baseBulletSize, bonuses.bullet_size, 0.5, false);
      state.weapon.bulletKnockback = applyValue(state.weapon.baseBulletKnockback, bonuses.bullet_knockback, 0, false);
      state.weapon.bulletPierce = applyValue(state.weapon.bulletPierce, bonuses.bullet_pierce, 0, true);
      state.weapon.magazineSize = applyValue(state.weapon.magazineSize, bonuses.magazine_size, 1, true);
      state.weapon.reloadDuration = applyValue(state.weapon.baseReloadDuration, bonuses.reload_duration_ms, 100, true);
      state.weapon.bulletSpreadDeg = applyValue(state.weapon.bulletSpreadDeg, bonuses.bullet_spread_deg, 0, false);
      state.player.speed = applyValue(state.player.speed, bonuses.move_speed, 1, false);
      if (state.weapon.ammo > state.weapon.magazineSize) state.weapon.ammo = state.weapon.magazineSize;
      if (!state.weapon.isReloading) state.weapon.currentReloadDuration = state.weapon.reloadDuration;

      const oldMaxHp = state.player.maxHp;
      state.player.maxHp = applyValue(state.player.maxHp, bonuses.hp, 1, true);
      if (resetHealth) state.player.hp = state.player.maxHp;
      else if (state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp;
      else if (oldMaxHp > 0 && state.player.maxHp > oldMaxHp) state.player.hp += state.player.maxHp - oldMaxHp;
    }
    function getTreeNextNodes(tree) {
      const currentLv = Number(state.upgrades.treeLevels[tree.treeId] || 0);
      const nextLevel = currentLv + 1;
      const levelBlock = tree.levels.find((lv) => lv.level === nextLevel);
      if (!levelBlock) return [];

      const playerLevel = Number(state.progress && state.progress.level) || 1;
      const treeMinLv = Number(tree.minPlayerLevel) || 1;
      if (playerLevel < treeMinLv) return [];

      const selected = ensureUpgradeTreeSelectedNodeList(tree.treeId);
      return levelBlock.nodes.filter((node) => {
        const nodeMinLv = Number(node.minPlayerLevel) || 1;
        if (playerLevel < nodeMinLv) return false;
        if (!node.requiresNodeId) return true;
        return selected.includes(node.requiresNodeId);
      });
    }

    function buildUpgradeChoicePool(heroId) {
      const config = state.upgrades.config;
      if (!config || !Array.isArray(config.trees)) return [];

      const pool = [];
      for (let i = 0; i < config.trees.length; i += 1) {
        const tree = config.trees[i];
        if (tree.group === "hero" && tree.heroId && tree.heroId !== heroId) continue;

        const nodes = getTreeNextNodes(tree);
        for (let j = 0; j < nodes.length; j += 1) {
          const node = nodes[j];
          const weight = Math.max(0.0001, tree.rollWeight * node.rollWeight);
          pool.push({
            choiceId: `${tree.treeId}:${node.nodeId}`,
            treeId: tree.treeId,
            treeName: tree.name,
            group: tree.group,
            heroId: tree.heroId,
            level: Number(state.upgrades.treeLevels[tree.treeId] || 0) + 1,
            nodeId: node.nodeId,
            nodeName: node.name,
            nodeDescription: node.description,
            effects: node.effects,
            weight,
          });
        }
      }

      return pool;
    }

    function rollUpgradeChoicesForLevel(heroId, count) {
      const desired = Math.max(1, Math.floor(Number(count) || 1));
      const pool = buildUpgradeChoicePool(heroId).slice();
      const out = [];

      while (pool.length && out.length < desired) {
        let total = 0;
        for (let i = 0; i < pool.length; i += 1) total += pool[i].weight;
        if (total <= 0) break;

        let r = rand() * total;
        let pickIndex = 0;
        for (let i = 0; i < pool.length; i += 1) {
          r -= pool[i].weight;
          if (r <= 0) {
            pickIndex = i;
            break;
          }
        }

        const picked = pool.splice(pickIndex, 1)[0];
        out.push(picked);
      }

      return out;
    }

    function applyUpgradeChoice(choiceId, now) {
      const id = String(choiceId || "").trim();
      if (!id) return false;

      const idx = state.upgrades.pendingChoices.findIndex((x) => x.choiceId === id);
      if (idx < 0) return false;

      const choice = state.upgrades.pendingChoices[idx];
      const currentLv = Number(state.upgrades.treeLevels[choice.treeId] || 0);
      state.upgrades.treeLevels[choice.treeId] = Math.max(currentLv, choice.level);

      const selected = ensureUpgradeTreeSelectedNodeList(choice.treeId);
      if (!selected.includes(choice.nodeId)) selected.push(choice.nodeId);
      if (!state.upgrades.selectedNodeIds.includes(choice.nodeId)) state.upgrades.selectedNodeIds.push(choice.nodeId);

      applyUpgradeNodeEffects(choice, now);
      applyCurrentHeroAttributesToState(false);

      state.upgrades.pendingChoices = [];
      return true;
    }

    function isUpgradeSelectionOpen() {
      return Boolean(state.upgrades && state.upgrades.isChoosing);
    }

    function rollUpgradeChoicesAndPrepare(now) {
      const config = state.upgrades.config;
      if (!config) return false;

      const heroId = getCurrentHeroIdForUpgrade();
      const count = UPGRADE_UI_SLOT_COUNT;
      const choices = rollUpgradeChoicesForLevel(heroId, count);
      state.upgrades.pendingChoices = choices;
      state.upgrades.selectedChoiceId = "";

      if (!choices.length) return false;

      console.info(`[upgrade] Lv.${state.progress.level} 可选效果:`, choices);
      if (config.rules && config.rules.autoPickFirst) {
        return commitUpgradeChoiceById(choices[0].choiceId, now);
      }

      openUpgradeSelectionOverlay();
      return true;
    }

    function tryDrainQueuedUpgradeRolls(now) {
      let guard = 16;
      while ((state.upgrades.queuedLevelUps || 0) > 0 && guard > 0) {
        state.upgrades.queuedLevelUps -= 1;
        const opened = rollUpgradeChoicesAndPrepare(now);
        if (opened || isUpgradeSelectionOpen()) return;
        guard -= 1;
      }
    }

    function commitUpgradeChoiceById(choiceId, now) {
      const ok = applyUpgradeChoice(choiceId, now);
      if (!ok) return false;

      closeUpgradeSelectionOverlay();
      tryDrainQueuedUpgradeRolls(now);
      return true;
    }

    function onLevelUpSkillRoll(now) {
      const config = state.upgrades.config;
      if (!config) return;

      if (isUpgradeSelectionOpen() || (Array.isArray(state.upgrades.pendingChoices) && state.upgrades.pendingChoices.length > 0)) {
        state.upgrades.queuedLevelUps = (state.upgrades.queuedLevelUps || 0) + 1;
        return;
      }

      rollUpgradeChoicesAndPrepare(now);
    }

    async function loadUpgradeEffectsConfig() {
      const candidates = getConfigPathCandidates("upgrade_effects.json");
      const hit = await fetchFirstAvailableJson(candidates);
      if (!hit) {
        if (location.protocol === "file:") {
          console.warn("[upgrade_effects.json] 读取失败：当前是 file:// 打开。请用本地 HTTP 服务启动。", candidates);
        } else {
          console.warn("[upgrade_effects.json] 读取失败，已使用空配置。", candidates);
        }
        state.upgrades.config = normalizeUpgradeConfig({ version: 1, commonTrees: [], heroTrees: {} });
        state.upgrades.pendingChoices = [];
        state.upgrades.isChoosing = false;
        state.upgrades.queuedLevelUps = 0;
        state.upgrades.selectedChoiceId = "";
        closeUpgradeSelectionOverlay();
        return;
      }

      state.upgrades.config = normalizeUpgradeConfig(hit.data);
      state.upgrades.pendingChoices = [];
      state.upgrades.isChoosing = false;
      state.upgrades.queuedLevelUps = 0;
      state.upgrades.selectedChoiceId = "";
      closeUpgradeSelectionOverlay();
      console.info(`[upgrade] 配置已加载: ${hit.path}`, state.upgrades.config);
    }

    window.debugListUpgradeChoices = function debugListUpgradeChoices() {
      return Array.isArray(state.upgrades.pendingChoices) ? state.upgrades.pendingChoices.slice() : [];
    };

    window.pickUpgradeChoice = function pickUpgradeChoice(choiceId) {
      return commitUpgradeChoiceById(choiceId, performance.now());
    };

    window.debugOpenUpgradeSelection = function debugOpenUpgradeSelection() {
      if (!Array.isArray(state.upgrades.pendingChoices) || !state.upgrades.pendingChoices.length) return false;
      openUpgradeSelectionOverlay();
      return true;
    };

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

      state.weapon.baseBulletSize = 1;
      state.weapon.bulletSize = state.weapon.baseBulletSize;
      state.weapon.baseBulletKnockback = 1;
      state.weapon.bulletKnockback = state.weapon.baseBulletKnockback;

      const reloadDuration = Number(attrs.reload_duration_ms);
      state.weapon.baseReloadDuration = Number.isFinite(reloadDuration) && reloadDuration > 0
        ? Math.max(100, Math.round(reloadDuration))
        : 2000;
      state.weapon.reloadDuration = state.weapon.baseReloadDuration;
      if (!state.weapon.isReloading) state.weapon.currentReloadDuration = state.weapon.reloadDuration;

      const magazineSize = Number(attrs.magazine_size);
      state.weapon.baseMagazineSize = Number.isFinite(magazineSize) && magazineSize > 0
        ? Math.max(1, Math.floor(magazineSize))
        : 12;

      state.weapon.attackMode = attrs.attack_mode === "tentacle_summon" ? "tentacle_summon" : "bullet";
      state.weapon.bulletPierce = Math.max(0, Math.floor(Number(state.weapon.baseBulletPierce) || 0));
      state.weapon.magazineSize = Math.max(1, Math.floor(Number(state.weapon.baseMagazineSize) || 12));
      if (state.weapon.ammo > state.weapon.magazineSize) state.weapon.ammo = state.weapon.magazineSize;

      const spread = Number(attrs.bullet_spread_deg);
      if (Number.isFinite(spread) && spread >= 0) state.weapon.bulletSpreadDeg = spread;

      const attack = Number(attrs.attack);
      if (Number.isFinite(attack) && attack > 0) state.weapon.bulletDamage = Math.max(1, Math.floor(attack));

      applyUpgradeBonusesToState(resetHealth);
      updateAmmoHudIcon();
    }

    const UPGRADE_STAT_LABELS = {
      attack: "伤害",
      shot_interval_ms: "攻击间隔",
      bullet_speed: "弹道速度",
      bullet_count: "子弹数量",
      bullet_size: "子弹大小",
      bullet_knockback: "击退距离",
      bullet_spread_deg: "子弹散射",
      bullet_pierce: "子弹穿透",
      magazine_size: "弹匣容量",
      reload_duration_ms: "换弹时间",
      move_speed: "移动速度",
      hp: "生命值",
    };

    const upgradeSelectState = {
      selectedIndex: 0,
    };

    let upgradeSelectRefs = null;

    function findUpgradeTreeById(treeId) {
      const trees = state.upgrades && state.upgrades.config && Array.isArray(state.upgrades.config.trees)
        ? state.upgrades.config.trees
        : [];
      for (let i = 0; i < trees.length; i += 1) {
        if (trees[i].treeId === treeId) return trees[i];
      }
      return null;
    }

    function getUpgradeChoiceBySlot(slotIndex) {
      const choices = Array.isArray(state.upgrades.pendingChoices) ? state.upgrades.pendingChoices : [];
      const i = Number(slotIndex);
      if (!Number.isFinite(i) || i < 0 || i >= choices.length) return null;
      return choices[i] || null;
    }

    function getUpgradeEffectDesc(effect) {
      if (!effect || typeof effect !== "object") return "";

      const type = String(effect.type || "stat_modifier").toLowerCase();
      if (type === "trail_flame") {
        const durationMs = Math.max(0, Number(effect.duration_ms ?? effect.durationMs) || 0);
        const tickMs = Math.max(1, Number(effect.tick_ms ?? effect.tickMs) || 1000);
        const damage = Math.max(1, Math.floor(Number(effect.damage) || 0));
        const durationSec = durationMs > 0 ? (durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1) : "0";
        const dps = Math.round(damage * (1000 / tickMs));
        return `移动留下火焰 ${durationSec}秒，每秒 ${dps} 点火焰伤害`;
      }

      if (type === "periodic_shockwave") {
        const intervalMs = Math.max(1, Number(effect.interval_ms ?? effect.intervalMs) || 1000);
        const radiusPx = Math.max(0, Number(effect.radius_px ?? effect.radiusPx) || 0);
        const distancePx = Math.max(0, Number(effect.knockback_distance_px ?? effect.knockbackDistancePx) || 0);
        const intervalSec = (intervalMs / 1000).toFixed(intervalMs % 1000 === 0 ? 0 : 1);
        return `每${intervalSec}秒释放冲击波，${radiusPx}px 内最多击退 ${distancePx}px`;
      }

      if (type === "stationary_free_shot") {
        const chance = Math.max(0, Math.min(1, Number(effect.chance ?? effect.procChance) || 0));
        return `站立不动射击时 ${Math.round(chance * 100)}% 概率不消耗子弹`;
      }

      if (type === "execute_low_hp") {
        const threshold = Math.max(0, Math.min(1, Number(effect.threshold ?? effect.hpThreshold) || 0));
        return `生命低于 ${Math.round(threshold * 100)}% 的敌人会被处决`;
      }

      if (type === "deadeye_marks") {
        const radiusPx = Math.max(0, Number(effect.radius_px ?? effect.radiusPx) || 0);
        const maxTargets = Math.max(1, Math.floor(Number(effect.max_targets ?? effect.maxTargets) || 1));
        return `${radiusPx}px 内最多 ${maxTargets} 名敌人获得准星，开火时同时射击`;
      }

      if (type === "pierce_dead_enemies") {
        return "击杀目标后子弹继续穿透，不消耗穿透次数";
      }

      if (type === "reload_damage_boost") {
        const durationMs = Math.max(100, Number(effect.duration_ms ?? effect.durationMs) || 3000);
        const damageMul = Math.max(1, Number(effect.damage_mul ?? effect.damageMul) || 1.15);
        return `换弹后 ${(durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1)}秒内伤害 +${Math.round((damageMul - 1) * 100)}%`;
      }

      if (type === "reload_speed_kill_stack") {
        const perKillMul = Math.max(0.1, Number(effect.per_kill_mul ?? effect.perKillMul) || 0.952381);
        return `每击杀 1 名敌人换弹速度 +${Math.round(((1 / perKillMul) - 1) * 100)}%，换弹后重置`;
      }

      const statKey = String(effect.stat || "").trim();
      const stat = UPGRADE_STAT_LABELS[statKey] || statKey || "属性";
      const op = String(effect.op || "add").toLowerCase();
      const value = Number(effect.value);
      if (!Number.isFinite(value)) return "";

      if (op === "set") return `${stat} = ${value}`;
      if (op === "mul" || op === "multiply") {
        if (statKey === "move_speed" || statKey === "bullet_speed" || statKey === "attack" || statKey === "bullet_size" || statKey === "bullet_knockback") {
          const pct = Math.round((value - 1) * 100);
          const sign = pct > 0 ? "+" : "";
          return `${stat} ${sign}${pct}%`;
        }
        if (statKey === "shot_interval_ms" && value > 0) {
          const intervalPct = Math.round((value - 1) * 100);
          const intervalSign = intervalPct > 0 ? "+" : "";
          return `攻击间隔 ${intervalSign}${intervalPct}%`;
        }
        if (statKey === "reload_duration_ms" && value > 0) {
          const reloadSpeedPct = Math.round(((1 / value) - 1) * 100);
          const reloadSign = reloadSpeedPct > 0 ? "+" : "";
          return `换弹速度 ${reloadSign}${reloadSpeedPct}%`;
        }
        if (statKey === "bullet_spread_deg") {
          const pct = Math.round((1 - value) * 100);
          const sign = pct > 0 ? "-" : "+";
          return `${stat} ${sign}${Math.abs(pct)}%`;
        }
        return `${stat} x${value}`;
      }

      const sign = value > 0 ? "+" : "";
      if (statKey === "shot_interval_ms") return `${stat} ${sign}${value}ms`;
      if (statKey === "reload_duration_ms") return `${stat} ${sign}${value}ms`;
      if (statKey === "bullet_spread_deg") return `${stat} ${sign}${value}deg`;
      return `${stat} ${sign}${value}`;
    }
    function drawUpgradeChoiceIcon(canvas, choice, active) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const seed = stringHash(`${choice.treeId}|${choice.nodeId}`);
      const stat = choice && Array.isArray(choice.effects) && choice.effects[0]
        ? String(choice.effects[0].stat || "")
        : "";

      const bg = active ? "#26374f" : "#1b273b";
      const frame = active ? "#f2c98a" : "#4a617f";
      const glow = active ? "rgba(246,203,133,0.28)" : "rgba(112,146,184,0.16)";

      const px = (x, y, w, h, c) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };

      px(0, 0, 48, 48, "rgba(0,0,0,0)");
      px(6, 6, 36, 36, glow);
      px(8, 8, 32, 32, bg);
      px(8, 8, 32, 2, frame);
      px(8, 38, 32, 2, frame);
      px(8, 8, 2, 32, frame);
      px(38, 8, 2, 32, frame);
      px(11, 11, 26, 26, "#121a2b");

      const c1 = mixHex("#7fa6d6", "#f5d18b", ((seed >> 4) & 0xff) / 255 * 0.55);
      const c2 = mixHex("#4f6f96", "#b8d5ef", ((seed >> 12) & 0xff) / 255 * 0.42);

      if (stat === "attack") {
        px(20, 14, 8, 20, c1);
        px(17, 18, 14, 4, c2);
        px(22, 10, 4, 4, c2);
      } else if (stat === "bullet_size") {
        px(15, 15, 18, 18, c1);
        px(19, 19, 10, 10, c2);
        px(22, 22, 4, 4, "#f1e8cf");
      } else if (stat === "bullet_knockback") {
        px(14, 21, 14, 6, c1);
        px(26, 17, 8, 14, c2);
        px(33, 20, 3, 8, "#f1e8cf");
      } else if (stat === "shot_interval_ms") {
        px(18, 15, 12, 12, c1);
        px(23, 17, 2, 8, "#f1e8cf");
        px(23, 22, 5, 2, "#f1e8cf");
      } else if (stat === "bullet_speed") {
        px(14, 21, 16, 6, c1);
        px(28, 18, 8, 12, c2);
        px(32, 22, 4, 4, "#f1e8cf");
      } else if (stat === "bullet_count") {
        px(14, 18, 8, 12, c1);
        px(20, 16, 8, 16, c2);
        px(26, 18, 8, 12, "#d6e7f5");
      } else if (stat === "move_speed") {
        px(14, 25, 20, 5, c1);
        px(24, 17, 10, 10, c2);
        px(30, 20, 6, 4, "#f1e8cf");
      } else if (stat === "hp") {
        px(16, 18, 16, 14, c1);
        px(13, 21, 6, 8, c1);
        px(29, 21, 6, 8, c1);
        px(20, 22, 8, 6, "#f1e8cf");
      } else {
        px(16, 16, 16, 16, c1);
        px(20, 20, 8, 8, c2);
      }
    }

    function ensureUpgradeSelectUI() {
      if (upgradeSelectRefs) return upgradeSelectRefs;

      if (!document.getElementById("upgradeSelectStyle")) {
        const style = document.createElement("style");
        style.id = "upgradeSelectStyle";
        style.textContent = `
#upgradeSelectOverlay {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: grid;
  place-items: center;
  padding: 16px;
  background: radial-gradient(circle at 50% 24%, rgba(26, 35, 53, 0.82), rgba(10, 15, 24, 0.9));
}

#upgradeSelectOverlay.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.upgrade-select-shell {
  width: min(920px, 100%);
  border: 1px solid #31455f;
  border-radius: 12px;
  background: linear-gradient(170deg, #1a1830, #151427);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
  padding: 14px;
  display: grid;
  gap: 10px;
}

.upgrade-title {
  text-align: center;
  color: #ff5f78;
  font-size: clamp(30px, 5.2vw, 64px);
  letter-spacing: 1px;
  line-height: 1;
}

.upgrade-choice-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.upgrade-choice-card {
  border: 1px solid #425773;
  border-radius: 10px;
  background: #1a2438;
  color: #d8e2f2;
  padding: 8px 6px;
  display: grid;
  justify-items: center;
  gap: 4px;
  min-height: 112px;
  cursor: pointer;
}

.upgrade-choice-card.hero-choice {
  border-color: #8b6130;
  box-shadow: 0 0 0 1px rgba(235, 180, 86, 0.08) inset;
}

.upgrade-choice-card.hero-choice:hover {
  border-color: #d9a55b;
}

.upgrade-choice-card:hover {
  border-color: #8eabcf;
}

.upgrade-choice-card.active {
  border-color: #f0ca8f;
  box-shadow: 0 0 0 1px rgba(240, 202, 143, 0.22) inset;
}

.upgrade-choice-card.hero-choice.active {
  border-color: #ffd27a;
  box-shadow: 0 0 0 1px rgba(255, 210, 122, 0.36) inset, 0 0 18px rgba(242, 180, 64, 0.18);
}

.upgrade-choice-card:disabled {
  opacity: 0.4;
  cursor: default;
}

.upgrade-choice-card canvas {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
}

.upgrade-choice-name {
  font-size: 13px;
  color: #f7dcae;
  text-align: center;
  line-height: 1.2;
}

.upgrade-choice-meta {
  font-size: 11px;
  color: #8da2c2;
  text-align: center;
}

.upgrade-detail {
  border: 1px solid #2f415a;
  border-radius: 10px;
  background: #1a1830;
  min-height: 170px;
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 12px;
  padding: 10px;
}

.upgrade-detail.hero-choice {
  border-color: #a67a32;
  box-shadow: 0 0 0 1px rgba(214, 168, 88, 0.18) inset;
}

.upgrade-name {
  font-size: 34px;
  color: #efe1c5;
  line-height: 1;
}

.upgrade-desc {
  margin-top: 6px;
  font-size: 19px;
  color: #82a089;
  min-height: 28px;
}

.upgrade-effects {
  margin: 8px 0 0;
  padding-left: 16px;
  color: #c6d6ed;
  font-size: 13px;
  line-height: 1.45;
}

.upgrade-tree-title {
  font-size: 12px;
  color: #89a273;
  margin-bottom: 6px;
}

.upgrade-tree-map {
  display: grid;
  gap: 6px;
}

.upgrade-tree-row {
  display: grid;
  grid-template-columns: 26px 1fr;
  align-items: center;
  gap: 6px;
}

.upgrade-tree-level {
  font-size: 11px;
  color: #9fb4d3;
}

.upgrade-tree-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.upgrade-tree-node {
  font-size: 11px;
  border: 1px solid #4f6483;
  border-radius: 999px;
  padding: 2px 7px;
  color: #c7d7ec;
}

.upgrade-tree-node.hero-choice {
  border-color: #8d6936;
  color: #f1d79f;
}

.upgrade-tree-node.hero-choice.available {
  border-color: #d6a858;
  color: #ffe7b8;
}

.upgrade-tree-node.hero-choice.selected {
  border-color: #ffe29a;
  color: #fff2cf;
}

.upgrade-tree-node.hero-choice.unlocked {
  border-color: #d19a45;
  color: #ffe1ad;
}

.upgrade-tree-node.locked {
  opacity: 0.4;
}

.upgrade-tree-node.available {
  border-color: #8da785;
  color: #b8d9af;
}

.upgrade-tree-node.selected {
  border-color: #f1cb90;
  color: #ffe6bf;
}

.upgrade-tree-node.unlocked {
  border-color: #7e9fc4;
  color: #d6e6fb;
}

.upgrade-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.upgrade-hint {
  font-size: 11px;
  color: #8ea4c6;
}

#upgradeConfirmBtn {
  min-width: 176px;
  height: 42px;
  border: 1px solid #546d8e;
  border-radius: 9px;
  background: linear-gradient(180deg, #202e49, #1a2338);
  color: #f3d9aa;
  font-size: 20px;
  cursor: pointer;
}

#upgradeConfirmBtn:disabled {
  opacity: 0.45;
  cursor: default;
}

@media (max-width: 920px) {
  .upgrade-choice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .upgrade-detail {
    grid-template-columns: 1fr;
  }

  .upgrade-name {
    font-size: 26px;
  }

  .upgrade-desc {
    font-size: 15px;
  }

  #upgradeConfirmBtn {
    width: 100%;
  }
}
`;
        document.head.appendChild(style);
      }

      let overlay = document.getElementById("upgradeSelectOverlay");
      if (!overlay) {
        overlay = document.createElement("section");
        overlay.id = "upgradeSelectOverlay";
        overlay.className = "hidden";
        overlay.innerHTML = `
<div class="upgrade-select-shell">
  <div class="upgrade-title">选择一个升级</div>
  <div id="upgradeChoiceGrid" class="upgrade-choice-grid"></div>
  <div id="upgradeDetailPane" class="upgrade-detail">
    <div>
      <div id="upgradeInfoName" class="upgrade-name">-</div>
      <div id="upgradeInfoDesc" class="upgrade-desc">请选择一个升级项</div>
      <ul id="upgradeInfoEffects" class="upgrade-effects"></ul>
    </div>
    <div>
      <div class="upgrade-tree-title">进阶路线</div>
      <div id="upgradeTreeMap" class="upgrade-tree-map"></div>
    </div>
  </div>
  <div class="upgrade-footer">
    <div id="upgradeHint" class="upgrade-hint">按 1~4 快捷选择，Enter 确认</div>
    <button type="button" id="upgradeConfirmBtn">选择</button>
  </div>
</div>`;
        document.body.appendChild(overlay);
      }

      upgradeSelectRefs = {
        overlay,
        choiceGrid: document.getElementById("upgradeChoiceGrid"),
        infoName: document.getElementById("upgradeInfoName"),
        infoDesc: document.getElementById("upgradeInfoDesc"),
        infoEffects: document.getElementById("upgradeInfoEffects"),
        detailPane: document.getElementById("upgradeDetailPane"),
        treeMap: document.getElementById("upgradeTreeMap"),
        hint: document.getElementById("upgradeHint"),
        confirmBtn: document.getElementById("upgradeConfirmBtn"),
      };

      if (upgradeSelectRefs.confirmBtn) {
        upgradeSelectRefs.confirmBtn.addEventListener("click", () => {
          commitSelectedUpgradeChoice();
        });
      }

      return upgradeSelectRefs;
    }

    function renderUpgradeTreeMap(choice) {
      if (!upgradeSelectRefs || !upgradeSelectRefs.treeMap) return;
      const treeMap = upgradeSelectRefs.treeMap;
      treeMap.innerHTML = "";

      if (!choice) {
        const empty = document.createElement("div");
        empty.className = "upgrade-tree-level";
        empty.textContent = "暂无可展示路线";
        treeMap.appendChild(empty);
        return;
      }

      const tree = findUpgradeTreeById(choice.treeId);
      if (!tree) {
        const empty = document.createElement("div");
        empty.className = "upgrade-tree-level";
        empty.textContent = "未找到树定义";
        treeMap.appendChild(empty);
        return;
      }

      const currentLv = Number(state.upgrades.treeLevels[tree.treeId] || 0);
      const selected = ensureUpgradeTreeSelectedNodeList(tree.treeId);

      for (let i = 0; i < tree.levels.length; i += 1) {
        const lv = tree.levels[i];
        const row = document.createElement("div");
        row.className = "upgrade-tree-row";

        const lvText = document.createElement("div");
        lvText.className = "upgrade-tree-level";
        lvText.textContent = `L${lv.level}`;

        const nodeWrap = document.createElement("div");
        nodeWrap.className = "upgrade-tree-nodes";

        for (let j = 0; j < lv.nodes.length; j += 1) {
          const node = lv.nodes[j];
          const tag = document.createElement("span");
          tag.className = "upgrade-tree-node";
          if (tree.group === "hero") tag.classList.add("hero-choice");
          tag.textContent = node.name || node.nodeId;

          if (selected.includes(node.nodeId)) {
            tag.classList.add("unlocked");
          } else if (node.nodeId === choice.nodeId) {
            tag.classList.add("selected");
          } else {
            const allowedByReq = !node.requiresNodeId || selected.includes(node.requiresNodeId);
            if (lv.level === currentLv + 1 && allowedByReq) tag.classList.add("available");
            else tag.classList.add("locked");
          }

          nodeWrap.appendChild(tag);
        }

        row.appendChild(lvText);
        row.appendChild(nodeWrap);
        treeMap.appendChild(row);
      }
    }

    function renderUpgradeChoiceDetails() {
      if (!upgradeSelectRefs) return;
      const choice = getUpgradeChoiceBySlot(upgradeSelectState.selectedIndex);

      if (!choice) {
        upgradeSelectRefs.infoName.textContent = "-";
        upgradeSelectRefs.infoDesc.textContent = "请选择一个升级项";
        upgradeSelectRefs.infoEffects.innerHTML = "";
        upgradeSelectRefs.confirmBtn.disabled = true;
        if (upgradeSelectRefs.detailPane) upgradeSelectRefs.detailPane.classList.remove("hero-choice");
        renderUpgradeTreeMap(null);
        return;
      }

      upgradeSelectRefs.infoName.textContent = choice.nodeName || choice.nodeId;
      upgradeSelectRefs.infoDesc.textContent = choice.nodeDescription || `${choice.treeName || choice.treeId} · Lv.${choice.level}`;
      if (upgradeSelectRefs.detailPane) upgradeSelectRefs.detailPane.classList.toggle("hero-choice", choice.group === "hero");

      const effects = Array.isArray(choice.effects) ? choice.effects : [];
      const lines = [];
      for (let i = 0; i < effects.length; i += 1) {
        const desc = getUpgradeEffectDesc(effects[i]);
        if (desc) lines.push(desc);
      }
      if (!lines.length) lines.push("无直接属性改动");

      upgradeSelectRefs.infoEffects.innerHTML = lines.map((line) => `<li>${line}</li>`).join("");
      upgradeSelectRefs.confirmBtn.disabled = false;

      const waiting = Math.max(0, Number(state.upgrades.queuedLevelUps) || 0);
      upgradeSelectRefs.hint.textContent = waiting > 0
        ? `按 1~4 快捷选择，Enter 确认（后续待选 ${waiting} 次）`
        : "按 1~4 快捷选择，Enter 确认";

      renderUpgradeTreeMap(choice);
    }

    function setUpgradeSelectionIndex(index) {
      const choices = Array.isArray(state.upgrades.pendingChoices) ? state.upgrades.pendingChoices : [];
      if (!choices.length) {
        upgradeSelectState.selectedIndex = 0;
        renderUpgradeChoiceDetails();
        return;
      }

      let idx = Number(index);
      if (!Number.isFinite(idx)) idx = 0;
      idx = Math.max(0, Math.min(UPGRADE_UI_SLOT_COUNT - 1, Math.floor(idx)));
      if (!choices[idx]) {
        const first = choices.findIndex((x) => Boolean(x));
        idx = first >= 0 ? first : 0;
      }

      upgradeSelectState.selectedIndex = idx;

      if (upgradeSelectRefs && upgradeSelectRefs.choiceGrid) {
        const cards = upgradeSelectRefs.choiceGrid.querySelectorAll(".upgrade-choice-card");
        cards.forEach((card) => {
          const slot = Number(card.dataset.slotIndex || "-1");
          card.classList.toggle("active", slot === idx);
        });
      }

      const selected = getUpgradeChoiceBySlot(idx);
      state.upgrades.selectedChoiceId = selected ? selected.choiceId : "";
      renderUpgradeChoiceDetails();
    }

    function renderUpgradeChoiceCards() {
      if (!upgradeSelectRefs || !upgradeSelectRefs.choiceGrid) return;
      const grid = upgradeSelectRefs.choiceGrid;
      grid.innerHTML = "";

      const choices = Array.isArray(state.upgrades.pendingChoices) ? state.upgrades.pendingChoices : [];
      for (let i = 0; i < UPGRADE_UI_SLOT_COUNT; i += 1) {
        const choice = choices[i] || null;

        const card = document.createElement("button");
        card.type = "button";
        card.className = "upgrade-choice-card";
        card.dataset.slotIndex = String(i);

        const icon = document.createElement("canvas");
        icon.width = 48;
        icon.height = 48;

        const name = document.createElement("div");
        name.className = "upgrade-choice-name";

        const meta = document.createElement("div");
        meta.className = "upgrade-choice-meta";

        if (choice) {
          drawUpgradeChoiceIcon(icon, choice, i === upgradeSelectState.selectedIndex);
          if (choice.group === "hero") card.classList.add("hero-choice");
          name.textContent = choice.nodeName || choice.nodeId;
          meta.textContent = choice.group === "hero"
            ? `${choice.treeName || choice.treeId} · Lv.${choice.level} · 专属`
            : `${choice.treeName || choice.treeId} · Lv.${choice.level}`;

          card.addEventListener("mouseenter", () => setUpgradeSelectionIndex(i));
          card.addEventListener("focus", () => setUpgradeSelectionIndex(i));
          card.addEventListener("click", () => setUpgradeSelectionIndex(i));
        } else {
          drawUpgradeChoiceIcon(icon, { treeId: "empty", nodeId: `empty_${i}`, effects: [] }, false);
          name.textContent = "空槽";
          meta.textContent = "当前无可用升级";
          card.disabled = true;
        }

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(meta);
        grid.appendChild(card);
      }

      setUpgradeSelectionIndex(upgradeSelectState.selectedIndex);
    }

    function commitSelectedUpgradeChoice() {
      const choice = getUpgradeChoiceBySlot(upgradeSelectState.selectedIndex);
      if (!choice) return false;
      return commitUpgradeChoiceById(choice.choiceId, performance.now());
    }

    function openUpgradeSelectionOverlay() {
      if (!state.gameStarted) return;

      const refs = ensureUpgradeSelectUI();
      if (!refs) return;

      state.upgrades.isChoosing = true;
      if (!Array.isArray(state.upgrades.pendingChoices) || !state.upgrades.pendingChoices.length) {
        closeUpgradeSelectionOverlay();
        return;
      }

      refs.overlay.classList.remove("hidden");
      renderUpgradeChoiceCards();
    }

    function closeUpgradeSelectionOverlay() {
      state.upgrades.isChoosing = false;
      if (upgradeSelectRefs && upgradeSelectRefs.overlay) {
        upgradeSelectRefs.overlay.classList.add("hidden");
      }
    }

    const heroSelectState = {
      selectedIndex: 0,
      portraitIndex: 0,
      portraitIndexByHero: {},
      dragStartX: 0,
      dragPointerId: null,
    };

    let heroSelectRefs = null;
    let heroVisualEventBound = false;
    let gameOverRefs = null;
    const FIRE_MOVE_MULTIPLIER = 0.5;
    const holdFireState = {
      isHeld: false,
      clientX: 0,
      clientY: 0,
    };

    function setHoldFirePointer(clientX, clientY) {
      const x = Number(clientX);
      const y = Number(clientY);
      if (Number.isFinite(x)) holdFireState.clientX = x;
      if (Number.isFinite(y)) holdFireState.clientY = y;
    }

    function getCurrentAttackMode() {
      if (state.weapon && state.weapon.attackMode === "tentacle_summon") return "tentacle_summon";
      const attrs = typeof getCurrentHeroAttributes === "function" ? getCurrentHeroAttributes() : null;
      return attrs && attrs.attack_mode === "tentacle_summon" ? "tentacle_summon" : "bullet";
    }

    function isTentacleSummonMode() {
      return getCurrentAttackMode() === "tentacle_summon";
    }

    function getTentacleSummonConfig() {
      return {
        lifetimeMs: 5000,
        attackIntervalMs: 2000,
        attackRadiusPx: 84,
        attackAnimMs: 420,
        attackReachPx: 76,
      };
    }

    function updateAmmoHudIcon() {
      if (!ui.ammoHudIcon) return;
      ui.ammoHudIcon.setAttribute("viewBox", "0 0 16 16");
      if (isTentacleSummonMode()) {
        ui.ammoHudIcon.innerHTML = `
          <path d="M9 1C7 2 6 4 6 6c0 1.6.8 2.8 1.6 3.9C8.6 11.3 9 12.1 9 13c0 1-.5 1.7-1.4 2H4.5c1.2-1.2 1.8-2.8 1.8-4.8 0-1.8-.7-3.3-1.5-4.7C4 4.2 3.4 3.1 3.4 2c0-.7.2-1.3.6-2h2.9c-.5.6-.8 1.3-.8 2.2 0 1 .5 2 1.2 3 .9-1.9 1.6-3.3 3.7-4.2H9z" fill="#c8d6ca"></path>
          <path d="M10.6 1.2c-.9.7-1.5 1.6-2.2 3.1-.3.7-.6 1.3-1 1.8-.5-.8-.7-1.5-.7-2.1 0-.8.3-1.5.9-2.2h3z" fill="#6f8278"></path>
          <path d="M8.9 6.7c1 1.2 1.8 2.5 1.8 4.1 0 1.5-.5 2.8-1.6 4.2H6.7c1.2-1 1.8-2.1 1.8-3.5 0-1.2-.5-2.1-1.2-3.2.5-.4 1.1-.9 1.6-1.6z" fill="#49594f"></path>
        `;
        return;
      }
      ui.ammoHudIcon.innerHTML = `
        <rect x="1" y="6" width="8" height="4" fill="#d2d8e6"></rect>
        <rect x="9" y="7" width="4" height="2" fill="#f2c26b"></rect>
        <rect x="5" y="10" width="3" height="4" fill="#9ca8bc"></rect>
        <rect x="6" y="12" width="4" height="2" fill="#79869d"></rect>
      `;
    }

    function isHoldFireSlowActive() {
      if (!holdFireState.isHeld) return false;
      if (isTentacleSummonMode()) return false;
      if (!state.gameStarted || state.gameOver || isUpgradeSelectionOpen()) return false;
      const w = state.weapon;
      return !w.isReloading && w.ammo > 0;
    }

    function updateHoldFire(now) {
      if (!holdFireState.isHeld) return;
      if (isTentacleSummonMode()) return;
      if (!state.gameStarted || state.gameOver || isUpgradeSelectionOpen()) return;
      shootAtClientPoint(holdFireState.clientX, holdFireState.clientY, now);
    }    function ensureHeroSelectUI() {
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
  width: min(1920px, 96vw);
  height: min(1080px, 92vh);
  border: 1px solid #2f3f57;
  border-radius: 14px;
  background: linear-gradient(170deg, #1a2234 0%, #141d2f 55%, #12172a 100%);
  box-shadow: 0 28px 62px rgba(0, 0, 0, 0.48);
  display: grid;
  grid-template-columns: 420px 1fr;
  overflow: hidden;
}

.hero-select-left {
  padding: 28px 24px 22px;
  border-right: 1px solid rgba(102, 128, 166, 0.22);
  background: linear-gradient(165deg, #202b43 0%, #1a2439 100%);
}

.hero-select-left h2 {
  margin: 0;
  color: #ff6d84;
  font-size: 30px;
  letter-spacing: 1px;
}

.hero-select-left p {
  margin: 8px 0 16px;
  color: #9fb1cf;
  font-size: 16px;
}

.hero-select-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  margin: 0 auto 4px;
  border: none;
  border-radius: 0;
  background: transparent;
}

.hero-card-name {
  display: block;
  font-weight: 700;
  font-size: 14px;
  color: #ffe0aa;
  margin-top: 2px;
}

.hero-select-right {
  padding: 26px;
  display: grid;
  grid-template-rows: auto auto auto auto 1fr;
  align-content: start;
  gap: 10px;
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
  grid-template-columns: 1fr;
  align-items: center;
  justify-items: center;
}

#heroPortraitCanvas {
  position: static;
  inset: auto;
  display: block;
  width: min(560px, 100%);
  aspect-ratio: 800 / 500;
  image-rendering: auto;
  border: 1px solid rgba(83, 103, 136, 0.55);
  border-radius: 8px;
  background: #0f1626;
  margin: 0 auto;
}

.hero-select-name {
  font-size: 34px;
  color: #ff6d84;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.hero-select-meta {
  font-size: 18px;
  color: #c7d5ec;
  line-height: 1.6;
}

.hero-select-passive {
  font-size: 16px;
  color: #a8bbda;
  line-height: 1.5;
  min-height: 42px;
}

.hero-select-tip {
  display: none;
}

.hero-start-btn {
  margin-top: 8px;
  width: 220px;
  height: 42px;
  border: 1px solid rgba(111, 140, 178, 0.75);
  border-radius: 8px;
  background: linear-gradient(180deg, #223658, #192840);
  color: #ffe2ad;
  font-size: 16px;
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
    width: min(1920px, 96vw);
    height: min(1080px, 96vh);
    max-height: 96vh;
    overflow-y: auto;
  }

  .hero-select-left {
    border-right: none;
    border-bottom: 1px solid rgba(102, 128, 166, 0.22);
  }

  .hero-select-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
        <canvas id="heroPortraitCanvas" width="800" height="500"></canvas>
      </div>
    </div>
    <div id="heroSelectName" class="hero-select-name">-</div>
    <div id="heroSelectMeta" class="hero-select-meta">-</div>
    <div id="heroSelectPassive" class="hero-select-passive">-</div>
    <button type="button" id="heroStartBtn" class="hero-start-btn">进入游戏</button>
  </div>
</div>`;
        document.body.appendChild(overlay);
      }

      heroSelectRefs = {
        overlay,
        cards: document.getElementById("heroSelectCards"),
        portraitCanvas: document.getElementById("heroPortraitCanvas"),
        name: document.getElementById("heroSelectName"),
        meta: document.getElementById("heroSelectMeta"),
        passive: document.getElementById("heroSelectPassive"),
        startBtn: document.getElementById("heroStartBtn"),
      };

      return heroSelectRefs;
    }

    function getHeroCardPartColor(hero, part) {
      const key = String(part || "body");
      if (key.startsWith("@")) return key.slice(1);
      const defaults = {
        leg: "#222d45",
        body: "#4f648f",
        cape: "#8e4250",
        skin: "#e0b892",
        hair: "#2f241f",
        eye: "#f6f1df",
        gear: "#c1cadb",
        trim: "#c1cadb",
      };
      if (hero && hero.palette && hero.palette[key]) return hero.palette[key];
      return defaults[key] || defaults.body;
    }

    function drawHeroCardSprite(canvas, hero) {
      const ctx = canvas.getContext("2d");
      if (!ctx || !hero) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const visual = (typeof resolveHeroVisualForDefinition === "function")
        ? (resolveHeroVisualForDefinition(hero) || hero)
        : hero;
      const rectsSrc = Array.isArray(visual.rects) ? visual.rects : [];
      const shadowSrc = Array.isArray(visual.shadow) ? visual.shadow : [-4, 1, 8, 2];
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

      const scale = 3;
      const ox = Math.floor(canvas.width * 0.5);
      const oy = Math.floor(canvas.height * 0.77);

      const px = (x, y, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(ox + x * scale, oy + y * scale, w * scale, h * scale);
      };

      const sx = Number(shadowSrc[0]) || -4;
      const sy = Number(shadowSrc[1]) || 1;
      const sw = Math.max(1, Number(shadowSrc[2]) || 8);
      const sh = Math.max(1, Number(shadowSrc[3]) || 2);
      px(sx, sy, sw, sh, "rgba(10,15,24,0.72)");

      if (!rects.length) {
        px(-3, -7, 6, 6, getHeroCardPartColor(visual, "body"));
        px(-4, -12, 8, 5, getHeroCardPartColor(visual, "skin"));
        px(-4, -14, 8, 2, getHeroCardPartColor(visual, "hair"));
        px(-1, -10, 1, 1, getHeroCardPartColor(visual, "eye"));
        px(1, -10, 1, 1, getHeroCardPartColor(visual, "eye"));
        return;
      }

      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        const color = getHeroCardPartColor(visual, r[4]);
        px(r[0], r[1], r[2], r[3], color);
      }

      // subtle top rim light to make silhouettes pop inside small cards
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        const color = mixHex(getHeroCardPartColor(visual, r[4]), "#f0e4c9", 0.16);
        px(r[0], r[1], r[2], 1, color);
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

    function refreshHeroCardSprites() {
      if (!heroSelectRefs || !heroSelectRefs.cards) return;
      const cards = heroSelectRefs.cards.querySelectorAll(".hero-card");
      cards.forEach((card) => {
        const idx = Number(card.dataset.heroIndex || "0");
        const hero = getHeroAt(idx);
        const icon = card.querySelector("canvas");
        if (!hero || !icon) return;
        drawHeroCardSprite(icon, hero);
      });
    }

    function refreshHeroCardActiveState() {
      if (!heroSelectRefs || !heroSelectRefs.cards) return;
      const cards = heroSelectRefs.cards.querySelectorAll(".hero-card");
      cards.forEach((card) => {
        const idx = Number(card.dataset.heroIndex || "0");
        card.classList.toggle("active", idx === heroSelectState.selectedIndex);
      });
    }    function updateHeroSelectDetail() {
      if (!heroSelectRefs) return;
      const hero = getHeroAt(heroSelectState.selectedIndex);
      if (!hero) return;
      const attrs = hero.attributes || {};
      const portraitSources = getPortraitSourcesForHero(hero);
      const portraitSrc = portraitSources.find((src) => String(src || "").trim()) || "";
      const portraitId = getPortraitLabelFromSource(portraitSrc, 0);

      heroSelectRefs.name.textContent = hero.name || hero.id || "未命名主角";
      heroSelectRefs.meta.innerHTML = [
        `伤害: <b>${attrs.attack ?? "-"}</b>`,
        `攻击间隔: <b>${attrs.shot_interval_ms ?? "-"}ms</b>`,
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

      drawHeroPortrait(heroSelectRefs.portraitCanvas, hero, portraitId, portraitSrc);
      refreshHeroCardActiveState();
    }

    function previewHeroSelectIndex(index) {
      const heroes = getAvailableHeroes();
      if (!heroes.length) return;
      const normalized = ((index % heroes.length) + heroes.length) % heroes.length;
      heroSelectState.selectedIndex = normalized;
      if (typeof setCurrentHeroIndex === "function") setCurrentHeroIndex(normalized);
      applyCurrentHeroAttributesToState(false);
      updateHeroSelectDetail();
    }

    function startGameWithHero(index) {
      const heroes = getAvailableHeroes();
      if (!heroes.length) {
        state.gameOver = false;
        holdFireState.isHeld = false;
        state.gameStarted = true;
        hideGameOverOverlay();
        return;
      }

      const normalized = ((index % heroes.length) + heroes.length) % heroes.length;
      if (typeof setCurrentHeroIndex === "function") setCurrentHeroIndex(normalized);
      heroSelectState.selectedIndex = normalized;

      state.gameOver = false;
      holdFireState.isHeld = false;
      hideGameOverOverlay();
      resetRunStateForNewGame(performance.now());

      state.gameStarted = true;
      Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });
      if (heroSelectRefs && heroSelectRefs.overlay) heroSelectRefs.overlay.classList.add("hidden");
      ensureAudioContext();
    }    function initHeroSelectOverlay() {
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

      refreshHeroCardSprites();

      if (!heroVisualEventBound && typeof window !== "undefined") {
        window.addEventListener("hero-visual-updated", () => {
          refreshHeroCardSprites();
          updateHeroSelectDetail();
        });
        heroVisualEventBound = true;
      }

      refs.startBtn.onclick = () => startGameWithHero(heroSelectState.selectedIndex);

      refs.overlay.classList.remove("hidden");
      heroSelectState.selectedIndex = state.player.heroIndex || 0;
      heroSelectState.portraitIndex = 0;
      previewHeroSelectIndex(heroSelectState.selectedIndex);
    }

    function ensureGameOverUI() {
      if (gameOverRefs) return gameOverRefs;

      if (!document.getElementById("gameOverStyle")) {
        const style = document.createElement("style");
        style.id = "gameOverStyle";
        style.textContent = `
#gameOverOverlay {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: grid;
  place-items: center;
  background: rgba(7, 11, 18, 0.76);
}

#gameOverOverlay.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.game-over-panel {
  width: min(420px, 92vw);
  border: 1px solid #4a5f7f;
  border-radius: 12px;
  background: linear-gradient(165deg, #1f2034, #181b2b);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.46);
  padding: 18px;
  text-align: center;
}

.game-over-title {
  margin: 0;
  color: #ff637b;
  font-size: 38px;
  letter-spacing: 1px;
}

.game-over-sub {
  margin: 8px 0 16px;
  color: #a6b8d6;
  font-size: 13px;
}

#gameOverBackBtn {
  min-width: 180px;
  height: 40px;
  border: 1px solid #5a7498;
  border-radius: 8px;
  background: linear-gradient(180deg, #253556, #1b2740);
  color: #f4dbaf;
  font-size: 16px;
  cursor: pointer;
}

#gameOverBackBtn:hover {
  border-color: #f2ce93;
}
`;
        document.head.appendChild(style);
      }

      let overlay = document.getElementById("gameOverOverlay");
      if (!overlay) {
        overlay = document.createElement("section");
        overlay.id = "gameOverOverlay";
        overlay.className = "hidden";
        overlay.innerHTML = `
<div class="game-over-panel">
  <h2 class="game-over-title">Game Over</h2>
  <p class="game-over-sub">生命耗尽。返回主界面后可重新选择角色开始。</p>
  <button type="button" id="gameOverBackBtn">回主界面</button>
</div>`;
        document.body.appendChild(overlay);
      }

      gameOverRefs = {
        overlay,
        backBtn: document.getElementById("gameOverBackBtn"),
      };

      if (gameOverRefs.backBtn) {
        gameOverRefs.backBtn.addEventListener("click", () => {
          returnToMainMenuFromGameOver();
        });
      }

      return gameOverRefs;
    }

    function showGameOverOverlay() {
      const refs = ensureGameOverUI();
      if (!refs || !refs.overlay) return;
      refs.overlay.classList.remove("hidden");
    }

    function hideGameOverOverlay() {
      if (!gameOverRefs || !gameOverRefs.overlay) return;
      gameOverRefs.overlay.classList.add("hidden");
    }

    function resetRunStateForNewGame(now) {
      const startAt = Number.isFinite(Number(now)) ? Number(now) : performance.now();

      state.player.x = WORLD_W * 0.5;
      state.player.y = WORLD_H * 0.5;
      state.player.lastHitAt = -10000;
      state.player.levelUpUntil = 0;
      state.player.shockwaveStartedAt = 0;
      state.player.shockwaveUntil = 0;
      state.player.shockwaveDurationMs = 0;
      state.player.shockwaveVisualRadiusPx = 0;
      state.player.isMoving = false;
      state.player.markedTargetIds = [];

      state.progress.level = 1;
      state.progress.xpInLevel = 0;
      state.progress.totalXp = 0;

      state.upgrades.pendingChoices = [];
      state.upgrades.isChoosing = false;
      state.upgrades.queuedLevelUps = 0;
      state.upgrades.selectedChoiceId = "";
      state.upgrades.treeLevels = {};
      state.upgrades.treeSelectedNodes = {};
      state.upgrades.selectedNodeIds = [];
      state.upgrades.statBonuses = {};
      state.upgrades.runtimeEffects = {
        trailFlame: null,
        periodicShockwave: null,
        stationaryFreeShotChance: 0,
        executeLowHpThreshold: 0,
        deadeyeMarks: null,
        pierceDeadEnemies: false,
        reloadDamageBoost: null,
        reloadKillStack: null,
      };
      closeUpgradeSelectionOverlay();

      state.weapon.isReloading = false;
      state.weapon.reloadStart = 0;
      state.weapon.currentReloadDuration = state.weapon.reloadDuration;
      state.weapon.bulletSize = Math.max(0.5, Number(state.weapon.baseBulletSize) || 1);
      state.weapon.bulletKnockback = Math.max(0, Number(state.weapon.baseBulletKnockback) || 1);
      state.weapon.bulletPierce = Math.max(0, Math.floor(Number(state.weapon.baseBulletPierce) || 0));
      state.weapon.magazineSize = Math.max(1, Math.floor(Number(state.weapon.baseMagazineSize) || 12));
      state.weapon.ammo = state.weapon.magazineSize;
      state.weapon.lastFireAt = startAt - state.weapon.fireCooldown;
      state.weapon.lastShotAt = startAt;

      state.bullets = [];
      state.orbs = [];
      state.floatingDamage = [];
      state.hitMarkers = [];
      state.flameTrails = [];
      state.tentacles = [];
      state.nextTentacleId = 1;
      state.lastDamage = null;
      state.inContact = false;

      state.trees = generateTrees();
      initGoblins(startAt);
      applyCurrentHeroAttributesToState(true);
    }

    function returnToMainMenuFromGameOver() {
      hideGameOverOverlay();
      state.gameOver = false;
      holdFireState.isHeld = false;
      state.gameStarted = false;
      Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });

      resetRunStateForNewGame(performance.now());

      if (heroSelectRefs && heroSelectRefs.overlay) heroSelectRefs.overlay.classList.remove("hidden");
      previewHeroSelectIndex(state.player.heroIndex || 0);
    }

    function triggerGameOver(now) {
      if (state.gameOver) return;
      state.player.hp = 0;
      holdFireState.isHeld = false;
      state.gameOver = true;
      state.gameStarted = false;
      Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });

      state.weapon.isReloading = false;
      state.upgrades.pendingChoices = [];
      state.upgrades.isChoosing = false;
      state.upgrades.queuedLevelUps = 0;
      state.upgrades.selectedChoiceId = "";
      closeUpgradeSelectionOverlay();

      showGameOverOverlay();
    }

    function getKnockbackDurationMs() {
      return Math.max(1, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDurationMs) || 320);
    }

    function getKnockbackDistancePx() {
      return Math.max(0, Number(COMBAT_TUNING && COMBAT_TUNING.goblinKnockbackDistancePx) || 100);
    }

    function startGoblinKnockback(goblin, now, distancePx, durationMs, dirXOverride, dirYOverride) {
      if (!goblin || !goblin.alive) return;

      let dx = Number(dirXOverride);
      let dy = Number(dirYOverride);
      let dist = Math.hypot(dx, dy);

      if (!Number.isFinite(dx) || !Number.isFinite(dy) || dist < 0.001) {
        dx = wrapDelta(goblin.x - state.player.x, WORLD_W);
        dy = wrapDelta(goblin.y - state.player.y, WORLD_H);
        dist = Math.hypot(dx, dy);
      }

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

    function markShockwaveVisual(now, durationMs, radiusPx) {
      state.player.shockwaveStartedAt = now;
      state.player.shockwaveUntil = now + durationMs;
      state.player.shockwaveDurationMs = durationMs;
      state.player.shockwaveVisualRadiusPx = radiusPx;
    }

    function triggerPlayerShockwave(now, options) {
      const opts = options && typeof options === "object" ? options : {};
      const maxDistancePx = Math.max(0, Number(opts.knockbackDistancePx) || getKnockbackDistancePx());
      const durationMs = Math.max(1, Number(opts.durationMs) || getKnockbackDurationMs());
      const radiusLimitPx = Number(opts.radiusPx);
      const visualRadiusPx = Math.max(
        0,
        Number(opts.visualRadiusPx) || (Number.isFinite(radiusLimitPx) && radiusLimitPx > 0 ? radiusLimitPx : maxDistancePx)
      );

      markShockwaveVisual(now, durationMs, visualRadiusPx);

      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) continue;

        const dx = wrapDelta(g.x - state.player.x, WORLD_W);
        const dy = wrapDelta(g.y - state.player.y, WORLD_H);
        const dist = Math.hypot(dx, dy);

        let knockbackDistancePx = maxDistancePx;
        if (Number.isFinite(radiusLimitPx) && radiusLimitPx > 0) {
          if (dist > radiusLimitPx) continue;
          knockbackDistancePx *= Math.max(0, 1 - dist / radiusLimitPx);
        }

        if (knockbackDistancePx <= 0.5) continue;
        startGoblinKnockback(g, now, knockbackDistancePx, durationMs);
      }
    }

    function spawnTrailFlame(now, effect) {
      if (!effect) return;
      state.flameTrails.push({
        x: state.player.x,
        y: state.player.y,
        bornAt: now,
        expiresAt: now + effect.durationMs,
        radiusPx: effect.radiusPx,
        seed: rand() * Math.PI * 2,
      });
      if (state.flameTrails.length > 96) state.flameTrails.splice(0, state.flameTrails.length - 96);
    }

    function updateTrailFlameEmitter(now) {
      const runtime = getUpgradeRuntimeEffects();
      const effect = runtime.trailFlame;
      if (!effect) return;

      if (!Number.isFinite(effect.nextSpawnAt) || effect.nextSpawnAt < now - effect.spawnIntervalMs) {
        effect.nextSpawnAt = now;
      }

      while (effect.nextSpawnAt <= now) {
        spawnTrailFlame(effect.nextSpawnAt, effect);
        effect.nextSpawnAt += effect.spawnIntervalMs;
      }
    }

    function updatePeriodicShockwave(now) {
      const runtime = getUpgradeRuntimeEffects();
      const effect = runtime.periodicShockwave;
      if (!effect) return;

      if (!Number.isFinite(effect.nextTriggerAt)) effect.nextTriggerAt = now + effect.intervalMs;
      while (now >= effect.nextTriggerAt) {
        triggerPlayerShockwave(effect.nextTriggerAt, {
          radiusPx: effect.radiusPx,
          visualRadiusPx: effect.radiusPx,
          knockbackDistancePx: effect.knockbackDistancePx,
          durationMs: effect.durationMs,
        });
        effect.nextTriggerAt += effect.intervalMs;
      }
    }

    function updatePlayer(dt, now) {
      let mx = 0;
      let my = 0;
      if (state.keys.KeyW) my -= 1;
      if (state.keys.KeyS) my += 1;
      if (state.keys.KeyA) mx -= 1;
      if (state.keys.KeyD) mx += 1;
      if (mx === 0 && my === 0) {
        state.player.isMoving = false;
        return;
      }

      const prevX = state.player.x;
      const prevY = state.player.y;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;

      const moveSpeed = state.player.speed * (isHoldFireSlowActive() ? FIRE_MOVE_MULTIPLIER : 1);

      const tryX = wrap(state.player.x + mx * moveSpeed * dt, WORLD_W);
      if (!collidesWithAnyTree(tryX, state.player.y)) state.player.x = tryX;

      const tryY = wrap(state.player.y + my * moveSpeed * dt, WORLD_H);
      if (!collidesWithAnyTree(state.player.x, tryY)) state.player.y = tryY;

      const movedDist = Math.hypot(
        wrapDelta(state.player.x - prevX, WORLD_W),
        wrapDelta(state.player.y - prevY, WORLD_H)
      );
      state.player.isMoving = movedDist > 0.25;
      if (state.player.isMoving) updateTrailFlameEmitter(now);
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
      goblin.trailFlameDamageAt = 0;
    }

    function killGoblin(goblin, now) {
      const deathX = goblin.x;
      const deathY = goblin.y;
      goblin.alive = false;
      goblin.knockback = null;
      goblin.trailFlameDamageAt = 0;
      goblin.respawnAt = now + 1400 + Math.floor(rand() * 400);
      state.orbs.push({ x: deathX, y: deathY, seed: rand() * Math.PI * 2 });
      handleGoblinKilled(now);
      if (getCurrentHeroIdForUpgrade() === "hunter") {
        state.tentacles.push(createTentacle(deathX, deathY, now));
      }
    }

    function damageGoblin(goblin, damage, now) {
      if (!goblin || !goblin.alive) return false;

      const amount = Math.max(1, Math.floor((Number(damage) || 0) * getCurrentDamageMultiplier(now)));
      if (!amount) return false;

      goblin.hp -= amount;
      goblin.hitFlashUntil = now + 120;
      pushFloatingDamage(goblin.x, goblin.y - 9, amount);

      const runtime = getUpgradeRuntimeEffects();
      const executeThreshold = Math.max(0, Math.min(1, Number(runtime.executeLowHpThreshold) || 0));
      if (goblin.hp <= 0) killGoblin(goblin, now);
      else if (executeThreshold > 0 && goblin.hp <= goblin.maxHp * executeThreshold) killGoblin(goblin, now);
      return true;
    }
    function updateTrailFlames(now) {
      const activeFlames = [];
      for (let i = 0; i < state.flameTrails.length; i += 1) {
        const flame = state.flameTrails[i];
        if (flame && flame.expiresAt > now) activeFlames.push(flame);
      }
      state.flameTrails = activeFlames;

      const runtime = getUpgradeRuntimeEffects();
      const effect = runtime.trailFlame;
      if (!effect || !activeFlames.length) return;

      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) continue;

        let touched = false;
        for (let j = 0; j < activeFlames.length; j += 1) {
          const flame = activeFlames[j];
          const dx = wrapDelta(g.x - flame.x, WORLD_W);
          const dy = wrapDelta(g.y - flame.y, WORLD_H);
          if (Math.hypot(dx, dy) <= flame.radiusPx) {
            touched = true;
            break;
          }
        }

        if (!touched) continue;
        if (!Number.isFinite(g.trailFlameDamageAt) || now >= g.trailFlameDamageAt) {
          if (damageGoblin(g, effect.damage, now)) g.trailFlameDamageAt = now + effect.tickMs;
        }
      }
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
        const speed = 36;

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
            const damage = 1;
            state.lastDamage = damage;
            state.player.lastHitAt = now;
            state.player.hp = Math.max(0, (state.player.hp || 0) - damage);
            g.cooldownUntil = now + 900;
            pushFloatingDamage(state.player.x, state.player.y - 8, damage);
            if (state.player.hp <= 0) {
              triggerGameOver(now);
              return;
            }
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
      const sampleRadius = Math.max(0.6, Number(bullet && bullet.size) || 1);
      const samples = [
        [0, 0],
        [-sampleRadius, 0],
        [sampleRadius, 0],
        [0, -sampleRadius],
        [0, sampleRadius],
        [-sampleRadius * 0.7, -sampleRadius * 0.7],
        [sampleRadius * 0.7, -sampleRadius * 0.7],
        [-sampleRadius * 0.7, sampleRadius * 0.7],
        [sampleRadius * 0.7, sampleRadius * 0.7],
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
        if (!bullet.hitGoblinIds || typeof bullet.hitGoblinIds !== "object") bullet.hitGoblinIds = {};

        let consumed = false;
        for (let j = 0; j < state.goblins.length; j += 1) {
          const g = state.goblins[j];
          if (!g.alive || bullet.hitGoblinIds[g.id]) continue;

          const hitGoblin = bulletHitsGoblinSprite(bullet, g, now);
          if (!hitGoblin) continue;

          bullet.hitGoblinIds[g.id] = true;
          const headshot = rollBaronHeadshotEffect();
          const damageMultiplier = headshot ? headshot.damageMultiplier : 1;
          const damage = Math.max(1, Math.floor(Number(bullet.damage) || 5) * damageMultiplier);
          if (headshot) pushHitMarker(g.x, g.y - 10, headshot.markerType, now);
          damageGoblin(g, damage, now);

          if (g.alive && (Number(bullet.knockbackDistancePx) || 0) > 0.5) {
            const bulletLen = Math.hypot(Number(bullet.vx) || 0, Number(bullet.vy) || 0) || 1;
            startGoblinKnockback(
              g,
              now,
              Number(bullet.knockbackDistancePx) || 0,
              getKnockbackDurationMs(),
              (Number(bullet.vx) || 0) / bulletLen,
              (Number(bullet.vy) || 0) / bulletLen
            );
          }

          if (!g.alive && bullet.pierceDeadEnemies) {
            continue;
          }

          if ((Number(bullet.pierceRemaining) || 0) > 0) {
            bullet.pierceRemaining -= 1;
            continue;
          }

          consumed = true;
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

    function collectDeadeyeTargets() {
      const runtime = getUpgradeRuntimeEffects();
      const effect = runtime.deadeyeMarks;
      if (!effect) return [];

      const candidates = [];
      for (let i = 0; i < state.goblins.length; i += 1) {
        const g = state.goblins[i];
        if (!g.alive) continue;

        const dx = wrapDelta(g.x - state.player.x, WORLD_W);
        const dy = wrapDelta(g.y - state.player.y, WORLD_H);
        const dist = Math.hypot(dx, dy);
        if (dist > effect.radiusPx) continue;
        candidates.push({ goblin: g, dist });
      }

      candidates.sort((a, b) => a.dist - b.dist || a.goblin.id - b.goblin.id);
      return candidates.slice(0, effect.maxTargets).map((entry) => entry.goblin);
    }

    function updateDeadeyeMarks() {
      state.player.markedTargetIds = collectDeadeyeTargets().map((g) => g.id);
    }

    function getDeadeyeAimPoint(goblin) {
      return {
        x: goblin.x,
        y: wrap(goblin.y - 10, WORLD_H),
      };
    }

    function screenToWorldPoint(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const sx = ((clientX - rect.left) / rect.width) * W;
      const sy = ((clientY - rect.top) / rect.height) * H;
      const cam = (typeof getCameraDistance === "function") ? getCameraDistance() : 1;
      const dx = (sx - CX) * cam;
      const dy = (sy - CY) * cam;
      const len = Math.hypot(dx, dy);
      return {
        screenX: sx,
        screenY: sy,
        dirX: len > 0.001 ? dx / len : 0,
        dirY: len > 0.001 ? dy / len : 0,
        dirLen: len,
        worldX: wrap(state.player.x + dx, WORLD_W),
        worldY: wrap(state.player.y + dy, WORLD_H),
      };
    }

    function createTentacle(worldX, worldY, now) {
      const config = getTentacleSummonConfig();
      const nextId = Math.max(1, Math.floor(Number(state.nextTentacleId) || 1));
      state.nextTentacleId = nextId + 1;
      return {
        id: nextId,
        x: wrap(worldX, WORLD_W),
        y: wrap(worldY, WORLD_H),
        bornAt: now,
        expiresAt: now + config.lifetimeMs,
        nextAttackAt: now + config.attackIntervalMs,
        attackStartedAt: now - config.attackAnimMs,
        attackAnimUntil: 0,
        attackPose: 0,
        swaySeed: rand() * Math.PI * 2,
        idleFrameOffset: Math.floor(rand() * 6),
        attackDirX: 0,
        attackDirY: -1,
        attackDistancePx: 0,
        lastAttackTargetId: 0,
      };
    }

    function summonTentacleAtClientPoint(clientX, clientY, now) {
      const point = screenToWorldPoint(clientX, clientY);
      if (!point) return false;

      state.tentacles.push(createTentacle(point.worldX, point.worldY, now));
      state.player.lastShotDirX = point.dirLen > 0.001 ? point.dirX : 0;
      state.player.lastShotDirY = point.dirLen > 0.001 ? point.dirY : -1;
      return true;
    }

    function updateTentacles(now) {
      if (!Array.isArray(state.tentacles) || !state.tentacles.length) return;

      const config = getTentacleSummonConfig();
      const nextTentacles = [];
      for (let i = 0; i < state.tentacles.length; i += 1) {
        const tentacle = state.tentacles[i];
        if (!tentacle || tentacle.expiresAt <= now) continue;

        if (now >= tentacle.nextAttackAt) {
          let target = null;
          let bestDist = Infinity;
          for (let j = 0; j < state.goblins.length; j += 1) {
            const goblin = state.goblins[j];
            if (!goblin.alive) continue;
            const dx = wrapDelta(goblin.x - tentacle.x, WORLD_W);
            const dy = wrapDelta(goblin.y - tentacle.y, WORLD_H);
            const dist = Math.hypot(dx, dy);
            if (dist > config.attackRadiusPx) continue;
            if (dist < bestDist) {
              bestDist = dist;
              target = goblin;
            }
          }

          if (target) {
            const attackDx = wrapDelta(target.x - tentacle.x, WORLD_W);
            const attackDy = wrapDelta(target.y - tentacle.y, WORLD_H);
            const attackDist = Math.hypot(attackDx, attackDy);
            damageGoblin(target, state.weapon.bulletDamage, now);
            tentacle.attackStartedAt = now;
            tentacle.attackAnimUntil = now + config.attackAnimMs;
            tentacle.attackPose = (tentacle.attackPose + 1) % 2;
            tentacle.attackDirX = attackDist > 0.001 ? attackDx / attackDist : 0;
            tentacle.attackDirY = attackDist > 0.001 ? attackDy / attackDist : -1;
            tentacle.attackDistancePx = Math.min(config.attackReachPx, Math.max(28, attackDist + 8));
            tentacle.lastAttackTargetId = target.id;
          }

          tentacle.nextAttackAt = now + config.attackIntervalMs;
        }

        nextTentacles.push(tentacle);
      }

      state.tentacles = nextTentacles;
    }

    function spawnBulletBurst(dirX, dirY, now, count, spreadRad, speed, damage, pierceRemaining, bulletSize, knockbackDistancePx, pierceDeadEnemies) {
      for (let i = 0; i < count; i += 1) {
        const offset = count === 1
          ? 0
          : ((i - (count - 1) * 0.5) / Math.max(1, count - 1)) * spreadRad;

        const cosO = Math.cos(offset);
        const sinO = Math.sin(offset);
        const shotDirX = dirX * cosO - dirY * sinO;
        const shotDirY = dirX * sinO + dirY * cosO;

        state.bullets.push({
          x: state.player.x + shotDirX * 7,
          y: state.player.y + shotDirY * 7,
          vx: shotDirX * speed,
          vy: shotDirY * speed,
          born: now,
          damage,
          size: Math.max(0.5, Number(bulletSize) || 1),
          knockbackDistancePx: Math.max(0, Number(knockbackDistancePx) || 0),
          pierceDeadEnemies: Boolean(pierceDeadEnemies),
          pierceRemaining,
          hitGoblinIds: {},
        });
      }
    }

    function shootAtClientPoint(clientX, clientY, nowOverride) {
      if (isUpgradeSelectionOpen()) return;
      setHoldFirePointer(clientX, clientY);
      const now = Number.isFinite(Number(nowOverride)) ? Number(nowOverride) : performance.now();
      const w = state.weapon;
      if (w.isReloading || w.ammo <= 0) return;
      if (now - w.lastFireAt < w.fireCooldown) return;

      if (isTentacleSummonMode()) {
        const summoned = summonTentacleAtClientPoint(clientX, clientY, now);
        if (!summoned) return;
        w.ammo -= 1;
        w.lastShotAt = now;
        w.lastFireAt = now;
        if (w.ammo <= 0) startReload(now);
        return;
      }

      const point = screenToWorldPoint(clientX, clientY);
      if (!point || point.dirLen < 2) return;

      const dirX = point.dirX;
      const dirY = point.dirY;
      const speed = Number(w.bulletSpeed) > 0 ? Number(w.bulletSpeed) : 260;
      const count = Math.max(1, Math.floor(Number(w.bulletCount) || 1));
      const spreadRad = (Number(w.bulletSpreadDeg) || 0) * (Math.PI / 180);
      const damage = Math.max(1, Math.floor(Number(w.bulletDamage) || 5));
      const bulletSize = Math.max(0.5, Number(w.bulletSize) || 1);
      const knockbackDistancePx = Math.max(0, getKnockbackDistancePx() * (Number(w.bulletKnockback) || 1));
      const pierceRemaining = Math.max(0, Math.floor(Number(w.bulletPierce) || 0));
      const runtime = getUpgradeRuntimeEffects();
      const pierceDeadEnemies = Boolean(runtime.pierceDeadEnemies);

      spawnBulletBurst(dirX, dirY, now, count, spreadRad, speed, damage, pierceRemaining, bulletSize, knockbackDistancePx, pierceDeadEnemies);

      const markedTargets = collectDeadeyeTargets();
      state.player.markedTargetIds = markedTargets.map((g) => g.id);
      for (let i = 0; i < markedTargets.length; i += 1) {
        const target = markedTargets[i];
        const aimPoint = getDeadeyeAimPoint(target);
        const tx = wrapDelta(aimPoint.x - state.player.x, WORLD_W);
        const ty = wrapDelta(aimPoint.y - state.player.y, WORLD_H);
        const tLen = Math.hypot(tx, ty);
        if (tLen < 0.001) continue;
        spawnBulletBurst(tx / tLen, ty / tLen, now, 1, 0, speed, damage, pierceRemaining, bulletSize, knockbackDistancePx, pierceDeadEnemies);
      }
      state.player.lastShotDirX = dirX;
      state.player.lastShotDirY = dirY;

      const freeShotChance = Math.max(0, Math.min(1, Number(runtime.stationaryFreeShotChance) || 0));
      const shouldSpendAmmo = !(freeShotChance > 0 && !state.player.isMoving && rand() < freeShotChance);
      if (shouldSpendAmmo) w.ammo -= 1;
      w.lastShotAt = now;
      w.lastFireAt = now;
      if (w.ammo <= 0) startReload(now);
    }

    function updateWorld(dt, now) {
      if (isUpgradeSelectionOpen()) return;
      updateHoldFire(now);
      updatePlayer(dt, now);
      updatePeriodicShockwave(now);
      updateGoblins(dt, now);
      updateTentacles(now);
      updateDeadeyeMarks();
      updateTrailFlames(now);
      updateBullets(dt, now);
      updateOrbs(dt, now);
      updateWeapon(now);
    }

    function drawFlameTrails(now) {
      if (!Array.isArray(state.flameTrails) || !state.flameTrails.length) return;

      for (let i = 0; i < state.flameTrails.length; i += 1) {
        const flame = state.flameTrails[i];
        const lifetime = Math.max(1, flame.expiresAt - flame.bornAt);
        const remain = Math.max(0, flame.expiresAt - now);
        const life = Math.max(0, Math.min(1, remain / lifetime));
        const flicker = Math.sin(now * 0.025 + flame.seed) * 0.5 + 0.5;
        const p = worldToScreen(flame.x, flame.y);
        const outer = Math.max(3, Math.round(flame.radiusPx * (0.45 + life * 0.3)));
        const core = Math.max(2, Math.round(outer * (0.45 + flicker * 0.2)));

        px(p.x - outer, p.y - 1, outer * 2, 3, `rgba(138,48,18,${(0.2 + life * 0.16).toFixed(3)})`);
        px(p.x - outer + 1, p.y - 2, Math.max(2, outer * 2 - 2), 4, `rgba(255,118,44,${(0.2 + life * 0.22).toFixed(3)})`);
        px(p.x - core, p.y - 3, core * 2, 5, `rgba(255,206,102,${(0.22 + life * 0.3).toFixed(3)})`);
        if (flicker > 0.42) px(p.x - 1, p.y - 4, 2, 2, `rgba(255,242,188,${(0.3 + life * 0.34).toFixed(3)})`);
      }
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
      if (ui.ammoHudMax) ui.ammoHudMax.textContent = `/${state.weapon.magazineSize}`;
      const maxHp = Math.max(1, Math.floor(state.player.maxHp || 1));
      const curHp = Math.max(0, Math.floor(state.player.hp || 0));
      const totalHearts = maxHp;
      const filledHearts = Math.max(0, Math.min(totalHearts, curHp));

      if (ui.hpFilled) ui.hpFilled.textContent = "♥".repeat(filledHearts);
      if (ui.hpEmpty) ui.hpEmpty.textContent = "♡".repeat(Math.max(0, totalHearts - filledHearts));
      if (ui.hpVal) {
        ui.hpVal.textContent = "";
        ui.hpVal.style.display = "none";
      }
      if (ui.knockbackDurationVal) ui.knockbackDurationVal.textContent = `${Math.round(getKnockbackDurationMs())}`;
      if (ui.knockbackDistanceVal) ui.knockbackDistanceVal.textContent = `${Math.round(getKnockbackDistancePx())}`;


      if (state.weapon.isReloading) {
        const activeReloadDuration = Math.max(100, Number(state.weapon.currentReloadDuration) || Number(state.weapon.reloadDuration) || 2000);
        const p = Math.max(0, Math.min(1, (now - state.weapon.reloadStart) / activeReloadDuration));
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
      drawFlameTrails(now);
      drawOrbs(now);
      drawActors(now);
      drawMarkedTargets(now);
      drawShockwave(now);
      drawReloadBar(now);
      drawBullets();
      drawFloatingDamage(now);
      drawHitMarkers(now);
      drawVignette();
      drawBlurLayers();
      updatePanel(now);
    }
    function syncUI() {
      const top = Number(ui.topRange.value);
      const bottom = Number(ui.bottomRange.value);
      if (bottom <= top + 6) ui.bottomRange.value = top + 6;
      const camRaw = ui.cameraDistanceRange ? Number(ui.cameraDistanceRange.value) : 0.22;
      const cam = Math.max(0.18, Math.min(1.2, Number.isFinite(camRaw) ? camRaw : 0.22));

      document.documentElement.style.setProperty("--focus-top", `${ui.topRange.value}%`);
      document.documentElement.style.setProperty("--focus-bottom", `${ui.bottomRange.value}%`);
      ui.blurVal.textContent = `${Number(ui.blurRange.value).toFixed(1)}px`;
      ui.topVal.textContent = `${ui.topRange.value}%`;
      ui.bottomVal.textContent = `${ui.bottomRange.value}%`;
      if (ui.cameraDistanceRange) ui.cameraDistanceRange.value = cam.toFixed(2);
      if (typeof setCameraDistance === "function") setCameraDistance(cam);
      if (ui.cameraDistanceVal) ui.cameraDistanceVal.textContent = `${cam.toFixed(2)}x`;
    }

    [ui.blurRange, ui.topRange, ui.bottomRange, ui.cameraDistanceRange].filter(Boolean).forEach((input) => {
      input.addEventListener("input", syncUI);
    });

    window.addEventListener("keydown", (e) => {
      if (state.gameOver) {
        e.preventDefault();
        return;
      }
      if (state.gameStarted && isUpgradeSelectionOpen()) {
        if (/^Digit[1-4]$/.test(e.code)) {
          const slot = Number(e.code.replace("Digit", "")) - 1;
          setUpgradeSelectionIndex(slot);
          commitSelectedUpgradeChoice();
          e.preventDefault();
          return;
        }

        if (e.code === "Enter" || e.code === "NumpadEnter") {
          commitSelectedUpgradeChoice();
          e.preventDefault();
          return;
        }

        if (e.code in state.keys) {
          e.preventDefault();
          return;
        }
      }

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
        if (!state.gameStarted || isUpgradeSelectionOpen()) return;
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
      holdFireState.isHeld = false;
    });

    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!state.gameStarted || state.gameOver || isUpgradeSelectionOpen()) return;
      holdFireState.isHeld = !isTentacleSummonMode();
      setHoldFirePointer(e.clientX, e.clientY);
      ensureAudioContext();
      shootAtClientPoint(e.clientX, e.clientY);
      e.preventDefault();
    });

    viewport.addEventListener("mousemove", (e) => {
      if (!state.gameStarted) return;
      setHoldFirePointer(e.clientX, e.clientY);
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      holdFireState.isHeld = false;
    });

        let last = performance.now();
    let loopStarted = false;
    let runtimeLoopErrorLogged = false;

    function startLoopOnce() {
      if (loopStarted) return;
      loopStarted = true;
      last = performance.now();
      requestAnimationFrame(loop);
    }

    function fallbackStartGame(err) {
      if (err) console.error("[bootstrap] 初始化失败，已回退到直接开局模式", err);
      state.gameOver = false;
      holdFireState.isHeld = false;
      state.gameStarted = true;
      hideGameOverOverlay();
      startLoopOnce();
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      try {
        if (state.gameStarted) updateWorld(dt, now);
        drawScene(now);
      } catch (err) {
        if (!runtimeLoopErrorLogged) {
          runtimeLoopErrorLogged = true;
          console.error("[loop] 运行时错误", err);
        }
      } finally {
        requestAnimationFrame(loop);
      }
    }

    async function bootstrapGame() {
      syncUI();
      state.trees = generateTrees();
      initGoblins(performance.now());
      applyCurrentHeroAttributesToState(true);
      await loadHeroJsonConfig();
      await loadCombatJsonConfig();
      await loadUpgradeEffectsConfig();
      applyCurrentHeroAttributesToState(true);
      initHeroSelectOverlay();
      startLoopOnce();
    }

    bootstrapGame().catch((err) => {
      fallbackStartGame(err);
    });


























































































































