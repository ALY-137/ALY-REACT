// Tema de sistema (identidade global) e tema de skin (visual da skin)
const LEGACY_THEME_ID_ALIASES = {
  ALY_137: "CYBERPINK",
};

export const SYSTEM_THEMES = [
  {
    id: "PADRAO_INICIAL",
    label: "Padrao Inicial",
    layoutTheme: "PADRAO",
    wallpaper: "",
    description: "Tema temporario para primeira configuracao do sistema.",
  },
  {
    id: "CYBERPINK",
    label: "Cyberpink",
    layoutTheme: "CYBERPINK",
    wallpaper: "/bigSky.jpg",
    description: "Visual neon com identidade synth-tech e contraste alto.",
  },
  {
    id: "LOJA_DE_ROUPAS",
    label: "Loja de roupas",
    layoutTheme: "LOJADEROUPAS",
    wallpaper: "/sky.jpg",
    description: "Visual focado em e-commerce de moda.",
  },
  {
    id: "JORNAL",
    label: "Jornal",
    layoutTheme: "JORNAL",
    wallpaper: "/backConteudo.png",
    description: "Visual inspirado em blog/portal de noticias.",
  },
  {
    id: "OBEYDOM",
    label: "Obeydom",
    layoutTheme: "OBEYDOM",
    wallpaper: "",
    description: "Tema dark confortavel com acentos vinho e tipografia editorial.",
  },
  {
    id: "PASSY",
    label: "Passy",
    layoutTheme: "PASSY",
    wallpaper: "",
    description: "Tema suave com paleta candy-tech em rosa, azul e lavanda.",
  },
];

export const SKIN_THEMES = [
  {
    id: "PADRAO_INICIAL",
    label: "Padrao Inicial",
    family: "PADRAO_INICIAL",
    cssTheme: "PADRAO",
    extendsSystem: ["PADRAO_INICIAL"],
    isPrimary: true,
    layout: {
      menuPosition: "drawer",
      surfaceDensity: "compact",
      frameMaxWidth: 995,
      viewportMargin: 5,
    },
  },
  {
    id: "CYBERPINK",
    label: "Cyberpink (padrao)",
    family: "CYBERPINK",
    cssTheme: "CYBERPINK",
    extendsSystem: ["CYBERPINK", "ALY_137"],
    isPrimary: true,
    layout: {
      menuPosition: "drawer",
      surfaceDensity: "compact",
      frameMaxWidth: 995,
      viewportMargin: 5,
    },
  },
  {
    id: "LOJA_DE_ROUPAS",
    label: "Loja de roupas (padrao)",
    family: "LOJA_DE_ROUPAS",
    cssTheme: "LOJADEROUPAS",
    extendsSystem: ["LOJA_DE_ROUPAS"],
    isPrimary: true,
    layout: {
      menuPosition: "drawer",
      surfaceDensity: "comfortable",
      frameMaxWidth: 1100,
      viewportMargin: 8,
    },
  },
  {
    id: "SUNSHINE",
    label: "Sunshine",
    family: "LOJA_DE_ROUPAS",
    cssTheme: "SUNSHINE",
    extendsSystem: ["LOJA_DE_ROUPAS"],
    isPrimary: false,
    layout: {
      menuPosition: "drawer",
      surfaceDensity: "comfortable",
      frameMaxWidth: 1100,
      viewportMargin: 8,
    },
  },
  {
    id: "JORNAL",
    label: "Jornal (padrao)",
    family: "JORNAL",
    cssTheme: "JORNAL",
    extendsSystem: ["JORNAL"],
    isPrimary: true,
    layout: {
      menuPosition: "top",
      surfaceDensity: "airy",
      frameMaxWidth: 1200,
      viewportMargin: 16,
    },
  },
  {
    id: "OBEYDOM",
    label: "Obeydom (padrao)",
    family: "OBEYDOM",
    cssTheme: "OBEYDOM",
    extendsSystem: ["OBEYDOM"],
    isPrimary: true,
    layout: {
      menuPosition: "top",
      surfaceDensity: "airy",
      frameMaxWidth: 1160,
      viewportMargin: 16,
    },
  },
  {
    id: "PASSY",
    label: "Passy (padrao)",
    family: "PASSY",
    cssTheme: "PASSY",
    extendsSystem: ["PASSY"],
    isPrimary: true,
    layout: {
      menuPosition: "top",
      surfaceDensity: "comfortable",
      frameMaxWidth: 1120,
      viewportMargin: 14,
    },
  },
];

