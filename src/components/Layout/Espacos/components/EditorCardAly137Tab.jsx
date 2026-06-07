import {
  ALY137_ATRIBUTOS,
  ALY137_PESOS_EVIDENCIA,
  calcularXpPorPesoAly137,
  normalizarAtributosSelecionadosAly137,
} from "../../Sistema/aly137Utils";

const EditorCardAly137Tab = ({
  editorCardModal,
  resumoAly137EditorCard,
  adicionarEvidenciaAly137Editor,
  adicionarConclusaoNivelAly137Editor,
  conclusaoNivelAly137EditorCard,
  removerEvidenciaAly137Editor,
  atualizarEvidenciaAly137Editor,
  alternarAtributoEvidenciaAly137Editor,
  atualizarPesoAtributoEvidenciaAly137Editor,
  normalizarAddOnIds,
  addOnsEfetivosEditorCard,
  addOnIdsHerdadosForjaEditor,
  alternarAddOnEvidenciaAly137Editor,
  cardsOrigemSelecionadosEditor,
  cardsDisponiveisForjaEditor,
  alternarCardOrigemForjaEditor,
  abrirForjaPreviewEditor,
}) => (
                  <section className="card-editor-panel card-editor-panel--aly137" aria-label="XP e Forja">
                    <div className="card-editor-panel__title-row">
                      <strong>ALY-137 / XP e Forja</strong>
                      <span>{resumoAly137EditorCard.nivelLabel}</span>
                    </div>

                    <div className="aly137-editor-summary">
                      <div className="aly137-editor-summary__main">
                        <strong>{`${resumoAly137EditorCard.xpTotal} XP`}</strong>
                        <span>{`${resumoAly137EditorCard.progressoNivel.percentual}% ate o proximo nivel`}</span>
                      </div>
                      <span className="aly137-editor-bar" aria-hidden="true">
                        <span style={{ width: `${resumoAly137EditorCard.progressoNivel.percentual}%` }} />
                      </span>
                      <div className="aly137-editor-attributes">
                        {ALY137_ATRIBUTOS.map((atributo) => {
                          const valor = Number(resumoAly137EditorCard.atributos?.[atributo.key] || 0);
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
                    </div>

                    <div className="card-editor-panel__title-row">
                      <strong>Evidencias</strong>
                      <span className="card-editor-modal__footer-actions">
                        <button type="button" onClick={adicionarEvidenciaAly137Editor}>
                          Adicionar evidencia
                        </button>
                        <button
                          type="button"
                          onClick={adicionarConclusaoNivelAly137Editor}
                          disabled={!conclusaoNivelAly137EditorCard.disponivel}
                          title={
                            conclusaoNivelAly137EditorCard.jaConcluiuNivel
                              ? "Este nivel ja possui evidencia de conclusao."
                              : conclusaoNivelAly137EditorCard.xpAlvo
                                ? `Adicionar +${conclusaoNivelAly137EditorCard.xpFaltante} XP ate ${conclusaoNivelAly137EditorCard.xpAlvo} XP.`
                                : "Card ja esta no maior nivel configurado."
                          }
                        >
                          {conclusaoNivelAly137EditorCard.xpAlvo
                            ? `${conclusaoNivelAly137EditorCard.labelBotao} (+${conclusaoNivelAly137EditorCard.xpFaltante} XP)`
                            : "Nivel maximo"}
                        </button>
                      </span>
                    </div>

                    <div className="aly137-editor-evidences">
                      {Array.isArray(editorCardModal.aly137Evidencias) &&
                      editorCardModal.aly137Evidencias.length ? (
                        editorCardModal.aly137Evidencias.map((evidencia, index) => {
                          const evidenciaNormalizada = resumoAly137EditorCard.evidencias[index] || evidencia;
                          const evidenciaId = String(evidencia?.id || evidenciaNormalizada?.id || "").trim();
                          const addOnsSelecionados = normalizarAddOnIds(evidencia?.addOnIds);
                          const ehConclusaoNivel =
                            String(evidencia?.tipo || evidenciaNormalizada?.tipo || "").trim() ===
                            "conclusao_nivel";
                          const atributosSelecionadosSalvos = normalizarAtributosSelecionadosAly137(
                            evidencia?.atributosSelecionados
                          );
                          const atributosSelecionadosNormalizados = normalizarAtributosSelecionadosAly137(
                            evidenciaNormalizada?.atributosSelecionados
                          );
                          const atributosSelecionadosLegados = normalizarAtributosSelecionadosAly137(
                            evidencia?.atributoPrincipal ? [evidencia.atributoPrincipal] : []
                          );
                          const atributosSelecionados = atributosSelecionadosSalvos.length
                            ? atributosSelecionadosSalvos
                            : atributosSelecionadosNormalizados.length
                              ? atributosSelecionadosNormalizados
                              : atributosSelecionadosLegados;
                          return (
                            <div
                              className={`aly137-editor-evidence${
                                ehConclusaoNivel ? " aly137-editor-evidence--conclusao" : ""
                              }`}
                              key={evidenciaId || index}
                            >
                              <div className="aly137-editor-evidence__header">
                                <strong>
                                  {ehConclusaoNivel
                                    ? evidenciaNormalizada?.conclusaoEtapa === "formacao"
                                      ? "Conclusao da formacao"
                                      : `Conclusao de nivel ${evidenciaNormalizada?.nivelAlvo || ""}`
                                    : `Evidencia ${index + 1}`}
                                </strong>
                                <span>{`${evidenciaNormalizada?.xpTotal || 0} XP`}</span>
                                <button
                                  type="button"
                                  onClick={() => removerEvidenciaAly137Editor(evidenciaId)}
                                  aria-label="Remover evidencia"
                                  title="Remover evidencia"
                                >
                                  X
                                </button>
                              </div>

                              <label>
                                <span>Titulo da evidencia</span>
                                <input
                                  type="text"
                                  value={evidencia?.titulo || ""}
                                  onChange={(event) =>
                                    atualizarEvidenciaAly137Editor(evidenciaId, {
                                      titulo: event.target.value,
                                    })
                                  }
                                  placeholder="Ex.: 10K de instalacoes"
                                />
                              </label>

                              {ehConclusaoNivel ? (
                                <div className="aly137-editor-conclusion-note">
                                  <strong>Fechamento automatico</strong>
                                  <span>
                                    {`Completa o card de ${evidenciaNormalizada?.xpAntesConclusao || 0} XP para ${evidenciaNormalizada?.xpAlvo || 0} XP, sem promover automaticamente para o proximo nivel.`}
                                  </span>
                                  <small>
                                    Novas evidencias depois do limite podem evoluir o card para o nivel seguinte.
                                  </small>
                                </div>
                              ) : null}

                              <div className="aly137-editor-evidence__grid">
                                <label>
                                  <span>Peso geral sem atributo</span>
                                  <select
                                    value={evidencia?.peso || "pequeno"}
                                    onChange={(event) =>
                                      atualizarEvidenciaAly137Editor(evidenciaId, {
                                        peso: event.target.value,
                                      })
                                    }
                                  >
                                    {Object.values(ALY137_PESOS_EVIDENCIA).map((peso) => (
                                      <option key={peso.key} value={peso.key}>
                                        {`${peso.label} (${peso.multiplicador}x)`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <div className="aly137-editor-attribute-picks" aria-label="Atributos afetados pela evidencia">
                                <span>Atributos afetados</span>
                                {ALY137_ATRIBUTOS.map((atributo) => {
                                  const marcado = atributosSelecionados.includes(atributo.key);
                                  const pesoAtributo =
                                    evidencia?.atributosPesos?.[atributo.key] || evidencia?.peso || "pequeno";
                                  return (
                                    <span
                                      key={atributo.key}
                                      className={`aly137-editor-attribute-pick${marcado ? " is-selected" : ""}`}
                                    >
                                      <button
                                        type="button"
                                        className={`aly137-editor-attribute-chip${marcado ? " is-selected" : ""}`}
                                        onClick={() =>
                                          alternarAtributoEvidenciaAly137Editor(evidenciaId, atributo.key)
                                        }
                                      >
                                        {atributo.label}
                                      </button>
                                      <select
                                        value={pesoAtributo}
                                        disabled={!marcado}
                                        onChange={(event) =>
                                          atualizarPesoAtributoEvidenciaAly137Editor(
                                            evidenciaId,
                                            atributo.key,
                                            event.target.value
                                          )
                                        }
                                        aria-label={`Peso de ${atributo.label}`}
                                      >
                                        {Object.values(ALY137_PESOS_EVIDENCIA).map((peso) => (
                                          <option key={peso.key} value={peso.key}>
                                            {peso.label}
                                          </option>
                                        ))}
                                      </select>
                                      <small>{`${calcularXpPorPesoAly137(pesoAtributo)} XP`}</small>
                                    </span>
                                  );
                                })}
                                <em>
                                  Cada atributo tem seu proprio peso. O XP total da evidencia soma os atributos selecionados.
                                </em>
                              </div>

                              <label>
                                <span>Descricao curta</span>
                                <textarea
                                  value={evidencia?.descricao || ""}
                                  onChange={(event) =>
                                    atualizarEvidenciaAly137Editor(evidenciaId, {
                                      descricao: event.target.value,
                                    })
                                  }
                                  rows={2}
                                  placeholder="Anotacao opcional sobre a prova."
                                />
                              </label>

                              <div className="aly137-editor-chip-list" aria-label="Add-ons afetados pela evidencia">
                                <span>Add-ons que recebem XP</span>
                                {addOnsEfetivosEditorCard.length ? (
                                  addOnsEfetivosEditorCard.map((addOn) => {
                                    const addOnId = String(addOn?.id || "").trim();
                                    const marcado = addOnsSelecionados.includes(addOnId);
                                    const herdado = addOnIdsHerdadosForjaEditor.includes(addOnId);
                                    return (
                                      <button
                                        key={addOnId}
                                        type="button"
                                        className={`aly137-editor-chip${marcado ? " is-selected" : ""}`}
                                        onClick={() => alternarAddOnEvidenciaAly137Editor(evidenciaId, addOnId)}
                                      >
                                        {addOn?.url_img ? <img src={addOn.url_img} alt="" /> : null}
                                        <span>{`${addOn?.nome || "Add-on"}${herdado ? " / herdado" : ""}`}</span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <em>Selecione add-ons na aba Add-ons para distribuir XP.</em>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p>Nenhuma evidencia cadastrada. O card ainda nao tem XP de prova.</p>
                      )}
                    </div>

                    <div className="card-editor-panel__title-row">
                      <strong>Cards usados na forja</strong>
                      <span>{`${cardsOrigemSelecionadosEditor.length} selecionado(s)`}</span>
                    </div>

                    <div className="aly137-editor-forge-list">
                      {cardsDisponiveisForjaEditor.length ? (
                        cardsDisponiveisForjaEditor.map((cardOrigem) => {
                          const marcado = cardsOrigemSelecionadosEditor.some(
                            (item) => item.key === cardOrigem.key
                          );
                          return (
                            <button
                              key={cardOrigem.key}
                              type="button"
                              className={`aly137-editor-forge-card${marcado ? " is-selected" : ""}`}
                              onClick={() => alternarCardOrigemForjaEditor(cardOrigem.key)}
                            >
                              <span>{cardOrigem.nome}</span>
                              <small>{`${cardOrigem.espacoNome || "Espaco"} / ${cardOrigem.blocoTitulo}`}</small>
                              <strong>{`${cardOrigem.xpTotal || 0} XP`}</strong>
                            </button>
                          );
                        })
                      ) : (
                        <p>Nenhum outro card disponivel para forja neste espaco.</p>
                      )}
                    </div>

                    <div className="card-editor-button-row">
                      <button
                        type="button"
                        onClick={abrirForjaPreviewEditor}
                        disabled={!editorCardModal?.card?.id}
                      >
                        Abrir forja
                      </button>
                      <span className="card-editor-muted">
                        A forja abre uma pre-visualizacao antes de preparar o novo card derivado.
                      </span>
                    </div>
                  </section>
);

export default EditorCardAly137Tab;
