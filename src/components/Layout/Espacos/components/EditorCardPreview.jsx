import Card from "../../Objects/Objetos/Card";
import { normalizeCyberpinkSubtheme } from "../../Temas/cyberpink/subthemes";

const EditorCardPreview = ({
  editorCardModal,
  ownerUserId,
  espacoId,
  addOnIdsEfetivosEditorCard,
  addOnSubthemesEfetivosEditorCard,
  addOnsEfetivosEditorCard,
  aly137Habilitado,
  resumoAly137EditorCard,
  abrirFichaAddOn,
  abrirFichaCardFragmento,
  espacoAtualEfetivo,
  imagemPreviewEditorCard,
}) => (
              <aside className="card-editor-preview" aria-label="Previa fixa do card">
                <span className="card-editor-preview__label">Previa fixa</span>
                <div className="card-editor-preview__frame">
                  <Card
                    id={editorCardModal.card?.id || "card-editor-preview"}
                    ownerUserId={ownerUserId}
                    espacoId={espacoId}
                    blocoId={editorCardModal.bloco?.id || ""}
                    addOnIds={addOnIdsEfetivosEditorCard}
                    addOnSubthemes={addOnSubthemesEfetivosEditorCard}
                    usaAddOnsGerenciador={true}
                    addOns={addOnsEfetivosEditorCard}
                    aly137={aly137Habilitado ? resumoAly137EditorCard : editorCardModal.card?.aly137}
                    onAddOnClick={abrirFichaAddOn}
                    onCardFragmentClick={abrirFichaCardFragmento}
                    cyberpinkSubtheme={normalizeCyberpinkSubtheme(espacoAtualEfetivo?.subtema)}
                    nome={editorCardModal.nome || "Card"}
                    descricaoExtra={editorCardModal.descricaoExtra || ""}
                    nomeDescricao={editorCardModal.nome || ""}
                    descricao={editorCardModal.descricaoPrevia || editorCardModal.descricao || ""}
                    atributoPersonalizado={{
                      rotulo: editorCardModal.atributoPersonalizadoRotulo || "",
                      nome: editorCardModal.atributoPersonalizadoNome || "",
                      valor: editorCardModal.atributoPersonalizadoValor || "",
                    }}
                    linkExterno={editorCardModal.linkExterno || ""}
                    imagem={imagemPreviewEditorCard}
                    idNome={`card-editor-preview-${editorCardModal.card?.id || "novo"}`}
                    cardDescricaoDiv="cardDescricaoDiv"
                    cardNome="cardNome"
                    cardContainerDesktop="cardContainerDesktop card-editor-preview__card"
                    cardCabecalho="cardCabecalho"
                    cardImagem="cardImagem"
                    cardDescricao="cardDescricao"
                    imgCard="imgCard"
                    previewSemFundoAddOn={true}
                  />
                </div>
              </aside>
);

export default EditorCardPreview;
