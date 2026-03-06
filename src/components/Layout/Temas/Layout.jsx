import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { obterConfigLayoutTemaSkin, obterCssTemaSkin } from "./themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

const ONEPAGE_HEADER_VERTICAL_PADDING = 32;

export default function Layout({
  profile,
  navigation = null,
  content,
  theme,
  configSistemaOverride = null,
  cardProfileDimensionsOverride = null,
}) {
  const fundoRef = useRef();
  const cabecalhoRef = useRef();
  const conteudoRef = useRef();
  const [configSistema, setConfigSistema] = useState(
    () => configSistemaOverride || obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const configSistemaEfetiva = configSistemaOverride || configSistema;
  const onePagePublicaAtiva = isOnePageComEntradaPublica(configSistemaEfetiva);
  const layoutConfig = useMemo(
    () => obterConfigLayoutTemaSkin(theme, configSistemaEfetiva?.layoutTema),
    [theme, configSistemaEfetiva?.layoutTema]
  );
  const dimensoesCardProfileEfetivas = useMemo(() => {
    const larguraOverride = Number(cardProfileDimensionsOverride?.width || 0);
    const alturaOverride = Number(cardProfileDimensionsOverride?.height || 0);

    if (larguraOverride > 0 && alturaOverride > 0) {
      return {
        width: larguraOverride,
        height: alturaOverride,
      };
    }

    return {
      width: layoutConfig.cardProfileSizePx,
      height: layoutConfig.cardProfileSizePx,
    };
  }, [cardProfileDimensionsOverride, layoutConfig.cardProfileSizePx]);
  const alturaCabecalhoEfetiva =
    onePagePublicaAtiva && layoutConfig.headerVisible
      ? Math.max(
          layoutConfig.headerHeightPx,
          dimensoesCardProfileEfetivas.height + ONEPAGE_HEADER_VERTICAL_PADDING
        )
      : layoutConfig.headerHeightPx;
  const layoutClassName = useMemo(
    () =>
      `layout-shell layout-menu-${layoutConfig.menuPosition} layout-density-${layoutConfig.surfaceDensity}`,
    [layoutConfig.menuPosition, layoutConfig.surfaceDensity]
  );

  useEffect(() => {
    if (!configSistemaOverride || typeof configSistemaOverride !== "object") return;
    setConfigSistema(configSistemaOverride);
  }, [configSistemaOverride]);

  useEffect(() => {
    const handleConfigSistemaAtualizada = (event) => {
      if (configSistemaOverride && typeof configSistemaOverride === "object") return;
      const configAtualizada = event?.detail;
      if (!configAtualizada || typeof configAtualizada !== "object") return;
      setConfigSistema(configAtualizada);
    };

    window.addEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    return () => {
      window.removeEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    };
  }, [configSistemaOverride]);

  // ---------- Layout Responsivo ----------
  useEffect(() => {
    const atualizarLayout = () => {
      const larScreen = window.innerWidth;
      const altSreen = window.innerHeight;
      const margemViewport = layoutConfig.viewportMargin;
      const larguraMaxima = layoutConfig.frameMaxWidth;
      const larguraBase =
        larScreen > larguraMaxima + margemViewport
          ? larguraMaxima
          : Math.max(320, larScreen - margemViewport);

      if (fundoRef.current) {
        fundoRef.current.style.display = "block";
        fundoRef.current.style.height = `${Math.max(460, altSreen - margemViewport)}px`;
        fundoRef.current.style.width = `${larguraBase}px`;
      }

      if (cabecalhoRef.current) {
        cabecalhoRef.current.style.display = layoutConfig.headerVisible ? "flex" : "none";
        cabecalhoRef.current.style.width = `${larguraBase}px`;
        cabecalhoRef.current.style.height = `${alturaCabecalhoEfetiva}px`;
        cabecalhoRef.current.style.minHeight = `${alturaCabecalhoEfetiva}px`;
        cabecalhoRef.current.style.flexDirection = onePagePublicaAtiva ? "column" : "";
        cabecalhoRef.current.style.justifyContent = onePagePublicaAtiva ? "center" : "";
        cabecalhoRef.current.style.alignItems = onePagePublicaAtiva ? "center" : "";
        cabecalhoRef.current.style.gap = onePagePublicaAtiva ? "14px" : "";
      }

      if (conteudoRef.current) {
        conteudoRef.current.style.height = `${altSreen}px`;
        conteudoRef.current.style.width = "100%";
      }
    };

    atualizarLayout();
    window.addEventListener("resize", atualizarLayout);
    return () => window.removeEventListener("resize", atualizarLayout);
  }, [
    layoutConfig.frameMaxWidth,
    layoutConfig.viewportMargin,
    layoutConfig.headerVisible,
    layoutConfig.headerHeightPx,
    alturaCabecalhoEfetiva,
    onePagePublicaAtiva,
  ]);

  // ---------- Tema ----------
  useLayoutEffect(() => {
    if (!theme) return;

    const cssTheme = obterCssTemaSkin(theme);
    const body = document.body;
    const root = document.documentElement;

    Array.from(body.classList).forEach(cls => {
      if (
        cls.startsWith("theme-") ||
        cls.startsWith("layout-menu-") ||
        cls.startsWith("layout-density-") ||
        cls.startsWith("layout-cardprofile-")
      ) {
        body.classList.remove(cls);
      }
    });

    body.classList.add(`theme-${cssTheme.toLowerCase()}`);
    body.classList.add(`layout-menu-${layoutConfig.menuPosition}`);
    body.classList.add(`layout-density-${layoutConfig.surfaceDensity}`);
    body.classList.add(`layout-cardprofile-${layoutConfig.cardProfileShape}`);
    body.classList.toggle("layout-header-hidden", !layoutConfig.headerVisible);
    body.classList.toggle(
      "layout-header-sticky-disabled",
      layoutConfig.headerSticky === false
    );
    body.classList.toggle(
      "layout-navbar-tabs-sticky-disabled",
      layoutConfig.navbarTabsSticky === false
    );
    body.classList.toggle(
      "layout-onepage-header-active",
      onePagePublicaAtiva && layoutConfig.headerVisible
    );
    root.style.setProperty("--layout-header-height", `${alturaCabecalhoEfetiva}px`);
    root.style.setProperty(
      "--layout-card-profile-radius",
      layoutConfig.cardProfileShape === "square" ? "0px" : "24px"
    );
    root.style.setProperty(
      "--layout-card-profile-size",
      `${layoutConfig.cardProfileSizePx}px`
    );
    root.style.setProperty(
      "--layout-card-profile-width",
      `${dimensoesCardProfileEfetivas.width}px`
    );
    root.style.setProperty(
      "--layout-card-profile-height",
      `${dimensoesCardProfileEfetivas.height}px`
    );

    import(`./${cssTheme.toLowerCase()}.css`).catch(console.error);
  }, [
    theme,
    layoutConfig.menuPosition,
    layoutConfig.surfaceDensity,
    layoutConfig.cardProfileShape,
    layoutConfig.cardProfileSizePx,
    layoutConfig.headerVisible,
    layoutConfig.headerSticky,
    layoutConfig.navbarTabsSticky,
    layoutConfig.headerHeightPx,
    dimensoesCardProfileEfetivas.height,
    dimensoesCardProfileEfetivas.width,
    alturaCabecalhoEfetiva,
    onePagePublicaAtiva,
  ]);

  return (
    <div id="fundo" ref={fundoRef} className={layoutClassName}>
      <div id="cabecalho" ref={cabecalhoRef}>
        {profile}
      </div>

      {navigation ? <div id="navegacao">{navigation}</div> : null}

      <div id="conteudo" ref={conteudoRef}>
        {content}
      </div>
    </div>
  );
}
