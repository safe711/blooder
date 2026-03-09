// 6 main-hero configurations for silhouette + gameplay attributes.
// You can edit this file directly in each thread workspace.
// Attribute schema:
// - attack: base damage per bullet
// - shot_interval_ms: min interval for holding fire (lower = faster)
// - bullet_speed: projectile speed
// - bullet_count: bullets per shot
// - bullet_spread_deg: spread angle for multiple bullets
// - move_speed: base move speed
// - hp: base health
// - portrait_id_a / portrait_id_b: 2 large portrait IDs for character select UI
// - portrait_file_a / portrait_file_b: 2 portrait image files for character select UI
// - passives: multiple passive entries (id + desc)
const HERO_DEFINITIONS = [
  {
    id: "baron",
    name: "夜幕伯爵",
    attributes: {
      attack: 10,
      shot_interval_ms: 500,
      bullet_speed: 260,
      bullet_count: 1,
      bullet_spread_deg: 0,
      move_speed: 132,
      hp: 100,
      portrait_id_a: "baron_portrait_a",
      portrait_id_b: "baron_portrait_b",
      portrait_file_a: "art/hero/johney.png",
      portrait_file_b: "art/hero/生成特定风格角色.png",
      passives: [
        { id: "blood_ledger", desc: "击杀时额外获得1点金币（示例）" },
      ],
    },
    palette: {
      leg: "#1f2740",
      body: "#3d4f7e",
      cape: "#c13f49",
      skin: "#edbb92",
      hair: "#2e1f1a",
      eye: "#f6f1df",
      gear: "#d8d4c9",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -7, 6, 6, "body"],
      [-4, -6, 1, 5, "cape"], [3, -6, 1, 5, "cape"],
      [-4, -12, 8, 5, "skin"],
      [-4, -14, 8, 2, "hair"],
      [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
      [4, -9, 1, 6, "gear"],
    ],
  },
  {
    id: "hunter",
    name: "猎魔枪手",
    attributes: {
      attack: 9,
      shot_interval_ms: 430,
      bullet_speed: 285,
      bullet_count: 1,
      bullet_spread_deg: 0,
      move_speed: 138,
      hp: 92,
      portrait_id_a: "hunter_portrait_a",
      portrait_id_b: "hunter_portrait_b",
      portrait_file_a: "art/hero/生成特定风格角色.png",
      portrait_file_b: "art/hero/johney.png",
      passives: [
        { id: "quick_draw", desc: "换弹结束后首发子弹速度提升（示例）" },
      ],
    },
    palette: {
      leg: "#273049",
      body: "#44546f",
      cape: "#5e4638",
      skin: "#edbc93",
      hair: "#5a3f2f",
      eye: "#f6f1df",
      gear: "#c8b27f",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -7, 6, 6, "body"],
      [-4, -8, 1, 7, "cape"], [3, -7, 1, 6, "cape"],
      [-4, -12, 8, 5, "skin"],
      [-5, -15, 10, 2, "hair"],
      [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
      [4, -9, 2, 2, "gear"], [5, -8, 1, 5, "gear"],
    ],
  },
  {
    id: "duelist",
    name: "银刃决斗者",
    attributes: {
      attack: 8,
      shot_interval_ms: 470,
      bullet_speed: 250,
      bullet_count: 2,
      bullet_spread_deg: 12,
      move_speed: 136,
      hp: 96,
      portrait_id_a: "duelist_portrait_a",
      portrait_id_b: "duelist_portrait_b",
      portrait_file_a: "art/hero/johney.png",
      portrait_file_b: "art/hero/生成特定风格角色.png",
      passives: [
        { id: "echo_round", desc: "每隔数次射击触发一次额外子弹（示例）" },
      ],
    },
    palette: {
      leg: "#243055",
      body: "#4e6aa2",
      cape: "#8e2642",
      skin: "#efbf95",
      hair: "#1f1825",
      eye: "#f6f1df",
      gear: "#d7dde8",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -7, 6, 6, "body"],
      [-4, -6, 1, 4, "cape"], [3, -6, 1, 4, "cape"],
      [-4, -12, 8, 5, "skin"],
      [-4, -14, 8, 2, "hair"],
      [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
      [4, -10, 1, 8, "gear"], [5, -10, 1, 1, "gear"],
    ],
  },
  {
    id: "scholar",
    name: "秘术学者",
    attributes: {
      attack: 11,
      shot_interval_ms: 560,
      bullet_speed: 230,
      bullet_count: 1,
      bullet_spread_deg: 0,
      move_speed: 126,
      hp: 110,
      portrait_id_a: "scholar_portrait_a",
      portrait_id_b: "scholar_portrait_b",
      portrait_file_a: "art/hero/生成特定风格角色.png",
      portrait_file_b: "art/hero/johney.png",
      passives: [
        { id: "arcane_credit", desc: "吸收宝珠时概率回复少量生命（示例）" },
      ],
    },
    palette: {
      leg: "#2a3140",
      body: "#596184",
      cape: "#6b5a86",
      skin: "#ecc098",
      hair: "#3f2b1f",
      eye: "#f6f1df",
      gear: "#b7d3f1",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -8, 6, 7, "body"],
      [-4, -7, 1, 6, "cape"], [3, -7, 1, 6, "cape"],
      [-4, -13, 8, 5, "skin"],
      [-4, -15, 8, 2, "hair"],
      [-1, -11, 1, 1, "eye"], [1, -11, 1, 1, "eye"],
      [4, -9, 2, 2, "gear"], [4, -7, 2, 1, "gear"],
    ],
  },
  {
    id: "nun",
    name: "圣印修女",
    attributes: {
      attack: 9,
      shot_interval_ms: 520,
      bullet_speed: 245,
      bullet_count: 1,
      bullet_spread_deg: 0,
      move_speed: 130,
      hp: 120,
      portrait_id_a: "nun_portrait_a",
      portrait_id_b: "nun_portrait_b",
      portrait_file_a: "art/hero/johney.png",
      portrait_file_b: "art/hero/生成特定风格角色.png",
      passives: [
        { id: "holy_shield", desc: "定时获得一次伤害减免（示例）" },
      ],
    },
    palette: {
      leg: "#253042",
      body: "#4b566f",
      cape: "#31415e",
      skin: "#efc29b",
      hair: "#101720",
      eye: "#f6f1df",
      gear: "#d4c6a0",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -8, 6, 7, "body"],
      [-4, -7, 1, 5, "cape"], [3, -7, 1, 5, "cape"],
      [-4, -13, 8, 5, "skin"],
      [-5, -15, 10, 2, "hair"],
      [-1, -11, 1, 1, "eye"], [1, -11, 1, 1, "eye"],
      [0, -8, 1, 4, "gear"], [-1, -6, 3, 1, "gear"],
    ],
  },
  {
    id: "engineer",
    name: "工坊技师",
    attributes: {
      attack: 7,
      shot_interval_ms: 510,
      bullet_speed: 240,
      bullet_count: 3,
      bullet_spread_deg: 18,
      move_speed: 128,
      hp: 105,
      portrait_id_a: "engineer_portrait_a",
      portrait_id_b: "engineer_portrait_b",
      portrait_file_a: "art/hero/生成特定风格角色.png",
      portrait_file_b: "art/hero/johney.png",
      passives: [
        { id: "turret_credit", desc: "定时生成临时机械支援（示例）" },
      ],
    },
    palette: {
      leg: "#2e3550",
      body: "#56698b",
      cape: "#4f3b2a",
      skin: "#e8b88f",
      hair: "#2d2218",
      eye: "#f6f1df",
      gear: "#d0ab56",
    },
    shadow: [-4, 1, 8, 2],
    rects: [
      [-2, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-3, -7, 6, 6, "body"],
      [-4, -6, 1, 5, "cape"], [3, -6, 1, 5, "cape"],
      [-4, -12, 8, 5, "skin"],
      [-4, -14, 8, 2, "hair"],
      [-1, -10, 1, 1, "eye"], [1, -10, 1, 1, "eye"],
      [4, -9, 2, 2, "gear"], [4, -7, 2, 1, "gear"], [5, -6, 1, 4, "gear"],
    ],
  },
];

