import React, { useState, useEffect, Suspense } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import { db } from "../../Banco/init-firebase";
import LoginButton from "../Geral/LoginButton";

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

function Estrutura({ username: propUsername, skins: propSkins }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [LayoutScript, setLayoutScript] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [skins, setSkins] = useState(propSkins || []);
  const [username, setUsername] = useState(propUsername || "");
  const [paginas, setPages] = useState([]); 
  
  const idGoogleCap = localStorage.getItem('idGoogleCap');
  const pathname = location.pathname;
  const urlUsername = pathname.split('/')[1];
  let skinLocal = null;

  useEffect(() => {
    if (urlUsername) {
      console.log(`URL username: ${urlUsername}`);
      localStorage.setItem('skinLocal', urlUsername);
      fetchSkins(urlUsername);
    } else {
      skinLocal = localStorage.getItem('skinLocal');
      fetchSkins(skinLocal);
    }
  }, [urlUsername]);

  const fetchSkins = async (username) => {
    try {
      console.log(`Buscando skins para o usuário: ${username}`);
      const usersSnapshot = await db.collection('users').get();
      let skinsList = [];
      let pagesList = [];

      for (const userDoc of usersSnapshot.docs) {
        const skinsSnapshot = await userDoc.ref.collection('skins').where('username', '==', username).get();
        skinsList = [...skinsList, ...skinsSnapshot.docs.map((doc) => doc.data())];

        for (const skinDoc of skinsSnapshot.docs) {
          const pagesSnapshot = await skinDoc.ref.collection('paginas').get();
          for (const pageDoc of pagesSnapshot.docs) {
            pagesList.push({
              nome: pageDoc.data().nome,
              is_main: pageDoc.data().is_main 
            });
          }
        }
      }
      
      console.log(`Skins encontradas: ${JSON.stringify(skinsList)}`);
      console.log(`Páginas encontradas: ${JSON.stringify(pagesList)}`);
      setSkins(skinsList);
      setPages(pagesList);
      setUsername(username);

      // Navegar para a página principal após carregar as páginas
      navigateMainPage(pagesList);

    } catch (error) {
      console.error('Erro ao buscar skins:', error);
    }
  };

  const getMainPage = (paginas) => {
    console.log("Chamando getMainPage com pages:", paginas);
    return 
  };

  const navigateMainPage = (paginas) => {
    const mainPage = paginas.find((paginas) => paginas.is_main === true);

    console.log(mainPage);
    skinLocal = localStorage.getItem('skinLocal');
    if (mainPage && skinLocal) {
      console.log("Navegando para:", `/${skinLocal}/${mainPage.nome}`);
      navigate(`/${skinLocal}/${mainPage.nome}`);
    } else {
      console.log("Erro! Página principal não encontrada ou skinLocal não definido.");
    }
  };

  useEffect(() => {
    if (!Array.isArray(skins) || skins.length === 0 || !username) {
      return;
    }

    const timeoutId = setTimeout(() => {
      defineTheme(username, skins, setLayoutScript);
    }, 1);

    return () => clearTimeout(timeoutId);
  }, [skins, username]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    navigate(menuOpen ? "/home" : `/menu/${idGoogleCap}`);
  };

  return (
    <div id="fundo">
      <div id="estrutura">
      {!idGoogleCap ? (
        <div id="navbar-menu" style={{ textAlign: "center", display: menuOpen ? 'none' : 'block' }}>
          <LoginButton />
        </div>
      ) : (
        <div id="navbar-menu" style={{ textAlign: "center", display: menuOpen ? 'none' : 'block' }}>
          <p onClick={toggleMenu} style={{ cursor: "pointer", display: menuOpen ? 'none' : 'block' }}>
            ㆔
          </p>
        </div>
      )}
        <div id="cardProfile" style={{ display: menuOpen ? 'none' : 'block' }}>
          <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
          <div id="MatrixDesign"></div>
          <div id="MatrixDev"></div>
          <div id="MatrixHome"></div>
        </div>
        <div style={{ display: menuOpen ? 'none' : 'block' }}>
          <Navbar />
        </div>
        <div id="conteudo">
          <Suspense fallback={<div>Carregando...</div>}>
            <Outlet />
          </Suspense>
        </div>
        {LayoutScript && (
          <div className="layout-container">
            <LayoutScript />
          </div>
        )}
      </div>
    </div>
  );
}

export default Estrutura;
