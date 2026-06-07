const EditorCardRastreabilidadeTab = ({
  editorCardModal,
  montarRotaCardDoBloco,
  montarUrlAbsolutaCard,
  navigate,
  podeVerAuditoriaConteudo,
  abrirAuditoriaEntidade,
}) => (
                  <section className="card-editor-panel" aria-label="Rastreabilidade do card">
                    {(() => {
                      const rotaCard = editorCardModal?.ehNovo
                        ? ""
                        : montarRotaCardDoBloco(editorCardModal.bloco, editorCardModal.card);
                      const urlCard = rotaCard ? montarUrlAbsolutaCard(rotaCard) : "";

                      return (
                        <div className="card-editor-trace-panel">
                          <strong>Visualizacao unica do card</strong>
                          <p>
                            Essa rota abre somente o card e preserva a leitura rastreavel quando usada por QR/link.
                          </p>
                          <code>{urlCard || "Salve o card antes de gerar rota rastreavel."}</code>
                          <div className="card-editor-button-row">
                            <button
                              type="button"
                              disabled={!rotaCard}
                              onClick={() => rotaCard && navigate(rotaCard)}
                            >
                              Abrir card ampliado
                            </button>
                            {podeVerAuditoriaConteudo ? (
                              <button
                                type="button"
                                disabled={!editorCardModal?.card?.id || editorCardModal?.ehNovo}
                                onClick={() =>
                                  abrirAuditoriaEntidade({
                                    entityType: "card",
                                    entityId: editorCardModal.card.id,
                                  })
                                }
                              >
                                Ver auditoria
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </section>
);

export default EditorCardRastreabilidadeTab;
