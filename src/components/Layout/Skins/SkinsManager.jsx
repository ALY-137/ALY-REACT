import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { verificarESalvarskins } from "./verificaSkins";
import { buscarSkinLogada } from "./buscarSkinLogada";

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";

import { db } from "../../Banco/init-firebase";
import { THEMES } from "../Temas/themesRegistry";
import { useAuth } from "../../../hooks/auth/useAuth";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../Sistema/configSistema";

const SkinsManager = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [skins, setSkins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // criação
  const [newUsername, setNewUsername] = useState("");
  const [newTheme, setNewTheme] = useState("");

  // edição
  const [editingSkinId, setEditingSkinId] = useState(null);
  const [editingTheme, setEditingTheme] = useState("");

  // ─────────────────────────────
  // BUSCAR SKINS
  // ─────────────────────────────
  useEffect(() => {
    if (loading || !user?.uid) return;
    fetchSkins();
  }, [loading, user?.uid]);

  const fetchSkins = async () => {
    setIsLoading(true);
    try {
      await user.getIdToken();
      const snap = await getDocs(
        collection(db, "users", user.uid, "skins")
      );

      setSkins(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    } catch (e) {
      console.error("Erro ao buscar skins:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────
  // PRIMEIRO ACESSO
  // ─────────────────────────────
  const handleCreateFirstSkin = async (themeId) => {
    if (!user?.uid) return;
    await user.getIdToken();
    const username = `skin${Math.floor(Math.random() * 10000)}`;

  
    await verificarESalvarskins(user.uid, username, themeId);

    localStorage.setItem("targetUsername", username);
    localStorage.setItem("skinLogadoUser", username);
    localStorage.setItem("skinLogado", "true");

    navigate(`/${username}/home`);
  };

// ─────────────────────────────
// CRIAR NOVA SKIN
// ─────────────────────────────
const [feedback, setFeedback] = useState(""); // estado para mensagens ao usuário

const [temaSistemaAtual, setTemaSistemaAtual] = useState(
  DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
);

useEffect(() => {
  let ativo = true;

  const carregarTemaSistema = async () => {
    try {
      const configSistema = await obterConfigSistema();
      if (!ativo) return;
      setTemaSistemaAtual(configSistema.temaPadraoSistema);
    } catch (error) {
      // Mantem fallback local quando a config global ainda nao existir.
    }
  };

  carregarTemaSistema();

  return () => {
    ativo = false;
  };
}, []);

const labelTemaSkin = (theme) => {
  const ehExtensao =
    Array.isArray(theme.extendsSystem) &&
    theme.extendsSystem.includes(temaSistemaAtual);

  if (!ehExtensao) {
    return theme.label || theme.id;
  }

  return `${theme.label || theme.id} (extensao do sistema)`;
};

const handleCreateSkin = async () => {
  if (!newUsername || !newTheme) {
    setFeedback("Preencha o nome da skin e selecione um tema.");
    return;
  }
  if (!user?.uid) {
    setFeedback("Usuário não autenticado.");
    return;
  }

  await user.getIdToken();

  // 🔹 Chama a função de verificação/criação
  const resultado = await verificarESalvarskins(user.uid, newUsername, newTheme);

  if (!resultado.sucesso) {
    // 🔹 Se username já existe ou deu erro
    setFeedback(resultado.mensagem || "Não foi possível criar a skin.");
    return;
  }

  // 🔹 Sucesso
  setFeedback("");
  setNewUsername("");
  setNewTheme("");
  fetchSkins();
};


  // ─────────────────────────────
  // TROCAR SKIN
  // ─────────────────────────────
  const handleSelectSkin = async (username) => {
    localStorage.setItem("targetUsername", username);
    localStorage.setItem("skinLogadoUser", username);
    localStorage.setItem("skinLogado", "true");

    await buscarSkinLogada();
    navigate(`/${username}/home`);
  };

  // ─────────────────────────────
  // ALTERAR TEMA
  // ─────────────────────────────
  const handleUpdateTheme = async (skinId) => {
    if (!editingTheme) return;

    await updateDoc(
      doc(db, "users", user.uid, "skins", skinId),
      { theme: editingTheme }
    );

    setEditingSkinId(null);
    setEditingTheme("");
    fetchSkins();
  };

  // ─────────────────────────────
  // EXCLUIR SKIN
  // ─────────────────────────────
  const handleDeleteSkin = async (skin) => {
    if (!window.confirm(`Excluir "${skin.username}"?`)) return;

    const paginasSnap = await getDocs(
      collection(db, "users", user.uid, "paginas")
    );

    for (const pagina of paginasSnap.docs) {
      await updateDoc(pagina.ref, {
        skins_relacionadas: arrayRemove(skin.id),
      });
    }

    await deleteDoc(
      doc(db, "users", user.uid, "skins", skin.id)
    );

    fetchSkins();
  };

  // ─────────────────────────────
  // RENDER
  // ─────────────────────────────
  if (loading || isLoading) return <p>Carregando...</p>;

  // 🆕 PRIMEIRO ACESSO
  if (skins.length === 0) {
    return (
      <div className="theme-picker">
        <h2>Escolha seu tema</h2>

        <div className="themes-grid">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleCreateFirstSkin(theme.id)}
            >
              {labelTemaSkin(theme)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="skins-manager">
      <h2>Gerenciar skins</h2>

   <div className="create-skin">
  <h3>Criar nova skin</h3>

  <input
    placeholder="Nome da skin"
    value={newUsername.toLowerCase()}
    onChange={e => setNewUsername(e.target.value)}
  />

  <select
    value={newTheme}
    onChange={e => setNewTheme(e.target.value)}
  >
    <option value="">Escolha o tema</option>
    {THEMES.map(t => (
      <option key={t.id} value={t.id}>
        {labelTemaSkin(t)}
      </option>
    ))}
  </select>

  <button onClick={handleCreateSkin}>Criar</button>

  {/* 🔹 Feedback para o usuário */}
  {feedback && <p style={{ color: "red" }}>{feedback}</p>}
</div>

      {/* ───── LISTA ───── */}
      <ul className="skins-list">
        {skins.map(skin => (
          <li key={skin.id}>
            <strong
              onClick={() => handleSelectSkin(skin.username)}
              style={{ cursor: "pointer" }}
            >
              {skin.username}
            </strong>

            {editingSkinId === skin.id ? (
              <>
                <select
                  value={editingTheme}
                  onChange={e => setEditingTheme(e.target.value)}
                >
                  <option value="">Tema</option>
                  {THEMES.map(t => (
                    <option key={t.id} value={t.id}>
                      {labelTemaSkin(t)}
                    </option>
                  ))}
                </select>

                <button onClick={() => handleUpdateTheme(skin.id)}>
                  Salvar
                </button>
                <button onClick={() => setEditingSkinId(null)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span> — {skin.theme}</span>
                <button
                  onClick={() => {
                    setEditingSkinId(skin.id);
                    setEditingTheme(skin.theme);
                  }}
                >
                  Alterar tema
                </button>
                <button
                  onClick={() => handleDeleteSkin(skin)}
                  style={{ color: "red" }}
                >
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
