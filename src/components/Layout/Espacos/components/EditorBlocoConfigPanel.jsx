import {
  encryptTextBlockContent,
  shouldEncryptTextBlockForVisibility,
} from "../../../Banco/textBlockCrypto";

const TEXTO_MODOS_BLOCO = [
  { value: "simples", label: "Texto simples" },
  { value: "artigo", label: "Artigo" },
  { value: "post", label: "Blog/Post" },
  { value: "aviso", label: "Aviso" },
];

const EditorBlocoConfigPanel = ({
  editorBlocoCardsModal,
  blocoEditorCardsAtual,
  setEditorBlocoCardsModal,
  blocoEmAtualizacaoId,
  projetoPossuiColecoesIcones,
  parseIconSelectionValue,
  iconCollectionsFiltradas,
  atualizarMetadadosBloco,
}) => {
  const bloqueado = blocoEmAtualizacaoId === blocoEditorCardsAtual.id;
  const blocoEhTexto = blocoEditorCardsAtual?.tipo === "texto";
  const textoDeveCriptografar =
    blocoEhTexto && shouldEncryptTextBlockForVisibility(blocoEditorCardsAtual?.visibilidade);

  const salvarConfiguracoes = async () => {
    const iconPayload = projetoPossuiColecoesIcones
      ? parseIconSelectionValue(editorBlocoCardsModal.iconeSelecao, iconCollectionsFiltradas)
      : {
          iconCollectionId: String(blocoEditorCardsAtual?.iconCollectionId || "").trim(),
          iconId: String(blocoEditorCardsAtual?.iconId || "").trim(),
          iconUrl: String(
            blocoEditorCardsAtual?.icone || blocoEditorCardsAtual?.iconUrl || ""
          ).trim(),
          iconLabel: String(blocoEditorCardsAtual?.iconLabel || "").trim(),
        };

    const updates = {
      titulo: editorBlocoCardsModal.titulo,
      icone: iconPayload.iconUrl,
      iconUrl: iconPayload.iconUrl,
      iconCollectionId: iconPayload.iconCollectionId,
      iconId: iconPayload.iconId,
      iconLabel: iconPayload.iconLabel,
    };

    if (blocoEhTexto) {
      const corpoTexto = String(editorBlocoCardsModal.textoCorpo || "").trim();
      const resumoPublico = String(editorBlocoCardsModal.textoResumoPublico || "").trim();
      updates.textoModo = String(editorBlocoCardsModal.textoModo || "simples").trim() || "simples";
      updates.textoSubtitulo = String(editorBlocoCardsModal.textoSubtitulo || "").trim();
      updates.textoResumoPublico = resumoPublico;
      updates.textoConteudoCriptografado = textoDeveCriptografar;

      if (textoDeveCriptografar) {
        if (corpoTexto) {
          const chave = String(editorBlocoCardsModal.textoChaveCripto || "").trim();
          if (!chave) {
            alert("Informe a chave para salvar este texto privado com criptografia.");
            return;
          }
          updates.textoCriptografia = await encryptTextBlockContent(corpoTexto, chave);
          updates.textoCorpo = "";
          updates.conteudo = resumoPublico;
        } else if (!blocoEditorCardsAtual?.textoConteudoCriptografado) {
          alert("Informe o corpo do texto para salvar este conteudo privado com criptografia.");
          return;
        } else {
          updates.conteudo = resumoPublico;
          updates.textoCorpo = "";
        }
      } else {
        updates.textoCriptografia = null;
        updates.textoCorpo = corpoTexto;
        updates.conteudo = corpoTexto;
      }
    }

    atualizarMetadadosBloco(blocoEditorCardsAtual.id, updates);
  };

  return (
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
          disabled={bloqueado}
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
            disabled={bloqueado}
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

      {blocoEhTexto ? (
        <section style={{ display: "grid", gap: 10, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
          <strong>Conteudo do texto</strong>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Formato</span>
            <select
              value={editorBlocoCardsModal.textoModo}
              onChange={(event) =>
                setEditorBlocoCardsModal((prev) => ({
                  ...prev,
                  textoModo: event.target.value,
                }))
              }
              disabled={bloqueado}
            >
              {TEXTO_MODOS_BLOCO.map((modo) => (
                <option key={modo.value} value={modo.value}>
                  {modo.label}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            placeholder="Subtitulo ou chamada"
            value={editorBlocoCardsModal.textoSubtitulo}
            onChange={(event) =>
              setEditorBlocoCardsModal((prev) => ({
                ...prev,
                textoSubtitulo: event.target.value,
              }))
            }
            disabled={bloqueado}
          />

          <textarea
            rows={8}
            placeholder={
              textoDeveCriptografar && blocoEditorCardsAtual?.textoConteudoCriptografado
                ? "Novo conteudo privado (opcional para substituir)"
                : "Conteudo do texto"
            }
            value={editorBlocoCardsModal.textoCorpo}
            onChange={(event) =>
              setEditorBlocoCardsModal((prev) => ({
                ...prev,
                textoCorpo: event.target.value,
              }))
            }
            disabled={bloqueado}
            style={{ resize: "vertical" }}
          />

          {textoDeveCriptografar ? (
            <>
              <strong style={{ fontSize: 13 }}>Criptografia automatica para texto privado</strong>
              <input
                type="password"
                placeholder="Chave local para criptografar novo conteudo"
                value={editorBlocoCardsModal.textoChaveCripto}
                onChange={(event) =>
                  setEditorBlocoCardsModal((prev) => ({
                    ...prev,
                    textoChaveCripto: event.target.value,
                  }))
                }
                disabled={bloqueado}
                autoComplete="new-password"
              />
              <textarea
                rows={2}
                placeholder="Resumo publico opcional"
                value={editorBlocoCardsModal.textoResumoPublico}
                onChange={(event) =>
                  setEditorBlocoCardsModal((prev) => ({
                    ...prev,
                    textoResumoPublico: event.target.value,
                  }))
                }
                disabled={bloqueado}
                style={{ resize: "vertical" }}
              />
              <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>
                A chave nao e salva. Se o conteudo atual ja estiver criptografado, deixe o corpo vazio para manter o ciphertext existente.
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={salvarConfiguracoes} disabled={bloqueado}>
          {bloqueado ? "Salvando bloco..." : "Salvar bloco"}
        </button>
      </div>
    </div>
  );
};

export default EditorBlocoConfigPanel;
