import React, { useMemo } from "react";

function isSvgIconUrl(iconUrl = "") {
  return (
    typeof iconUrl === "string" &&
    (/\.svg(?:[?#].*)?$/i.test(iconUrl) || /^data:image\/svg\+xml/i.test(iconUrl))
  );
}

function buildMaskImageValue(rawUrl = "") {
  return `url("${String(rawUrl).replace(/"/g, '\\"')}")`;
}

function BlockHeaderIcon({ iconUrl }) {
  const iconIsSvg = isSvgIconUrl(iconUrl);
  const iconIsRemote = /^https?:\/\//i.test(String(iconUrl || "").trim());
  const maskUrl = useMemo(() => {
    if (!iconIsSvg || !iconUrl || iconIsRemote) return null;
    return buildMaskImageValue(iconUrl);
  }, [iconIsRemote, iconIsSvg, iconUrl]);

  if (!iconUrl) return null;

  if (!iconIsSvg) {
    return <img className="bloco-container__icon" src={iconUrl} alt="" aria-hidden="true" />;
  }

  if (iconIsRemote) {
    return (
      <img
        className="bloco-container__icon bloco-container__icon--svg-fallback"
        src={iconUrl}
        alt=""
        aria-hidden="true"
      />
    );
  }

  if (!maskUrl) {
    return (
      <img
        className="bloco-container__icon bloco-container__icon--svg-fallback"
        src={iconUrl}
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="bloco-container__icon bloco-container__icon--svg"
      style={{
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
      }}
      aria-hidden="true"
    />
  );
}

function Container({
  titulo = "",
  iconUrl = "",
  variante = "home",
  className = "",
  contentClassName = "",
  style = undefined,
  children,
}) {
  const possuiCabecalho = Boolean(titulo || iconUrl);
  const classesContainer = [
    "bloco-container",
    `bloco-container--${variante}`,
    possuiCabecalho ? "bloco-container--with-header" : "bloco-container--without-header",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const classesConteudo = ["bloco-container__content", contentClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classesContainer} style={style}>
      {possuiCabecalho && (
        <header className="bloco-container__header">
          {!!iconUrl && <BlockHeaderIcon iconUrl={iconUrl} />}
          {!!titulo && <h3 className="bloco-container__title">{titulo}</h3>}
        </header>
      )}
      <div className={classesConteudo}>{children}</div>
    </section>
  );
}

export default Container;
