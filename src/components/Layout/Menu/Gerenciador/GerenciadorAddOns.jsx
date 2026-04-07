import { useEffect, useMemo, useState } from "react";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import { storage } from "../../../Banco/init-firebase";
import {
  excluirArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../../Banco/sharedBucketApi";
import {
  criarAddOnNoGerenciador,
  listarAddOnsNoGerenciador,
  removerAddOnNoGerenciador,
  salvarAddOnNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";

function nomeArquivoSeguro(nome = "addon.png") {
  return String(nome || "addon.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

async function subirImagemAddOn({ file, addOnId, currentUser }) {
  const currentUid = String(currentUser?.uid || "").trim();
  if (!currentUid) {
    throw new Error("Usuario autenticado obrigatorio para enviar icones de add-on.");
  }

  const nome = `${Date.now()}-${nomeArquivoSeguro(file?.name || "addon.png")}`;
  const path = `users/${currentUid}/add_ons/${addOnId}/${nome}`;

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

async function removerImagemAddOnStorage({ path = "", currentUser }) {
  const pathNormalizado = String(path || "").trim();
  if (!pathNormalizado) return;

  if (usandoBucketCompartilhadoCrossProject()) {
    await excluirArquivoNoBucketCompartilhado({
      user: currentUser,
      path: pathNormalizado,
    });
    return;
  }

  await deleteObject(ref(storage, pathNormalizado));
}

function buildDrafts(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    acc[item.id] = {
      nome: String(item?.nome || ""),
      descricao: String(item?.descricao || ""),
    };
    return acc;
  }, {});
}

function GerenciadorAddOns() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [salvandoKey, setSalvandoKey] = useState("");
  const [addOns, setAddOns] = useState([]);
  const [draftsPorId, setDraftsPorId] = useState({});
  const [arquivosPorId, setArquivosPorId] = useState({});
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoArquivo, setNovoArquivo] = useState(null);

  const carregarAddOns = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarAddOnsNoGerenciador();
      setAddOns(lista);
      setDraftsPorId(buildDrafts(lista));
    } catch (error) {
      setErro(error?.message || "Falha ao carregar add-ons.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    void carregarAddOns();
  }, [loading]);

  const addOnsFiltrados = useMemo(() => {
    const buscaNormalizada = String(busca || "").trim().toLowerCase();
    return [...addOns]
      .filter((item) => {
        if (!buscaNormalizada) return true;
        return String(item?.nome || "").toLowerCase().includes(buscaNormalizada);
      })
      .sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR"));
  }, [addOns, busca]);

  const criarAddOn = async () => {
    const nome = String(novoNome || "").trim();
    if (!nome) {
      setErro("Informe o nome do add-on.");
      return;
    }

    setErro("");
    setMensagem("");
    setSalvandoKey("novo");

    try {
      const addOnCriado = await criarAddOnNoGerenciador({
        nome,
        descricao: novaDescricao,
        criadoPorUid: user?.uid || null,
      });

      if (novoArquivo instanceof File) {
        const upload = await subirImagemAddOn({
          file: novoArquivo,
          addOnId: addOnCriado.id,
          currentUser: user || null,
        });

        await salvarAddOnNoGerenciador({
          addOnId: addOnCriado.id,
          url_img: upload.url,
          path_img: upload.path,
          atualizadoPorUid: user?.uid || null,
        });
      }

      setNovoNome("");
      setNovaDescricao("");
      setNovoArquivo(null);
      setMensagem("Add-on criado com sucesso.");
      await carregarAddOns();
    } catch (error) {
      setErro(error?.message || "Falha ao criar add-on.");
    } finally {
      setSalvandoKey("");
    }
  };

  const salvarAddOn = async (item) => {
    const draft = draftsPorId[item.id] || {};
    const nome = String(draft?.nome || "").trim();
    if (!nome) {
      setErro("Informe o nome do add-on.");
      return;
    }

    setErro("");
    setMensagem("");
    setSalvandoKey(item.id);

    try {
      const arquivoNovo = arquivosPorId[item.id];
      let payloadImagem = {};

      if (arquivoNovo instanceof File) {
        if (item?.path_img) {
          await removerImagemAddOnStorage({
            path: item.path_img,
            currentUser: user || null,
          }).catch(() => {});
        }

        const upload = await subirImagemAddOn({
          file: arquivoNovo,
          addOnId: item.id,
          currentUser: user || null,
        });
        payloadImagem = {
          url_img: upload.url,
          path_img: upload.path,
        };
      }

      await salvarAddOnNoGerenciador({
        addOnId: item.id,
        nome,
        descricao: draft?.descricao || "",
        atualizadoPorUid: user?.uid || null,
        ...payloadImagem,
      });

      setArquivosPorId((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setMensagem(`Add-on "${nome}" atualizado.`);
      await carregarAddOns();
    } catch (error) {
      setErro(error?.message || "Falha ao salvar add-on.");
    } finally {
      setSalvandoKey("");
    }
  };

  const removerAddOn = async (item) => {
    const ok = window.confirm(`Remover o add-on "${item.nome}"?`);
    if (!ok) return;

    setErro("");
    setMensagem("");
    setSalvandoKey(`remover:${item.id}`);

    try {
      if (item?.path_img) {
        await removerImagemAddOnStorage({
          path: item.path_img,
          currentUser: user || null,
        }).catch(() => {});
      }
      await removerAddOnNoGerenciador({ addOnId: item.id });
      setMensagem(`Add-on "${item.nome}" removido.`);
      await carregarAddOns();
    } catch (error) {
      setErro(error?.message || "Falha ao remover add-on.");
    } finally {
      setSalvandoKey("");
    }
  };

  if (loading || carregando) {
    return <ProjectLoadingFallback text="Carregando add-ons..." />;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>ADD-ONS</h2>
        <p>Acesso restrito ao owner.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>ADD-ONS</h2>
      <p>Cadastre add-ons globais, envie o icone e mantenha a biblioteca central do gerenciador.</p>

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Novo add-on</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Nome</span>
            <input
              type="text"
              value={novoNome}
              onChange={(event) => setNovoNome(event.target.value)}
              placeholder="Ex.: VIP, Raro, Colecionavel"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Descricao</span>
            <textarea
              rows={2}
              value={novaDescricao}
              onChange={(event) => setNovaDescricao(event.target.value)}
              placeholder="Descricao opcional do add-on"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Icone</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setNovoArquivo(event.target.files?.[0] || null)}
            />
          </label>
          <div>
            <button type="button" onClick={criarAddOn} disabled={salvandoKey === "novo"}>
              {salvandoKey === "novo" ? "Criando add-on..." : "Criar add-on"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Biblioteca central</h3>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Pesquisar add-on por nome"
            style={{ width: "min(320px, 100%)" }}
          />
        </div>

        {erro ? <p style={{ marginTop: 0, color: "#ff9090" }}>{erro}</p> : null}
        {mensagem ? <p style={{ marginTop: 0, color: "#9dffb4" }}>{mensagem}</p> : null}

        {!addOnsFiltrados.length ? (
          <p style={{ marginBottom: 0 }}>Nenhum add-on encontrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {addOnsFiltrados.map((item) => {
              const draft = draftsPorId[item.id] || {};
              const arquivoNovo = arquivosPorId[item.id];
              const emSalvamento =
                salvandoKey === item.id || salvandoKey === `remover:${item.id}`;

              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "88px minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
                    ) : (
                      <span style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
                        Sem icone
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Nome</span>
                      <input
                        type="text"
                        value={draft.nome || ""}
                        onChange={(event) =>
                          setDraftsPorId((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              nome: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Descricao</span>
                      <textarea
                        rows={2}
                        value={draft.descricao || ""}
                        onChange={(event) =>
                          setDraftsPorId((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              descricao: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Trocar icone</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setArquivosPorId((prev) => ({
                            ...prev,
                            [item.id]: event.target.files?.[0] || null,
                          }))
                        }
                      />
                    </label>

                    {arquivoNovo ? (
                      <span style={{ fontSize: 12, opacity: 0.78 }}>
                        {`Arquivo selecionado: ${arquivoNovo.name}`}
                      </span>
                    ) : null}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => salvarAddOn(item)} disabled={emSalvamento}>
                        {salvandoKey === item.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removerAddOn(item)}
                        disabled={emSalvamento}
                        style={{ color: "#ff9db0" }}
                      >
                        {salvandoKey === `remover:${item.id}` ? "Removendo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GerenciadorAddOns;
