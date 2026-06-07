import EditorBlocoAddOnsPanel from "./EditorBlocoAddOnsPanel";
import EditorBlocoCardsList from "./EditorBlocoCardsList";
import EditorBlocoConfigPanel from "./EditorBlocoConfigPanel";
import EditorBlocoHeader from "./EditorBlocoHeader";

const EditorBlocoCardsModal = ({
  editorBlocoCardsModal,
  blocoEditorCardsAtual,
  fecharEditorBlocoCards,
  cardsEditorBlocoAtual,
  abrirEditorCardDoBloco,
  gerarIdCardTemporario,
  subObjetosAddOnsEditorBlocoAtual,
  setEditorBlocoCardsModal,
  blocoEmAtualizacaoId,
  projetoPossuiColecoesIcones,
  parseIconSelectionValue,
  iconCollectionsFiltradas,
  atualizarMetadadosBloco,
  imagensCardsPorBloco,
  isRenderableUrl,
  setDragCardInfo,
  dragCardInfo,
  reordenarCardsDoBloco,
  cardEmAtualizacaoId,
  buscaAddOnEditor,
  setBuscaAddOnEditor,
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
  excluirBloco,
  blocoEmExclusaoId,
  nomeBlocoSingularCapitalizado,
}) => {
  if (!editorBlocoCardsModal?.aberto || !blocoEditorCardsAtual) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99997,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="menuContentArea"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(96vw, 760px)",
          maxHeight: "92vh",
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(10, 6, 22, 0.96)",
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        <EditorBlocoHeader
          blocoEditorCardsAtual={blocoEditorCardsAtual}
          fecharEditorBlocoCards={fecharEditorBlocoCards}
          cardsEditorBlocoAtual={cardsEditorBlocoAtual}
          abrirEditorCardDoBloco={abrirEditorCardDoBloco}
          gerarIdCardTemporario={gerarIdCardTemporario}
          subObjetosAddOnsEditorBlocoAtual={subObjetosAddOnsEditorBlocoAtual}
        />

        <EditorBlocoConfigPanel
          editorBlocoCardsModal={editorBlocoCardsModal}
          blocoEditorCardsAtual={blocoEditorCardsAtual}
          setEditorBlocoCardsModal={setEditorBlocoCardsModal}
          blocoEmAtualizacaoId={blocoEmAtualizacaoId}
          projetoPossuiColecoesIcones={projetoPossuiColecoesIcones}
          parseIconSelectionValue={parseIconSelectionValue}
          iconCollectionsFiltradas={iconCollectionsFiltradas}
          atualizarMetadadosBloco={atualizarMetadadosBloco}
        />

        <EditorBlocoCardsList
          blocoEditorCardsAtual={blocoEditorCardsAtual}
          cardsEditorBlocoAtual={cardsEditorBlocoAtual}
          imagensCardsPorBloco={imagensCardsPorBloco}
          isRenderableUrl={isRenderableUrl}
          blocoEmAtualizacaoId={blocoEmAtualizacaoId}
          setDragCardInfo={setDragCardInfo}
          dragCardInfo={dragCardInfo}
          reordenarCardsDoBloco={reordenarCardsDoBloco}
          abrirEditorCardDoBloco={abrirEditorCardDoBloco}
          cardEmAtualizacaoId={cardEmAtualizacaoId}
        />

        <EditorBlocoAddOnsPanel
          blocoEditorCardsAtual={blocoEditorCardsAtual}
          buscaAddOnEditor={buscaAddOnEditor}
          setBuscaAddOnEditor={setBuscaAddOnEditor}
          blocoEmAtualizacaoId={blocoEmAtualizacaoId}
          subBlocosAddOnsEditorBlocoAtual={subBlocosAddOnsEditorBlocoAtual}
          normalizarSubObjetosAddOns={normalizarSubObjetosAddOns}
          persistirSubBlocosAddOnsDoBloco={persistirSubBlocosAddOnsDoBloco}
          addOnsProjetoHabilitados={addOnsProjetoHabilitados}
          blocoAddOnsProjetoHabilitado={blocoAddOnsProjetoHabilitado}
          erroAddOnsGerenciador={erroAddOnsGerenciador}
          addOnsDisponiveisProjeto={addOnsDisponiveisProjeto}
          addOnsEditorFiltrados={addOnsEditorFiltrados}
          normalizarSubtemaAddOnOpcional={normalizarSubtemaAddOnOpcional}
          isSvgAssetUrl={isSvgAssetUrl}
          criarSubObjetoAddOnRef={criarSubObjetoAddOnRef}
          criarSubBlocoAddOns={criarSubBlocoAddOns}
          addOnIdsEditorBlocoAtual={addOnIdsEditorBlocoAtual}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 12,
          }}
        >
          <button
            type="button"
            onClick={() => excluirBloco(blocoEditorCardsAtual.id)}
            disabled={blocoEmExclusaoId === blocoEditorCardsAtual.id}
            style={{ color: "#ff5aa5" }}
          >
            {blocoEmExclusaoId === blocoEditorCardsAtual.id
              ? `Excluindo ${nomeBlocoSingularCapitalizado}...`
              : `Excluir ${nomeBlocoSingularCapitalizado}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorBlocoCardsModal;
