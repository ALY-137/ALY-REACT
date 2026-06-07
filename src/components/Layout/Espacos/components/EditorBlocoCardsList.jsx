const EditorBlocoCardsList = ({
  blocoEditorCardsAtual,
  cardsEditorBlocoAtual,
  imagensCardsPorBloco,
  isRenderableUrl,
  blocoEmAtualizacaoId,
  setDragCardInfo,
  dragCardInfo,
  reordenarCardsDoBloco,
  abrirEditorCardDoBloco,
  cardEmAtualizacaoId,
}) => (
            blocoEditorCardsAtual?.tipo === "cards" ? (
              <div style={{ display: "grid", gap: 10 }}>
                {cardsEditorBlocoAtual.length ? (
                <>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>
                    Arraste as miniaturas para reordenar os cards do bloco.
                  </p>
                  {cardsEditorBlocoAtual.map((card, index) => {
                  const imagemCardResolvida =
                    imagensCardsPorBloco?.[blocoEditorCardsAtual.id]?.[card.id] || "";
                  const imagemCardFinal = isRenderableUrl(card.imagem)
                    ? card.imagem
                    : imagemCardResolvida || "/logoNeon.png";
                  return (
                    <div
                      key={`editor-bloco-card-${card.id || index}`}
                      draggable={blocoEmAtualizacaoId !== blocoEditorCardsAtual.id}
                      onDragStart={() =>
                        setDragCardInfo({
                          blocoId: blocoEditorCardsAtual.id,
                          cardId: String(card.id || ""),
                        })
                      }
                      onDragEnd={() => setDragCardInfo({ blocoId: "", cardId: "" })}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={async (event) => {
                        event.preventDefault();
                        const origemIndex = cardsEditorBlocoAtual.findIndex(
                          (item) =>
                            String(item?.id || "") === String(dragCardInfo?.cardId || "")
                        );
                        if (
                          dragCardInfo?.blocoId !== blocoEditorCardsAtual.id ||
                          origemIndex < 0
                        ) {
                          return;
                        }
                        await reordenarCardsDoBloco(blocoEditorCardsAtual, origemIndex, index);
                        setDragCardInfo({ blocoId: "", cardId: "" });
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        border:
                          dragCardInfo?.blocoId === blocoEditorCardsAtual.id &&
                          dragCardInfo?.cardId === String(card.id || "")
                            ? "1px solid rgba(255,255,255,0.5)"
                            : "1px solid rgba(255,255,255,0.1)",
                        padding: 10,
                        background: "rgba(255,255,255,0.03)",
                        cursor: "grab",
                        opacity:
                          dragCardInfo?.blocoId === blocoEditorCardsAtual.id &&
                          dragCardInfo?.cardId === String(card.id || "")
                            ? 0.72
                            : 1,
                      }}
                    >
                      <img
                        src={imagemCardFinal}
                        alt=""
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(0,0,0,0.25)",
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {card.nome || `Card ${index + 1}`}
                        </strong>
                        <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.56 }}>
                          {`Posicao ${index + 1}`}
                        </p>
                        {!!card.descricaoExtra && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.78 }}>
                            {card.descricaoExtra}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => abrirEditorCardDoBloco(blocoEditorCardsAtual, card)}
                        disabled={cardEmAtualizacaoId === `${blocoEditorCardsAtual.id}:${card.id}`}
                      >
                        {cardEmAtualizacaoId === `${blocoEditorCardsAtual.id}:${card.id}`
                          ? "Salvando..."
                          : "Editar"}
                      </button>
                    </div>
                  );
                })}
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.76 }}>
                  Nenhum card cadastrado ainda.
                </p>
                )}
              </div>
            ) : null
);

export default EditorBlocoCardsList;
