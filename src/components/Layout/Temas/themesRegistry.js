// Tema de sistema (identidade global) e tema de skin (visual da skin)
export const SYSTEM_THEMES = [
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
];

export const SKIN_THEMES = [
  {
    id: "CYBERPINK",
    label: "Cyberpink",
    extendsSystem: ["ALY_137"],
  },
  {
    id: "SUNSHINE",
    label: "Sunshine",
    extendsSystem: ["LOJA_DE_ROUPAS"],
  },
];

// Compatibilidade com imports antigos no sistema
export const THEMES = SKIN_THEMES;
