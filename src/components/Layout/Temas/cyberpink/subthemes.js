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
