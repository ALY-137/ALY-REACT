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
  criarAddOnDoUsuarioProjeto,
  listarAddOnsDoUsuarioProjeto,
  removerAddOnDoUsuarioProjeto,
  salvarAddOnDoUsuarioProjeto,
} from "../../Sistema/gerenciadorProjetosApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterOwnerUidConfigurado,
  usuarioCorrespondeOwnerConfigurado,
} from "../../Sistema/configSistema";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";

function nomeArquivoSeguro(nome = "addon.png") {
  return String(nome || "addon.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

async function subirImagemAddOn({ file, addOnId, currentUser, ownerUserId }) {
  const ownerUid = String(ownerUserId || currentUser?.uid || "").trim();
  if (!ownerUid) {
    throw new Error("Usuario autenticado obrigatorio para enviar icones de add-on.");
  }

  const nome = `${Date.now()}-${nomeArquivoSeguro(file?.name || "addon.png")}`;
  const path = `users/${ownerUid}/add_ons/${addOnId}/${nome}`;

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
  const [configSistema, setConfigSistema] = useState(DEFAULT_SISTEMA_CONFIG);

  const addOnsHabilitados = configSistema?.addOnsHabilitados === true;
  const oneOwnerAtivo = isOneOwnerComEntradaPublica(configSistema);
  const ownerUidConfigurado = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const usuarioEhOwnerProjeto = Boolean(
    user?.uid &&
      (
        usuarioCorrespondeOwnerConfigurado(configSistema, {
          uid: user.uid,
          email: user?.email,
        }) ||
        (!ownerUidConfigurado && seforAdm(user))
      )
  );
  const ownerUserId = String(
    oneOwnerAtivo
      ? ownerUidConfigurado || (usuarioEhOwnerProjeto ? user?.uid : "")
      : user?.uid || ""
  ).trim();
  const podeGerenciarAddOns = Boolean(
    user?.uid &&
      addOnsHabilitados &&
      ownerUserId &&
      (!oneOwnerAtivo || usuarioEhOwnerProjeto)
  );

  const carregarAddOns = async () => {
    setCarregando(true);
    setErro("");
    try {
      const config = await obterConfigSistema();
      setConfigSistema(config || DEFAULT_SISTEMA_CONFIG);
      const configOneOwnerAtivo = isOneOwnerComEntradaPublica(config);
      const configOwnerUid = String(obterOwnerUidConfigurado(config) || "").trim();
      const configUsuarioEhOwner = Boolean(
        user?.uid &&
          (
            usuarioCorrespondeOwnerConfigurado(config, {
              uid: user.uid,
              email: user?.email,
            }) ||
            (!configOwnerUid && seforAdm(user))
          )
      );
      const ownerUid = String(
        configOneOwnerAtivo
          ? configOwnerUid || (configUsuarioEhOwner ? user?.uid : "")
          : user?.uid || ""
      ).trim();

      if (config?.addOnsHabilitados !== true) {
        setAddOns([]);
        setDraftsPorId({});
        return;
      }
      if (!ownerUid || (configOneOwnerAtivo && !configUsuarioEhOwner)) {
        setAddOns([]);
        setDraftsPorId({});
        return;
      }

      const lista = await listarAddOnsDoUsuarioProjeto({ ownerUserId: ownerUid });
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
  }, [loading, user?.uid]);

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
    if (!podeGerenciarAddOns) {
      setErro("Add-ons estao desativados ou voce nao tem permissao neste projeto.");
      return;
    }

    const nome = String(novoNome || "").trim();
    if (!nome) {
      setErro("Informe o nome do add-on.");
      return;
    }

    setErro("");
    setMensagem("");
    setSalvandoKey("novo");

    try {
      const addOnCriado = await criarAddOnDoUsuarioProjeto({
        ownerUserId,
        nome,
        descricao: novaDescricao,
        criadoPorUid: user?.uid || null,
      });

      if (novoArquivo instanceof File) {
        const upload = await subirImagemAddOn({
          file: novoArquivo,
          addOnId: addOnCriado.id,
          currentUser: user || null,
          ownerUserId,
        });

        await salvarAddOnDoUsuarioProjeto({
          ownerUserId,
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
    if (!podeGerenciarAddOns) {
      setErro("Add-ons estao desativados ou voce nao tem permissao neste projeto.");
      return;
    }

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
          ownerUserId,
        });
        payloadImagem = {
          url_img: upload.url,
          path_img: upload.path,
        };
      }

      await salvarAddOnDoUsuarioProjeto({
        ownerUserId,
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
    if (!podeGerenciarAddOns) {
      setErro("Add-ons estao desativados ou voce nao tem permissao neste projeto.");
      return;
    }

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
      await removerAddOnDoUsuarioProjeto({ ownerUserId, addOnId: item.id });
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

  if (!user) {
    return (
      <div className="menu-panel-stack addon-manager">
        <h2 className="menu-panel-main-title">ADD-ONS</h2>
        <div className="menu-panel-block">
          <p className="menu-panel-note">Faca login para gerenciar add-ons.</p>
        </div>
      </div>
    );
  }

  if (!addOnsHabilitados) {
    return (
      <div className="menu-panel-stack addon-manager">
        <h2 className="menu-panel-main-title">ADD-ONS</h2>
        <div className="menu-panel-block">
          <p className="menu-panel-note">A base de add-ons esta desativada neste projeto.</p>
        </div>
      </div>
    );
  }

  if (!podeGerenciarAddOns) {
    return (
      <div className="menu-panel-stack addon-manager">
        <h2 className="menu-panel-main-title">ADD-ONS</h2>
        <div className="menu-panel-block">
          <p className="menu-panel-note">Acesso permitido apenas ao usuario do projeto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-panel-stack addon-manager">
      <h2 className="menu-panel-main-title">ADD-ONS</h2>
      <p className="menu-panel-note">
        Cadastre add-ons deste usuario/projeto, envie icones e use-os em cards e blocos.
      </p>

      <div className="menu-panel-block addon-manager__create">
        <h3 className="menu-panel-title">Novo add-on</h3>
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

      <div className="menu-panel-block addon-manager__library">
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
          <h3 className="menu-panel-title" style={{ margin: 0 }}>Biblioteca do projeto</h3>
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
                  className="menu-panel-item addon-manager__item"
                  style={{
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "88px minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div
                    className="addon-manager__preview"
                    style={{
                      width: 88,
                      height: 88,
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
