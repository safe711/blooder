// 6 main-hero configurations for silhouette and palette.
// Edit this file in your thread workspace to iterate hero looks safely.
const HERO_DEFINITIONS = [
  {
    id: "baron",
    name: "夜幕伯爵",
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

function setCurrentHeroIndex(index) {
  if (typeof state === "undefined" || !state.player) return;
  state.player.heroIndex = ((index % HERO_DEFINITIONS.length) + HERO_DEFINITIONS.length) % HERO_DEFINITIONS.length;
}