function getHeroByIndex(index) {
  if (!HERO_DEFINITIONS.length) return null;
  const i = ((index % HERO_DEFINITIONS.length) + HERO_DEFINITIONS.length) % HERO_DEFINITIONS.length;
  return HERO_DEFINITIONS[i];
}

function getCurrentHeroDefinition() {
  if (typeof state === "undefined" || !state.player) return HERO_DEFINITIONS[0] || null;
  return getHeroByIndex(state.player.heroIndex || 0);
}

function getCurrentHeroAttributes() {
  const hero = getCurrentHeroDefinition();
  return hero ? hero.attributes : null;
}

function getHeroPortraitIds(hero) {
  if (!hero || !hero.attributes) return [];
  const first = hero.attributes.portrait_id_a || `${hero.id || "hero"}_portrait_a`;
  const second = hero.attributes.portrait_id_b || `${hero.id || "hero"}_portrait_b`;
  return [first, second];
}

function getHeroPortraitSources(hero) {
  if (!hero || !hero.attributes) return [];
  const a = hero.attributes.portrait_file_a || "";
  const b = hero.attributes.portrait_file_b || "";
  if (a && b) return [a, b];
  if (a) return [a, a];
  if (b) return [b, b];
  return [];
}

function setCurrentHeroIndex(index) {
  if (typeof state === "undefined" || !state.player) return;
  state.player.heroIndex = ((index % HERO_DEFINITIONS.length) + HERO_DEFINITIONS.length) % HERO_DEFINITIONS.length;
}
