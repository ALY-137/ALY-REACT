import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  arrayRemove,
  deleteDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

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
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";

function nomeArquivoSeguro(nome = "avatar.png") {
  return String(nome || "avatar.png")
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

  const [feedback, setFeedback] = useState("");
  const [avatarUploadSkinId, setAvatarUploadSkinId] = useState("");
  const [avatarUploadMensagem, setAvatarUploadMensagem] = useState("");

  const iconSkinPadraoUrl = String(
    configSistema?.iconSkinPadraoUrl || DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || ""
  ).trim();

  const getSkinsCollectionRefs = () =>
    getProjectCollectionCandidates(db, "users", user?.uid || "", "skins");
  const getSkinDocRefs = (skinId = "") =>
    getProjectDocCandidates(db, "users", user?.uid || "", "skins", skinId);
  const getPaginasCollectionRefs = () =>
    getProjectCollectionCandidates(db, "users", user?.uid || "", "paginas");

  const subirAvatarSkin = async (skin, arquivo) => {
    const skinId = String(skin?.id || "").trim();
    if (!skinId || !user?.uid || !arquivo) return;

    if (!arquivo.type?.startsWith("image/")) {
      setAvatarUploadMensagem("Selecione um arquivo de imagem valido para avatar.");
      return;
    }
    if (arquivo.size > 3 * 1024 * 1024) {
      setAvatarUploadMensagem("Avatar muito grande. Use ate 3MB.");
      return;
    }

    setAvatarUploadSkinId(skinId);
    setAvatarUploadMensagem("");
    try {
      const nome = `${Date.now()}-${nomeArquivoSeguro(arquivo.name)}`;
      const path = `users/${user.uid}/skins/${skinId}/avatar/${nome}`;
      let url = "";

      if (usandoBucketCompartilhadoCrossProject()) {
        const upload = await uploadArquivoNoBucketCompartilhado({
          user,
          path,
          file: arquivo,
        });
        url = String(upload?.url || "").trim();
      } else {
        const avatarRef = ref(storage, path);
        await uploadBytes(avatarRef, arquivo);
        url = await getDownloadURL(avatarRef);
      }

      for (const skinRef of getSkinDocRefs(skinId)) {
        await setDoc(
          skinRef,
          {
            iconSkin: url || iconSkinPadraoUrl || null,
            iconSkinPath: path,
          },
          { merge: true }
        );
      }

      setAvatarUploadMensagem("Avatar atualizado com sucesso.");
      await fetchSkins();
    } catch (error) {
      setAvatarUploadMensagem(
        String(error?.message || "Falha ao atualizar avatar desta skin.")
      );
    } finally {
      setAvatarUploadSkinId("");
    }
  };

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
      const snapshots = await Promise.all(getSkinsCollectionRefs().map((refItem) => getDocs(refItem)));
      const dedupe = new Map();
      snapshots.forEach((snap) => {
        snap.docs.forEach((docItem) => {
          if (!dedupe.has(docItem.id)) {
            dedupe.set(docItem.id, {
              id: docItem.id,
              ...docItem.data(),
            });
          }
        });
      });
      setSkins(Array.from(dedupe.values()));
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
  const tipoExperienciaProjeto = String(configSistema?.tipoExperiencia || "")
    .trim()
    .toLowerCase();
  const projetoOneOwner = tipoExperienciaProjeto === "oneowner";

  const { singular, plural } = obterRotulosSkin(configSistema);
  const nomeSkinSingular = singular || "skin";
  const nomeSkinPlural = plural || "skins";
  const usarTituloSingular = projetoOneOwner;
  const nomeSkinGestao = usarTituloSingular ? nomeSkinSingular : nomeSkinPlural;
  const permitirTemasSkinSecundarios =
    configSistema.permitirTemasSkinSecundarios !== false;
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
    if (projetoOneOwner) {
      setFeedback(
        `Em projetos oneowner, a ${nomeSkinSingular} e criada automaticamente no primeiro login.`
      );
      return;
    }
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

    const resultado = await verificarESalvarskins(user.uid, username, temaCriacao, {
      iconSkinPadraoUrl,
    });
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
    if (projetoOneOwner) {
      setFeedback(
        `Em projetos oneowner, a ${nomeSkinSingular} e criada automaticamente no primeiro login.`
      );
      return;
    }
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

    const resultado = await verificarESalvarskins(user.uid, newUsername, temaCriacao, {
      iconSkinPadraoUrl,
    });

    if (!resultado.sucesso) {
      setFeedback(resultado.mensagem || `Nao foi possivel criar ${nomeSkinSingular}.`);
      return;
    }

    setFeedback("");
    setNewUsername("");
    setNewTheme("");
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

    for (const skinRef of getSkinDocRefs(skinId)) {
      await setDoc(
        skinRef,
        {
          theme: temaAtualizado,
        },
        { merge: true }
      );
    }

    setEditingSkinId(null);
    setEditingTheme("");
    fetchSkins();
  };

  const handleDeleteSkin = async (skin) => {
    if (projetoOneOwner) {
      setFeedback(
        `Em projetos oneowner, a ${nomeSkinSingular} automatica nao pode ser excluida.`
      );
      return;
    }
    if (!window.confirm(`Excluir "${skin.username}"?`)) return;

    const paginasRefs = getPaginasCollectionRefs();
    for (const paginasRef of paginasRefs) {
      const paginasSnap = await getDocs(paginasRef);
      for (const pagina of paginasSnap.docs) {
        await updateDoc(pagina.ref, {
          skins_relacionadas: arrayRemove(skin.id),
        });
      }
    }

    for (const skinRef of getSkinDocRefs(skin.id)) {
      try {
        await deleteDoc(skinRef);
      } catch (errorDelete) {
        if (errorDelete?.code !== "not-found") {
          throw errorDelete;
        }
      }
    }

    fetchSkins();
  };

  const textoLimite = useMemo(() => {
    if (isAdmin) {
      return "";
    }
    if (configSistema.limiteSkinsPorUsuario === "1") {
      return "";
    }
    return `Limite atual: ${nomeSkinPlural} ilimitadas por usuario.`;
  }, [configSistema.limiteSkinsPorUsuario, isAdmin, nomeSkinPlural, nomeSkinSingular]);

  if (loading || isLoading || carregandoConfig) return <p>Carregando...</p>;

  if (skins.length === 0) {
    if (projetoOneOwner) {
      return (
        <div className="theme-picker">
          <h2>Gerenciar {nomeSkinGestao}</h2>
          <p>
            {`Em projetos oneowner, a ${nomeSkinSingular} e criada automaticamente no primeiro login.`}
          </p>
          <button type="button" onClick={fetchSkins}>
            Atualizar lista
          </button>
          {!!feedback && <p style={{ color: "red" }}>{feedback}</p>}
        </div>
      );
    }

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

      {!projetoOneOwner && exibirSecaoCriacao ? (
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {String(skin.iconSkin || iconSkinPadraoUrl || "").trim() ? (
                <img
                  src={String(skin.iconSkin || iconSkinPadraoUrl || "").trim()}
                  alt={`Avatar da ${nomeSkinSingular} ${skin.username}`}
                  style={{
                    width: 34,
                    height: 34,
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "1px solid rgba(0,0,0,0.2)",
                  }}
                />
              ) : null}
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <span style={{ opacity: 0.9 }}>Trocar avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const arquivo = event.target.files?.[0];
                    if (!arquivo) return;
                    void subirAvatarSkin(skin, arquivo);
                    event.target.value = "";
                  }}
                  disabled={avatarUploadSkinId === skin.id}
                />
              </label>
              {String(skin.iconSkin || "").trim() ? (
                <button
                  type="button"
                  onClick={async () => {
                    for (const skinRef of getSkinDocRefs(skin.id)) {
                      await setDoc(
                        skinRef,
                        {
                          iconSkin: iconSkinPadraoUrl || null,
                          iconSkinPath: null,
                        },
                        { merge: true }
                      );
                    }
                    await fetchSkins();
                  }}
                  disabled={avatarUploadSkinId === skin.id}
                >
                  Usar avatar padrao
                </button>
              ) : null}
            </div>
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
                {!projetoOneOwner ? (
                  <button onClick={() => handleDeleteSkin(skin)} style={{ color: "red" }}>
                    Excluir
                  </button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      {!!avatarUploadMensagem ? (
        <p style={{ marginTop: 8, opacity: 0.9 }}>{avatarUploadMensagem}</p>
      ) : null}
    </div>
  );
};

export default SkinsManager;

