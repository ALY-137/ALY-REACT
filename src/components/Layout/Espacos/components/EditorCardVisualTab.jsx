const EditorCardVisualTab = ({
  editorCardModal,
  setEditorCardModal,
  selecionarArquivoImagem,
  imagemPreviewEditorCard,
}) => (
                  <section className="card-editor-panel" aria-label="Visual do card">
                    <label>
                      <span>URL da imagem</span>
                      <input
                        type="text"
                        value={editorCardModal.imagem}
                        onChange={(event) =>
                          setEditorCardModal((prev) => {
                            const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                            if (previewAnterior.startsWith("blob:")) {
                              try {
                                URL.revokeObjectURL(previewAnterior);
                              } catch {
                                // no-op
                              }
                            }
                            return {
                              ...prev,
                              imagem: event.target.value,
                              imagemArquivo: null,
                              imagemPreviewUrl: "",
                            };
                          })
                        }
                        placeholder="https://..."
                      />
                    </label>

                    <div className="card-editor-button-row">
                      <button
                        type="button"
                        onClick={async () => {
                          const arquivo = await selecionarArquivoImagem();
                          if (!arquivo) return;
                          const previewUrl = URL.createObjectURL(arquivo);
                          setEditorCardModal((prev) => {
                            const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                            if (previewAnterior.startsWith("blob:")) {
                              try {
                                URL.revokeObjectURL(previewAnterior);
                              } catch {
                                // no-op
                              }
                            }
                            return {
                              ...prev,
                              imagemArquivo: arquivo,
                              imagemPreviewUrl: previewUrl,
                            };
                          });
                        }}
                      >
                        Escolher arquivo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditorCardModal((prev) => {
                            const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                            if (previewAnterior.startsWith("blob:")) {
                              try {
                                URL.revokeObjectURL(previewAnterior);
                              } catch {
                                // no-op
                              }
                            }
                            return {
                              ...prev,
                              imagem: "",
                              imagemArquivo: null,
                              imagemPreviewUrl: "",
                            };
                          })
                        }
                      >
                        Remover imagem
                      </button>

                      {editorCardModal.imagemArquivo ? (
                        <span className="card-editor-muted">
                          {`Arquivo: ${editorCardModal.imagemArquivo.name}`}
                        </span>
                      ) : null}
                    </div>

                    <div className="card-editor-image-preview">
                      <span>Imagem atual</span>
                      <img
                        src={imagemPreviewEditorCard}
                        alt="Preview do card"
                      />
                    </div>

                    <label className="card-editor-addon-svg-custom card-editor-addon-svg-custom--card-icon">
                      <span>SVG do card como add-on</span>
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        onChange={async (event) => {
                          const arquivo = event.target.files?.[0] || null;
                          if (!arquivo) return;
                          const textoSvg = await arquivo.text().catch(() => "");
                          const svgLimpo = String(textoSvg || "").trim();
                          setEditorCardModal((prev) => ({
                            ...prev,
                            iconeSvg: svgLimpo,
                          }));
                          event.target.value = "";
                        }}
                      />
                      {String(editorCardModal?.iconeSvg || "").trim() ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditorCardModal((prev) => ({
                              ...prev,
                              iconeSvg: "",
                            }))
                          }
                        >
                          Remover SVG do card
                        </button>
                      ) : null}
                    </label>
                  </section>
);

export default EditorCardVisualTab;
