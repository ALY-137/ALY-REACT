const EditorBlocoConfigPanel = ({
  editorBlocoCardsModal,
  blocoEditorCardsAtual,
  setEditorBlocoCardsModal,
  blocoEmAtualizacaoId,
  projetoPossuiColecoesIcones,
  parseIconSelectionValue,
  iconCollectionsFiltradas,
  atualizarMetadadosBloco,
}) => (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Titulo do bloco</span>
                <input
                  type="text"
                  value={editorBlocoCardsModal.titulo}
                  onChange={(event) =>
                    setEditorBlocoCardsModal((prev) => ({
                      ...prev,
                      titulo: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Icone do bloco</span>
                {projetoPossuiColecoesIcones ? (
                  <select
                    value={editorBlocoCardsModal.iconeSelecao}
                    onChange={(event) => {
                      const valor = event.target.value;
                      const iconPayload = parseIconSelectionValue(valor, iconCollectionsFiltradas);
                      setEditorBlocoCardsModal((prev) => ({
                        ...prev,
                        iconeSelecao: valor,
                        icone: iconPayload.iconUrl,
                      }));
                    }}
                    disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                  >
                    <option value="">Sem icone</option>
                    {iconCollectionsFiltradas.map((colecao) => (
                      <optgroup key={colecao.id} label={colecao.nome}>
                        {(colecao.icons || []).map((icon) => (
                          <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                            {icon.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>
                    Nenhuma colecao de icones permitida para este projeto/tema.
                  </p>
                )}
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    const iconPayload = projetoPossuiColecoesIcones
                      ? parseIconSelectionValue(
                          editorBlocoCardsModal.iconeSelecao,
                          iconCollectionsFiltradas
                        )
                      : {
                          iconCollectionId: String(blocoEditorCardsAtual?.iconCollectionId || "").trim(),
                          iconId: String(blocoEditorCardsAtual?.iconId || "").trim(),
                          iconUrl: String(blocoEditorCardsAtual?.icone || blocoEditorCardsAtual?.iconUrl || "").trim(),
                          iconLabel: String(blocoEditorCardsAtual?.iconLabel || "").trim(),
                        };
                    atualizarMetadadosBloco(blocoEditorCardsAtual.id, {
                      titulo: editorBlocoCardsModal.titulo,
                      icone: iconPayload.iconUrl,
                      iconUrl: iconPayload.iconUrl,
                      iconCollectionId: iconPayload.iconCollectionId,
                      iconId: iconPayload.iconId,
                      iconLabel: iconPayload.iconLabel,
                    });
                  }}
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                >
                  {blocoEmAtualizacaoId === blocoEditorCardsAtual.id
                    ? "Salvando bloco..."
                    : "Salvar cabecalho"}
                </button>
              </div>
            </div>
);

export default EditorBlocoConfigPanel;