// Compatibilidade com imports antigos no sistema
export const THEMES = SKIN_THEMES;

export const LAYOUT_STANDARD_OPERATIONS = [
  {
    id: "menuPositionOverride",
    label: "Posicao do menu",
    description: "Permite herdar o tema base ou forcar gaveta lateral / abas superiores.",
  },
  {
    id: "surfaceDensityOverride",
    label: "Densidade da interface",
    description: "Controla o ritmo do layout entre compacto, confortavel e arejado.",
  },
  {
    id: "frameMaxWidth",
    label: "Largura maxima do frame",
    description: "Define a largura util maxima da estrutura central do layout.",
  },
  {
    id: "viewportMargin",
    label: "Margem do viewport",
    description: "Define o respiro minimo entre a estrutura e as bordas da tela.",
  },
  {
    id: "headerVisible",
    label: "Visibilidade do cabecalho",
    description: "Permite exibir ou ocultar o cabecalho principal da estrutura.",
  },
  {
    id: "headerHeightPx",
    label: "Altura do cabecalho",
    description: "Padroniza a altura do cabecalho para todos os temas que usam estrutura.",
  },
  {
    id: "headerSticky",
    label: "Cabecalho fixo ao rolar",
    description: "Controla se o cabecalho principal permanece fixo durante a rolagem.",
  },
  {
    id: "navbarTabsSticky",
    label: "Abas do navbar fixas ao rolar",
    description: "Controla se as abas do navbar permanecem fixas enquanto o conteudo rola.",
  },
  {
    id: "cardProfileShape",
    label: "Forma do card profile",
    description: "Alterna o tratamento visual do card profile entre quadrado e arredondado.",
  },
  {
    id: "cardProfileSizePx",
    label: "Tamanho do card profile",
    description: "Define o tamanho padrao do card profile dentro do cabecalho.",
  },
];

function normalizarIdTema(value) {
  const temaId = String(value || "").trim().toUpperCase();
  return LEGACY_THEME_ID_ALIASES[temaId] || temaId;
}

export function normalizarTemaRegistrado(value) {
  return normalizarIdTema(value);
}

