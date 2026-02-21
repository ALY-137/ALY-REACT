import React from "react";

function Container({
  titulo = "",
  iconUrl = "",
  variante = "home",
  className = "",
  contentClassName = "",
  children,
}) {
  const possuiCabecalho = Boolean(titulo || iconUrl);
  const classesContainer = ["bloco-container", `bloco-container--${variante}`, className]
    .filter(Boolean)
    .join(" ");
  const classesConteudo = ["bloco-container__content", contentClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classesContainer}>
      {possuiCabecalho && (
        <header className="bloco-container__header">
          {!!iconUrl && (
            <img className="bloco-container__icon" src={iconUrl} alt="" aria-hidden="true" />
          )}
          {!!titulo && <h3 className="bloco-container__title">{titulo}</h3>}
        </header>
      )}
      <div className={classesConteudo}>{children}</div>
    </section>
  );
}

export default Container;
