import { useEffect, useMemo } from "react";

import theMatrixHome, {
  configureMatrixHomeMessage,
  resetMatrixHomeScene,
} from "../../Scripts/matrixHome";
import { normalizarTemaRegistrado } from "../Temas/themesRegistry";
import "./project-maintenance.css";

const THEME_COPY = {
  CYBERPINK: {
    eyebrow: "EM MANUTEN\u00c7\u00c3O",
    title: "EM CRIA\u00c7\u00c3O",
    description:
      "Estamos ajustando a estrutura deste projeto. O acesso publico volta quando a nova versao estiver pronta.",
  },
  PASSY: {
    eyebrow: "EM MANUTEN\u00c7\u00c3O",
    title: "Passando por ajustes",
    description:
      "Estamos reorganizando o ambiente para a proxima entrega. O acesso via dominio fica pausado ate a reabertura.",
  },
  OBEYDOM: {
    eyebrow: "EM MANUTEN\u00c7\u00c3O",
    title: "Ritual de reconstrucao",
    description:
      "O projeto esta em uma janela controlada de manutencao. Assim que a estrutura estiver alinhada, o acesso volta.",
  },
  JORNAL: {
    eyebrow: "EDICAO FECHADA",
    title: "Redacao em manutencao",
    description:
      "O conteudo esta sendo reorganizado para a proxima edicao. O dominio volta a publicar assim que a atualizacao terminar.",
  },
  LOJA_DE_ROUPAS: {
    eyebrow: "EM MANUTEN\u00c7\u00c3O",
    title: "Vitrine em reorganizacao",
    description:
      "Estamos montando a proxima colecao deste projeto. O dominio permanece fechado enquanto finalizamos a atualizacao.",
  },
};

function resolveThemeCopy(themeId = "CYBERPINK") {
  return THEME_COPY[themeId] || THEME_COPY.CYBERPINK;
}

function CyberpinkMaintenanceAnimation() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    configureMatrixHomeMessage({
      headline: "EM",
      subheadline: "CRIA\u00c7\u00c3O",
    });
    resetMatrixHomeScene();

    const height = Math.min(Math.max(window.innerHeight * 0.34, 180), 320);
    const width = Math.min(Math.max(window.innerWidth * 0.55, 260), 620);
    const raf = window.requestAnimationFrame(() => {
      theMatrixHome(height, width);
    });

    return () => {
      window.cancelAnimationFrame(raf);
      configureMatrixHomeMessage({
        headline: "BOAS-VINDAS",
        subheadline: "",
      });
      resetMatrixHomeScene();
    };
  }, []);

  return (
    <div className="project-maintenance__matrix-frame" aria-hidden="true">
      <div id="MatrixHome" />
    </div>
  );
}

function ThemeMaintenanceAnimation({ themeId = "CYBERPINK" }) {
  if (themeId === "CYBERPINK") {
    return <CyberpinkMaintenanceAnimation />;
  }

  if (themeId === "PASSY") {
    return (
      <div className="project-maintenance__scene project-maintenance__scene--passy" aria-hidden="true">
        <span className="project-maintenance__passy-orb project-maintenance__passy-orb--a" />
        <span className="project-maintenance__passy-orb project-maintenance__passy-orb--b" />
        <span className="project-maintenance__passy-orb project-maintenance__passy-orb--c" />
      </div>
    );
  }

  if (themeId === "OBEYDOM") {
    return (
      <div className="project-maintenance__scene project-maintenance__scene--obeydom" aria-hidden="true">
        <span className="project-maintenance__obeydom-ring project-maintenance__obeydom-ring--outer" />
        <span className="project-maintenance__obeydom-ring project-maintenance__obeydom-ring--mid" />
        <span className="project-maintenance__obeydom-core" />
      </div>
    );
  }

  if (themeId === "JORNAL") {
    return (
      <div className="project-maintenance__scene project-maintenance__scene--jornal" aria-hidden="true">
        <span className="project-maintenance__jornal-strip project-maintenance__jornal-strip--a" />
        <span className="project-maintenance__jornal-strip project-maintenance__jornal-strip--b" />
        <span className="project-maintenance__jornal-strip project-maintenance__jornal-strip--c" />
      </div>
    );
  }

  if (themeId === "LOJA_DE_ROUPAS") {
    return (
      <div className="project-maintenance__scene project-maintenance__scene--loja" aria-hidden="true">
        <span className="project-maintenance__loja-card project-maintenance__loja-card--left" />
        <span className="project-maintenance__loja-card project-maintenance__loja-card--center" />
        <span className="project-maintenance__loja-card project-maintenance__loja-card--right" />
      </div>
    );
  }

  return (
    <div className="project-maintenance__scene project-maintenance__scene--default" aria-hidden="true">
      <span className="project-maintenance__default-bar project-maintenance__default-bar--a" />
      <span className="project-maintenance__default-bar project-maintenance__default-bar--b" />
      <span className="project-maintenance__default-bar project-maintenance__default-bar--c" />
    </div>
  );
}

function ProjectMaintenanceScreen({ configSistema = {}, themeId = "CYBERPINK" }) {
  const temaNormalizado = normalizarTemaRegistrado(themeId || configSistema?.temaPadraoSistema);
  const copy = useMemo(() => resolveThemeCopy(temaNormalizado), [temaNormalizado]);
  const tituloSistema = String(
    configSistema?.tituloSistema || configSistema?.nomeProjeto || "Projeto"
  ).trim();

  return (
    <section className={`project-maintenance project-maintenance--${temaNormalizado.toLowerCase()}`}>
      <div className="project-maintenance__shell">
        <div className="project-maintenance__copy">
          <p className="project-maintenance__eyebrow">{copy.eyebrow}</p>
          <h1 className="project-maintenance__title">{copy.title}</h1>
          <p className="project-maintenance__text">{copy.description}</p>
          <div className="project-maintenance__meta">
            <span className="project-maintenance__meta-chip">{tituloSistema}</span>
            <span className="project-maintenance__meta-chip">Acesso via dominio pausado</span>
          </div>
        </div>
        <div className="project-maintenance__visual">
          <ThemeMaintenanceAnimation themeId={temaNormalizado} />
        </div>
      </div>
    </section>
  );
}

export default ProjectMaintenanceScreen;
