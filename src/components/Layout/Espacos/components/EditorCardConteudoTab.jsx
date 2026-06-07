const EditorCardConteudoTab = ({
  editorCardModal,
  setEditorCardModal,
}) => (
                  <section className="card-editor-panel" aria-label="Conteudo do card">
                    <label>
                      <span>Titulo</span>
                      <input
                        type="text"
                        value={editorCardModal.nome}
                        onChange={(event) =>
                          setEditorCardModal((prev) => ({
                            ...prev,
                            nome: event.target.value,
                          }))
                        }
                        placeholder="Titulo do card"
                      />
                    </label>

                    <label>
                      <span>Descricao extra do titulo</span>
                      <input
                        type="text"
                        value={editorCardModal.descricaoExtra}
                        onChange={(event) =>
                          setEditorCardModal((prev) => ({
                            ...prev,
                            descricaoExtra: event.target.value,
                          }))
                        }
                        placeholder="Ex.: 22.000 instalacoes"
                      />
                    </label>

                    <label>
                      <span>Descricao previa</span>
                      <textarea
                        value={editorCardModal.descricaoPrevia || editorCardModal.descricao || ""}
                        onChange={(event) =>
                          setEditorCardModal((prev) => ({
                            ...prev,
                            descricaoPrevia: event.target.value,
                            descricao: event.target.value,
                          }))
                        }
                        placeholder="Texto curto exibido na previa do card"
                        rows={5}
                      />
                    </label>

                    <label>
                      <span>Descricao completa</span>
                      <textarea
                        value={editorCardModal.descricaoCompleta || ""}
                        onChange={(event) =>
                          setEditorCardModal((prev) => ({
                            ...prev,
                            descricaoCompleta: event.target.value,
                          }))
                        }
                        placeholder="Texto completo exibido no card ampliado. Inclua a descricao previa no inicio."
                        rows={9}
                      />
                    </label>

                    <label>
                      <span>Link externo</span>
                      <input
                        type="text"
                        value={editorCardModal.linkExterno}
                        onChange={(event) =>
                          setEditorCardModal((prev) => ({
                            ...prev,
                            linkExterno: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </label>
                  </section>
);

export default EditorCardConteudoTab;
