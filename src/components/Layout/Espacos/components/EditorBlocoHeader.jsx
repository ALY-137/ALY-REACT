const EditorBlocoHeader = ({
  blocoEditorCardsAtual,
  fecharEditorBlocoCards,
  cardsEditorBlocoAtual,
  abrirEditorCardDoBloco,
  gerarIdCardTemporario,
  subObjetosAddOnsEditorBlocoAtual,
}) => (
  <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>Editar bloco</strong>
                <p style={{ margin: "4px 0 0", opacity: 0.72, fontSize: 12 }}>
                  {blocoEditorCardsAtual?.tipo === "addons"
                    ? "Gerencie os subobjetos de add-ons deste bloco."
                    : blocoEditorCardsAtual?.tipo === "cards"
                      ? "Gerencie os cards deste bloco e adicione novos itens."
                      : "Ajuste as configuracoes deste bloco."}
                </p>
              </div>
              <button type="button" onClick={fecharEditorBlocoCards}>
                Fechar
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {blocoEditorCardsAtual?.tipo === "cards" ? (
                <>
                  <span style={{ fontSize: 12, opacity: 0.78 }}>
                    {`Cards no bloco: ${cardsEditorBlocoAtual.length}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      abrirEditorCardDoBloco(blocoEditorCardsAtual, {
                        id: gerarIdCardTemporario(),
                        ordem: cardsEditorBlocoAtual.length,
                        __novo: true,
                        nome: "",
                        descricaoExtra: "",
                        descricaoPrevia: "",
                        descricaoCompleta: "",
                        descricao: "",
                        imagem: "",
                        imagemPath: "",
                        linkExterno: "",
                      })
                    }
                  >
                    Adicionar card
                  </button>
                </>
              ) : blocoEditorCardsAtual?.tipo === "addons" ? (
                <span style={{ fontSize: 12, opacity: 0.78 }}>
                  {`Add-ons no bloco: ${subObjetosAddOnsEditorBlocoAtual.length}`}
                </span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.78 }}>
                  Ajuste o cabecalho deste bloco.
                </span>
              )}
            </div>
  </>
);

export default EditorBlocoHeader;
