import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { useAuth } from "../../../hooks/auth/useAuth";
import { db, storage } from "../../Banco/init-firebase";
import { buscarSkinLogada } from "./buscarSkinLogada";
import { verificarESalvarskins } from "./verificaSkins";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import {
  listarTemasSkinDaFamilia,
  obterTemaSkinDefinicao,
  obterTemaSkinPadrao,
  resolverTemaSkinEfetivo,
} from "../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
  obterRotulosSkin,
} from "../Sistema/configSistema";
import {
  excluirArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../Storage/sharedBucketApi";

function nomeArquivoSeguro(nome = "cardprofile.png") {
  return String(nome || "cardprofile.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

const SkinsManager = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [skins, setSkins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configSistema, setConfigSistema] = useState(DEFAULT_SISTEMA_CONFIG);
  const [carregandoConfig, setCarregandoConfig] = useState(true);

  const [newUsername, setNewUsername] = useState("");
  const [newTheme, setNewTheme] = useState("");

  const [editingSkinId, setEditingSkinId] = useState(null);
  const [editingTheme, setEditingTheme] = useState("");
  const [novoCardProfileArquivo, setNovoCardProfileArquivo] = useState(null);
  const [cardProfileArquivos, setCardProfileArquivos] = useState({});
  const [skinUploadAtivaId, setSkinUploadAtivaId] = useState("");
  const [skinRemocaoAtivaId, setSkinRemocaoAtivaId] = useState("");

  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarConfig() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistema(config);
      } catch {
        if (!ativo) return;
        setConfigSistema(DEFAULT_SISTEMA_CONFIG);
      } finally {
        if (ativo) setCarregandoConfig(false);
      }
    }

    carregarConfig();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !user?.uid) return;
    fetchSkins();
  }, [loading, user?.uid]);

  const fetchSkins = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "skins"));

      setSkins(
        snap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
      );
    } catch (error) {
      console.error("Erro ao buscar skins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = seforAdm(user);
  const limiteAtingido =
    !isAdmin &&
    configSistema.limiteSkinsPorUsuario === "1" &&
    skins.length >= 1;
  const exibirSecaoCriacao = !limiteAtingido;

  const { singular, plural } = obterRotulosSkin(configSistema);
  const nomeSkinSingular = singular || "skin";
  const nomeSkinPlural = plural || "skins";
  const usarTituloSingular = configSistema?.tipoExperiencia === "onepage";
  const nomeSkinGestao = usarTituloSingular ? nomeSkinSingular : nomeSkinPlural;
  const permitirTemasSkinSecundarios =
    configSistema.permitirTemasSkinSecundarios !== false;
  const cabecalhoProjetoHabilitado = configSistema?.layoutTema?.headerVisible !== false;
  const temaSkinPadraoId = obterTemaSkinPadrao(configSistema.temaPadraoSistema);
  const temasDisponiveis = useMemo(
    () =>
      listarTemasSkinDaFamilia(
        configSistema.temaPadraoSistema,
        permitirTemasSkinSecundarios
      ),
    [configSistema.temaPadraoSistema, permitirTemasSkinSecundarios]
  );

  const resolverTemaCriacao = (themeIdCandidato = "") => {
    if (permitirTemasSkinSecundarios && !themeIdCandidato) {
      return "";
    }

    return resolverTemaSkinEfetivo(
      themeIdCandidato,
      configSistema.temaPadraoSistema,
      permitirTemasSkinSecundarios
    );
  };

  const labelTemaSkin = (theme) => {
    if (!theme) {
      return "";
    }

    const familia = String(theme.family || theme.id || "").trim();
    const sufixoFamilia = familia ? ` - familia ${familia}` : "";

    if (theme.id === temaSkinPadraoId || theme.isPrimary) {
      return `${theme.label || theme.id}${sufixoFamilia} (base)`;
    }

    return `${theme.label || theme.id}${sufixoFamilia} (secundario)`;
  };

  const labelSkinAtual = (skinThemeId) => {
    const temaEfetivoId = resolverTemaSkinEfetivo(
      skinThemeId,
      configSistema.temaPadraoSistema,
      permitirTemasSkinSecundarios
    );
    const temaDef = obterTemaSkinDefinicao(temaEfetivoId);
    return temaDef?.label || temaEfetivoId || skinThemeId;
  };

  const handleCreateFirstSkin = async (themeId) => {
    if (!user?.uid) return;
    if (limiteAtingido) {
      setFeedback(`Limite atingido. Voce pode criar apenas 1 ${nomeSkinSingular}.`);
      return;
    }

    const temaCriacao = resolverTemaCriacao(themeId);
    if (!temaCriacao) {
      setFeedback("Tema padrao nao configurado para criar a primeira skin.");
      return;
    }

    const prefixoPadrao = nomeSkinSingular
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const username = `${prefixoPadrao || "skin"}${Math.floor(Math.random() * 10000)}`;

    const resultado = await verificarESalvarskins(user.uid, username, temaCriacao);
    if (!resultado?.sucesso) {
      setFeedback(resultado?.mensagem || `Nao foi possivel criar ${nomeSkinSingular}.`);
      return;
    }

    localStorage.setItem("targetUsername", username);
    localStorage.setItem("skinLogadoUser", username);
    localStorage.setItem("skinLogado", "true");

    navigate(`/${username}/home`);
  };

  const handleCreateSkin = async () => {
    const temaCriacao = resolverTemaCriacao(newTheme);

    if (!newUsername || !temaCriacao) {
      const mensagemBase = permitirTemasSkinSecundarios
        ? `Preencha o nome da ${nomeSkinSingular} e selecione um tema.`
        : `Tema padrao indisponivel para criar a ${nomeSkinSingular}.`;
      setFeedback(mensagemBase);
      return;
    }
    if (!user?.uid) {
      setFeedback("Usuario nao autenticado.");
      return;
    }
    if (limiteAtingido) {
      setFeedback(`Limite atingido. Voce pode criar apenas 1 ${nomeSkinSingular}.`);
      return;
    }

    const resultado = await verificarESalvarskins(user.uid, newUsername, temaCriacao);

    if (!resultado.sucesso) {
      setFeedback(resultado.mensagem || `Nao foi possivel criar ${nomeSkinSingular}.`);
      return;
    }

    if (cabecalhoProjetoHabilitado && novoCardProfileArquivo && resultado?.id_skin) {
      try {
        await salvarCardProfileSkin(resultado.id_skin, novoCardProfileArquivo);
      } catch (error) {
        setFeedback(
          error?.message ||
            "A skin foi criada, mas nao foi possivel enviar a imagem do cardProfile."
        );
      }
    }

    setFeedback("");
    setNewUsername("");
    setNewTheme("");
    setNovoCardProfileArquivo(null);
    fetchSkins();
  };

  const handleSelectSkin = async (username) => {
    localStorage.setItem("targetUsername", username);
    localStorage.setItem("skinLogadoUser", username);
    localStorage.setItem("skinLogado", "true");

    await buscarSkinLogada();
    navigate(`/${username}/home`);
  };

  const handleUpdateTheme = async (skinId) => {
    if (!permitirTemasSkinSecundarios) return;
    if (!editingTheme) return;
    const temaAtualizado = resolverTemaCriacao(editingTheme);
    if (!temaAtualizado) return;

    await updateDoc(doc(db, "users", user.uid, "skins", skinId), {
      theme: temaAtualizado,
    });

    setEditingSkinId(null);
    setEditingTheme("");
    fetchSkins();
  };

  const handleDeleteSkin = async (skin) => {
    if (!window.confirm(`Excluir "${skin.username}"?`)) return;

    const paginasSnap = await getDocs(collection(db, "users", user.uid, "paginas"));

    for (const pagina of paginasSnap.docs) {
      await updateDoc(pagina.ref, {
        skins_relacionadas: arrayRemove(skin.id),
      });
    }

    await deleteDoc(doc(db, "users", user.uid, "skins", skin.id));

    fetchSkins();
  };

  const subirArquivoCardProfile = async (skinId, arquivo) => {
    const nome = `${Date.now()}-${nomeArquivoSeguro(arquivo?.name || "cardprofile.png")}`;
    const path = `users/${user.uid}/skins/${skinId}/cardProfile/${nome}`;

    if (usandoBucketCompartilhadoCrossProject) {
      const upload = await uploadArquivoNoBucketCompartilhado({
        user,
        path,
        file: arquivo,
      });
      return {
        cardProfilePath: path,
        cardProfileUrl: String(upload?.url || ""),
      };
    }

    const arquivoRef = ref(storage, path);
    await uploadBytes(arquivoRef, arquivo);
    const url = await getDownloadURL(arquivoRef);
    return {
      cardProfilePath: path,
      cardProfileUrl: url,
    };
  };

  const excluirArquivoCardProfile = async (path = "") => {
    const pathNormalizado = String(path || "").trim();
    if (!pathNormalizado) return;

    if (usandoBucketCompartilhadoCrossProject) {
      await excluirArquivoNoBucketCompartilhado({
        user,
        path: pathNormalizado,
      });
      return;
    }

    await deleteObject(ref(storage, pathNormalizado));
  };

  const salvarCardProfileSkin = async (skinId, arquivo) => {
    if (!skinId || !arquivo) return;
    const upload = await subirArquivoCardProfile(skinId, arquivo);
    await updateDoc(doc(db, "users", user.uid, "skins", skinId), upload);
  };

  const handleUploadCardProfile = async (skin) => {
    const arquivo = cardProfileArquivos[skin.id];
    if (!arquivo) {
      setFeedback("Selecione uma imagem para o cardProfile.");
      return;
    }

    setSkinUploadAtivaId(skin.id);
    setFeedback("");

    try {
      await salvarCardProfileSkin(skin.id, arquivo);
      setCardProfileArquivos((prev) => {
        const next = { ...prev };
        delete next[skin.id];
        return next;
      });
      await fetchSkins();
      setFeedback("Imagem do cardProfile salva com sucesso.");
    } catch (error) {
      setFeedback(error?.message || "Falha ao salvar imagem do cardProfile.");
    } finally {
      setSkinUploadAtivaId("");
    }
  };

  const handleRemoveCardProfile = async (skin) => {
    if (!skin?.id) return;

    setSkinRemocaoAtivaId(skin.id);
    setFeedback("");

    try {
      if (skin.cardProfilePath) {
        try {
          await excluirArquivoCardProfile(skin.cardProfilePath);
        } catch (error) {
          if (
            error?.code !== "storage/object-not-found" &&
            error?.code !== "storage/unauthorized"
          ) {
            throw error;
          }
        }
      }

      await updateDoc(doc(db, "users", user.uid, "skins", skin.id), {
        cardProfileUrl: "",
        cardProfilePath: "",
      });

      await fetchSkins();
      setFeedback("Imagem do cardProfile removida.");
    } catch (error) {
      setFeedback(error?.message || "Falha ao remover imagem do cardProfile.");
    } finally {
      setSkinRemocaoAtivaId("");
    }
  };

  const textoLimite = useMemo(() => {
    if (isAdmin) {
      return "Administrador tem criacao ilimitada.";
    }
    if (configSistema.limiteSkinsPorUsuario === "1") {
      return "";
    }
    return `Limite atual: ${nomeSkinPlural} ilimitadas por usuario.`;
  }, [configSistema.limiteSkinsPorUsuario, isAdmin, nomeSkinPlural, nomeSkinSingular]);

  if (loading || isLoading || carregandoConfig) return <p>Carregando...</p>;

  if (skins.length === 0) {
    return (
      <div className="theme-picker">
        {permitirTemasSkinSecundarios ? (
          <>
            <h2>Escolha o tema da sua {nomeSkinSingular}</h2>
            <div className="themes-grid">
              {temasDisponiveis.map((theme) => (
                <button key={theme.id} onClick={() => handleCreateFirstSkin(theme.id)}>
                  {labelTemaSkin(theme)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>Criar sua primeira {nomeSkinSingular}</h2>
            <p>Este projeto usa somente o tema padrao de skin.</p>
            <button onClick={() => handleCreateFirstSkin(temaSkinPadraoId)}>
              Criar com tema padrao
            </button>
          </>
        )}

        {!!feedback && <p style={{ color: "red" }}>{feedback}</p>}
      </div>
    );
  }

  return (
    <div className="skins-manager">
      <h2>Gerenciar {nomeSkinGestao}</h2>

      {exibirSecaoCriacao ? (
        <div className="create-skin">
          <h3>Criar nova {nomeSkinSingular}</h3>

          <input
            placeholder={`Nome da ${nomeSkinSingular}`}
            value={newUsername.toLowerCase()}
            onChange={(event) => setNewUsername(event.target.value)}
            disabled={limiteAtingido}
          />

          {permitirTemasSkinSecundarios ? (
            <select
              value={newTheme}
              onChange={(event) => setNewTheme(event.target.value)}
              disabled={limiteAtingido}
            >
              <option value="">Escolha o tema</option>
              {temasDisponiveis.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {labelTemaSkin(theme)}
                </option>
              ))}
            </select>
          ) : null}

          {cabecalhoProjetoHabilitado ? (
            <>
              <label style={{ display: "block", marginTop: 8 }}>
                Imagem do cardProfile
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setNovoCardProfileArquivo(event.target.files?.[0] || null)
                }
                disabled={limiteAtingido}
              />
            </>
          ) : null}

          <button onClick={handleCreateSkin} disabled={limiteAtingido}>
            Criar
          </button>

          {textoLimite ? <p style={{ marginTop: 8, opacity: 0.8 }}>{textoLimite}</p> : null}
          {!!feedback && <p style={{ color: "red" }}>{feedback}</p>}
        </div>
      ) : (
        textoLimite ? <p style={{ marginTop: 8, opacity: 0.8 }}>{textoLimite}</p> : null
      )}

      <ul className="skins-list">
        {skins.map((skin) => (
          <li key={skin.id}>
            <strong
              onClick={() => handleSelectSkin(skin.username)}
              style={{ cursor: "pointer" }}
            >
              {skin.username}
            </strong>

            {editingSkinId === skin.id && permitirTemasSkinSecundarios ? (
              <>
                <select value={editingTheme} onChange={(event) => setEditingTheme(event.target.value)}>
                  <option value="">Tema</option>
                  {temasDisponiveis.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {labelTemaSkin(theme)}
                    </option>
                  ))}
                </select>

                <button onClick={() => handleUpdateTheme(skin.id)}>Salvar</button>
                <button onClick={() => setEditingSkinId(null)}>Cancelar</button>
              </>
            ) : (
              <>
                {permitirTemasSkinSecundarios ? (
                  <span> - {labelSkinAtual(skin.theme)}</span>
                ) : null}
                {permitirTemasSkinSecundarios && (
                  <button
                    onClick={() => {
                      setEditingSkinId(skin.id);
                      setEditingTheme(
                        resolverTemaSkinEfetivo(
                          skin.theme,
                          configSistema.temaPadraoSistema,
                          permitirTemasSkinSecundarios
                        )
                      );
                    }}
                  >
                    Alterar tema
                  </button>
                )}
                <button onClick={() => handleDeleteSkin(skin)} style={{ color: "red" }}>
                  Excluir
                </button>
              </>
            )}

            {cabecalhoProjetoHabilitado ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: "0 0 6px 0", opacity: 0.85 }}>
                  CardProfile do cabecalho
                </p>
                {skin.cardProfileUrl ? (
                  <img
                    src={skin.cardProfileUrl}
                    alt={`CardProfile de ${skin.username}`}
                    style={{
                      display: "block",
                      width: 120,
                      maxWidth: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      marginBottom: 8,
                    }}
                  />
                ) : (
                  <p style={{ margin: "0 0 8px 0", opacity: 0.7 }}>
                    Nenhuma imagem carregada.
                  </p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setCardProfileArquivos((prev) => ({
                      ...prev,
                      [skin.id]: event.target.files?.[0] || null,
                    }))
                  }
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleUploadCardProfile(skin)}
                    disabled={!cardProfileArquivos[skin.id] || skinUploadAtivaId === skin.id}
                  >
                    {skinUploadAtivaId === skin.id
                      ? "Salvando imagem..."
                      : "Salvar cardProfile"}
                  </button>
                  {skin.cardProfileUrl ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveCardProfile(skin)}
                      disabled={skinRemocaoAtivaId === skin.id}
                    >
                      {skinRemocaoAtivaId === skin.id
                        ? "Removendo imagem..."
                        : "Remover cardProfile"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SkinsManager;
