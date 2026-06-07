const EditorCardImpressaoTab = ({
  editorCardModal,
  imagemPreviewEditorCard,
  addOnIdsEfetivosEditorCard,
  addOnSubthemesEfetivosEditorCard,
  aly137Habilitado,
  resumoAly137EditorCard,
  abrirPreviewImpressaoCard,
  addOnsEfetivosEditorCard,
  montarRotaCardDoBloco,
}) => (
                  <section className="card-editor-panel" aria-label="Impressao e QR do card">
                    <div className="card-editor-trace-panel">
                      <strong>Card rastreavel para impressao</strong>
                      <p>
                        Crie ou escolha um QR rastreavel no historico. A frente e o verso para impressao ficam dentro desse fluxo.
                      </p>
                      <div className="card-editor-button-row">
                        <button
                          type="button"
                          disabled={editorCardModal?.ehNovo || !editorCardModal?.card?.id}
                          onClick={() => {
                            const cardPreview = {
                              ...(editorCardModal.card || {}),
                              nome: editorCardModal.nome,
                              descricaoExtra: editorCardModal.descricaoExtra,
                              descricaoPrevia: editorCardModal.descricaoPrevia || editorCardModal.descricao,
                              descricaoCompleta:
                                editorCardModal.descricaoCompleta ||
                                editorCardModal.descricaoPrevia ||
                                editorCardModal.descricao,
                              descricao: editorCardModal.descricaoPrevia || editorCardModal.descricao,
                              imagem: imagemPreviewEditorCard,
                              linkExterno: editorCardModal.linkExterno,
                              addOnIds: addOnIdsEfetivosEditorCard,
                              addOnSubthemes: addOnSubthemesEfetivosEditorCard,
                              aly137: aly137Habilitado
                                ? resumoAly137EditorCard
                                : editorCardModal.card?.aly137,
                              usaAddOnsGerenciador: true,
                            };
                            abrirPreviewImpressaoCard({
                              bloco: editorCardModal.bloco,
                              card: cardPreview,
                              imagem: imagemPreviewEditorCard,
                              addOns: addOnsEfetivosEditorCard,
                              rota: montarRotaCardDoBloco(editorCardModal.bloco, editorCardModal.card),
                            });
                          }}
                        >
                          Historico de card rastreavel
                        </button>
                      </div>
                      {editorCardModal?.ehNovo ? (
                        <span className="card-editor-muted">
                          Salve o card antes de criar QR ou gerar impressao.
                        </span>
                      ) : null}
                    </div>
                  </section>
);

export default EditorCardImpressaoTab;
