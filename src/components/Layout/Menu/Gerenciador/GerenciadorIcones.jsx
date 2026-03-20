import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { storage } from "../../../Banco/init-firebase";
import { SYSTEM_THEMES } from "../../Temas/themesRegistry";
import {
  criarIconCollectionNoGerenciador,
  listarIconCollectionsNoGerenciador,
  removerIconCollectionNoGerenciador,
  salvarIconCollectionNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import {
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../../Banco/sharedBucketApi";

function nomeArquivoSeguro(nome = "icon.png") {
  return String(nome || "icon.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

async function subirIconeColecao({ file, collectionId, currentUser }) {
  const currentUid = String(currentUser?.uid || "").trim();
  if (!currentUid) {
    throw new Error("Usuario autenticado obrigatorio para enviar icones.");
  }

  const nome = `${Date.now()}-${nomeArquivoSeguro(file?.name || "icon.png")}`;
  const path = `users/${currentUid}/icon-collections/${collectionId}/${nome}`;

  if (usandoBucketCompartilhadoCrossProject()) {
    const upload = await uploadArquivoNoBucketCompartilhado({
      user: currentUser,
      path,
      file,
    });
    return {
      url: String(upload?.url || ""),
      path,
    };
  }

  const arquivoRef = ref(storage, path);
  await uploadBytes(arquivoRef, file);
  return {
    url: await getDownloadURL(arquivoRef),
    path,
  };
}

function toggleArrayValue(array = [], value = "") {
  const normalizado = String(value || "").trim();
  if (!normalizado) return array;
  return array.includes(normalizado)
    ? array.filter((item) => item !== normalizado)
    : [...array, normalizado];
}

function GerenciadorIcones() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [colecoes, setColecoes] = useState([]);
  const [novaColecaoNome, setNovaColecaoNome] = useState("");
  const [novosTemasColecao, setNovosTemasColecao] = useState([]);
  const [editingCollectionId, setEditingCollectionId] = useState("");
  const [editingCollectionNome, setEditingCollectionNome] = useState("");
  const [editingCollectionThemeIds, setEditingCollectionThemeIds] = useState([]);
  const [novoIconeLabelPorColecao, setNovoIconeLabelPorColecao] = useState({});
  const [novoIconeArquivoPorColecao, setNovoIconeArquivoPorColecao] = useState({});
  const [uploadCollectionId, setUploadCollectionId] = useState("");

  const carregarColecoes = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarIconCollectionsNoGerenciador();
      setColecoes(lista);
    } catch (error) {
      setErro(error?.message || "Falha ao carregar colecoes de icones.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    carregarColecoes();
  }, [loading]);

  const colecoesOrdenadas = useMemo(
    () => [...colecoes].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""))),
    [colecoes]
  );

  const criarColecao = async () => {
    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      await criarIconCollectionNoGerenciador({
        nome: novaColecaoNome,
        themeIds: novosTemasColecao,
        criadoPorUid: user?.uid || null,
      });
      setNovaColecaoNome("");
      setNovosTemasColecao([]);
      setMensagem("Colecao de icones criada com sucesso.");
      await carregarColecoes();
    } catch (error) {
      setErro(error?.message || "Falha ao criar colecao de icones.");
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (colecao) => {
    setEditingCollectionId(colecao.id);
    setEditingCollectionNome(String(colecao.nome || ""));
    setEditingCollectionThemeIds(Array.isArray(colecao.themeIds) ? colecao.themeIds : []);
  };

  const cancelarEdicao = () => {
    setEditingCollectionId("");
    setEditingCollectionNome("");
    setEditingCollectionThemeIds([]);
  };

  const salvarColecao = async (colecao) => {
    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      await salvarIconCollectionNoGerenciador({
        collectionId: colecao.id,
        nome: editingCollectionId === colecao.id ? editingCollectionNome : colecao.nome,
        themeIds:
          editingCollectionId === colecao.id
            ? editingCollectionThemeIds
            : (colecao.themeIds || []),
        icons: colecao.icons || [],
        atualizadoPorUid: user?.uid || null,
      });
      cancelarEdicao();
      setMensagem("Colecao atualizada com sucesso.");
      await carregarColecoes();
    } catch (error) {
      setErro(error?.message || "Falha ao salvar colecao de icones.");
    } finally {
      setSalvando(false);
    }
  };

  const removerColecao = async (colecao) => {
    const ok = window.confirm(`Remover a colecao "${colecao.nome}"?`);
    if (!ok) return;

    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      await removerIconCollectionNoGerenciador({ collectionId: colecao.id });
      if (editingCollectionId === colecao.id) {
        cancelarEdicao();
      }
      setMensagem("Colecao removida com sucesso.");
      await carregarColecoes();
    } catch (error) {
      setErro(error?.message || "Falha ao remover colecao de icones.");
    } finally {
      setSalvando(false);
    }
  };

  const adicionarIcone = async (colecao) => {
    const label = String(novoIconeLabelPorColecao[colecao.id] || "").trim();
    const arquivo = novoIconeArquivoPorColecao[colecao.id];
    if (!label) {
      setErro("Informe o nome do icone.");
      return;
    }
    if (!arquivo) {
      setErro("Selecione o arquivo do icone.");
      return;
    }

    setUploadCollectionId(colecao.id);
    setErro("");
    setMensagem("");

    try {
      const upload = await subirIconeColecao({
        file: arquivo,
        collectionId: colecao.id,
        currentUser: user || null,
      });
      const iconsAtualizados = [
        ...(colecao.icons || []),
        {
          id: `icon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          label,
          url: upload.url,
          path: upload.path,
        },
      ];

      await salvarIconCollectionNoGerenciador({
        collectionId: colecao.id,
        icons: iconsAtualizados,
        atualizadoPorUid: user?.uid || null,
      });

      setNovoIconeLabelPorColecao((prev) => ({ ...prev, [colecao.id]: "" }));
      setNovoIconeArquivoPorColecao((prev) => ({ ...prev, [colecao.id]: null }));
      setMensagem("Icone adicionado com sucesso.");
      await carregarColecoes();
    } catch (error) {
      setErro(error?.message || "Falha ao adicionar icone.");
    } finally {
      setUploadCollectionId("");
    }
  };

  const removerIcone = async (colecao, iconId) => {
    const iconsAtualizados = (colecao.icons || []).filter((icon) => icon.id !== iconId);
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      await salvarIconCollectionNoGerenciador({
        collectionId: colecao.id,
        icons: iconsAtualizados,
        atualizadoPorUid: user?.uid || null,
      });
      setMensagem("Icone removido da colecao.");
      await carregarColecoes();
    } catch (error) {
      setErro(error?.message || "Falha ao remover icone.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading || carregando) {
    return <p>Carregando colecoes de icones...</p>;
  }

  return (
    <div>
      <h2>GERENCIADOR DE ICONES</h2>
      <p>Crie colecoes de icones, vincule temas e alimente os icones disponiveis.</p>

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Nova colecao</h3>
        <label htmlFor="novaColecaoNome">Nome da colecao</label>
        <input
          id="novaColecaoNome"
          type="text"
          value={novaColecaoNome}
          onChange={(event) => setNovaColecaoNome(event.target.value)}
          style={{ width: "100%", marginTop: 6 }}
        />
        <p style={{ marginTop: 10, marginBottom: 6 }}>Temas permitidos</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {SYSTEM_THEMES.map((theme) => (
            <label key={theme.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={novosTemasColecao.includes(theme.id)}
                onChange={() =>
                  setNovosTemasColecao((prev) => toggleArrayValue(prev, theme.id))
                }
              />
              {theme.label}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={criarColecao} disabled={salvando}>
            {salvando ? "Salvando..." : "Criar colecao"}
          </button>
        </div>
      </div>

      {colecoesOrdenadas.map((colecao) => {
        const emEdicao = editingCollectionId === colecao.id;
        const nomeAtual = emEdicao ? editingCollectionNome : colecao.nome;
        const themeIdsAtuais = emEdicao ? editingCollectionThemeIds : (colecao.themeIds || []);

        return (
          <div
            key={colecao.id}
            style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{colecao.nome}</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {emEdicao ? (
                  <>
                    <button type="button" onClick={() => salvarColecao(colecao)} disabled={salvando}>
                      Salvar colecao
                    </button>
                    <button type="button" onClick={cancelarEdicao}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => iniciarEdicao(colecao)}>
                    Editar colecao
                  </button>
                )}
                <button type="button" onClick={() => removerColecao(colecao)} disabled={salvando}>
                  Remover colecao
                </button>
              </div>
            </div>

            <label htmlFor={`nome-${colecao.id}`} style={{ display: "block", marginTop: 10 }}>
              Nome da colecao
            </label>
            <input
              id={`nome-${colecao.id}`}
              type="text"
              value={nomeAtual}
              onChange={(event) => setEditingCollectionNome(event.target.value)}
              disabled={!emEdicao}
              style={{ width: "100%", marginTop: 6 }}
            />

            <p style={{ marginTop: 10, marginBottom: 6 }}>Temas permitidos</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {SYSTEM_THEMES.map((theme) => (
                <label key={`${colecao.id}-${theme.id}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={themeIdsAtuais.includes(theme.id)}
                    disabled={!emEdicao}
                    onChange={() =>
                      setEditingCollectionThemeIds((prev) => toggleArrayValue(prev, theme.id))
                    }
                  />
                  {theme.label}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Icones ({(colecao.icons || []).length})</strong>
              {(colecao.icons || []).length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 10 }}>
                  {colecao.icons.map((icon) => (
                    <div
                      key={icon.id}
                      style={{
                        border: "1px solid #666",
                        borderRadius: 8,
                        padding: 8,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <img
                        src={icon.url}
                        alt={icon.label}
                        style={{ width: 32, height: 32, objectFit: "contain" }}
                      />
                      <span style={{ fontSize: 12, textAlign: "center" }}>{icon.label}</span>
                      <button type="button" onClick={() => removerIcone(colecao, icon.id)}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: 8, opacity: 0.75 }}>Nenhum icone cadastrado nesta colecao.</p>
              )}
            </div>

            <div style={{ marginTop: 12, borderTop: "1px solid #555", paddingTop: 12 }}>
              <strong>Adicionar icone</strong>
              <label htmlFor={`label-${colecao.id}`} style={{ display: "block", marginTop: 8 }}>
                Nome do icone
              </label>
              <input
                id={`label-${colecao.id}`}
                type="text"
                value={novoIconeLabelPorColecao[colecao.id] || ""}
                onChange={(event) =>
                  setNovoIconeLabelPorColecao((prev) => ({
                    ...prev,
                    [colecao.id]: event.target.value,
                  }))
                }
                style={{ width: "100%", marginTop: 6 }}
              />
              <label htmlFor={`file-${colecao.id}`} style={{ display: "block", marginTop: 8 }}>
                Arquivo do icone
              </label>
              <input
                id={`file-${colecao.id}`}
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setNovoIconeArquivoPorColecao((prev) => ({
                    ...prev,
                    [colecao.id]: event.target.files?.[0] || null,
                  }))
                }
              />
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => adicionarIcone(colecao)}
                  disabled={uploadCollectionId === colecao.id}
                >
                  {uploadCollectionId === colecao.id ? "Enviando..." : "Adicionar icone"}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {mensagem ? <p style={{ marginTop: 10 }}>{mensagem}</p> : null}
      {erro ? <p style={{ marginTop: 10 }}>{erro}</p> : null}
    </div>
  );
}

export default GerenciadorIcones;
