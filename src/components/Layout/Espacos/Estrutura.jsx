import React, { useState, useEffect, Suspense  } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth";
import { collection, collectionGroup, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "../../Banco/init-firebase";

import Layout from "../Temas/Layout.jsx";
import { resolverTemaSkinEfetivo } from "../Temas/themesRegistry";
import { DEFAULT_SISTEMA_CONFIG, obterConfigSistema } from "../Sistema/configSistema";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import Navbar from "../Navbar/Navbar";
import LoginButton from "../Geral/LoginButton";
import { getEspacosDaSkin } from "./firebaseEspacos";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";

function Estrutura({ username: propUsername, skins: propSkins }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [username, setUsername] = useState(propUsername || "");
  const [skins, setSkins] = useState(propSkins || []);
  const [theme, setTheme] = useState(false);
  const [espacos, setEspacos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  const urlUsername = location.pathname.split("/")[1];
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");
  const skinIdAtual = localStorage.getItem("skinIdAtual") || null;


  // --------------------------
  // Buscar skin e páginas
  // --------------------------
  useEffect(() => {
    if (loading) return;

    const targetUsername = urlUsername || localStorage.getItem("targetUsername");

    localStorage.setItem("targetUsername", targetUsername);

    const fetchSkinData = async () => {
      setIsLoading(true);
      try {
        let configSistemaAtual = DEFAULT_SISTEMA_CONFIG;
        try {
          configSistemaAtual = await obterConfigSistema();
        } catch {
          configSistemaAtual = DEFAULT_SISTEMA_CONFIG;
        }

        if (user?.uid) {
          await user.getIdToken();
        }
        // 1) Quando logado, tenta primeiro no caminho do próprio usuário.
        let skinsSnap = { empty: true, docs: [] };
        if (user?.uid) {
          const ownerQuery = query(
            collection(db, "users", user.uid, "skins"),
            where("username", "==", targetUsername),
            limit(1)
          );
          skinsSnap = await getDocs(ownerQuery);
        }

        // 2) Se não encontrar no usuário logado, faz fallback para busca pública/global.
        if (skinsSnap.empty) {
          const publicQuery = query(
            collectionGroup(db, "skins"),
            where("username", "==", targetUsername),
            where("visibilidade", "==", "publico"),
            limit(1)
          );

          if (user?.uid) {
            const preferredQuery = query(
              collectionGroup(db, "skins"),
              where("username", "==", targetUsername),
              where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
              limit(1)
            );

            try {
              skinsSnap = await getDocs(preferredQuery);
            } catch (err) {
              if (err?.code !== "permission-denied") throw err;

              const compatQuery = query(
                collectionGroup(db, "skins"),
                where("username", "==", targetUsername),
                where("visibilidade", "in", ["publico", "publico_restritivo"]),
                limit(1)
              );
              skinsSnap = await getDocs(compatQuery);
            }
          } else {
            skinsSnap = await getDocs(publicQuery);
          }

          if (skinsSnap.empty) {
            const legacyVisibilityQuery = query(
              collectionGroup(db, "skins"),
              where("username", "==", targetUsername),
              where("visibilidade", "==", null),
              limit(1)
            );
            try {
              skinsSnap = await getDocs(legacyVisibilityQuery);
            } catch (err) {
              if (err?.code !== "permission-denied") throw err;
            }
          }
        }

if (skinsSnap.empty) {
  navigate("/Error");
  console.log(targetUsername);
  return;
}

const skinDoc = skinsSnap.docs[0];
const skinData = skinDoc.data();

// 🔐 REGRA DE VISIBILIDADE
const isOwner = user && user.uid === skinData.ownerUserId;
const isPublic =
  !skinData.visibilidade || skinData.visibilidade === "publico";
const isAuthPublic =
  (skinData.visibilidade === "publico_restritivo" ||
    skinData.visibilidade === "privado") &&
  !!user;

if (!isOwner && !isPublic && !isAuthPublic) {
  navigate("/Error"); // ou /acesso-negado
  return;
}


        const skinId = skinDoc.id;
        const temaEfetivo = resolverTemaSkinEfetivo(
          skinData.theme,
          configSistemaAtual.temaPadraoSistema,
          configSistemaAtual.permitirTemasSkinSecundarios !== false
        );

        setUsername(targetUsername);
        setSkins([skinData]);
        setTheme(temaEfetivo);

        let pagesList = [];
        try {
          pagesList = await getEspacosDaSkin({
            userId: skinData.ownerUserId,
            skinId,
            viewerUserId: user?.uid || null,
          });
        } catch (espacosErr) {
          if (espacosErr?.code !== "permission-denied") throw espacosErr;
          console.warn(
            "Permissao negada ao ler espacos da skin. Perfil sera exibido sem lista de espacos.",
            espacosErr?.message
          );
        }

        setEspacos(pagesList);

        if (user?.uid === skinData.ownerUserId) {
          localStorage.setItem("skinIdAtual", skinId);
          localStorage.setItem("skinLogadoUser", targetUsername);
          try {
            await setDoc(doc(db, "users", user.uid), {
              uid: user.uid,
              skinAtivaId: skinId,
            }, { merge: true });
          } catch (updateErr) {
            // Nao bloqueia renderizacao da skin caso falhe apenas a metadata do user.
            console.warn(
              "Falha ao atualizar skinAtivaId:",
              updateErr?.code,
              updateErr?.message
            );
          }
        }
      } catch (err) {
        console.error(
          "Erro ao buscar skin:",
          err?.code,
          err?.message,
          err
        );
        if (err?.code === "permission-denied") {
          console.warn(
            "Permissao negada ao ler skin. Confirme deploy das regras com: npm run firestore:rules:deploy"
          );
        }
        navigate("/Error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkinData();
  }, [urlUsername, loading, navigate, user]);

  // --------------------------
  // Navega para página principal
  // --------------------------
  useEffect(() => {
    if (!espacos.length || !username || hasNavigated) return;

    const mainPage = espacos.find(p => p.isHome === true);

    if (!mainPage) {
      console.warn("Página principal não encontrada!");
      navigate("/Error"); // redireciona para página de erro
      setHasNavigated(true);
      return;
    }

    navigate(`/${username}/${mainPage.nome}`, { replace: true });
    setHasNavigated(true);
  }, [espacos, username, hasNavigated, navigate, skinIdAtual]);

  // --------------------------
  // Permissão de criar blocos
  // --------------------------


  // --------------------------
  // Toggle menu
  // --------------------------
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    navigate(menuOpen ? "/home" : `/menu/${skinLogadoUser}`);
  };

// --------------------------
// JSX do profile
// --------------------------
const profileJSX = (
  <>
    <div id="navbar-menu" style={{ textAlign: "center" }}>
      {!user ? (
        <LoginButton />
      ) : (
        <p onClick={toggleMenu} style={{ cursor: "pointer" }}>㆔</p>
      )}
    </div>

    {/* 🔥 cardProfile EXISTE APENAS AQUI */}
    <div
      id="cardProfile"
      style={{ display: menuOpen ? "none" : "block" }}
    >
      <Navegacoes />
      <img
        src="/imagens/imgHome/busto.png"
        id="imgBustoHome"
        alt="imagem"
      />
    </div>
  </>
);

  

  // --------------------------
  // JSX do conteúdo
  // --------------------------
  const contentJSX = (
    <>
      <Navbar pages={espacos} username={username} />
       
      <Suspense fallback={<div>Carregando...</div>}>

        <Outlet  context={{    user,    skinIdAtual,    espacos  }}/>

      </Suspense>
    </>
  );

  // --------------------------
  // Loader
  // --------------------------
  if (loading || isLoading || !theme) return <div>Carregando...</div>;

  // --------------------------
  // Render
  // --------------------------
  return (
    <>
      <Layout
        theme={theme}
        profile={profileJSX}
        content={contentJSX}
      />
      <FirebaseProjectBadge />
    </>

   
  );
}

export default Estrutura;
