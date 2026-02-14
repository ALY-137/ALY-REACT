import React, { useEffect, useRef } from "react";

export default function Layout({ profile, content, theme }) {
  const fundoRef = useRef();
  const cabecalhoRef = useRef();
  const conteudoRef = useRef();

  // ---------- Layout Responsivo ----------
  useEffect(() => {
    const atualizarLayout = () => {
      const larScreen = window.innerWidth;
      const altSreen = window.innerHeight;

      if (fundoRef.current) {
        fundoRef.current.style.display = "block";
        fundoRef.current.style.height = `${altSreen - 5}px`;
        fundoRef.current.style.width =
          larScreen > 1000 ? "995px" : `${larScreen - 5}px`;
      }

      if (cabecalhoRef.current) {
        cabecalhoRef.current.style.display = "flex";
        cabecalhoRef.current.style.width =
          larScreen > 1000 ? "995px" : `${larScreen - 5}px`;
      }

      if (conteudoRef.current) {
        conteudoRef.current.style.height = `${altSreen}px`;
        conteudoRef.current.style.width = "100%";
      }
    };

    atualizarLayout();
    window.addEventListener("resize", atualizarLayout);
    return () => window.removeEventListener("resize", atualizarLayout);
  }, []);

  // ---------- Tema ----------
  useEffect(() => {
    if (!theme) return;

    const body = document.body;

    Array.from(body.classList).forEach(cls => {
      if (cls.startsWith("theme-")) body.classList.remove(cls);
    });

    body.classList.add(`theme-${theme.toLowerCase()}`);

    import(`./${theme.toLowerCase()}.css`).catch(console.error);
  }, [theme]);

  return (
    <div id="fundo" ref={fundoRef}>
      <div id="cabecalho" ref={cabecalhoRef}>
        {profile}
      </div>

      <div id="conteudo" ref={conteudoRef}>
        {content}
      </div>
    </div>
  );
}
