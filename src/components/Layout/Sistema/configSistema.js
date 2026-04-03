import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../Banco/init-firebase";
import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
} from "../../Banco/init-firebase";
import {
  DEFAULT_LAYOUT_THEME_OVERRIDES,
  SYSTEM_THEMES,
  normalizarConfiguracaoLayoutTema,
} from "../Temas/themesRegistry";
import {
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
} from "./gerenciadorProjetosApi";
import { APPLYABLE_LOGIN_PRESET_IDS } from "./loginPresets";
import { buildProjectDataPathCandidates } from "../../Banco/projectDataNamespace";

const SISTEMA_CONFIG_CACHE_KEY_BASE = "sistemaConfigCacheV1";
const SISTEMA_PROJECT_CONTEXT_KEY = "systemProjectContextKey";
const SHARED_ONEOWNER_RUNTIME_KEYS = new Set(["aly-onepages-runtime"]);
const LOCALHOST_PROJECT_SYSTEM_QUERY_KEYS = [
  "projectSystemKey",
  "systemKey",
  "slug",
  "projectSlug",
];
const TEMAS_SISTEMA_VALIDOS = SYSTEM_THEMES.map((tema) => tema.id);
const TEMA_SISTEMA_FALLBACK = TEMAS_SISTEMA_VALIDOS.includes("CYBERPINK")
  ? "CYBERPINK"
  : TEMAS_SISTEMA_VALIDOS[0] || "CYBERPINK";
const LEGACY_MAP_TEMA_SKIN_TO_SISTEMA = {
  ALY_137: "CYBERPINK",
  CYBERPINK: "CYBERPINK",
  SUNSHINE: "LOJA_DE_ROUPAS",
};
const LIMITE_SKINS_VALIDOS = ["1", "ilimitado"];
const TIPOS_EXPERIENCIA_VALIDOS = ["multiowner", "oneowner", "manager"];
const MODOS_ACESSO_PROJETO_VALIDOS = [
  "privado_com_login",
  "publico_com_area_restrita",
  "publico_sem_login",
];
const DESTINOS_POS_LOGIN_VALIDOS = [
  "home_central_projeto",
  "home_skin_usuario",
];
const SYSTEM_MANAGER_PROJECT_ID = String(
  process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID || "gerenciador-aly"
)
  .trim()
  .toLowerCase();
const METODOS_LOGIN_PADRAO = {
  google: true,
  twitter: true,
  emailSenha: true,
};
const LOGIN_PRESET_IDS_VALIDOS = Array.isArray(APPLYABLE_LOGIN_PRESET_IDS)
  ? APPLYABLE_LOGIN_PRESET_IDS
  : ["manual", "aly137"];
const LOGIN_LOADING_MODE_VALIDOS = ["auto", "simple", "ritual", "obeydom", "sprite_sheet"];
const THEME_CSS_LOADERS = {
  padrao: () => import("../Temas/padrao/index.css"),
  cyberpink: () => import("../Temas/cyberpink/index.css"),
  lojaderoupas: () => import("../Temas/lojaderoupas/index.css"),
  jornal: () => import("../Temas/jornal/index.css"),
  obeydom: () => import("../Temas/obeydom/index.css"),
  passy: () => import("../Temas/passy/index.css"),
  sunshine: () => import("../Temas/sunshine/index.css"),
  pura: () => import("../Temas/pura/index.css"),
};

function obterSistemaConfigRefsComFallback() {
  const caminhos = buildProjectDataPathCandidates(["add_ons", "sistema_config"], {
    activeProjectKey: activeFirebaseProjectKey,
  });
  const refs = caminhos.map((segmentos) => doc(db, ...segmentos));
  const mapa = new Map();
  refs.forEach((ref) => {
    if (!mapa.has(ref.path)) {
      mapa.set(ref.path, ref);
    }
  });
  return Array.from(mapa.values());
}

function obterSistemaConfigRefPrincipal() {
  return obterSistemaConfigRefsComFallback()[0];
}

