import EditorCardAddOnsTab from "./EditorCardAddOnsTab";
import EditorCardAly137Tab from "./EditorCardAly137Tab";
import EditorCardConteudoTab from "./EditorCardConteudoTab";
import EditorCardImpressaoTab from "./EditorCardImpressaoTab";
import EditorCardPreview from "./EditorCardPreview";
import EditorCardRastreabilidadeTab from "./EditorCardRastreabilidadeTab";
import EditorCardVisualTab from "./EditorCardVisualTab";
import useEdgeHorizontalScroll from "../../../../hooks/useEdgeHorizontalScroll";


const EditorCardModal = ({
  editorCardModal,
  editorCardAba,
  setEditorCardAba,
  setEditorCardModal,
  fecharEditorCard,
  aly137Habilitado,
  selecionarArquivoImagem,
  imagemPreviewEditorCard,
  addOnIdsEfetivosEditorCard,
  cardsOrigemSelecionadosEditor,
  isSvgAssetUrl,
  normalizarAddOnSubthemes,
  addOnSubthemesEfetivosEditorCard,
  addOnIdsHerdadosForjaEditor,
  formatarTipoAddOn,
  resolverTipoAddOn,
  moverAddOnEditorCard,
  normalizarAddOnIds,
  obterAddOnIdsDisponiveisCardOrigemAly137,
  addOnsDisponiveisProjetoPorId,
  alternarCardOrigemForjaEditor,
  alternarAddOnCardOrigemForjaEditor,
  buscaAddOnEditor,
  setBuscaAddOnEditor,
  filtroTipoAddOnEditor,
  setFiltroTipoAddOnEditor,
  tiposAddOnsEditor,
  addOnsProjetoHabilitados,
  erroAddOnsGerenciador,
  addOnsDisponiveisProjeto,
  addOnsEditorFiltrados,
  cardsFragmentosSkinLoading,
  erroCardsFragmentosSkin,
  cardsDisponiveisForjaEditor,
  cardsRelacionaveisEditorFiltrados,
  resumoAly137EditorCard,
  adicionarEvidenciaAly137Editor,
  adicionarConclusaoNivelAly137Editor,
  conclusaoNivelAly137EditorCard,
  removerEvidenciaAly137Editor,
  atualizarEvidenciaAly137Editor,
  alternarAtributoEvidenciaAly137Editor,
  atualizarPesoAtributoEvidenciaAly137Editor,
  addOnsEfetivosEditorCard,
  alternarAddOnEvidenciaAly137Editor,
  abrirForjaPreviewEditor,
  montarRotaCardDoBloco,
  montarUrlAbsolutaCard,
  navigate,
  podeVerAuditoriaConteudo,
  abrirAuditoriaEntidade,
  podeVerAuditoriaRastreaveis,
  abrirPreviewImpressaoCard,
  erroAcaoBloco,
  ownerUserId,
  espacoId,
  abrirFichaAddOn,
  abrirFichaCardFragmento,
  espacoAtualEfetivo,
  excluirCardDoBloco,
  cardEmAtualizacaoId,
  salvarEdicaoCardDoBloco,
}) => {
  const editorTabsEdgeScroll = useEdgeHorizontalScroll();

  if (!editorCardModal?.aberto) return null;

  return (
        <div
          role="dialog"
          aria-modal="true"
          className="card-editor-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="menuContentArea card-editor-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-editor-modal__header">
              <div>
                <strong>Editar card</strong>
                <p>
                  Conteudo, visual, add-ons, rastreabilidade e impressao em um fluxo unico.
                </p>
              </div>
              <button
                type="button"
                className="card-editor-modal__close"
                onClick={fecharEditorCard}
                aria-label="Fechar editor de card"
                title="Fechar"
              >
                <span className="card-editor-modal__close-icon" aria-hidden="true" />
              </button>
            </div>

            <div
              ref={editorTabsEdgeScroll.ref}
              className="card-editor-tabs edge-horizontal-scroll"
              data-edge-horizontal-scroll="true"
              role="tablist"
              aria-label="Abas do editor de card"
              onMouseEnter={editorTabsEdgeScroll.onMouseEnter}
              onMouseMove={editorTabsEdgeScroll.onMouseMove}
              onMouseLeave={editorTabsEdgeScroll.onMouseLeave}
              onBlur={editorTabsEdgeScroll.onBlur}
            >
              {[
                ["conteudo", "Conteudo"],
                ["visual", "Visual"],
                ["addons", "Add-ons"],
                ...(aly137Habilitado ? [["aly137", "XP / Forja"]] : []),
                ["rastreabilidade", "Rastreabilidade"],
                ["impressao", "Impressao"],
              ].map(([abaId, label]) => (
                <button
                  key={abaId}
                  type="button"
                  role="tab"
                  aria-selected={editorCardAba === abaId}
                  className={`card-editor-tab${editorCardAba === abaId ? " is-active" : ""}`}
                  onClick={() => setEditorCardAba(abaId)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="card-editor-modal__layout">
              <div className="card-editor-modal__fields">
                {editorCardAba === "conteudo" ? (
                  <EditorCardConteudoTab
                    editorCardModal={editorCardModal}
                    setEditorCardModal={setEditorCardModal}
                  />
                ) : null}

                {editorCardAba === "visual" ? (
                  <EditorCardVisualTab
                    editorCardModal={editorCardModal}
                    setEditorCardModal={setEditorCardModal}
                    selecionarArquivoImagem={selecionarArquivoImagem}
                    imagemPreviewEditorCard={imagemPreviewEditorCard}
                  />
                ) : null}

                {editorCardAba === "addons" ? (
                  <EditorCardAddOnsTab
                    editorCardModal={editorCardModal}
                    setEditorCardModal={setEditorCardModal}
                    aly137Habilitado={aly137Habilitado}
                    addOnIdsEfetivosEditorCard={addOnIdsEfetivosEditorCard}
                    addOnsEfetivosEditorCard={addOnsEfetivosEditorCard}
                    cardsOrigemSelecionadosEditor={cardsOrigemSelecionadosEditor}
                    isSvgAssetUrl={isSvgAssetUrl}
                    normalizarAddOnSubthemes={normalizarAddOnSubthemes}
                    addOnSubthemesEfetivosEditorCard={addOnSubthemesEfetivosEditorCard}
                    addOnIdsHerdadosForjaEditor={addOnIdsHerdadosForjaEditor}
                    formatarTipoAddOn={formatarTipoAddOn}
                    resolverTipoAddOn={resolverTipoAddOn}
                    moverAddOnEditorCard={moverAddOnEditorCard}
                    normalizarAddOnIds={normalizarAddOnIds}
                    obterAddOnIdsDisponiveisCardOrigemAly137={obterAddOnIdsDisponiveisCardOrigemAly137}
                    addOnsDisponiveisProjetoPorId={addOnsDisponiveisProjetoPorId}
                    alternarCardOrigemForjaEditor={alternarCardOrigemForjaEditor}
                    alternarAddOnCardOrigemForjaEditor={alternarAddOnCardOrigemForjaEditor}
                    buscaAddOnEditor={buscaAddOnEditor}
                    setBuscaAddOnEditor={setBuscaAddOnEditor}
                    filtroTipoAddOnEditor={filtroTipoAddOnEditor}
                    setFiltroTipoAddOnEditor={setFiltroTipoAddOnEditor}
                    tiposAddOnsEditor={tiposAddOnsEditor}
                    addOnsProjetoHabilitados={addOnsProjetoHabilitados}
                    erroAddOnsGerenciador={erroAddOnsGerenciador}
                    addOnsDisponiveisProjeto={addOnsDisponiveisProjeto}
                    addOnsEditorFiltrados={addOnsEditorFiltrados}
                    cardsFragmentosSkinLoading={cardsFragmentosSkinLoading}
                    erroCardsFragmentosSkin={erroCardsFragmentosSkin}
                    cardsDisponiveisForjaEditor={cardsDisponiveisForjaEditor}
                    cardsRelacionaveisEditorFiltrados={cardsRelacionaveisEditorFiltrados}
                  />
                ) : null}

                {editorCardAba === "aly137" && aly137Habilitado ? (
                  <EditorCardAly137Tab
                    editorCardModal={editorCardModal}
                    resumoAly137EditorCard={resumoAly137EditorCard}
                    adicionarEvidenciaAly137Editor={adicionarEvidenciaAly137Editor}
                    adicionarConclusaoNivelAly137Editor={adicionarConclusaoNivelAly137Editor}
                    conclusaoNivelAly137EditorCard={conclusaoNivelAly137EditorCard}
                    removerEvidenciaAly137Editor={removerEvidenciaAly137Editor}
                    atualizarEvidenciaAly137Editor={atualizarEvidenciaAly137Editor}
                    alternarAtributoEvidenciaAly137Editor={alternarAtributoEvidenciaAly137Editor}
                    atualizarPesoAtributoEvidenciaAly137Editor={atualizarPesoAtributoEvidenciaAly137Editor}
                    normalizarAddOnIds={normalizarAddOnIds}
                    addOnsEfetivosEditorCard={addOnsEfetivosEditorCard}
                    addOnIdsHerdadosForjaEditor={addOnIdsHerdadosForjaEditor}
                    alternarAddOnEvidenciaAly137Editor={alternarAddOnEvidenciaAly137Editor}
                    cardsOrigemSelecionadosEditor={cardsOrigemSelecionadosEditor}
                    cardsDisponiveisForjaEditor={cardsDisponiveisForjaEditor}
                    alternarCardOrigemForjaEditor={alternarCardOrigemForjaEditor}
                    abrirForjaPreviewEditor={abrirForjaPreviewEditor}
                  />
                ) : null}

                {editorCardAba === "rastreabilidade" ? (
                  <EditorCardRastreabilidadeTab
                    editorCardModal={editorCardModal}
                    montarRotaCardDoBloco={montarRotaCardDoBloco}
                    montarUrlAbsolutaCard={montarUrlAbsolutaCard}
                    navigate={navigate}
                    podeVerAuditoriaConteudo={podeVerAuditoriaConteudo}
                    abrirAuditoriaEntidade={abrirAuditoriaEntidade}
                  />
                ) : null}

                {editorCardAba === "impressao" && podeVerAuditoriaRastreaveis ? (
                  <EditorCardImpressaoTab
                    editorCardModal={editorCardModal}
                    imagemPreviewEditorCard={imagemPreviewEditorCard}
                    addOnIdsEfetivosEditorCard={addOnIdsEfetivosEditorCard}
                    addOnSubthemesEfetivosEditorCard={addOnSubthemesEfetivosEditorCard}
                    aly137Habilitado={aly137Habilitado}
                    resumoAly137EditorCard={resumoAly137EditorCard}
                    abrirPreviewImpressaoCard={abrirPreviewImpressaoCard}
                    addOnsEfetivosEditorCard={addOnsEfetivosEditorCard}
                    montarRotaCardDoBloco={montarRotaCardDoBloco}
                  />
                ) : null}

                {!!erroAcaoBloco && (
                  <p className="card-editor-error">{erroAcaoBloco}</p>
                )}
              </div>

              <EditorCardPreview
                editorCardModal={editorCardModal}
                ownerUserId={ownerUserId}
                espacoId={espacoId}
                addOnIdsEfetivosEditorCard={addOnIdsEfetivosEditorCard}
                addOnSubthemesEfetivosEditorCard={addOnSubthemesEfetivosEditorCard}
                addOnsEfetivosEditorCard={addOnsEfetivosEditorCard}
                aly137Habilitado={aly137Habilitado}
                resumoAly137EditorCard={resumoAly137EditorCard}
                abrirFichaAddOn={abrirFichaAddOn}
                abrirFichaCardFragmento={abrirFichaCardFragmento}
                espacoAtualEfetivo={espacoAtualEfetivo}
                imagemPreviewEditorCard={imagemPreviewEditorCard}
              />
            </div>

            <div className="card-editor-modal__footer">
              <button
                type="button"
                onClick={() => {
                  void excluirCardDoBloco();
                }}
                disabled={
                  cardEmAtualizacaoId ===
                  `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                }
                className="card-editor-danger"
              >
                {editorCardModal?.ehNovo ? "Descartar card" : "Excluir card"}
              </button>

              <span className="card-editor-modal__footer-actions">
                <button type="button" onClick={fecharEditorCard}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void salvarEdicaoCardDoBloco();
                  }}
                  disabled={
                    cardEmAtualizacaoId ===
                    `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                  }
                >
                  {cardEmAtualizacaoId ===
                  `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                    ? "Salvando card..."
                    : "Salvar card"}
                </button>
              </span>
            </div>
          </div>
        </div>
  );
};

export default EditorCardModal;
