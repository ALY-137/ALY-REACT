// Tema de sistema (identidade global) e tema de skin (visual da skin)
export const SYSTEM_THEMES = [
  {
    id: "PADRAO_INICIAL",
    label: "Padrao Inicial",
    layoutTheme: "PADRAO",
    wallpaper: "",
    description: "Tema temporario para primeira configuracao do sistema.",
  },
  {
    id: "ALY_137",
    label: "Aly-137",
    layoutTheme: "CYBERPINK",
    wallpaper: "/bigSky.jpg",
    description: "Identidade atual baseada em Cyberpink.",
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
    id: "ALY_137",
    label: "Aly-137 (padrao)",
    family: "ALY_137",
    cssTheme: "CYBERPINK",
    extendsSystem: ["ALY_137"],
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
    label: "Cyberpink",
    family: "ALY_137",
    cssTheme: "CYBERPINK",
    extendsSystem: ["ALY_137"],
    isPrimary: false,
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
];

// Compatibilidade com imports antigos no sistema
export const THEMES = SKIN_THEMES;

function normalizarIdTema(value) {
  return String(value || "").trim().toUpperCase();
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

  if (temasDaFamilia.length > 0) {
    return temasDaFamilia;
  }

  return temaPadraoDef ? [temaPadraoDef] : [];
}

export function resolverTemaSkinEfetivo(
  temaSkinId,
  temaSistemaId,
  permitirTemasSkinSecundarios = true
) {
  const temaPadraoId = obterTemaSkinPadrao(temaSistemaId);
  const temaPadraoDef = obterTemaSkinDefinicao(temaPadraoId);
  const familiaPadrao = obterFamiliaTemaSkin(temaPadraoDef);
  const temaSelecionadoDef = obterTemaSkinDefinicao(temaSkinId);

  if (!temaSelecionadoDef) {
    return temaPadraoId;
  }

  const familiaSelecionada = obterFamiliaTemaSkin(temaSelecionadoDef);
  if (familiaSelecionada !== familiaPadrao) {
    return temaPadraoId;
  }

  if (
    !permitirTemasSkinSecundarios &&
    normalizarIdTema(temaSelecionadoDef.id) !== normalizarIdTema(temaPadraoId)
  ) {
    return temaPadraoId;
  }

  return temaSelecionadoDef.id;
}

export function obterCssTemaSkin(temaSkinId) {
  const temaDef = obterTemaSkinDefinicao(temaSkinId);
  if (!temaDef) return "CYBERPINK";
  return normalizarIdTema(temaDef.cssTheme || temaDef.id || "CYBERPINK");
}

const LAYOUT_MENU_POSITIONS = new Set(["drawer", "top"]);
const LAYOUT_SURFACE_DENSITIES = new Set(["compact", "comfortable", "airy"]);

const DEFAULT_LAYOUT_TEMA_SKIN = {
  menuPosition: "drawer",
  surfaceDensity: "compact",
  frameMaxWidth: 995,
  viewportMargin: 5,
};

function normalizarNumeroLayout(value, fallback, min, max) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return fallback;
  if (numero < min) return min;
  if (numero > max) return max;
  return numero;
}

export function obterConfigLayoutTemaSkin(temaSkinId) {
  const temaDef = obterTemaSkinDefinicao(temaSkinId);
  const layout = temaDef?.layout || {};

  const menuPosition = String(layout.menuPosition || "").toLowerCase();
  const surfaceDensity = String(layout.surfaceDensity || "").toLowerCase();

  return {
    menuPosition: LAYOUT_MENU_POSITIONS.has(menuPosition)
      ? menuPosition
      : DEFAULT_LAYOUT_TEMA_SKIN.menuPosition,
    surfaceDensity: LAYOUT_SURFACE_DENSITIES.has(surfaceDensity)
      ? surfaceDensity
      : DEFAULT_LAYOUT_TEMA_SKIN.surfaceDensity,
    frameMaxWidth: normalizarNumeroLayout(
      layout.frameMaxWidth,
      DEFAULT_LAYOUT_TEMA_SKIN.frameMaxWidth,
      720,
      1600
    ),
    viewportMargin: normalizarNumeroLayout(
      layout.viewportMargin,
      DEFAULT_LAYOUT_TEMA_SKIN.viewportMargin,
      4,
      40
    ),
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
