import { ALY137_ATRIBUTOS } from "../../Sistema/aly137Utils";

export default function ForjaPreviewModal({
  aberto = false,
  resumo,
  cardsOrigem = [],
  addOnsEfetivos = [],
  addOnIdsHerdados = [],
  onClose,
  onConfirm,
} = {}) {
  if (!aberto) return null;

  const resumoSeguro = resumo || {};
  const progresso = resumoSeguro.progressoNivel || {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="aly137-forge-modal"
      onClick={onClose}
    >
      <div
        className="aly137-forge-modal__content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-editor-modal__header">
          <div>
            <strong>Forja</strong>
            <p>Revise os materiais antes de preparar o novo card derivado.</p>
          </div>
          <button
            type="button"
            className="card-editor-modal__close"
            onClick={onClose}
            aria-label="Fechar forja"
            title="Fechar"
          >
            <span className="card-editor-modal__close-icon" aria-hidden="true" />
          </button>
        </div>

        <div className="aly137-forge-modal__grid">
          <section className="aly137-forge-modal__panel">
            <strong>Resultado previsto</strong>
            <div className="aly137-editor-summary">
              <div className="aly137-editor-summary__main">
                <strong>{`${resumoSeguro.xpTotal || 0} XP`}</strong>
                <span>{resumoSeguro.nivelLabel || "Em formacao"}</span>
              </div>
              <span className="aly137-editor-bar" aria-hidden="true">
                <span style={{ width: `${progresso.percentual || 0}%` }} />
              </span>
            </div>
            <div className="aly137-editor-attributes">
              {ALY137_ATRIBUTOS.map((atributo) => {
                const valor = Number(resumoSeguro.atributos?.[atributo.key] || 0);
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
          </section>

          <section className="aly137-forge-modal__panel">
            <strong>Cards de origem</strong>
            <div className="aly137-editor-forge-list">
              {cardsOrigem.length ? (
                cardsOrigem.map((cardOrigem) => (
                  <span className="aly137-forge-token" key={cardOrigem.key}>
                    <span>{cardOrigem.nome}</span>
                    <small>{`${cardOrigem.espacoNome || "Espaco"} / ${cardOrigem.blocoTitulo}`}</small>
                    <strong>{`${cardOrigem.xpTotal || 0} XP`}</strong>
                  </span>
                ))
              ) : (
                <p>Nenhum card de origem selecionado.</p>
              )}
            </div>
          </section>

          <section className="aly137-forge-modal__panel">
            <strong>Add-ons do card forjado</strong>
            <div className="aly137-editor-chip-list">
              {addOnsEfetivos.length ? (
                addOnsEfetivos.map((addOn) => {
                  const addOnId = String(addOn?.id || "").trim();
                  const resumoAddOn = resumoSeguro.addOnsXp?.[addOnId] || null;
                  const herdado = addOnIdsHerdados.includes(addOnId);
                  return (
                    <span className="aly137-forge-token" key={addOnId}>
                      {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                      <span>{`${addOn?.nome || "Add-on"}${herdado ? " / herdado" : ""}`}</span>
                      <strong>{`${resumoAddOn?.xpTotal || 0} XP`}</strong>
                    </span>
                  );
                })
              ) : (
                <p>Nenhum add-on selecionado.</p>
              )}
            </div>
          </section>
        </div>

        <div className="card-editor-modal__footer">
          <span className="card-editor-muted">
            Confirmar prepara um novo card. O card original so e preservado se voce salvar este novo card.
          </span>
          <span className="card-editor-modal__footer-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm}>
              Confirmar forja
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
