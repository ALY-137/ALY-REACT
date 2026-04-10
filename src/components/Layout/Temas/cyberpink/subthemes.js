export const CYBERPINK_SUBTHEME_FALLBACK = "violet";
export const CYBERPINK_SUBTHEME_STORAGE_KEY = "cyberpinkActiveSubtheme";

export const CYBERPINK_SUBTHEMES = [
  { value: "violet", label: "Violeta" },
  { value: "red", label: "Vermelho" },
  { value: "orange", label: "Laranja" },
  { value: "green", label: "Verde" },
  { value: "blue", label: "Blue" },
  { value: "pink", label: "Pink" },
];

export const CYBERPINK_SUBTHEME_ICON_COLORS = {
  violet: "#9335ff",
  red: "#ff5677",
  orange: "#ffa333",
  green: "#27e07b",
  blue: "#46a0ff",
  pink: "#ff3fab",
};

export const CYBERPINK_SUBTHEME_ICON_FILTERS = {
  violet:
    "brightness(0) saturate(100%) invert(23%) sepia(96%) saturate(4142%) hue-rotate(267deg) brightness(103%) contrast(101%)",
  red:
    "brightness(0) saturate(100%) invert(43%) sepia(90%) saturate(2703%) hue-rotate(318deg) brightness(104%) contrast(104%)",
  orange:
    "brightness(0) saturate(100%) invert(65%) sepia(80%) saturate(1826%) hue-rotate(350deg) brightness(104%) contrast(101%)",
  green:
    "brightness(0) saturate(100%) invert(67%) sepia(66%) saturate(600%) hue-rotate(92deg) brightness(97%) contrast(92%)",
  blue:
    "brightness(0) saturate(100%) invert(55%) sepia(95%) saturate(1758%) hue-rotate(189deg) brightness(103%) contrast(101%)",
  pink:
    "brightness(0) saturate(100%) invert(38%) sepia(98%) saturate(3419%) hue-rotate(304deg) brightness(106%) contrast(104%)",
};

const CYBERPINK_SUBTHEME_VALUES = new Set(CYBERPINK_SUBTHEMES.map((item) => item.value));

export function normalizeCyberpinkSubtheme(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return CYBERPINK_SUBTHEME_VALUES.has(normalized)
    ? normalized
    : CYBERPINK_SUBTHEME_FALLBACK;
}

export function getCyberpinkSubthemeLabel(value = "") {
  const normalized = normalizeCyberpinkSubtheme(value);
  return (
    CYBERPINK_SUBTHEMES.find((item) => item.value === normalized)?.label ||
    CYBERPINK_SUBTHEMES[0]?.label ||
    "Violeta"
  );
}

export function getCyberpinkSubthemeIconColor(value = "") {
  const normalized = normalizeCyberpinkSubtheme(value);
  return (
    CYBERPINK_SUBTHEME_ICON_COLORS[normalized] ||
    CYBERPINK_SUBTHEME_ICON_COLORS[CYBERPINK_SUBTHEME_FALLBACK]
  );
}

export function getCyberpinkSubthemeIconFilter(value = "") {
  const normalized = normalizeCyberpinkSubtheme(value);
  return (
    CYBERPINK_SUBTHEME_ICON_FILTERS[normalized] ||
    CYBERPINK_SUBTHEME_ICON_FILTERS[CYBERPINK_SUBTHEME_FALLBACK]
  );
}
