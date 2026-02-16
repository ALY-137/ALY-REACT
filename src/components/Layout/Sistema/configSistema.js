import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../Banco/init-firebase";
import { SYSTEM_THEMES } from "../Temas/themesRegistry";

const SISTEMA_CONFIG_REF = doc(db, "add_ons", "sistema_config");
const TEMAS_SISTEMA_VALIDOS = SYSTEM_THEMES.map((tema) => tema.id);
const TEMA_SISTEMA_FALLBACK = TEMAS_SISTEMA_VALIDOS.includes("ALY_137")
  ? "ALY_137"
  : TEMAS_SISTEMA_VALIDOS[0] || "ALY_137";
const LEGACY_MAP_TEMA_SKIN_TO_SISTEMA = {
  CYBERPINK: "ALY_137",
  SUNSHINE: "LOJA_DE_ROUPAS",
};

export const DEFAULT_SISTEMA_CONFIG = {
  logoLoginUrl: "/logoNeon.png",
  temaPadraoSistema: TEMA_SISTEMA_FALLBACK,
};

function normalizarTemaSistema(tema) {
  if (typeof tema !== "string") {
    return DEFAULT_SISTEMA_CONFIG.temaPadraoSistema;
  }

  const temaUpper = tema.toUpperCase();
  if (TEMAS_SISTEMA_VALIDOS.includes(temaUpper)) {
    return temaUpper;
  }

  if (LEGACY_MAP_TEMA_SKIN_TO_SISTEMA[temaUpper]) {
    return LEGACY_MAP_TEMA_SKIN_TO_SISTEMA[temaUpper];
  }

  return DEFAULT_SISTEMA_CONFIG.temaPadraoSistema;
}

function resolveSystemThemeDefinition(temaSistemaId) {
  const temaSistemaNormalizado = normalizarTemaSistema(temaSistemaId);
  const match = SYSTEM_THEMES.find((tema) => tema.id === temaSistemaNormalizado);
  if (!match) {
    return {
      layoutTheme: "CYBERPINK",
      wallpaper: "/bigSky.jpg",
    };
  }

  return {
    layoutTheme: match.layoutTheme || "CYBERPINK",
    wallpaper: match.wallpaper || "/bigSky.jpg",
  };
}

export function normalizarConfigSistema(data = {}) {
  const logoNormalizada =
    typeof data.logoLoginUrl === "string" && data.logoLoginUrl.trim()
      ? data.logoLoginUrl.trim()
      : DEFAULT_SISTEMA_CONFIG.logoLoginUrl;

  return {
    logoLoginUrl: logoNormalizada,
    temaPadraoSistema: normalizarTemaSistema(data.temaPadraoSistema),
  };
}

export async function obterConfigSistema() {
  const snap = await getDoc(SISTEMA_CONFIG_REF);
  if (!snap.exists()) {
    return { ...DEFAULT_SISTEMA_CONFIG };
  }

  return normalizarConfigSistema(snap.data());
}

export async function salvarConfigSistemaAdmin(configParcial = {}) {
  const configNormalizada = normalizarConfigSistema(configParcial);

  await setDoc(
    SISTEMA_CONFIG_REF,
    {
      ...configNormalizada,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return configNormalizada;
}

export function aplicarTemaNoBody(themeId) {
  if (typeof document === "undefined") return;

  const { layoutTheme, wallpaper } = resolveSystemThemeDefinition(themeId);
  const body = document.body;
  const root = document.documentElement;

  Array.from(body.classList).forEach((className) => {
    if (className.startsWith("theme-")) {
      body.classList.remove(className);
    }
  });

  root.style.setProperty("--system-wallpaper", `url('${wallpaper}')`);
  body.classList.add(`theme-${layoutTheme.toLowerCase()}`);
  import(`../Temas/${layoutTheme.toLowerCase()}.css`).catch(() => {});
}
