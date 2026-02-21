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

import { useAuth } from "../../../hooks/auth/useAuth";
import { db } from "../../Banco/init-firebase";
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
      <h2>Gerenciar {nomeSkinPlural}</h2>

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
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SkinsManager;