export const DEFAULT_SISTEMA_CONFIG = {
  projectSystemKey: "",
  logoLoginUrl: "",
  faviconUrl: "/favicon.ico",
  loginButtonIconUrl:
    "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Ffoguete.png?alt=media&token=19c205b6-b36f-49df-b336-4afc6565c9a5",
  chatButtonIconUrl:
    "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fchat.png?alt=media&token=663a432d-f916-4917-98b2-e90eacd65745",
  iconSkinPadraoUrl:
    "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b",
  cardProfileUrl: "",
  cardProfilePath: "",
  tituloSistema: "ALY-137",
  exibirTituloSistemaNoLogin: true,
  textoLogin: "EMBARQUE COM O GOOGLE",
  loginLoadingMode: "auto",
  loginLoadingSpriteUrl: "",
  solicitacaoStatusAguardandoSpriteUrl: "",
  solicitacaoStatusConfirmadoIconUrl: "",
  googleFontsUrls: [],
  mensagemEspacoLoginRestrito:
    "Este {nomeEspacoSingular} requer login para visualizar o conteudo.",
  mensagemEspacoLoginRestritoFontFamily: "",
  mensagemEspacoAssinanteRestrito:
    "Este {nomeEspacoSingular} requer assinatura para visualizar o conteudo.",
  mensagemEspacoAssinanteRestritoFontFamily: "",
  exibirBotaoLoginMensagemRestricao: true,
  mensagemRestricaoAvatarUrl: "",
  exibirBadgeProjetoFirebase: true,
  termosUsoUrl: "",
  politicaPrivacidadeUrl: "",
  exigirAceiteTermosNoCadastro: false,
  larguraIconsLoginPx: null,
  temaPadraoSistema: TEMA_SISTEMA_FALLBACK,
  layoutTema: { ...DEFAULT_LAYOUT_THEME_OVERRIDES },
  loginPresetId: "manual",
  tipoExperiencia: "multiowner",
  modoAcessoProjeto: "privado_com_login",
  destinoPosLogin: "home_skin_usuario",
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
  livesHabilitadas: false,
  cardcaptorHabilitado: false,
  mercadoPagoHabilitado: true,
  pixManualHabilitado: true,
  blocoCardsHabilitado: false,
  compraAssinaturaPaisesBloqueados: [],
  compraAssinaturaRegioesBloqueadas: [],
  compraAssinaturaUfsBloqueadas: [],
  compraAssinaturaCidadesBloqueadas: [],
  ownerUid: "",
  ownerEmail: "",
  adminUid: "",
  adminEmail: "",
  iconCollectionIds: [],
  projectOwnerUid: "",
  projectLastEditorUid: "",
};

function limparProjectSystemKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-_]+/g, "")
    .slice(0, 80);
}

function obterProjectSystemKeyDaQuery(search = "") {
  try {
    const searchParams = new URLSearchParams(search || "");
    for (const key of LOCALHOST_PROJECT_SYSTEM_QUERY_KEYS) {
      const value = limparProjectSystemKey(searchParams.get(key) || "");
      if (value) return value;
    }
  } catch {
    // Ignora erro de parse da URL.
  }
  return "";
}

function isSharedOneownerRuntimeAtivo() {
  const projectKey = String(activeFirebaseProjectKey || "").trim().toLowerCase();
  const projectId = String(activeFirebaseProjectId || "").trim().toLowerCase();
  return (
    SHARED_ONEOWNER_RUNTIME_KEYS.has(projectKey) ||
    SHARED_ONEOWNER_RUNTIME_KEYS.has(projectId)
  );
}

function isHostnameLocal(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function exigirResolucaoEstritaPorDominio(hostname = "") {
  return (
    isSharedOneownerRuntimeAtivo() &&
    !isHostnameLocal(hostname)
  );
}

export function isOneOwnerComEntradaPublica(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const tipoExperiencia = String(
    configSistema?.tipoExperiencia || DEFAULT_SISTEMA_CONFIG.tipoExperiencia
  )
    .trim()
    .toLowerCase();
  const modoAcessoProjeto = String(
    configSistema?.modoAcessoProjeto || DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto
  )
    .trim()
    .toLowerCase();

  return (
    tipoExperiencia === "oneowner" &&
    (
      modoAcessoProjeto === "publico_sem_login" ||
      modoAcessoProjeto === "publico_com_area_restrita"
    )
  );
}

// Compatibilidade retroativa: mantenha chamadas antigas funcionando.
export function isOnePageComEntradaPublica(configSistema = DEFAULT_SISTEMA_CONFIG) {
  return isOneOwnerComEntradaPublica(configSistema);
}

export function obterManagerProjectIdConfigurado() {
  return SYSTEM_MANAGER_PROJECT_ID;
}

export function obterManagerProjectLabel() {
  return SYSTEM_MANAGER_PROJECT_ID || "manager";
}

export function isManagerExperienceType(configSistema = null) {
  return String(configSistema?.tipoExperiencia || "")
    .trim()
    .toLowerCase() === "manager";
}

export function isManagerProjectRuntime(configSistema = null) {
  const projectKey = String(activeFirebaseProjectKey || "").trim().toLowerCase();
  const projectId = String(activeFirebaseProjectId || "").trim().toLowerCase();
  const managerProjectId = obterManagerProjectIdConfigurado();

  return Boolean(
    (managerProjectId && (projectKey === managerProjectId || projectId === managerProjectId)) ||
      isManagerExperienceType(configSistema)
  );
}

function normalizarDestinoPosLogin(value) {
  const normalizado = String(value || "").trim().toLowerCase();
  if (DESTINOS_POS_LOGIN_VALIDOS.includes(normalizado)) {
    return normalizado;
  }
  return DEFAULT_SISTEMA_CONFIG.destinoPosLogin;
}

export function resolverDestinoPosLoginPadrao(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  if (isOneOwnerComEntradaPublica(configNormalizada)) {
    return "/home";
  }
  if (configNormalizada.destinoPosLogin === "home_central_projeto") {
    return "/";
  }
  return null;
}

export function isOneOwnerHomeCentralProjeto(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  return (
    isOneOwnerComEntradaPublica(configNormalizada) &&
    configNormalizada.destinoPosLogin === "home_central_projeto"
  );
}

export function isOneOwnerHomeSkinDoOwner(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const configNormalizada = normalizarConfigSistema(configSistema);
  return (
    isOneOwnerComEntradaPublica(configNormalizada) &&
    configNormalizada.destinoPosLogin !== "home_central_projeto"
  );
}

function obterDefaultConfigSistemaProjeto() {
  if (isManagerProjectRuntime()) {
    return {
      ...DEFAULT_SISTEMA_CONFIG,
      temaPadraoSistema: "CYBERPINK",
      tituloSistema: "GERENCIADO DE PROJETOS",
      tipoExperiencia: "manager",
      modoAcessoProjeto: "privado_com_login",
    };
  }
  return { ...DEFAULT_SISTEMA_CONFIG };
}

function aplicarDefaultsPorProjeto(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const config = {
    ...configSistema,
  };
  if (isManagerProjectRuntime(config)) {
    if (
      !config.temaPadraoSistema ||
      config.temaPadraoSistema === "PADRAO_INICIAL" ||
      config.temaPadraoSistema === "ALY_137"
    ) {
      config.temaPadraoSistema = "CYBERPINK";
    }
    if (!config.tituloSistema) {
      config.tituloSistema = "GERENCIADO DE PROJETOS";
    }
    if (!config.tipoExperiencia || config.tipoExperiencia === "multiowner") {
      config.tipoExperiencia = "manager";
    }
  }
  return config;
}

function obterChaveCacheSistemaProjeto() {
  const projectKeyNormalizada =
    typeof activeFirebaseProjectKey === "string" && activeFirebaseProjectKey.trim()
      ? activeFirebaseProjectKey.trim()
      : "default";
  let contextoProjeto = "default";

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").trim().toLowerCase();
    const isLocalHost =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    if (isLocalHost) {
      try {
        const queryProjectSystemKey = obterProjectSystemKeyDaQuery(window.location.search || "");
        const contextoSalvo = limparProjectSystemKey(
          window.localStorage.getItem(SISTEMA_PROJECT_CONTEXT_KEY) || ""
        );
        const searchParams = new URLSearchParams(window.location.search || "");
        const queryProject = String(searchParams.get("firebaseProject") || "")
          .trim()
          .toLowerCase();
        if (queryProjectSystemKey) {
          contextoProjeto = queryProjectSystemKey;
        } else if (contextoSalvo) {
          contextoProjeto = contextoSalvo;
        } else if (isSharedOneownerRuntimeAtivo()) {
          contextoProjeto = `${hostname || "localhost"}:shared-runtime`;
        } else {
          contextoProjeto = queryProject || hostname || "localhost";
        }
      } catch {
        contextoProjeto = isSharedOneownerRuntimeAtivo()
          ? `${hostname || "localhost"}:shared-runtime`
          : (hostname || "localhost");
      }
    } else {
      contextoProjeto = hostname || "default";
    }
  }

  return `${SISTEMA_CONFIG_CACHE_KEY_BASE}:${projectKeyNormalizada}:${contextoProjeto}`;
}

