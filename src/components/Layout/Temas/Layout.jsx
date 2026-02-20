import React, { useEffect, useMemo, useRef } from "react";
import { obterConfigLayoutTemaSkin, obterCssTemaSkin } from "./themesRegistry";

export default function Layout({ profile, content, theme }) {
  const fundoRef = useRef();
  const cabecalhoRef = useRef();
  const conteudoRef = useRef();
  const layoutConfig = useMemo(() => obterConfigLayoutTemaSkin(theme), [theme]);
  const layoutClassName = useMemo(
    () =>
      `layout-shell layout-menu-${layoutConfig.menuPosition} layout-density-${layoutConfig.surfaceDensity}`,
    [layoutConfig.menuPosition, layoutConfig.surfaceDensity]
  );

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
        cabecalhoRef.current.style.display = "flex";
        cabecalhoRef.current.style.width = `${larguraBase}px`;
      }

      if (conteudoRef.current) {
        conteudoRef.current.style.height = `${altSreen}px`;
        conteudoRef.current.style.width = "100%";
      }
    };

    atualizarLayout();
    window.addEventListener("resize", atualizarLayout);
    return () => window.removeEventListener("resize", atualizarLayout);
  }, [layoutConfig.frameMaxWidth, layoutConfig.viewportMargin]);

  // ---------- Tema ----------
  useEffect(() => {
    if (!theme) return;

    const cssTheme = obterCssTemaSkin(theme);
    const body = document.body;

    Array.from(body.classList).forEach(cls => {
      if (
        cls.startsWith("theme-") ||
        cls.startsWith("layout-menu-") ||
        cls.startsWith("layout-density-")
      ) {
        body.classList.remove(cls);
      }
    });

    body.classList.add(`theme-${cssTheme.toLowerCase()}`);
    body.classList.add(`layout-menu-${layoutConfig.menuPosition}`);
    body.classList.add(`layout-density-${layoutConfig.surfaceDensity}`);

    import(`./${cssTheme.toLowerCase()}.css`).catch(console.error);
  }, [theme, layoutConfig.menuPosition, layoutConfig.surfaceDensity]);

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
