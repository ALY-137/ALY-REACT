import {
  CYBERPINK_SUBTHEMES,
  normalizeCyberpinkSubtheme,
} from "../../Temas/cyberpink/subthemes";

const EditorCardAddOnsTab = ({
  editorCardModal,
  setEditorCardModal,
  aly137Habilitado,
  addOnIdsEfetivosEditorCard = [],
  addOnsEfetivosEditorCard = [],
  cardsOrigemSelecionadosEditor = [],
  isSvgAssetUrl,
  normalizarAddOnSubthemes,
  addOnSubthemesEfetivosEditorCard,
  addOnIdsHerdadosForjaEditor = [],
  formatarTipoAddOn,
  resolverTipoAddOn,
  moverAddOnEditorCard,
  normalizarAddOnIds,
  obterAddOnIdsDisponiveisCardOrigemAly137,
  addOnsDisponiveisProjetoPorId,
  alternarCardOrigemForjaEditor,
  alternarAddOnCardOrigemForjaEditor,
  buscaAddOnEditor,
  setBuscaAddOnEditor,
  filtroTipoAddOnEditor,
  setFiltroTipoAddOnEditor,
  tiposAddOnsEditor = [],
  addOnsProjetoHabilitados,
  erroAddOnsGerenciador,
  addOnsDisponiveisProjeto = [],
  addOnsEditorFiltrados = [],
  cardsFragmentosSkinLoading,
  erroCardsFragmentosSkin,
  cardsDisponiveisForjaEditor = [],
  cardsRelacionaveisEditorFiltrados = [],
}) => (
                  <section className="card-editor-panel" aria-label="Add-ons do card">
                    <div className="card-editor-panel__title-row">
                      <strong>Add-ons do card</strong>
                      <span>
                        {`${addOnIdsEfetivosEditorCard.length} add-on(s) / ${cardsOrigemSelecionadosEditor.length} card(s)`}
                      </span>
                    </div>

                    <div className="card-editor-selected-addons">
                      {addOnsEfetivosEditorCard.length ? (
                        addOnsEfetivosEditorCard.map((item, index) => {
                          const addOnId = String(item?.id || "").trim();
                          const addOnEhSvg = isSvgAssetUrl(item?.url_img);
                          const subtemaSelecionado =
                            normalizarAddOnSubthemes(addOnSubthemesEfetivosEditorCard, [addOnId])[addOnId] ||
                            "";
                          const herdado = addOnIdsHerdadosForjaEditor.includes(addOnId);

                          return (
                            <div
                              className={`card-editor-selected-addon${herdado ? " is-inherited" : ""}`}
                              key={addOnId}
                            >
                              <span className="card-editor-selected-addon__icon">
                                {item?.url_img ? <img src={item.url_img} alt="" /> : null}
                              </span>
                              <span className="card-editor-selected-addon__meta">
                                <strong>{item.nome || "Add-on"}</strong>
                                <small>
                                  {`${formatarTipoAddOn(resolverTipoAddOn(item))}${herdado ? " / herdado da forja" : ""}`}
                                </small>
                              </span>
                              <span className="card-editor-selected-addon__actions">
                                <button
                                  type="button"
                                  onClick={() => moverAddOnEditorCard(addOnId, -1)}
                                  disabled={herdado || index === 0}
                                  aria-label="Mover add-on para esquerda"
                                  title="Mover para esquerda"
                                >
                                  {"<"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moverAddOnEditorCard(addOnId, 1)}
                                  disabled={herdado || index >= addOnsEfetivosEditorCard.length - 1}
                                  aria-label="Mover add-on para direita"
                                  title="Mover para direita"
                                >
                                  {">"}
                                </button>
                              </span>
                              {addOnEhSvg ? (
                                <select
                                  value={subtemaSelecionado}
                                  onChange={(event) => {
                                    const proximoValor = String(event.target.value || "").trim();
                                    setEditorCardModal((prev) => {
                                      const mapaAtual = normalizarAddOnSubthemes(
                                        prev?.addOnSubthemes,
                                        prev?.addOnIds
                                      );

                                      if (!proximoValor) {
                                        const { [addOnId]: _omitido, ...restante } = mapaAtual;
                                        return {
                                          ...prev,
                                          addOnSubthemes: restante,
                                        };
                                      }

                                      return {
                                        ...prev,
                                        addOnSubthemes: {
                                          ...mapaAtual,
                                          [addOnId]: normalizeCyberpinkSubtheme(proximoValor),
                                        },
                                      };
                                    });
                                  }}
                                >
                                  <option value="">Padrao do espaco</option>
                                  {CYBERPINK_SUBTHEMES.map((subtema) => (
                                    <option key={subtema.value} value={subtema.value}>
                                      {subtema.label}
                                    </option>
                                  ))}
                                </select>
                              ) : null}

                            </div>
                          );
                        })
                      ) : (
                        <p>Nenhum add-on selecionado ainda.</p>
                      )}
                      {cardsOrigemSelecionadosEditor.length ? (
                        cardsOrigemSelecionadosEditor.map((cardOrigem) => {
                          const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigemAly137(cardOrigem);
                          const addOnIdsRelacionados = normalizarAddOnIds(cardOrigem.addOnIdsRelacionados);
                          return (
                            <div
                              className="card-editor-selected-addon card-editor-selected-addon--card"
                              key={`card-fragmento-${cardOrigem.key}`}
                            >
                              <span className="card-editor-selected-addon__icon card-editor-selected-addon__icon--card">
                                {cardOrigem.imagem ? (
                                  <img src={cardOrigem.imagem} alt="" />
                                ) : (
                                  <span>{String(cardOrigem.nome || "C").slice(0, 2).toUpperCase()}</span>
                                )}
                              </span>
                              <span className="card-editor-selected-addon__meta">
                                <strong>{cardOrigem.nome || "Card"}</strong>
                                <small>
                                  {`Card / ${cardOrigem.espacoNome || "Espaco"} / ${cardOrigem.blocoTitulo || "Bloco"} / ${cardOrigem.xpTotal || 0} XP`}
                                </small>
                                <em>{`${addOnIdsRelacionados.length} de ${addOnIdsDisponiveis.length} add-on(s) relacionados`}</em>
                              </span>
                              <span className="card-editor-selected-addon__actions">
                                <button
                                  type="button"
                                  onClick={() => alternarCardOrigemForjaEditor(cardOrigem.key)}
                                  aria-label="Remover card relacionado"
                                  title="Remover card relacionado"
                                >
                                  X
                                </button>
                              </span>
                              <div className="card-editor-card-fragment-addons">
                                <span>Add-ons deste card que entram na relacao</span>
                                {addOnIdsDisponiveis.length ? (
                                  addOnIdsDisponiveis.map((addOnId) => {
                                    const addOn = addOnsDisponiveisProjetoPorId[addOnId] || {};
                                    const marcado = addOnIdsRelacionados.includes(addOnId);
                                    return (
                                      <button
                                        type="button"
                                        key={`${cardOrigem.key}-${addOnId}`}
                                        className={`card-editor-card-fragment-addon${marcado ? " is-selected" : ""}`}
                                        onClick={() => alternarAddOnCardOrigemForjaEditor(cardOrigem.key, addOnId)}
                                      >
                                        {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                                        <span>{addOn?.nome || addOnId}</span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <em>Este card nao possui add-ons disponiveis no snapshot.</em>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : null}
                    </div>

                    <div className="card-editor-filters">
                      <input
                        type="search"
                        value={buscaAddOnEditor}
                        onChange={(event) => setBuscaAddOnEditor(event.target.value)}
                        placeholder="Pesquisar por nome, tipo ou descricao"
                      />
                      <select
                        value={filtroTipoAddOnEditor}
                        onChange={(event) => setFiltroTipoAddOnEditor(event.target.value)}
                      >
                        <option value="">Todos os tipos</option>
                        {tiposAddOnsEditor.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {formatarTipoAddOn(tipo)}
                          </option>
                        ))}
                        {aly137Habilitado ? <option value="__card__">Cards</option> : null}
                      </select>
                    </div>

                    <div className="card-editor-addons-list">
                      {String(filtroTipoAddOnEditor || "").trim().toLowerCase() === "__card__" ? (
                        <p>Filtro de cards ativo. Selecione os cards relacionaveis abaixo.</p>
                      ) : !addOnsProjetoHabilitados ? (
                        <p>A base de add-ons esta desativada neste projeto.</p>
                      ) : erroAddOnsGerenciador ? (
                        <p className="card-editor-error">{erroAddOnsGerenciador}</p>
                      ) : !addOnsDisponiveisProjeto.length ? (
                        <p>Nenhum add-on criado para este usuario/projeto.</p>
                      ) : !addOnsEditorFiltrados.length ? (
                        <p>Nenhum add-on encontrado para este filtro.</p>
                      ) : (
                        addOnsEditorFiltrados.map((item) => {
                          const addOnId = String(item?.id || "").trim();
                          const marcado = normalizarAddOnIds(editorCardModal.addOnIds).includes(addOnId);
                          const addOnEhSvg = isSvgAssetUrl(item?.url_img);
                          return (
                            <label
                              key={addOnId}
                              className={`card-editor-addon-option${marcado ? " is-selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() =>
                                  setEditorCardModal((prev) => {
                                    const atuais = normalizarAddOnIds(prev?.addOnIds);
                                    const addOnSubthemesAtuais = normalizarAddOnSubthemes(
                                      prev?.addOnSubthemes,
                                      atuais
                                    );
                                    const estaMarcado = atuais.includes(addOnId);
                                    const proximosIds = estaMarcado
                                      ? atuais.filter((id) => id !== addOnId)
                                      : [...atuais, addOnId];
                                    const proximosSubtemas = estaMarcado
                                      ? Object.fromEntries(
                                          Object.entries(addOnSubthemesAtuais).filter(
                                            ([id]) => id !== addOnId
                                          )
                                        )
                                      : addOnSubthemesAtuais;
                                    return {
                                      ...prev,
                                      addOnIds: proximosIds,
                                      addOnSubthemes: proximosSubtemas,
                                    };
                                  })
                                }
                              />
                              <span className="card-editor-addon-option__icon">
                                {item?.url_img ? <img src={item.url_img} alt={item.nome || "Add-on"} /> : null}
                              </span>
                              <span className="card-editor-addon-option__meta">
                                <strong>{item.nome}</strong>
                                <small>
                                  {`${formatarTipoAddOn(resolverTipoAddOn(item))}${addOnEhSvg ? " / SVG colorivel" : ""}`}
                                </small>
                                {item?.descricao ? <em>{item.descricao}</em> : null}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {aly137Habilitado ? (
                      <div className="card-editor-addons-list card-editor-addons-list--cards">
                        <div className="card-editor-panel__title-row">
                          <strong>Cards como fragmentos</strong>
                          <span>{`${cardsOrigemSelecionadosEditor.length} relacionado(s)`}</span>
                        </div>
                        {cardsFragmentosSkinLoading ? (
                          <p>Carregando cards dos outros espacos da skin...</p>
                        ) : erroCardsFragmentosSkin ? (
                          <p className="card-editor-error">{erroCardsFragmentosSkin}</p>
                        ) : !cardsDisponiveisForjaEditor.length ? (
                          <p>Nenhum outro card disponivel nesta skin.</p>
                        ) : !cardsRelacionaveisEditorFiltrados.length ? (
                          <p>Nenhum card encontrado para este filtro.</p>
                        ) : (
                          cardsRelacionaveisEditorFiltrados.map((cardOrigem) => {
                            const marcado = cardsOrigemSelecionadosEditor.some(
                              (item) => item.key === cardOrigem.key
                            );
                            const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigemAly137(cardOrigem);
                            const cardSelecionado = cardsOrigemSelecionadosEditor.find(
                              (item) => item.key === cardOrigem.key
                            );
                            const addOnIdsRelacionados = normalizarAddOnIds(
                              cardSelecionado?.addOnIdsRelacionados || addOnIdsDisponiveis
                            );
                            return (
                              <label
                                key={`card-addon-option-${cardOrigem.key}`}
                                className={`card-editor-addon-option card-editor-addon-option--card${
                                  marcado ? " is-selected" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => alternarCardOrigemForjaEditor(cardOrigem.key)}
                                />
                                <span className="card-editor-addon-option__icon card-editor-addon-option__icon--card">
                                  {cardOrigem.imagem ? (
                                    <img src={cardOrigem.imagem} alt={cardOrigem.nome || "Card"} />
                                  ) : (
                                    <span>{String(cardOrigem.nome || "C").slice(0, 2).toUpperCase()}</span>
                                  )}
                                </span>
                                <span className="card-editor-addon-option__meta">
                                  <strong>{cardOrigem.nome}</strong>
                                  <small>
                                    {`Card / ${cardOrigem.espacoNome || "Espaco"} / ${cardOrigem.blocoTitulo || "Bloco"} / ${cardOrigem.xpTotal || 0} XP`}
                                  </small>
                                  {marcado ? (
                                    <em>{`${addOnIdsRelacionados.length} de ${addOnIdsDisponiveis.length} add-on(s) relacionados`}</em>
                                  ) : null}
                                  {cardOrigem.descricao ? <em>{cardOrigem.descricao}</em> : null}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </section>
);

export default EditorCardAddOnsTab;
