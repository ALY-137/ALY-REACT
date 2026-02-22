import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../Banco/init-firebase";
import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
} from "../../Banco/init-firebase";
import { SYSTEM_THEMES } from "../Temas/themesRegistry";
import {
  obterConfigSistemaDoGerenciador,
  salvarConfigSistemaNoGerenciador,
} from "./gerenciadorSistemasApi";

const SISTEMA_CONFIG_REF = doc(db, "add_ons", "sistema_config");
const SISTEMA_CONFIG_CACHE_KEY = "sistemaConfigCacheV1";
const TEMAS_SISTEMA_VALIDOS = SYSTEM_THEMES.map((tema) => tema.id);
const TEMA_SISTEMA_FALLBACK = TEMAS_SISTEMA_VALIDOS.includes("PADRAO_INICIAL")
  ? "PADRAO_INICIAL"
  : TEMAS_SISTEMA_VALIDOS[0] || "PADRAO_INICIAL";
const LEGACY_MAP_TEMA_SKIN_TO_SISTEMA = {
  CYBERPINK: "ALY_137",
  SUNSHINE: "LOJA_DE_ROUPAS",
};
const LIMITE_SKINS_VALIDOS = ["1", "ilimitado"];
const METODOS_LOGIN_PADRAO = {
  google: true,
  twitter: true,
  emailSenha: true,
};

export const DEFAULT_SISTEMA_CONFIG = {
  logoLoginUrl: "/logoNeon.png",
  faviconUrl: "/favicon.ico",
  tituloSistema: "ALY-137",
  exibirTituloSistemaNoLogin: true,
  textoLogin: "EMBARQUE COM O GOOGLE",
  larguraIconsLoginPx: null,
  temaPadraoSistema: TEMA_SISTEMA_FALLBACK,
  limiteSkinsPorUsuario: "ilimitado",
  nomeSkinSingular: "skin",
  nomeSkinPlural: "skins",
  nomeEspacoSingular: "espaco",
  nomeEspacoPlural: "espacos",
  nomeBlocoSingular: "bloco",
  nomeBlocoPlural: "blocos",
  permitirTemasSkinSecundarios: true,
  metodosLoginHabilitados: { ...METODOS_LOGIN_PADRAO },
  chatHabilitado: true,
  mercadoPagoHabilitado: true,
  blocoCardsHabilitado: false,
};

function obterDefaultConfigSistemaProjeto() {
  if (activeFirebaseProjectKey === "gerenciador-aly") {
    return {
      ...DEFAULT_SISTEMA_CONFIG,
      temaPadraoSistema: "ALY_137",
      tituloSistema: "GERENCIADOR DE SISTEMAS",
    };
  }
  return { ...DEFAULT_SISTEMA_CONFIG };
}

function aplicarDefaultsPorProjeto(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const config = {
    ...configSistema,
  };
  if (activeFirebaseProjectKey === "gerenciador-aly") {
    if (!config.temaPadraoSistema || config.temaPadraoSistema === "PADRAO_INICIAL") {
      config.temaPadraoSistema = "ALY_137";
    }
    if (!config.tituloSistema) {
      config.tituloSistema = "GERENCIADOR DE SISTEMAS";
    }
  }
  return config;
}

function salvarConfigSistemaCacheLocal(configNormalizada = DEFAULT_SISTEMA_CONFIG) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SISTEMA_CONFIG_CACHE_KEY,
      JSON.stringify(configNormalizada)
    );
  } catch {
    // Ignora indisponibilidade de storage local.
  }
}

export function obterConfigSistemaCacheLocal() {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(SISTEMA_CONFIG_CACHE_KEY);
    if (!bruto) return null;
    const parsed = JSON.parse(bruto);
    return aplicarDefaultsPorProjeto(normalizarConfigSistema(parsed));
  } catch {
    return null;
  }
}

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
      layoutTheme: "PADRAO",
      wallpaper: "",
    };
  }

  return {
    layoutTheme: match.layoutTheme || "PADRAO",
    wallpaper: typeof match.wallpaper === "string" ? match.wallpaper : "",
  };
}

function normalizarTexto(value, fallback, maxLen = 80) {
  if (typeof value !== "string") return fallback;
  const trim = value.trim();
  if (!trim) return fallback;
  return trim.slice(0, maxLen);
}

function normalizarBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalizado = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(normalizado)) return true;
    if (["false", "0", "nao", "não", "no"].includes(normalizado)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function normalizarLimiteSkins(value) {
  if (value === 1 || value === "1") return "1";
  if (typeof value === "string") {
    const normalizado = value.trim().toLowerCase();
    if (LIMITE_SKINS_VALIDOS.includes(normalizado)) {
      return normalizado;
    }
  }
  return DEFAULT_SISTEMA_CONFIG.limiteSkinsPorUsuario;
}

function normalizarNomeSkin(value, fallback, maxLen = 40) {
  if (typeof value !== "string") return fallback;
  const trim = value.trim();
  if (!trim) return fallback;
  return trim.slice(0, maxLen);
}

function normalizarLarguraIconsLogin(value) {
  if (value === null || value === undefined || value === "") return null;

  const numero = Number(value);
  if (!Number.isFinite(numero)) return null;

  const arredondado = Math.round(numero);
  if (arredondado < 120) return 120;
  if (arredondado > 640) return 640;
  return arredondado;
}

function normalizarMetodosLoginHabilitados(
  value = {},
  legacyGoogleValue = undefined,
  legacyTwitterValue = undefined,
  legacyEmailSenhaValue = undefined
) {
  const origem = value && typeof value === "object" ? value : {};
  const valorGoogle = Object.prototype.hasOwnProperty.call(origem, "google")
    ? origem.google
    : legacyGoogleValue;
  const valorTwitter = Object.prototype.hasOwnProperty.call(origem, "twitter")
    ? origem.twitter
    : legacyTwitterValue;
  const valorEmailSenha = Object.prototype.hasOwnProperty.call(origem, "emailSenha")
    ? origem.emailSenha
    : legacyEmailSenhaValue;

  return {
    google: normalizarBoolean(
      valorGoogle,
      DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados.google
    ),
    twitter: normalizarBoolean(
      valorTwitter,
      DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados.twitter
    ),
    emailSenha: normalizarBoolean(
      valorEmailSenha,
      DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados.emailSenha
    ),
  };
}

export function normalizarConfigSistema(data = {}) {
  const logoNormalizada = normalizarTexto(
    data.logoLoginUrl,
    DEFAULT_SISTEMA_CONFIG.logoLoginUrl,
    120000
  );
  const faviconNormalizado = normalizarTexto(
    data.faviconUrl,
    DEFAULT_SISTEMA_CONFIG.faviconUrl,
    120000
  );
  const tituloSistemaNormalizado = normalizarTexto(
    data.tituloSistema,
    DEFAULT_SISTEMA_CONFIG.tituloSistema,
    80
  );
  const textoLoginNormalizado = normalizarTexto(
    data.textoLogin,
    DEFAULT_SISTEMA_CONFIG.textoLogin,
    120
  );
  const adminUidNormalizado =
    typeof data.adminUid === "string" && data.adminUid.trim()
      ? data.adminUid.trim()
      : null;

  return {
    logoLoginUrl: logoNormalizada,
    faviconUrl: faviconNormalizado,
    tituloSistema: tituloSistemaNormalizado,
    exibirTituloSistemaNoLogin: normalizarBoolean(
      data.exibirTituloSistemaNoLogin,
      DEFAULT_SISTEMA_CONFIG.exibirTituloSistemaNoLogin
    ),
    textoLogin: textoLoginNormalizado,
    larguraIconsLoginPx: normalizarLarguraIconsLogin(data.larguraIconsLoginPx),
    temaPadraoSistema: normalizarTemaSistema(data.temaPadraoSistema),
    limiteSkinsPorUsuario: normalizarLimiteSkins(data.limiteSkinsPorUsuario),
    nomeSkinSingular: normalizarNomeSkin(
      data.nomeSkinSingular,
      DEFAULT_SISTEMA_CONFIG.nomeSkinSingular
    ),
    nomeSkinPlural: normalizarNomeSkin(
      data.nomeSkinPlural,
      DEFAULT_SISTEMA_CONFIG.nomeSkinPlural
    ),
    nomeEspacoSingular: normalizarNomeSkin(
      data.nomeEspacoSingular,
      DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
    ),
    nomeEspacoPlural: normalizarNomeSkin(
      data.nomeEspacoPlural,
      DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
    ),
    nomeBlocoSingular: normalizarNomeSkin(
      data.nomeBlocoSingular,
      DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular
    ),
    nomeBlocoPlural: normalizarNomeSkin(
      data.nomeBlocoPlural,
      DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural
    ),
    permitirTemasSkinSecundarios: normalizarBoolean(
      data.permitirTemasSkinSecundarios,
      DEFAULT_SISTEMA_CONFIG.permitirTemasSkinSecundarios
    ),
    metodosLoginHabilitados: normalizarMetodosLoginHabilitados(
      data.metodosLoginHabilitados,
      data.loginGoogleHabilitado,
      data.loginTwitterHabilitado,
      data.loginEmailSenhaHabilitado
    ),
    chatHabilitado: normalizarBoolean(
      data.chatHabilitado,
      DEFAULT_SISTEMA_CONFIG.chatHabilitado
    ),
    mercadoPagoHabilitado: normalizarBoolean(
      data.mercadoPagoHabilitado,
      DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
    ),
    blocoCardsHabilitado: normalizarBoolean(
      data.blocoCardsHabilitado,
      DEFAULT_SISTEMA_CONFIG.blocoCardsHabilitado
    ),
    adminUid: adminUidNormalizado,
  };
}

export async function obterConfigSistema() {
  const hostnameAtual =
    typeof window !== "undefined" ? window.location.hostname || "" : "";

  try {
    const configGerenciada = await obterConfigSistemaDoGerenciador({
      projectKey: activeFirebaseProjectKey,
      projectId: activeFirebaseProjectId,
      hostname: hostnameAtual,
    });

    if (configGerenciada) {
      const configNormalizada = aplicarDefaultsPorProjeto(
        normalizarConfigSistema(configGerenciada)
      );
      salvarConfigSistemaCacheLocal(configNormalizada);
      return configNormalizada;
    }
  } catch {
    // Segue fallback local.
  }

  const snap = await getDoc(SISTEMA_CONFIG_REF);
  if (!snap.exists()) {
    const fallback = aplicarDefaultsPorProjeto(obterDefaultConfigSistemaProjeto());
    salvarConfigSistemaCacheLocal(fallback);
    return fallback;
  }

  const configNormalizada = aplicarDefaultsPorProjeto(normalizarConfigSistema(snap.data()));
  salvarConfigSistemaCacheLocal(configNormalizada);
  return configNormalizada;
}

export async function estaConfigSistemaInicializada() {
  const hostnameAtual =
    typeof window !== "undefined" ? window.location.hostname || "" : "";
  try {
    const configGerenciada = await obterConfigSistemaDoGerenciador({
      projectKey: activeFirebaseProjectKey,
      projectId: activeFirebaseProjectId,
      hostname: hostnameAtual,
    });
    if (configGerenciada) return true;
  } catch {
    // Segue fallback local.
  }

  const snap = await getDoc(SISTEMA_CONFIG_REF);
  return snap.exists();
}

export async function salvarConfigSistemaAdmin(configParcial = {}) {
  const configNormalizada = normalizarConfigSistema(configParcial);
  const hostnameAtual =
    typeof window !== "undefined" ? window.location.hostname || "" : "";

  let salvoNoGerenciador = false;
  try {
    salvoNoGerenciador = await salvarConfigSistemaNoGerenciador({
      projectKey: activeFirebaseProjectKey,
      projectId: activeFirebaseProjectId,
      hostname: hostnameAtual,
      configSistema: configNormalizada,
      atualizadoPorUid: configNormalizada.adminUid || null,
    });
  } catch {
    salvoNoGerenciador = false;
  }

  if (!salvoNoGerenciador) {
    await setDoc(
      SISTEMA_CONFIG_REF,
      {
        ...configNormalizada,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  }

  salvarConfigSistemaCacheLocal(configNormalizada);
  return configNormalizada;
}

export function aplicarBrandingNoDocumento(configSistema = DEFAULT_SISTEMA_CONFIG) {
  if (typeof document === "undefined") return;

  const configNormalizada = normalizarConfigSistema(configSistema);
  const titulo = configNormalizada.tituloSistema || DEFAULT_SISTEMA_CONFIG.tituloSistema;
  const favicon = configNormalizada.faviconUrl || DEFAULT_SISTEMA_CONFIG.faviconUrl;

  document.title = titulo;

  let faviconLink = document.querySelector("link[rel='icon']");
  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.setAttribute("rel", "icon");
    document.head.appendChild(faviconLink);
  }
  faviconLink.setAttribute("href", favicon);
}

export function obterRotulosSkin(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  return {
    singular: configNormalizada.nomeSkinSingular,
    plural: configNormalizada.nomeSkinPlural,
  };
}

export function obterRotulosEspaco(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  return {
    singular: configNormalizada.nomeEspacoSingular,
    plural: configNormalizada.nomeEspacoPlural,
  };
}

export function obterRotulosBloco(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  return {
    singular: configNormalizada.nomeBlocoSingular,
    plural: configNormalizada.nomeBlocoPlural,
  };
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

  if (wallpaper) {
    root.style.setProperty("--system-wallpaper", `url('${wallpaper}')`);
  } else {
    root.style.removeProperty("--system-wallpaper");
  }
  body.classList.add(`theme-${layoutTheme.toLowerCase()}`);
  import(`../Temas/${layoutTheme.toLowerCase()}.css`).catch(() => {});
}
