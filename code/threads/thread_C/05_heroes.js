// 6 main-hero configurations for silhouette + gameplay attributes.
// You can edit this file directly in each thread workspace.
// Attribute schema:
// - attack: base damage per bullet
// - shot_interval_ms: min interval for holding fire (lower = faster)
// - bullet_speed: projectile speed
// - bullet_count: bullets per shot
// - bullet_spread_deg: spread angle for multiple bullets
// - magazine_size: starting magazine capacity
// - attack_mode: bullet (default) or tentacle_summon
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
      magazine_size: 12,
      move_speed: 132,
      hp: 100,
      portrait_id_a: "baron_portrait_a",
      portrait_id_b: "baron_portrait_b",
      portrait_file_a: "art/hero/johney.png",
      portrait_file_b: "art/hero/生成特定风格角色.png",
      passives: [
        { id: "headshot", desc: "爆头：30% 几率造成 2 倍伤害，5% 几率造成 10 倍伤害" },
      ],
    },
    palette: {
      leg: "#202841",
      body: "#425a87",
      cape: "#b64050",
      skin: "#e6b48f",
      hair: "#2a1c1a",
      eye: "#f7f2e1",
      gear: "#c9cfde",
    },
    shadow: [-6, 1, 12, 2],
    rects: [
      [-3, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-4, 0, 2, 1, "gear"], [2, 0, 2, 1, "gear"],
      [-4, -8, 8, 7, "body"],
      [-6, -7, 2, 6, "cape"], [4, -7, 2, 6, "cape"],
      [-5, -2, 1, 2, "cape"], [4, -2, 1, 2, "cape"],
      [-2, -6, 4, 4, "gear"],
      [-4, -13, 8, 5, "skin"],
      [-4, -15, 8, 2, "hair"],
      [-5, -13, 1, 2, "hair"], [4, -13, 1, 2, "hair"],
      [-2, -11, 1, 1, "eye"], [1, -11, 1, 1, "eye"],
      [6, -9, 1, 8, "gear"], [5, -2, 3, 1, "gear"],
      [-1, -8, 2, 1, "cape"],
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
      magazine_size: 1,
      attack_mode: "tentacle_summon",
      move_speed: 138,
      hp: 92,
      portrait_id_a: "hunter_portrait_a",
      portrait_id_b: "hunter_portrait_b",
      portrait_file_a: "art/hero/生成特定风格角色.png",
      portrait_file_b: "art/hero/johney.png",
      passives: [
        { id: "death_tentacle", desc: "每次击杀目标时，会在目标死亡位置召唤一个触须" },
      ],
    },
    palette: {
      leg: "#2a3650",
      body: "#4d6485",
      cape: "#3e6f66",
      skin: "#89a494",
      hair: "#1a2732",
      eye: "#f4f0e0",
      gear: "#6aa59b",
    },
    shadow: [-8, 1, 16, 2],
    rects: [
      [-4, -8, 8, 6, "body"],
      [-5, -14, 10, 6, "skin"],
      [-5, -16, 10, 2, "hair"],
      [-6, -14, 1, 3, "hair"], [5, -14, 1, 3, "hair"],
      [-3, -12, 2, 2, "eye"], [1, -12, 2, 2, "eye"],
      [-2, -11, 1, 1, "hair"], [2, -11, 1, 1, "hair"],
      [-7, -3, 3, 3, "cape"], [-5, -1, 3, 3, "cape"],
      [-2, 0, 3, 3, "cape"], [1, 0, 3, 3, "cape"], [4, -1, 3, 3, "cape"],
      [-1, 2, 2, 1, "gear"],
      [-6, -7, 2, 2, "gear"], [4, -7, 2, 2, "gear"],
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
      magazine_size: 12,
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
      leg: "#27324d",
      body: "#5d7fb8",
      cape: "#c4d5e2",
      skin: "#e8b893",
      hair: "#2a1f34",
      eye: "#f7f3e5",
      gear: "#9da8bc",
    },
    shadow: [-9, 1, 18, 2],
    rects: [
      [-8, -1, 5, 5, "gear"], [3, -1, 5, 5, "gear"],
      [-6, 1, 1, 1, "eye"], [5, 1, 1, 1, "eye"],
      [-4, -4, 8, 2, "body"],
      [-5, -7, 2, 5, "gear"],
      [-3, -8, 6, 5, "cape"],
      [-2, -9, 5, 5, "body"],
      [-3, -14, 6, 5, "skin"],
      [-4, -16, 8, 2, "hair"],
      [-4, -14, 1, 3, "hair"], [3, -14, 1, 3, "hair"],
      [-1, -12, 1, 1, "eye"], [1, -12, 1, 1, "eye"],
      [4, -9, 3, 2, "gear"],
      [-2, 4, 4, 1, "gear"],
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
      magazine_size: 12,
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
      leg: "#273046",
      body: "#55658a",
      cape: "#9cb8d8",
      skin: "#e7bc98",
      hair: "#493222",
      eye: "#f6f3e6",
      gear: "#f1d88e",
    },
    shadow: [-7, 1, 14, 2],
    rects: [
      [-3, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-4, -9, 8, 8, "body"],
      [-8, -9, 3, 6, "cape"], [-6, -7, 2, 5, "cape"],
      [5, -9, 3, 6, "cape"], [4, -7, 2, 5, "cape"],
      [-2, -4, 4, 1, "gear"],
      [-4, -14, 8, 5, "skin"],
      [-4, -16, 8, 2, "hair"],
      [-5, -13, 1, 3, "hair"], [4, -13, 1, 3, "hair"],
      [-1, -12, 1, 1, "eye"], [1, -12, 1, 1, "eye"],
      [-2, -17, 4, 1, "gear"], [-3, -16, 6, 1, "gear"],
      [6, -10, 1, 10, "gear"], [5, -1, 3, 1, "gear"],
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
      magazine_size: 12,
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
      leg: "#232c3f",
      body: "#556380",
      cape: "#2f3d56",
      skin: "#eac19d",
      hair: "#141b27",
      eye: "#f6f2e3",
      gear: "#dfc88f",
    },
    shadow: [-6, 1, 12, 2],
    rects: [
      [-3, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-4, -9, 8, 8, "body"],
      [-6, -8, 2, 7, "cape"], [4, -8, 2, 7, "cape"],
      [-5, -15, 10, 3, "hair"],
      [-5, -12, 2, 3, "hair"], [3, -12, 2, 3, "hair"],
      [-3, -13, 6, 4, "skin"],
      [-1, -12, 1, 1, "eye"], [1, -12, 1, 1, "eye"],
      [0, -9, 1, 5, "gear"], [-1, -8, 3, 1, "gear"],
      [5, -5, 2, 3, "gear"],
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
      magazine_size: 12,
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
      leg: "#2b344f",
      body: "#587093",
      cape: "#6a5034",
      skin: "#e4b68d",
      hair: "#2c251f",
      eye: "#f5f0dd",
      gear: "#d6b158",
    },
    shadow: [-7, 1, 14, 2],
    rects: [
      [-3, -1, 2, 2, "leg"], [1, -1, 2, 2, "leg"],
      [-4, -8, 8, 7, "body"],
      [-5, -7, 1, 6, "cape"], [4, -7, 1, 6, "cape"],
      [-2, -5, 4, 3, "cape"],
      [-4, -13, 8, 5, "skin"],
      [-5, -16, 10, 2, "gear"],
      [-4, -14, 8, 1, "gear"],
      [-3, -11, 6, 1, "gear"],
      [-2, -11, 1, 1, "eye"], [1, -11, 1, 1, "eye"],
      [5, -8, 3, 6, "gear"],
      [7, -6, 1, 7, "gear"], [6, -7, 3, 1, "gear"],
      [-3, -3, 6, 1, "gear"],
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






