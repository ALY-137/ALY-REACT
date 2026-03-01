import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { obterConfigLayoutTemaSkin, obterCssTemaSkin } from "./themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

export default function Layout({ profile, content, theme }) {
  const fundoRef = useRef();
  const cabecalhoRef = useRef();
  const conteudoRef = useRef();
  const [configSistema, setConfigSistema] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const onePagePublicaAtiva =
    configSistema?.tipoExperiencia === "onepage" &&
    configSistema?.modoAcessoProjeto === "publico_sem_login";
  const layoutConfig = useMemo(
    () => obterConfigLayoutTemaSkin(theme, configSistema?.layoutTema),
    [theme, configSistema?.layoutTema]
  );
  const alturaCabecalhoEfetiva =
    onePagePublicaAtiva && layoutConfig.headerVisible
      ? Math.max(layoutConfig.headerHeightPx, 200)
      : layoutConfig.headerHeightPx;
  const layoutClassName = useMemo(
    () =>
      `layout-shell layout-menu-${layoutConfig.menuPosition} layout-density-${layoutConfig.surfaceDensity}`,
    [layoutConfig.menuPosition, layoutConfig.surfaceDensity]
  );

  useEffect(() => {
    const handleConfigSistemaAtualizada = (event) => {
      const configAtualizada = event?.detail;
      if (!configAtualizada || typeof configAtualizada !== "object") return;
      setConfigSistema(configAtualizada);
    };

    window.addEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    return () => {
      window.removeEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    };
  }, []);

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

    import(`./${cssTheme.toLowerCase()}.css`).catch(console.error);
  }, [
    theme,
    layoutConfig.menuPosition,
    layoutConfig.surfaceDensity,
    layoutConfig.cardProfileShape,
    layoutConfig.headerVisible,
    layoutConfig.headerSticky,
    layoutConfig.navbarTabsSticky,
    layoutConfig.headerHeightPx,
    alturaCabecalhoEfetiva,
    onePagePublicaAtiva,
  ]);

  return (
    <div id="fundo" ref={fundoRef} className={layoutClassName}>
      <div id="cabecalho" ref={cabecalhoRef}>
        {profile}
      </div>

      <div id="conteudo" ref={conteudoRef}>
        {content}
      </div>
    </div>
  );
}