export function obterProjectKeyContextual() {
  if (typeof window === "undefined") return "";

  const hostname = String(window.location.hostname || "").trim().toLowerCase();
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isLocalHost) {
    const projectKeyQuery = obterProjectSystemKeyDaQuery(window.location.search || "");
    if (projectKeyQuery) {
      try {
        window.localStorage.setItem(SISTEMA_PROJECT_CONTEXT_KEY, projectKeyQuery);
      } catch {
        // Ignora indisponibilidade de storage local.
      }
      return projectKeyQuery;
    }

    let keySalvaLocal = "";
    try {
      keySalvaLocal = limparProjectSystemKey(
        String(window.localStorage.getItem(SISTEMA_PROJECT_CONTEXT_KEY) || "")
      );
    } catch {
      keySalvaLocal = "";
    }

    if (isSharedOneownerRuntimeAtivo()) {
      return keySalvaLocal;
    }

    try {
      const searchParams = new URLSearchParams(window.location.search || "");
      const firebaseProjectQuery = String(searchParams.get("firebaseProject") || "")
        .trim()
        .toLowerCase();
      if (firebaseProjectQuery) {
        try {
          window.localStorage.setItem(SISTEMA_PROJECT_CONTEXT_KEY, firebaseProjectQuery);
        } catch {
          // Ignora indisponibilidade de storage local.
        }
        return firebaseProjectQuery;
      }

      return keySalvaLocal;
    } catch {
      return keySalvaLocal;
    }
  }

  try {
    const keySalva = String(window.localStorage.getItem(SISTEMA_PROJECT_CONTEXT_KEY) || "")
      .trim()
      .toLowerCase();
    if (keySalva) {
      return keySalva;
    }
  } catch {
    // Ignora indisponibilidade de storage local.
  }

  const projectKeyHost = limparProjectSystemKey(String(hostname.split(".")[0] || ""));
  try {
    window.localStorage.setItem(SISTEMA_PROJECT_CONTEXT_KEY, projectKeyHost);
  } catch {
    // Ignora indisponibilidade de storage local.
  }
  return projectKeyHost;
}

