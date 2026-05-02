import { ALY137_ATRIBUTOS } from "../../../Sistema/aly137Utils";

const normalizarAddOnIds = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean))
  );
};

const obterAddOnIdsDisponiveisCardOrigem = (card = {}) =>
  normalizarAddOnIds([
    ...(Array.isArray(card?.addOnIdsDisponiveis) ? card.addOnIdsDisponiveis : []),
    ...(Array.isArray(card?.addOnIds) ? card.addOnIds : []),
    ...Object.keys(card?.addOnsXp || {}),
  ]);

export default function Aly137Forja({
  modal,
  setModal,
  onClose,
  blocosDestino = [],
  cardsInventario = [],
  addOnsInventario = [],
  cardsFragmentosSkinLoading = false,
  addOnIdsDiretos = [],
  cardsSelecionados = [],
  addOnsDiretos = [],
  addOnsPorId = {},
  resumo,
  onAdicionarCard,
  onRemoverCard,
  onAlternarAddOnCard,
  onAlternarAddOnDireto,
  onDragStartMaterial,
  onDragEndMaterial,
  onDropMaterial,
  onCriarCard,
} = {}) {
  if (!modal?.aberto) return null;

  const patchModal = (updates = {}) => {
    if (typeof setModal !== "function") return;
    setModal((prev) => ({ ...prev, ...updates }));
  };

  const resumoSeguro = resumo || {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="aly137-inventory-forge-modal"
      onClick={onClose}
    >
      <div
        className="menuContentArea aly137-inventory-forge-modal__content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-editor-modal__header">
          <div>
            <strong>Forja</strong>
            <p>Arraste cards e chips do inventario para montar um novo card.</p>
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

        <div className="aly137-inventory-forge-modal__controls">
          <label>
            <span>Nome do card forjado</span>
            <input
              type="text"
              value={modal.nome || ""}
              onChange={(event) => patchModal({ nome: event.target.value })}
            />
          </label>
          <label>
            <span>Bloco destino</span>
            <select
              value={modal.blocoDestinoId || ""}
              onChange={(event) => patchModal({ blocoDestinoId: event.target.value })}
            >
              <option value="">Selecione</option>
              {blocosDestino.map((bloco) => (
                <option key={bloco.id} value={bloco.id}>
                  {bloco.titulo || bloco.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Buscar no inventario</span>
            <input
              type="search"
              value={modal.busca || ""}
              onChange={(event) => patchModal({ busca: event.target.value })}
              placeholder="Cards, espacos, chips..."
            />
          </label>
        </div>

        <label className="aly137-inventory-forge-modal__description">
          <span>Descricao inicial</span>
          <textarea
            rows={2}
            value={modal.descricao || ""}
            onChange={(event) => patchModal({ descricao: event.target.value })}
          />
        </label>

        <div className="aly137-inventory-forge-modal__grid">
          <section className="aly137-inventory-forge-modal__inventory">
            <div className="card-editor-panel__title-row">
              <strong>Inventario</strong>
              <span>{`${cardsInventario.length} cards / ${addOnsInventario.length} chips`}</span>
            </div>

            <div className="aly137-inventory-section">
              <strong>Cards</strong>
              <div className="aly137-inventory-mini-grid">
                {cardsFragmentosSkinLoading ? <p>Carregando cards da skin...</p> : null}
                {!cardsFragmentosSkinLoading && !cardsInventario.length ? (
                  <p>Nenhum card disponivel no inventario.</p>
                ) : null}
                {cardsInventario.map((card) => {
                  const selecionado = Array.isArray(modal.cardKeys) && modal.cardKeys.includes(card.key);
                  return (
                    <button
                      type="button"
                      draggable
                      key={`forja-card-${card.key}`}
                      className={`aly137-inventory-card-mini${selecionado ? " is-selected" : ""}`}
                      onDragStart={(event) =>
                        onDragStartMaterial?.(event, { tipo: "card", id: card.key })
                      }
                      onDragEnd={onDragEndMaterial}
                      onClick={() => onAdicionarCard?.(card.key)}
                      title="Arraste para a forja"
                    >
                      <span className="aly137-inventory-card-mini__image">
                        {card.imagem ? (
                          <img src={card.imagem} alt="" />
                        ) : (
                          <em>{String(card.nome || "C").slice(0, 2)}</em>
                        )}
                      </span>
                      <span>{card.nome || "Card"}</span>
                      <small>{`${card.espacoNome || "Espaco"} / ${card.xpTotal || 0} XP`}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="aly137-inventory-section">
              <strong>Chips / Add-ons</strong>
              <div className="aly137-inventory-chip-grid">
                {addOnsInventario.map((addOn) => {
                  const addOnId = String(addOn?.id || "").trim();
                  const selecionado = addOnIdsDiretos.includes(addOnId);
                  return (
                    <button
                      type="button"
                      draggable
                      key={`forja-addon-${addOnId}`}
                      className={`aly137-inventory-chip${selecionado ? " is-selected" : ""}`}
                      onDragStart={(event) =>
                        onDragStartMaterial?.(event, { tipo: "addon", id: addOnId })
                      }
                      onDragEnd={onDragEndMaterial}
                      onClick={() => onAlternarAddOnDireto?.(addOnId)}
                      title="Arraste para a forja"
                    >
                      {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                      <span>{addOn?.nome || "Add-on"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className="aly137-inventory-forge-modal__forge"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropMaterial}
          >
            <div className="card-editor-panel__title-row">
              <strong>Estrutura de forja</strong>
              <span>{`${cardsSelecionados.length} card(s) / ${addOnsDiretos.length} chip(s)`}</span>
            </div>

            <div className="aly137-forge-drop-zone">
              <span>Solte cards e chips aqui</span>
              <small>Os cards definem XP/atributos; os chips diretos ficam vinculados ao card criado.</small>
            </div>

            <div className="aly137-forge-assembly">
              {cardsSelecionados.map((card) => {
                const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigem(card);
                const addOnIdsRelacionados = normalizarAddOnIds(card.addOnIdsRelacionados);
                return (
                  <article className="aly137-forge-assembly-card" key={`assembly-${card.key}`}>
                    <div>
                      <strong>{card.nome || "Card"}</strong>
                      <small>{`${card.espacoNome || "Espaco"} / ${card.blocoTitulo || "Bloco"} / ${card.xpTotal || 0} XP`}</small>
                    </div>
                    <button type="button" onClick={() => onRemoverCard?.(card.key)}>
                      Remover
                    </button>
                    <div className="card-editor-card-fragment-addons">
                      <span>Add-ons relacionados deste card</span>
                      {addOnIdsDisponiveis.length ? (
                        addOnIdsDisponiveis.map((addOnId) => {
                          const addOn = addOnsPorId[addOnId] || {};
                          const marcado = addOnIdsRelacionados.includes(addOnId);
                          return (
                            <button
                              type="button"
                              key={`${card.key}-assembly-${addOnId}`}
                              className={`card-editor-card-fragment-addon${marcado ? " is-selected" : ""}`}
                              onClick={() => onAlternarAddOnCard?.(card.key, addOnId)}
                            >
                              {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                              <span>{addOn?.nome || addOnId}</span>
                            </button>
                          );
                        })
                      ) : (
                        <em>Sem add-ons disponiveis neste card.</em>
                      )}
                    </div>
                  </article>
                );
              })}

              {addOnsDiretos.length ? (
                <div className="aly137-forge-assembly-chips">
                  <strong>Chips diretos</strong>
                  {addOnsDiretos.map((addOn) => (
                    <button
                      type="button"
                      key={`assembly-addon-${addOn.id}`}
                      className="aly137-inventory-chip is-selected"
                      onClick={() => onAlternarAddOnDireto?.(addOn.id)}
                    >
                      {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                      <span>{addOn?.nome || "Add-on"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="aly137-editor-summary">
              <div className="aly137-editor-summary__main">
                <strong>{`${resumoSeguro.xpTotal || 0} XP`}</strong>
                <span>{resumoSeguro.nivelLabel || "Em formacao"}</span>
              </div>
              <span className="aly137-editor-bar" aria-hidden="true">
                <span style={{ width: `${resumoSeguro.progressoNivel?.percentual || 0}%` }} />
              </span>
            </div>

            <div className="aly137-editor-attributes">
              {ALY137_ATRIBUTOS.map((atributo) => {
                const valor = Number(resumoSeguro.atributos?.[atributo.key] || 0);
                return (
                  <div className="aly137-editor-attribute" key={`forja-${atributo.key}`}>
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
        </div>

        {modal.erro ? <p className="card-editor-error">{modal.erro}</p> : null}

        <div className="card-editor-modal__footer">
          <span className="card-editor-muted">
            A forja cria um novo card no bloco destino, mantendo os cards originais intactos.
          </span>
          <span className="card-editor-modal__footer-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void onCriarCard?.();
              }}
              disabled={modal.criando}
            >
              {modal.criando ? "Forjando..." : "Criar card forjado"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