function ordenarTemasFamilia(temas = []) {
  return [...temas].sort((a, b) => {
    if (!!a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && !!b.isPrimary) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function obterTemaSkinDefinicao(temaSkinId) {
  const temaSkin = normalizarIdTema(temaSkinId);
  return SKIN_THEMES.find((theme) => normalizarIdTema(theme.id) === temaSkin) || null;
}

function obterFamiliaTemaSkin(temaSkin) {
  if (!temaSkin) return "";
  return normalizarIdTema(temaSkin.family || temaSkin.id);
}

export function obterTemaSkinPadrao(temaSistemaId) {
  const temaSistema = normalizarIdTema(temaSistemaId);
  if (!temaSistema) {
    return SKIN_THEMES[0]?.id || "CYBERPINK";
  }

  const temaMesmoNome = obterTemaSkinDefinicao(temaSistema);
  if (temaMesmoNome && obterFamiliaTemaSkin(temaMesmoNome) === temaSistema) {
    return temaMesmoNome.id;
  }

  const temasDaFamilia = SKIN_THEMES.filter(
    (theme) => obterFamiliaTemaSkin(theme) === temaSistema
  );
  const [primeiroDaFamilia] = ordenarTemasFamilia(temasDaFamilia);
  if (primeiroDaFamilia?.id) {
    return primeiroDaFamilia.id;
  }

  const matchPorExtensao = SKIN_THEMES.find((theme) => {
    return (
      Array.isArray(theme.extendsSystem) &&
      theme.extendsSystem
        .map((item) => String(item || "").toUpperCase())
        .includes(temaSistema)
    );
  });

  if (matchPorExtensao?.id) {
    return matchPorExtensao.id;
  }

  return SKIN_THEMES[0]?.id || "CYBERPINK";
}

export function listarTemasSkinDaFamilia(
  temaSistemaId,
  permitirTemasSkinSecundarios = true
) {
  const temaSistema = normalizarIdTema(temaSistemaId);
  const temaPadraoId = obterTemaSkinPadrao(temaSistema);
  const temaPadraoDef = obterTemaSkinDefinicao(temaPadraoId);
  const familia = obterFamiliaTemaSkin(temaPadraoDef) || temaSistema;

  const temasDaFamilia = ordenarTemasFamilia(
    SKIN_THEMES.filter((theme) => obterFamiliaTemaSkin(theme) === familia)
  );

  if (!permitirTemasSkinSecundarios) {
    return temaPadraoDef ? [temaPadraoDef] : [];
  }

  // Com secundarios liberados no sistema, disponibiliza todos os temas de skin.
  return ordenarTemasFamilia(SKIN_THEMES);
}

export function resolverTemaSkinEfetivo(
  temaSkinId,
  temaSistemaId,
  permitirTemasSkinSecundarios = true
) {
  const temaPadraoId = obterTemaSkinPadrao(temaSistemaId);
  const temaSelecionadoDef = obterTemaSkinDefinicao(temaSkinId);

  if (!temaSelecionadoDef) {
    return temaPadraoId;
  }

  if (permitirTemasSkinSecundarios) {
    return temaSelecionadoDef.id;
  }

  return temaPadraoId;
}

export function obterCssTemaSkin(temaSkinId) {
  const temaDef = obterTemaSkinDefinicao(temaSkinId);
  if (!temaDef) return "CYBERPINK";
  return normalizarIdTema(temaDef.cssTheme || temaDef.id || "CYBERPINK");
}

export function temaSistemaUsaLoginRitual(themeId) {
  const normalizado = normalizarIdTema(themeId);
  return normalizado === "OBEYDOM";
}

const LAYOUT_MENU_POSITIONS = new Set(["drawer", "top"]);
const LAYOUT_SURFACE_DENSITIES = new Set(["compact", "comfortable", "airy"]);
const LAYOUT_MENU_POSITION_OVERRIDES = new Set(["inherit", "drawer", "top"]);
const LAYOUT_SURFACE_DENSITY_OVERRIDES = new Set([
  "inherit",
  "compact",
  "comfortable",
  "airy",
]);
const LAYOUT_CARD_PROFILE_SHAPES = new Set(["round", "square"]);

const DEFAULT_LAYOUT_TEMA_SKIN = {
  menuPosition: "drawer",
  surfaceDensity: "compact",
  frameMaxWidth: 995,
  viewportMargin: 5,
  headerVisible: true,
  headerHeightPx: 40,
  headerSticky: true,
  navbarTabsSticky: true,
  cardProfileShape: "round",
  cardProfileSizePx: 170,
};

export const DEFAULT_LAYOUT_THEME_OVERRIDES = {
  menuPositionOverride: "inherit",
  surfaceDensityOverride: "inherit",
  frameMaxWidth: null,
  viewportMargin: null,
  headerVisible: true,
  headerHeightPx: 40,
  headerSticky: true,
  navbarTabsSticky: true,
  cardProfileShape: "round",
  cardProfileSizePx: 170,
};

function normalizarNumeroLayout(value, fallback, min, max) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return fallback;
  if (numero < min) return min;
  if (numero > max) return max;
  return numero;
}

function normalizarNumeroLayoutOpcional(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const numero = Number(value);
  if (!Number.isFinite(numero)) return null;
  if (numero < min) return min;
  if (numero > max) return max;
  return Math.round(numero);
}

export function normalizarConfiguracaoLayoutTema(value = {}) {
  const origem = value && typeof value === "object" ? value : {};
  const menuPositionOverride = String(origem.menuPositionOverride || "")
    .trim()
    .toLowerCase();
  const surfaceDensityOverride = String(origem.surfaceDensityOverride || "")
    .trim()
    .toLowerCase();
  const cardProfileShape = String(origem.cardProfileShape || "")
    .trim()
    .toLowerCase();

  return {
    menuPositionOverride: LAYOUT_MENU_POSITION_OVERRIDES.has(menuPositionOverride)
      ? menuPositionOverride
      : DEFAULT_LAYOUT_THEME_OVERRIDES.menuPositionOverride,
    surfaceDensityOverride: LAYOUT_SURFACE_DENSITY_OVERRIDES.has(surfaceDensityOverride)
      ? surfaceDensityOverride
      : DEFAULT_LAYOUT_THEME_OVERRIDES.surfaceDensityOverride,
    frameMaxWidth: normalizarNumeroLayoutOpcional(origem.frameMaxWidth, 720, 1600),
    viewportMargin: normalizarNumeroLayoutOpcional(origem.viewportMargin, 4, 40),
    headerVisible:
      typeof origem.headerVisible === "boolean"
        ? origem.headerVisible
        : DEFAULT_LAYOUT_THEME_OVERRIDES.headerVisible,
    headerHeightPx: normalizarNumeroLayout(
      origem.headerHeightPx,
      DEFAULT_LAYOUT_THEME_OVERRIDES.headerHeightPx,
      32,
      160
    ),
    headerSticky:
      typeof origem.headerSticky === "boolean"
        ? origem.headerSticky
        : typeof origem.navbarMenuSticky === "boolean"
          ? origem.navbarMenuSticky
          : DEFAULT_LAYOUT_THEME_OVERRIDES.headerSticky,
    navbarTabsSticky:
      typeof origem.navbarTabsSticky === "boolean"
        ? origem.navbarTabsSticky
        : DEFAULT_LAYOUT_THEME_OVERRIDES.navbarTabsSticky,
    cardProfileShape: LAYOUT_CARD_PROFILE_SHAPES.has(cardProfileShape)
      ? cardProfileShape
      : DEFAULT_LAYOUT_THEME_OVERRIDES.cardProfileShape,
    cardProfileSizePx: normalizarNumeroLayout(
      origem.cardProfileSizePx,
      DEFAULT_LAYOUT_THEME_OVERRIDES.cardProfileSizePx,
      96,
      320
    ),
  };
}

export function obterConfigLayoutTemaSkin(temaSkinId, layoutOverrides = null) {
  const temaDef = obterTemaSkinDefinicao(temaSkinId);
  const layout = temaDef?.layout || {};
  const overrides = normalizarConfiguracaoLayoutTema(layoutOverrides || {});

  const menuPosition = String(layout.menuPosition || "").toLowerCase();
  const surfaceDensity = String(layout.surfaceDensity || "").toLowerCase();

  return {
    menuPosition:
      overrides.menuPositionOverride !== "inherit"
        ? overrides.menuPositionOverride
        : LAYOUT_MENU_POSITIONS.has(menuPosition)
          ? menuPosition
          : DEFAULT_LAYOUT_TEMA_SKIN.menuPosition,
    surfaceDensity:
      overrides.surfaceDensityOverride !== "inherit"
        ? overrides.surfaceDensityOverride
        : LAYOUT_SURFACE_DENSITIES.has(surfaceDensity)
          ? surfaceDensity
          : DEFAULT_LAYOUT_TEMA_SKIN.surfaceDensity,
    frameMaxWidth: normalizarNumeroLayout(
      overrides.frameMaxWidth ?? layout.frameMaxWidth,
      DEFAULT_LAYOUT_TEMA_SKIN.frameMaxWidth,
      720,
      1600
    ),
    viewportMargin: normalizarNumeroLayout(
      overrides.viewportMargin ?? layout.viewportMargin,
      DEFAULT_LAYOUT_TEMA_SKIN.viewportMargin,
      4,
      40
    ),
    headerVisible: overrides.headerVisible,
    headerHeightPx: overrides.headerHeightPx,
    headerSticky: overrides.headerSticky,
    navbarTabsSticky: overrides.navbarTabsSticky,
    cardProfileShape: overrides.cardProfileShape,
    cardProfileSizePx: overrides.cardProfileSizePx,
  };
}

const SYSTEM_THEME_IDS = new Set(SYSTEM_THEMES.map((theme) => normalizarIdTema(theme.id)));
const SKIN_THEME_BASE_IDS = new Set(
  SKIN_THEMES.filter((theme) => normalizarIdTema(theme.id) === obterFamiliaTemaSkin(theme)).map(
    (theme) => normalizarIdTema(theme.id)
  )
);

if (typeof console !== "undefined") {
  SYSTEM_THEME_IDS.forEach((themeId) => {
    if (!SKIN_THEME_BASE_IDS.has(themeId)) {
      console.warn(
        `[themes] System theme "${themeId}" sem skin theme base da mesma familia.`
      );
    }
  });
}
