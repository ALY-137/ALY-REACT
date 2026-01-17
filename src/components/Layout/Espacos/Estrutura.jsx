import React, { useState, useEffect, Suspense } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import LoginButton from "../Geral/LoginButton";
import CriadorBloco from "../Blocos/CriadorBloco";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";

import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import { getEspacosDaSkin } from "../../Banco/firebaseEspacos";

import {
  collection,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../Banco/init-firebase";

// Função para aplicar o tema
export const defineTheme = async (username, skins, setLayoutScript) => {
  const selectedSkinItem = skins.find((skin) => skin.username === username);
  if (!selectedSkinItem) {
    console.error("Skin ou tema não encontrados.");
    return;
  }

  const { theme } = selectedSkinItem;
  console.log(`Tema encontrado: ${theme}`);

  try {
    const module = await import(`../Temas/${theme}/layout.js`);
    setLayoutScript(() => module.default);
    console.log(`Tema "${theme}" aplicado com sucesso.`);
  } catch (error) {
    console.error(`Erro ao carregar o layout para o tema "${theme}":`, error);
  }
};

// Componente principal
function Estrutura({ username: propUsername, skins: propSkins }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [LayoutScript, setLayoutScript] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [skins, setSkins] = useState(propSkins || []);
  const [username, setUsername] = useState(propUsername || "");
  const [espacos, setPages] = useState([]);
  const [userLocalId, setUserLocalId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [blocos, setBlocos] = useState([]);

  const idGoogleCap = localStorage.getItem("idGoogleCap");
  const pathname = location.pathname;
  const urlUsername = pathname.split("/")[1];
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");

  // --------------------------
  // Carrega a skin e páginas
  // --------------------------
  useEffect(() => {
    if (urlUsername) {
      localStorage.setItem("skinLocal", urlUsername);
      fetchSkins(urlUsername);
    } else if (skinLogadoUser) {
      fetchSkins(skinLogadoUser);
      localStorage.setItem("skinLocal", skinLogadoUser);
    } else {
      navigate("/");
    }
  }, [urlUsername]);

  // --------------------------
  // Função para adicionar bloco
  // --------------------------
  function adicionarBloco(bloco) {
    setBlocos((prev) => [...prev, bloco]);
    console.log("Bloco criado:", bloco);
  }

  // --------------------------
  // Função para buscar skins + páginas
  // --------------------------
  const fetchSkins = async (username) => {
    setIsLoading(true);

    try {
      // 1. Encontrar usuário baseado na username da skin
      const usersCol = collection(db, "users");
      const usersSnapshot = await getDocs(usersCol);

      let userId = null;
      let skinId = null;

      for (const userDoc of usersSnapshot.docs) {
        const skinsCol = collection(db, "users", userDoc.id, "skins");
        const q = query(skinsCol, where("username", "==", username));
        const skinsSnap = await getDocs(q);

        if (!skinsSnap.empty) {
          userId = userDoc.id;
          skinId = skinsSnap.docs[0].id;
          break;
        }
      }

      if (!userId || !skinId) {
        alert("Nenhum usuário ou skin encontrada para esse username.");
        navigate("/");
        return;
      }

      localStorage.setItem("userLocalId", userId);
      localStorage.setItem("skinIdAtual", skinId);
      setUserLocalId(userId);

      // 2. Buscar todas as skins do usuário
      const skinsCol = collection(db, "users", userId, "skins");
      const skinsSnap = await getDocs(skinsCol);
      const skinsList = skinsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 3. Buscar somente as páginas relacionadas a essa skin
      const pagesList = await getEspacosDaSkin({ userId, skinId });
      setPages(Array.isArray(pagesList) ? pagesList : []);

      // 4. Atualizar estados
      setSkins(skinsList);
      setUsername(username);

      console.log("pagesList recebido:", pagesList);
    } catch (error) {
      console.error("Erro ao buscar skins e páginas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------
  // Navega para a página principal da skin
  // --------------------------
  useEffect(() => {
    if (!espacos.length || !username) return;

    const mainPage = espacos.find((p) => p.is_main === true);
    if (!mainPage) {
      console.warn("Nenhuma home encontrada");
      return;
    }

    navigate(`/${username}/${mainPage.nome}`, { replace: true });
  }, [espacos, username]);

  // --------------------------
  // Aplica tema
  // --------------------------
  useEffect(() => {
    if (!username || !skins.length) return;
    defineTheme(username, skins, setLayoutScript);
  }, [username, skins]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    navigate(menuOpen ? "/home" : `/menu/${skinLogadoUser}`);
  };

  return (
    <div id="fundo">
      <div id="estrutura">
        {isLoading ? (
          <div>Carregando dados...</div>
        ) : (
          <>
            {!idGoogleCap ? (
              <div id="navbar-menu" style={{ textAlign: "center", display: menuOpen ? "none" : "block" }}>
                <LoginButton />
              </div>
            ) : (
              <div id="navbar-menu" style={{ textAlign: "center", display: menuOpen ? "none" : "block" }}>
                <p onClick={toggleMenu} style={{ cursor: "pointer", display: menuOpen ? "none" : "block" }}>
                  ㆔
                </p>
              </div>
            )}

            <div id="cardProfile" style={{ display: menuOpen ? "none" : "block" }}>
              <Navegacoes />
              <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
              <div id="MatrixDesign"></div>
              <div id="MatrixDev"></div>
              <div id="MatrixHome"></div>
            </div>

            <div style={{ display: menuOpen ? "none" : "block" }}>
              <Navbar pages={espacos} />
            </div>

            <div id="conteudo">
              <CriadorBloco onCreate={adicionarBloco} />
              <Suspense fallback={<div>Carregando...</div>}>
                <Outlet />
              </Suspense>
            </div>

            {LayoutScript && (
              <div className="layout-container">
                <LayoutScript />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Estrutura;