function salvarConfigSistemaCacheLocal(configNormalizada = DEFAULT_SISTEMA_CONFIG) {
  if (typeof window === "undefined") return;
  try {
    const projectSystemKey = limparProjectSystemKey(configNormalizada?.projectSystemKey || "");
    if (projectSystemKey) {
      window.localStorage.setItem(SISTEMA_PROJECT_CONTEXT_KEY, projectSystemKey);
    }
    const chaveCacheProjeto = obterChaveCacheSistemaProjeto();
    window.localStorage.setItem(
      chaveCacheProjeto,
      JSON.stringify(configNormalizada)
    );
  } catch {
    // Ignora indisponibilidade de storage local.
  }
}

async function sincronizarConfigSistemaRuntime(configNormalizada = DEFAULT_SISTEMA_CONFIG) {
  if (isManagerProjectRuntime(configNormalizada)) return;
  if (!auth.currentUser?.uid) return;

  const refsConfig = obterSistemaConfigRefsComFallback();
  for (const refConfig of refsConfig) {
    try {
      await setDoc(
        refConfig,
        {
          ...configNormalizada,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      if (error?.code !== "permission-denied") {
        throw error;
      }
    }
  }
}

export function obterConfigSistemaCacheLocal() {
  if (typeof window === "undefined") return null;
  try {
    const chaveCacheProjeto = obterChaveCacheSistemaProjeto();
    const bruto = window.localStorage.getItem(chaveCacheProjeto);
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
    if (["false", "0", "nao", "nÃ£o", "no"].includes(normalizado)) return false;
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

function normalizarTipoExperiencia(value) {
  let normalizado = String(value || "").trim().toLowerCase();
  if (normalizado === "onepage") normalizado = "oneowner";
  if (normalizado === "multipage") normalizado = "multiowner";
  if (normalizado === "menager") normalizado = "manager";
  if (normalizado === "gerenciador") normalizado = "manager";
  if (TIPOS_EXPERIENCIA_VALIDOS.includes(normalizado)) {
    return normalizado;
  }
  return DEFAULT_SISTEMA_CONFIG.tipoExperiencia;
}

function normalizarLoginPresetId(value) {
  const normalizado = String(value || "").trim().toLowerCase();
  if (LOGIN_PRESET_IDS_VALIDOS.includes(normalizado)) {
    return normalizado;
  }
  return DEFAULT_SISTEMA_CONFIG.loginPresetId;
}

function normalizarLoginLoadingMode(value) {
  const normalizado = String(value || "").trim().toLowerCase();
  if (normalizado === "obeydom") {
    return "ritual";
  }
  if (LOGIN_LOADING_MODE_VALIDOS.includes(normalizado)) {
    return normalizado;
  }
  return DEFAULT_SISTEMA_CONFIG.loginLoadingMode;
}

function normalizarModoAcessoProjeto(value) {
  const normalizado = String(value || "").trim().toLowerCase();
  if (MODOS_ACESSO_PROJETO_VALIDOS.includes(normalizado)) {
    return normalizado;
  }
  return DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto;
}

function normalizarNomeSkin(value, fallback, maxLen = 40) {
  if (typeof value !== "string") return fallback;
  const trim = value.trim();
  if (!trim) return fallback;
  return trim.slice(0, maxLen);
}

function normalizarEmailOwner(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 160);
}

function ignorarFallbackOwnerLocalPorRuntimeCompartilhado() {
  if (typeof window === "undefined") return false;
  const hostname = String(window.location.hostname || "").trim().toLowerCase();
  return (
    isHostnameLocal(hostname) &&
    isSharedOneownerRuntimeAtivo() &&
    !obterProjectSystemKeyDaQuery(window.location.search || "")
  );
}

export function obterOwnerUidConfigurado(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const ownerUid = String(configSistema?.ownerUid || configSistema?.adminUid || "").trim();
  if (ownerUid) return ownerUid;
  if (typeof window === "undefined" || ignorarFallbackOwnerLocalPorRuntimeCompartilhado()) {
    return "";
  }
  return String(
    window.localStorage.getItem("systemOwnerUid") ||
      window.localStorage.getItem("systemAdminUid") ||
      ""
  ).trim();
}

export function obterOwnerEmailConfigurado(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const ownerEmail = String(configSistema?.ownerEmail || configSistema?.adminEmail || "")
    .trim()
    .toLowerCase();
  if (ownerEmail) return ownerEmail;
  if (typeof window === "undefined" || ignorarFallbackOwnerLocalPorRuntimeCompartilhado()) {
    return "";
  }
  return String(
    window.localStorage.getItem("systemOwnerEmail") ||
      window.localStorage.getItem("systemAdminEmail") ||
      ""
  )
    .trim()
    .toLowerCase();
}

export function usuarioCorrespondeOwnerConfigurado(
  configSistema = DEFAULT_SISTEMA_CONFIG,
  { uid = "", email = "" } = {}
) {
  const ownerUid = obterOwnerUidConfigurado(configSistema);
  if (ownerUid) {
    return Boolean(uid && String(uid).trim() === ownerUid);
  }

  const ownerEmail = obterOwnerEmailConfigurado(configSistema);
  const emailNormalizado = String(email || "").trim().toLowerCase();
  if (ownerEmail) {
    return Boolean(emailNormalizado && emailNormalizado === ownerEmail);
  }

  return false;
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

function normalizarListaString(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizarTextoComparacaoLocalizacao(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolverValorGeoComparacao(localizacao = {}, campo = "") {
  switch (campo) {
    case "pais":
      return localizacao?.country;
    case "regiao":
      return localizacao?.region;
    case "uf":
      return localizacao?.uf || localizacao?.regionCode;
    case "cidade":
      return localizacao?.cidade || localizacao?.city;
    default:
      return "";
  }
}

export function resolverBloqueioCompraAssinaturaPorLocalizacao(
  configSistema = DEFAULT_SISTEMA_CONFIG,
  localizacao = {}
) {
  const regras = [
    {
      campo: "pais",
      valores: normalizarListaString(configSistema?.compraAssinaturaPaisesBloqueados),
      rotulo: "pais",
    },
    {
      campo: "regiao",
      valores: normalizarListaString(configSistema?.compraAssinaturaRegioesBloqueadas),
      rotulo: "regiao",
    },
    {
      campo: "uf",
      valores: normalizarListaString(configSistema?.compraAssinaturaUfsBloqueadas),
      rotulo: "UF",
    },
    {
      campo: "cidade",
      valores: normalizarListaString(configSistema?.compraAssinaturaCidadesBloqueadas),
      rotulo: "cidade",
    },
  ];

  for (const regra of regras) {
    const valorAtual = normalizarTextoComparacaoLocalizacao(
      resolverValorGeoComparacao(localizacao, regra.campo)
    );
    if (!valorAtual) continue;

    const match = regra.valores.find(
      (item) => normalizarTextoComparacaoLocalizacao(item) === valorAtual
    );
    if (match) {
      return {
        bloqueado: true,
        campo: regra.campo,
        campoLabel: regra.rotulo,
        valor: String(match),
        valorAtual: resolverValorGeoComparacao(localizacao, regra.campo),
      };
    }
  }

  return {
    bloqueado: false,
    campo: "",
    campoLabel: "",
    valor: "",
    valorAtual: "",
  };
}

function extrairPrimeiraUrl(value = "") {
  const bruto = String(value || "").trim();
  if (!bruto) return "";

  const semAspas = bruto.replace(/^['"]|['"]$/g, "").trim();
  if (/^https?:\/\//i.test(semAspas)) return semAspas;

  const hrefMatch = bruto.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch?.[1]) {
    const href = String(hrefMatch[1]).trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const importMatch = bruto.match(/url\(([^)]+)\)/i);
  if (importMatch?.[1]) {
    const href = String(importMatch[1]).replace(/^['"]|['"]$/g, "").trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const geral = bruto.match(/https?:\/\/[^\s"'<>]+/i);
  return geral?.[0] ? String(geral[0]).trim() : "";
}

function formatarFamilyGoogleCss2(value = "") {
  return encodeURI(String(value || "").trim().replace(/\s+/g, "+"));
}

function normalizarUrlGoogleFonts(url = "") {
  const href = extrairPrimeiraUrl(url);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    const host = String(parsed.hostname || "").toLowerCase();

    if (host.includes("fonts.googleapis.com")) {
      return parsed.toString();
    }

    if (host.includes("fonts.google.com") && parsed.pathname.startsWith("/share")) {
      const familias = parsed.searchParams
        .getAll("selection.family")
        .flatMap((value) => String(value || "").split("|"))
        .map((value) => value.trim())
        .filter(Boolean);

      if (!familias.length) return "";

      const queryFamilias = familias
        .map((family) => `family=${formatarFamilyGoogleCss2(family)}`)
        .join("&");
      return `https://fonts.googleapis.com/css2?${queryFamilias}&display=swap`;
    }
  } catch {
    return "";
  }

  return "";
}

function normalizarGoogleFontsUrls(value = []) {
  const origem = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/g)
      : [];

  return Array.from(
    new Set(
      origem
        .map((item) => normalizarUrlGoogleFonts(item))
        .filter((item) => /^https?:\/\/fonts\.googleapis\.com\//i.test(item))
    )
  ).slice(0, 20);
}

export function normalizarConfigSistema(data = {}) {
  const logoNormalizadaBase = normalizarTexto(
    data.logoLoginUrl,
    DEFAULT_SISTEMA_CONFIG.logoLoginUrl,
    120000
  );
  const logoNormalizada =
    logoNormalizadaBase === "/logoNeon.png" ? "" : logoNormalizadaBase;
  const faviconNormalizado = normalizarTexto(
    data.faviconUrl,
    DEFAULT_SISTEMA_CONFIG.faviconUrl,
    120000
  );
  const loginButtonIconUrlNormalizado = normalizarTexto(
    data.loginButtonIconUrl,
    DEFAULT_SISTEMA_CONFIG.loginButtonIconUrl,
    120000
  );
  const chatButtonIconUrlNormalizado = normalizarTexto(
    data.chatButtonIconUrl,
    DEFAULT_SISTEMA_CONFIG.chatButtonIconUrl,
    120000
  );
  const cardProfileUrlNormalizado = normalizarTexto(
    data.cardProfileUrl,
    DEFAULT_SISTEMA_CONFIG.cardProfileUrl,
    120000
  );
  const cardProfilePathNormalizado = normalizarTexto(
    data.cardProfilePath,
    DEFAULT_SISTEMA_CONFIG.cardProfilePath,
    120000
  );
  const iconSkinPadraoUrlNormalizado = normalizarTexto(
    data.iconSkinPadraoUrl,
    DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl,
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
  const loginLoadingModeNormalizado = normalizarLoginLoadingMode(data.loginLoadingMode);
  const loginLoadingSpriteUrlNormalizado = normalizarTexto(
    data.loginLoadingSpriteUrl,
    DEFAULT_SISTEMA_CONFIG.loginLoadingSpriteUrl,
    120000
  );
  const solicitacaoStatusAguardandoSpriteUrlNormalizada = normalizarTexto(
    data.solicitacaoStatusAguardandoSpriteUrl,
    DEFAULT_SISTEMA_CONFIG.solicitacaoStatusAguardandoSpriteUrl,
    120000
  );
  const solicitacaoStatusConfirmadoIconUrlNormalizada = normalizarTexto(
    data.solicitacaoStatusConfirmadoIconUrl,
    DEFAULT_SISTEMA_CONFIG.solicitacaoStatusConfirmadoIconUrl,
    120000
  );
  const googleFontsUrlsNormalizadas = normalizarGoogleFontsUrls(data.googleFontsUrls);
  const mensagemEspacoLoginRestritoNormalizada = normalizarTexto(
    data.mensagemEspacoLoginRestrito,
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito,
    240
  );
  const mensagemEspacoLoginRestritoFontFamilyNormalizada = normalizarTexto(
    data.mensagemEspacoLoginRestritoFontFamily,
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily,
    120
  );
  const mensagemEspacoAssinanteRestritoNormalizada = normalizarTexto(
    data.mensagemEspacoAssinanteRestrito,
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito,
    240
  );
  const mensagemEspacoAssinanteRestritoFontFamilyNormalizada = normalizarTexto(
    data.mensagemEspacoAssinanteRestritoFontFamily,
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily,
    120
  );
  const mensagemRestricaoAvatarUrlNormalizada = normalizarTexto(
    data.mensagemRestricaoAvatarUrl,
    DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl,
    120000
  );
  const termosUsoUrlNormalizado = normalizarTexto(
    data.termosUsoUrl,
    DEFAULT_SISTEMA_CONFIG.termosUsoUrl,
    2000
  );
  const politicaPrivacidadeUrlNormalizado = normalizarTexto(
    data.politicaPrivacidadeUrl,
    DEFAULT_SISTEMA_CONFIG.politicaPrivacidadeUrl,
    2000
  );
  const ownerUidRaw = String(data.ownerUid || data.adminUid || "").trim();
  const ownerUidNormalizado = ownerUidRaw || null;
  const ownerEmailNormalizado = normalizarEmailOwner(data.ownerEmail || data.adminEmail);
  const projectSystemKeyNormalizado = limparProjectSystemKey(
    data.projectSystemKey || data.systemKey
  );
  const projectOwnerUidNormalizado =
    typeof data.projectOwnerUid === "string" && data.projectOwnerUid.trim()
      ? data.projectOwnerUid.trim()
      : (typeof data.criadoPorUid === "string" && data.criadoPorUid.trim()
          ? data.criadoPorUid.trim()
          : "");
  const projectLastEditorUidNormalizado =
    typeof data.projectLastEditorUid === "string" && data.projectLastEditorUid.trim()
      ? data.projectLastEditorUid.trim()
      : (typeof data.atualizadoPorUid === "string" && data.atualizadoPorUid.trim()
          ? data.atualizadoPorUid.trim()
          : "");
  const tipoExperienciaNormalizado = normalizarTipoExperiencia(data.tipoExperiencia);
  const modoAcessoProjetoNormalizado = normalizarModoAcessoProjeto(data.modoAcessoProjeto);
  const destinoPosLoginNormalizado = normalizarDestinoPosLogin(data.destinoPosLogin);
  const layoutTemaNormalizado = normalizarConfiguracaoLayoutTema({
    ...(data.layoutTema && typeof data.layoutTema === "object" ? data.layoutTema : {}),
    headerVisible:
      Object.prototype.hasOwnProperty.call(data, "layoutHeaderVisible")
        ? data.layoutHeaderVisible
        : data?.layoutTema?.headerVisible,
    headerHeightPx:
      Object.prototype.hasOwnProperty.call(data, "layoutHeaderHeightPx")
        ? data.layoutHeaderHeightPx
        : data?.layoutTema?.headerHeightPx,
    headerSticky:
      Object.prototype.hasOwnProperty.call(data, "layoutHeaderSticky")
        ? data.layoutHeaderSticky
        : data?.layoutTema?.headerSticky,
    navbarMenuSticky:
      Object.prototype.hasOwnProperty.call(data, "layoutNavbarMenuSticky")
        ? data.layoutNavbarMenuSticky
        : data?.layoutTema?.navbarMenuSticky,
    navbarTabsSticky:
      Object.prototype.hasOwnProperty.call(data, "layoutNavbarTabsSticky")
        ? data.layoutNavbarTabsSticky
        : data?.layoutTema?.navbarTabsSticky,
    cardProfileShape:
      Object.prototype.hasOwnProperty.call(data, "layoutCardProfileShape")
        ? data.layoutCardProfileShape
        : data?.layoutTema?.cardProfileShape,
    cardProfileSizePx:
      Object.prototype.hasOwnProperty.call(data, "layoutCardProfileSizePx")
        ? data.layoutCardProfileSizePx
        : data?.layoutTema?.cardProfileSizePx,
    menuPositionOverride:
      Object.prototype.hasOwnProperty.call(data, "layoutMenuPositionOverride")
        ? data.layoutMenuPositionOverride
        : data?.layoutTema?.menuPositionOverride,
    surfaceDensityOverride:
      Object.prototype.hasOwnProperty.call(data, "layoutSurfaceDensityOverride")
        ? data.layoutSurfaceDensityOverride
        : data?.layoutTema?.surfaceDensityOverride,
    frameMaxWidth:
      Object.prototype.hasOwnProperty.call(data, "layoutFrameMaxWidth")
        ? data.layoutFrameMaxWidth
        : data?.layoutTema?.frameMaxWidth,
    viewportMargin:
      Object.prototype.hasOwnProperty.call(data, "layoutViewportMargin")
        ? data.layoutViewportMargin
        : data?.layoutTema?.viewportMargin,
  });
  const limiteSkinsNormalizado =
    tipoExperienciaNormalizado === "oneowner"
      ? "1"
      : normalizarLimiteSkins(data.limiteSkinsPorUsuario);

  return {
    projectSystemKey: projectSystemKeyNormalizado,
    logoLoginUrl: logoNormalizada,
    faviconUrl: faviconNormalizado,
    loginButtonIconUrl: loginButtonIconUrlNormalizado,
    chatButtonIconUrl: chatButtonIconUrlNormalizado,
    iconSkinPadraoUrl: iconSkinPadraoUrlNormalizado,
    cardProfileUrl: cardProfileUrlNormalizado,
    cardProfilePath: cardProfilePathNormalizado,
    tituloSistema: tituloSistemaNormalizado,
    exibirTituloSistemaNoLogin: normalizarBoolean(
      data.exibirTituloSistemaNoLogin,
      DEFAULT_SISTEMA_CONFIG.exibirTituloSistemaNoLogin
    ),
    textoLogin: textoLoginNormalizado,
    loginLoadingMode: loginLoadingModeNormalizado,
    loginLoadingSpriteUrl: loginLoadingSpriteUrlNormalizado,
    solicitacaoStatusAguardandoSpriteUrl:
      solicitacaoStatusAguardandoSpriteUrlNormalizada,
    solicitacaoStatusConfirmadoIconUrl:
      solicitacaoStatusConfirmadoIconUrlNormalizada,
    googleFontsUrls: googleFontsUrlsNormalizadas,
    mensagemEspacoLoginRestrito: mensagemEspacoLoginRestritoNormalizada,
    mensagemEspacoLoginRestritoFontFamily:
      mensagemEspacoLoginRestritoFontFamilyNormalizada,
    mensagemEspacoAssinanteRestrito: mensagemEspacoAssinanteRestritoNormalizada,
    mensagemEspacoAssinanteRestritoFontFamily:
      mensagemEspacoAssinanteRestritoFontFamilyNormalizada,
    exibirBotaoLoginMensagemRestricao: normalizarBoolean(
      data.exibirBotaoLoginMensagemRestricao,
      DEFAULT_SISTEMA_CONFIG.exibirBotaoLoginMensagemRestricao
    ),
    exibirBadgeProjetoFirebase: normalizarBoolean(
      data.exibirBadgeProjetoFirebase,
      DEFAULT_SISTEMA_CONFIG.exibirBadgeProjetoFirebase
    ),
    mensagemRestricaoAvatarUrl: mensagemRestricaoAvatarUrlNormalizada,
    termosUsoUrl: termosUsoUrlNormalizado,
    politicaPrivacidadeUrl: politicaPrivacidadeUrlNormalizado,
    exigirAceiteTermosNoCadastro: normalizarBoolean(
      data.exigirAceiteTermosNoCadastro,
      DEFAULT_SISTEMA_CONFIG.exigirAceiteTermosNoCadastro
    ),
    larguraIconsLoginPx: normalizarLarguraIconsLogin(data.larguraIconsLoginPx),
    temaPadraoSistema: normalizarTemaSistema(data.temaPadraoSistema),
    layoutTema: layoutTemaNormalizado,
    loginPresetId: normalizarLoginPresetId(data.loginPresetId),
    tipoExperiencia: tipoExperienciaNormalizado,
    modoAcessoProjeto: modoAcessoProjetoNormalizado,
    destinoPosLogin: destinoPosLoginNormalizado,
    limiteSkinsPorUsuario: limiteSkinsNormalizado,
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
    livesHabilitadas: normalizarBoolean(
      data.livesHabilitadas,
      DEFAULT_SISTEMA_CONFIG.livesHabilitadas
    ),
    cardcaptorHabilitado: normalizarBoolean(
      data.cardcaptorHabilitado,
      DEFAULT_SISTEMA_CONFIG.cardcaptorHabilitado
    ),
    mercadoPagoHabilitado: normalizarBoolean(
      data.mercadoPagoHabilitado,
      DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
    ),
    pixManualHabilitado: normalizarBoolean(
      data.pixManualHabilitado,
      DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
    ),
    blocoCardsHabilitado: normalizarBoolean(
      data.blocoCardsHabilitado,
      DEFAULT_SISTEMA_CONFIG.blocoCardsHabilitado
    ),
    compraAssinaturaPaisesBloqueados: normalizarListaString(
      data.compraAssinaturaPaisesBloqueados
    ),
    compraAssinaturaRegioesBloqueadas: normalizarListaString(
      data.compraAssinaturaRegioesBloqueadas
    ),
    compraAssinaturaUfsBloqueadas: normalizarListaString(
      data.compraAssinaturaUfsBloqueadas
    ),
    compraAssinaturaCidadesBloqueadas: normalizarListaString(
      data.compraAssinaturaCidadesBloqueadas
    ),
    ownerUid: ownerUidNormalizado,
    ownerEmail: ownerEmailNormalizado,
    // Compatibilidade retroativa.
    adminUid: ownerUidNormalizado,
    adminEmail: ownerEmailNormalizado,
    iconCollectionIds: normalizarListaString(data.iconCollectionIds),
    projectOwnerUid: projectOwnerUidNormalizado,
    projectLastEditorUid: projectLastEditorUidNormalizado,
  };
}

export async function obterConfigSistema() {
  const hostnameAtual =
    typeof window !== "undefined" ? window.location.hostname || "" : "";
  const projectKeyContextual = obterProjectKeyContextual();
  const strictDomainMatch = exigirResolucaoEstritaPorDominio(hostnameAtual);

  try {
    const configGerenciada = await obterConfigProjetoDoGerenciador({
      projectKey: strictDomainMatch ? "" : (projectKeyContextual || activeFirebaseProjectKey),
      projectId: strictDomainMatch ? "" : activeFirebaseProjectId,
      hostname: hostnameAtual,
      strictDomainMatch,
    });

    if (configGerenciada) {
      const configNormalizada = aplicarDefaultsPorProjeto(
        normalizarConfigSistema(configGerenciada)
      );
      await sincronizarConfigSistemaRuntime(configNormalizada);
      salvarConfigSistemaCacheLocal(configNormalizada);
      return configNormalizada;
    }
  } catch {
    // Segue fallback local.
  }

  if (strictDomainMatch) {
    const error = new Error("Dominio publico nao vinculado a nenhum projeto do runtime compartilhado.");
    error.code = "project-domain-not-bound";
    throw error;
  }

  let snap = null;
  for (const refConfig of obterSistemaConfigRefsComFallback()) {
    const snapAtual = await getDoc(refConfig);
    if (snapAtual.exists()) {
      snap = snapAtual;
      break;
    }
  }

  if (!snap?.exists?.()) {
    const fallback = aplicarDefaultsPorProjeto(obterDefaultConfigSistemaProjeto());
    try {
      await setDoc(
        obterSistemaConfigRefPrincipal(),
        {
          ...fallback,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Segue com fallback local.
    }
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
  const projectKeyContextual = obterProjectKeyContextual();
  const strictDomainMatch = exigirResolucaoEstritaPorDominio(hostnameAtual);
  try {
    const configGerenciada = await obterConfigProjetoDoGerenciador({
      projectKey: strictDomainMatch ? "" : (projectKeyContextual || activeFirebaseProjectKey),
      projectId: strictDomainMatch ? "" : activeFirebaseProjectId,
      hostname: hostnameAtual,
      strictDomainMatch,
    });
    if (configGerenciada) return true;
  } catch {
    // Segue fallback local.
  }

  for (const refConfig of obterSistemaConfigRefsComFallback()) {
    const snap = await getDoc(refConfig);
    if (snap.exists()) {
      return true;
    }
  }
  return false;
}

export async function salvarConfigSistemaAdmin(configParcial = {}) {
  const configNormalizada = normalizarConfigSistema(configParcial);
  const hostnameAtual =
    typeof window !== "undefined" ? window.location.hostname || "" : "";
  const projectKeyContextual = obterProjectKeyContextual();
  const projectSystemKey = limparProjectSystemKey(
    configNormalizada.projectSystemKey || projectKeyContextual || activeFirebaseProjectKey
  );

  let salvoNoGerenciador = false;
  try {
    salvoNoGerenciador = await salvarConfigProjetoNoGerenciador({
      projectKey: projectSystemKey,
      projectId: activeFirebaseProjectId,
      hostname: hostnameAtual,
      configSistema: configNormalizada,
      atualizadoPorUid: configNormalizada.ownerUid || configNormalizada.adminUid || null,
    });
  } catch {
    salvoNoGerenciador = false;
  }

  if (!salvoNoGerenciador) {
    const refsConfig = obterSistemaConfigRefsComFallback();
    for (const refConfig of refsConfig) {
      await setDoc(
        refConfig,
        {
          ...configNormalizada,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } else {
    await sincronizarConfigSistemaRuntime(configNormalizada);
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
  const themeKey = String(layoutTheme || "")
    .trim()
    .toLowerCase();
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
  body.classList.add(`theme-${themeKey}`);
  THEME_CSS_LOADERS[themeKey]?.().catch(() => {});
}

