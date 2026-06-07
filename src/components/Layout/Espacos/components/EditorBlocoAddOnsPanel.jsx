import { CYBERPINK_SUBTHEMES } from "../../Temas/cyberpink/subthemes";

const EditorBlocoAddOnsPanel = ({
  blocoEditorCardsAtual,
  buscaAddOnEditor,
  setBuscaAddOnEditor,
  blocoEmAtualizacaoId,
  subBlocosAddOnsEditorBlocoAtual,
  normalizarSubObjetosAddOns,
  persistirSubBlocosAddOnsDoBloco,
  addOnsProjetoHabilitados,
  blocoAddOnsProjetoHabilitado,
  erroAddOnsGerenciador,
  addOnsDisponiveisProjeto,
  addOnsEditorFiltrados,
  normalizarSubtemaAddOnOpcional,
  isSvgAssetUrl,
  criarSubObjetoAddOnRef,
  criarSubBlocoAddOns,
  addOnIdsEditorBlocoAtual,
}) => (
            blocoEditorCardsAtual?.tipo === "addons" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Subblocos de add-ons</strong>
                <input
                  type="search"
                  value={buscaAddOnEditor}
                  onChange={(event) => setBuscaAddOnEditor(event.target.value)}
                  placeholder="Pesquisar add-on por nome"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                />
                {subBlocosAddOnsEditorBlocoAtual.length ? (
                  subBlocosAddOnsEditorBlocoAtual.map((subBloco, subBlocoIndex) => {
                    const bloqueadoEditor = blocoEmAtualizacaoId === blocoEditorCardsAtual.id;
                    const subObjetosSubBloco = normalizarSubObjetosAddOns(subBloco.subObjetos);

                    return (
                      <section
                        key={subBloco.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 8,
                          padding: 10,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            defaultValue={subBloco.titulo}
                            placeholder={`Nome do subbloco ${subBlocoIndex + 1}`}
                            disabled={bloqueadoEditor}
                            onBlur={(event) => {
                              const titulo = String(event.target.value || "").trim();
                              if (titulo === subBloco.titulo) return;
                              const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.map(
                                (item, index) =>
                                  index === subBlocoIndex
                                    ? {
                                        ...item,
                                        titulo: titulo || `Subbloco ${subBlocoIndex + 1}`,
                                      }
                                    : item
                              );
                              void persistirSubBlocosAddOnsDoBloco(
                                blocoEditorCardsAtual,
                                proximosSubBlocos
                              );
                            }}
                          />
                          {subBlocosAddOnsEditorBlocoAtual.length > 1 ? (
                            <button
                              type="button"
                              disabled={bloqueadoEditor}
                              onClick={() => {
                                const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.filter(
                                  (_, index) => index !== subBlocoIndex
                                );
                                void persistirSubBlocosAddOnsDoBloco(
                                  blocoEditorCardsAtual,
                                  proximosSubBlocos
                                );
                              }}
                              style={{ color: "#ff5aa5" }}
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>

                        <div
                          style={{
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            padding: 10,
                            maxHeight: 320,
                            overflowY: "auto",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          {!addOnsProjetoHabilitados ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              A base de add-ons esta desativada neste projeto.
                            </p>
                          ) : !blocoAddOnsProjetoHabilitado ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Blocos do tipo Add-ons estao desativados neste projeto.
                            </p>
                          ) : erroAddOnsGerenciador ? (
                            <p style={{ margin: 0, color: "#ff9db0" }}>{erroAddOnsGerenciador}</p>
                          ) : !addOnsDisponiveisProjeto.length ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Nenhum add-on criado para este usuario/projeto.
                            </p>
                          ) : !addOnsEditorFiltrados.length ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Nenhum add-on encontrado para este filtro.
                            </p>
                          ) : (
                            addOnsEditorFiltrados.map((item) => {
                              const addOnId = String(item?.id || "").trim();
                              const subObjetoAtual = subObjetosSubBloco.find(
                                (subObjeto) => String(subObjeto?.addonId || "") === addOnId
                              );
                              const marcado = Boolean(subObjetoAtual);
                              const subtemaSelecionado =
                                normalizarSubtemaAddOnOpcional(subObjetoAtual?.subtema) || "";
                              const addOnEhSvg = isSvgAssetUrl(item?.url_img);

                              return (
                                <label
                                  key={`${subBloco.id}-${addOnId}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "20px 38px minmax(0, 1fr)",
                                    gap: 10,
                                    alignItems: "center",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    disabled={bloqueadoEditor}
                                    onChange={() => {
                                      const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.map(
                                        (itemSubBloco, index) => {
                                          if (index !== subBlocoIndex) return itemSubBloco;
                                          const atuais = normalizarSubObjetosAddOns(
                                            itemSubBloco.subObjetos
                                          );
                                          const proximosSubObjetos = marcado
                                            ? atuais.filter(
                                                (subObjeto) =>
                                                  String(subObjeto?.addonId || "") !== addOnId
                                              )
                                            : [
                                                ...atuais,
                                                criarSubObjetoAddOnRef(item, atuais.length),
                                              ];
                                          return {
                                            ...itemSubBloco,
                                            subObjetos: proximosSubObjetos,
                                          };
                                        }
                                      );

                                      void persistirSubBlocosAddOnsDoBloco(
                                        blocoEditorCardsAtual,
                                        proximosSubBlocos
                                      );
                                    }}
                                  />
                                  <span
                                    style={{
                                      width: 38,
                                      height: 38,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                      background: "rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    {item?.url_img ? (
                                      <img
                                        src={item.url_img}
                                        alt={item.nome || "Add-on"}
                                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                      />
                                    ) : null}
                                  </span>
                                  <span style={{ minWidth: 0 }}>
                                    <strong>{item.nome}</strong>
                                    {item?.descricao ? (
                                      <span style={{ display: "block", fontSize: 12, opacity: 0.74 }}>
                                        {item.descricao}
                                      </span>
                                    ) : null}
                                    {marcado && addOnEhSvg ? (
                                      <span style={{ display: "grid", gap: 4, marginTop: 8 }}>
                                        <span style={{ fontSize: 11, opacity: 0.72 }}>
                                          Subtema do SVG neste subbloco
                                        </span>
                                        <select
                                          value={subtemaSelecionado}
                                          disabled={bloqueadoEditor}
                                          onChange={(event) => {
                                            const proximoValor = normalizarSubtemaAddOnOpcional(
                                              event.target.value
                                            );
                                            const proximosSubBlocos =
                                              subBlocosAddOnsEditorBlocoAtual.map(
                                                (itemSubBloco, index) => {
                                                  if (index !== subBlocoIndex) return itemSubBloco;
                                                  return {
                                                    ...itemSubBloco,
                                                    subObjetos: normalizarSubObjetosAddOns(
                                                      itemSubBloco.subObjetos
                                                    ).map((subObjeto) =>
                                                      String(subObjeto?.addonId || "") === addOnId
                                                        ? {
                                                            ...subObjeto,
                                                            subtema: proximoValor,
                                                          }
                                                        : subObjeto
                                                    ),
                                                  };
                                                }
                                              );

                                            void persistirSubBlocosAddOnsDoBloco(
                                              blocoEditorCardsAtual,
                                              proximosSubBlocos
                                            );
                                          }}
                                        >
                                          <option value="">Padrao do espaco</option>
                                          {CYBERPINK_SUBTHEMES.map((subtema) => (
                                            <option key={subtema.value} value={subtema.value}>
                                              {`Subtema: ${subtema.label}`}
                                            </option>
                                          ))}
                                        </select>
                                      </span>
                                    ) : null}
                                    {marcado && !addOnEhSvg ? (
                                      <span style={{ display: "block", fontSize: 11, opacity: 0.58, marginTop: 8 }}>
                                        Cor dinamica disponivel apenas para add-ons em SVG.
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
                          {`${subObjetosSubBloco.length} subobjeto(s) neste subbloco.`}
                        </span>
                      </section>
                    );
                  })
                ) : (
                  <p style={{ margin: 0, opacity: 0.76 }}>Nenhum subbloco criado.</p>
                )}
                <button
                  type="button"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                  onClick={() => {
                    const atuais = subBlocosAddOnsEditorBlocoAtual.length
                      ? subBlocosAddOnsEditorBlocoAtual
                      : [criarSubBlocoAddOns(0)];
                    void persistirSubBlocosAddOnsDoBloco(blocoEditorCardsAtual, [
                      ...atuais,
                      criarSubBlocoAddOns(atuais.length),
                    ]);
                  }}
                >
                  Adicionar subbloco
                </button>
                <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
                  {`${addOnIdsEditorBlocoAtual.length} subobjeto(s) selecionado(s).`}
                </span>
              </div>
            ) : null
);

export default EditorBlocoAddOnsPanel;
