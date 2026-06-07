import { ALY137_ATRIBUTOS } from "../../Sistema/aly137Utils";
import {
  getCyberpinkSubthemeIconColor,
  getCyberpinkSubthemeIconFilter,
  normalizeCyberpinkSubtheme,
} from "../../Temas/cyberpink/subthemes";

function isSvgAssetUrl(value = "") {
  const normalizado = String(value || "").trim().toLowerCase();
  return (
    normalizado.endsWith(".svg") ||
    normalizado.includes(".svg?") ||
    normalizado.startsWith("data:image/svg+xml")
  );
}

export default function AddOnFichaModal({
  modal,
  onClose,
  resolverTipoAddOn,
  formatarTipoAddOn,
  onNavigateCard,
} = {}) {
  if (!modal?.aberto || !modal?.addOn) return null;

  const addOn = modal.addOn || {};
  const resumo = addOn?.aly137Resumo || {};
  const atributos = resumo?.atributos || {};
  const ehCardFragmento = addOn?.tipoFicha === "cardFragmento";
  const cardPreview = addOn?.cardPreview || {};
  const origemCard = [addOn?.espacoNome, addOn?.blocoTitulo]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" / ");
  const subtemaCardFragmento = normalizeCyberpinkSubtheme(addOn?.subtema);
  const corCardFragmento = getCyberpinkSubthemeIconColor(subtemaCardFragmento);
  const subtemaAddOnBruto = String(
    addOn?.subtema || addOn?.subtheme || addOn?.theme || ""
  ).trim();
  const subtemaAddOn = subtemaAddOnBruto ? normalizeCyberpinkSubtheme(subtemaAddOnBruto) : "";
  const corIconeSubtema = subtemaAddOn ? getCyberpinkSubthemeIconColor(subtemaAddOn) : "";
  const filtroIconeSubtema = subtemaAddOn ? getCyberpinkSubthemeIconFilter(subtemaAddOn) : "";
  const urlIconeAddOn = String(addOn.url_img || "").trim();
  const podeColorirIconeAddOn = Boolean(subtemaAddOn && urlIconeAddOn && isSvgAssetUrl(urlIconeAddOn));
  const estiloIconeSubtema = subtemaAddOn
    ? {
        "--aly137-addon-modal-icon-color": corIconeSubtema,
        "--aly137-addon-modal-icon-filter": filtroIconeSubtema,
      }
    : undefined;
  const tipoLabel = ehCardFragmento
    ? "Card fragmento de forja"
    : typeof formatarTipoAddOn === "function"
      ? formatarTipoAddOn(
          typeof resolverTipoAddOn === "function" ? resolverTipoAddOn(addOn) : addOn?.tipo
        )
      : "Add-on";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="aly137-addon-modal"
      onClick={onClose}
    >
      <div
        className="aly137-addon-modal__content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-editor-modal__header">
          <div>
            <strong>{addOn.nome || "Add-on"}</strong>
            <p>{tipoLabel}</p>
          </div>
          <button
            type="button"
            className="card-editor-modal__close"
            onClick={onClose}
            aria-label="Fechar ficha do add-on"
            title="Fechar"
          >
            <span className="card-editor-modal__close-icon" aria-hidden="true" />
          </button>
        </div>

        <div className="aly137-addon-modal__hero">
          <span
            className={`aly137-addon-modal__icon${subtemaAddOn ? " is-subtheme-tinted" : ""}`}
            data-subtema={subtemaAddOn || undefined}
            style={estiloIconeSubtema}
          >
            {urlIconeAddOn ? (
              <img
                src={urlIconeAddOn}
                alt=""
                className={podeColorirIconeAddOn ? "is-subtheme-tinted" : undefined}
              />
            ) : null}
            {!urlIconeAddOn && ehCardFragmento ? (
              <svg
                className="aly137-addon-modal__card-icon"
                viewBox="0 0 32 32"
                aria-hidden="true"
                focusable="false"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: corCardFragmento,
                  filter: `drop-shadow(0 0 2px ${corCardFragmento}) drop-shadow(0 0 6px ${corCardFragmento})`,
                }}
              >
                <path d="M7 5.5h13l5 5V26.5H7V5.5Z" />
                <path d="M20 5.5V11h5" />
                <path d="M11 15h10M11 19h8M11 23h6" />
              </svg>
            ) : null}
          </span>
          <div className="aly137-editor-summary">
            <div className="aly137-editor-summary__main">
              <strong>{`${resumo?.xpTotal || 0} XP`}</strong>
              <span>
                {ehCardFragmento
                  ? `${resumo?.nivelLabel || "Card"} / ${Math.min(100, resumo?.percentual || 0)}%`
                  : `Nivel unico / ${Math.min(100, resumo?.percentual || 0)}%`}
              </span>
            </div>
            <span className="aly137-editor-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, resumo?.percentual || 0)}%` }} />
            </span>
          </div>
        </div>

        {addOn.descricao ? (
          <p className="aly137-addon-modal__description">{addOn.descricao}</p>
        ) : null}
        {ehCardFragmento && origemCard ? (
          <p className="aly137-addon-modal__description">{`Origem: ${origemCard}`}</p>
        ) : null}

        {ehCardFragmento ? (
          <aside className="aly137-addon-modal__card-preview">
            <div className="aly137-addon-modal__card-preview-image">
              {cardPreview.imagem ? (
                <img src={cardPreview.imagem} alt="" />
              ) : (
                <span>{String(cardPreview.nome || addOn.nome || "Card").slice(0, 2)}</span>
              )}
            </div>
            <div>
              <strong>{cardPreview.nome || addOn.nome || "Card relacionado"}</strong>
              {cardPreview.descricao ? <p>{cardPreview.descricao}</p> : null}
              <button
                type="button"
                className="aly137-addon-modal__card-preview-button"
                disabled={!cardPreview.rota}
                onClick={() => {
                  if (cardPreview.rota) onNavigateCard?.(cardPreview.rota);
                }}
              >
                Ver card completo
              </button>
            </div>
          </aside>
        ) : null}

        <div className="aly137-editor-attributes">
          {ALY137_ATRIBUTOS.map((atributo) => {
            const valor = Number(atributos?.[atributo.key] || 0);
            return (
              <div className="aly137-editor-attribute" key={atributo.key}>
                <span>{atributo.label}</span>
                <strong>{`${valor} XP`}</strong>
                <em aria-hidden="true">
                  <span style={{ width: `${Math.min(100, valor)}%` }} />
                </em>
              </div>
            );
          })}
        </div>

        <div className="aly137-addon-modal__columns">
          {ehCardFragmento ? (
            <>
              <section>
                <strong>Origem</strong>
                <span className="aly137-forge-token">
                  <span>{addOn.nome || "Card relacionado"}</span>
                  <small>{origemCard || "Espaco / Bloco"}</small>
                  <strong>{`${resumo?.xpTotal || 0} XP`}</strong>
                </span>
              </section>

              <section>
                <strong>Add-ons relacionados</strong>
                {Array.isArray(resumo?.addOnsHerdados) && resumo.addOnsHerdados.length ? (
                  resumo.addOnsHerdados.map((item) => (
                    <span className="aly137-forge-token" key={item.id}>
                      {item.url_img ? <img src={item.url_img} alt="" /> : null}
                      <span>{item.nome || "Add-on"}</span>
                    </span>
                  ))
                ) : (
                  <p>Nenhum add-on deste card foi relacionado a este card.</p>
                )}
              </section>
            </>
          ) : (
            <>
              <section>
                <strong>Cards relacionados</strong>
                {Array.isArray(resumo?.cardsRelacionados) && resumo.cardsRelacionados.length ? (
                  resumo.cardsRelacionados.map((cardItem) => (
                    <span
                      className="aly137-forge-token"
                      key={`${cardItem.blocoId}-${cardItem.cardId}`}
                    >
                      <span>{cardItem.nome}</span>
                      <small>{cardItem.blocoTitulo || "Bloco"}</small>
                      <strong>{`${cardItem.xpTotal || 0} XP`}</strong>
                    </span>
                  ))
                ) : (
                  <p>Nenhum card relacionado ainda.</p>
                )}
              </section>

              <section>
                <strong>Evidencias relacionadas</strong>
                {Array.isArray(resumo?.evidenciasRelacionadas) &&
                resumo.evidenciasRelacionadas.length ? (
                  resumo.evidenciasRelacionadas.slice(0, 12).map((evidencia) => (
                    <span
                      className="aly137-forge-token"
                      key={`${evidencia.cardId}-${evidencia.evidenciaId}`}
                    >
                      <span>{evidencia.titulo}</span>
                      <small>{evidencia.cardNome}</small>
                      <strong>{`${evidencia.xpTotal || 0} XP`}</strong>
                    </span>
                  ))
                ) : (
                  <p>Nenhuma evidencia vinculada ainda.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
