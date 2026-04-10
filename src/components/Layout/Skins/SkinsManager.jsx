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
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  obterConfigSistema,
  obterRotulosSkin,
  usuarioCorrespondeOwnerConfigurado,
} from "../Sistema/configSistema";
import ProjectLoadingFallback from "../Geral/ProjectLoadingFallback";
import {
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import Cardcaptor from "../../Funcionalidades/Cardcaptor/Cardcaptor";
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
  const [cardcaptorSkin, setCardcaptorSkin] = useState(null);

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
  const cardcaptorHabilitado = configSistema?.cardcaptorHabilitado === true;
  const ownerUidProjeto = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const ownerEmailProjeto = String(obterOwnerEmailConfigurado(configSistema) || "")
    .trim()
    .toLowerCase();
  const usuarioEhOwnerProjeto = Boolean(
    user?.uid &&
      (
        usuarioCorrespondeOwnerConfigurado(configSistema, {
          uid: user.uid,
          email: user?.email,
        }) ||
        (!ownerUidProjeto && !ownerEmailProjeto && isAdmin)
      )
  );
  const podeUsarCardcaptor = cardcaptorHabilitado && (!projetoOneOwner || usuarioEhOwnerProjeto);

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

  if (loading || isLoading || carregandoConfig) {
    return <ProjectLoadingFallback text="Carregando..." />;
  }

  if (skins.length === 0) {
    if (projetoOneOwner) {
      return (
        <div className="theme-picker menu-panel-stack">
          <h2 className="menu-panel-main-title">Gerenciar {nomeSkinGestao}</h2>
          <div className="menu-panel-block">
            <p className="menu-panel-note">
              {`Em projetos oneowner, a ${nomeSkinSingular} e criada automaticamente no primeiro login.`}
            </p>
            <div className="menu-panel-actions">
              <button type="button" onClick={fetchSkins}>
                Atualizar lista
              </button>
            </div>
            {!!feedback && <p className="menu-panel-message menu-panel-message--error">{feedback}</p>}
          </div>
        </div>
      );
    }

    return (
      <div className="theme-picker menu-panel-stack">
        {permitirTemasSkinSecundarios ? (
          <div className="menu-panel-block">
            <h2 className="menu-panel-main-title">{`Escolha o tema da sua ${nomeSkinSingular}`}</h2>
            <div className="themes-grid menu-panel-actions">
              {temasDisponiveis.map((theme) => (
                <button key={theme.id} onClick={() => handleCreateFirstSkin(theme.id)}>
                  {labelTemaSkin(theme)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="menu-panel-block">
            <h2 className="menu-panel-main-title">{`Criar sua primeira ${nomeSkinSingular}`}</h2>
            <p className="menu-panel-note">Este projeto usa somente o tema padrao de skin.</p>
            <div className="menu-panel-actions">
              <button onClick={() => handleCreateFirstSkin(temaSkinPadraoId)}>
                Criar com tema padrao
              </button>
            </div>
          </div>
        )}

        {!!feedback && <p className="menu-panel-message menu-panel-message--error">{feedback}</p>}
      </div>
    );
  }

  return (
    <div className="skins-manager menu-panel-stack">
      <h2 className="menu-panel-main-title">Gerenciar {nomeSkinGestao}</h2>

      {!projetoOneOwner && exibirSecaoCriacao ? (
        <div className="create-skin menu-panel-block">
          <h3 className="menu-panel-title">{`Criar nova ${nomeSkinSingular}`}</h3>

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

          {textoLimite ? <p className="menu-panel-note">{textoLimite}</p> : null}
          {!!feedback && <p className="menu-panel-message menu-panel-message--error">{feedback}</p>}
        </div>
      ) : (
        textoLimite ? <p className="menu-panel-note">{textoLimite}</p> : null
      )}

      <ul className="skins-list">
        {skins.map((skin) => (
          <li key={skin.id} className="skin-item">
            <div className="skin-item__avatar-row">
              {String(skin.iconSkin || iconSkinPadraoUrl || "").trim() ? (
                <img
                  src={String(skin.iconSkin || iconSkinPadraoUrl || "").trim()}
                  alt={`Avatar da ${nomeSkinSingular} ${skin.username}`}
                  className="skin-item__avatar"
                />
              ) : null}
              <label className="skin-item__upload">
                <span>Trocar avatar</span>
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
              className="skin-item__name"
            >
              {skin.username}
            </strong>

            {editingSkinId === skin.id && permitirTemasSkinSecundarios ? (
              <div className="skin-item__actions">
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
              </div>
            ) : (
              <div className="skin-item__actions">
                {permitirTemasSkinSecundarios ? (
                  <span className="skin-item__theme">{labelSkinAtual(skin.theme)}</span>
                ) : null}
                {podeUsarCardcaptor && String(skin.username || "").trim() ? (
                  <button type="button" onClick={() => setCardcaptorSkin(skin)}>
                    Cardcaptor
                  </button>
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
                  <button onClick={() => handleDeleteSkin(skin)} className="skin-item__danger">
                    Excluir
                  </button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!!avatarUploadMensagem ? (
        <p className="menu-panel-message">{avatarUploadMensagem}</p>
      ) : null}
      <Cardcaptor
        aberto={!!cardcaptorSkin && podeUsarCardcaptor}
        onClose={() => setCardcaptorSkin(null)}
        skin={cardcaptorSkin}
        configSistema={configSistema}
      />
    </div>
  );
};

export default SkinsManager;

