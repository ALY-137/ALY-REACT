import React, { useState, useEffect, Suspense ,useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import { db } from "../../Banco/init-firebase";
import LoginButton from "../Geral/LoginButton";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";

// Função para definir o tema
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
  const [paginas, setPages] = useState([]); // Passa as páginas para o componente Navbar
  const [userLocalId, setUserLocalId] = useState(null); // Estado para armazenar o ID do usuário
  const [isLoading, setIsLoading] = useState(false); // Gerenciar estado de carregamento


  const idGoogleCap = localStorage.getItem('idGoogleCap'); // USUÁRIO LOGADO
  const pathname = location.pathname;
  const urlUsername = pathname.split('/')[1];
  let skinLocal = null;

  const skinLogadoUser = localStorage.getItem('skinLogadoUser');

  const [fechskinRep, setFechskinRep] = useState(false);

  useEffect(() => {
    if (urlUsername ==='savannaoliveira' && seforAdm(idGoogleCap)) {
      
      console.log(`URL username: ${urlUsername}`);
      localStorage.setItem('skinLocal', urlUsername);
      fetchSkins(urlUsername);

    } else {
localStorage.setItem('skinLocal','savannaoliveira');
      fetchSkins('savannaoliveira');
       
      
    }
  }, [urlUsername]);

  const fetchSkins = async (username) => {
    setIsLoading(true); // Inicia o carregamento
    try {
  
      const usersSnapshot = await db.collection('users').get();

      if (usersSnapshot.empty) {
        console.error('Nenhum usuário encontrado.');
        alert('Usuário não encontrado. Verifique o username e tente novamente.');
        return;
      }

      let localId = null;
      let skinsList = [];
      let pagesList = [];

      // Iterar sobre todos os documentos da coleção `users`
      for (const userDoc of usersSnapshot.docs) {
        const skinsSnapshot = await userDoc.ref.collection('skins').where('username', '==', username).get();

        if (!skinsSnapshot.empty) {
          localId = userDoc.id; // ID do usuário associado às skins encontradas
   
          localStorage.setItem('userLocalId',localId);
          setUserLocalId(localId); // Atualiza o estado do ID do usuário

          // Obter as skins e suas páginas
          skinsList = skinsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          for (const skinDoc of skinsSnapshot.docs) {
            const pagesSnapshot = await skinDoc.ref.collection('paginas').get();
            pagesList.push(
              ...pagesSnapshot.docs.map((pageDoc) => ({
                nome: pageDoc.data().nome,
                is_main: pageDoc.data().is_main,
              }))
            );
          }
          break; // Parar a iteração após encontrar o usuário e suas skins
        }
      }

      if (!localId) {
        console.error('Nenhuma skin ou usuário correspondente encontrado.');
        alert('Nenhuma skin ou usuário correspondente foi encontrado.');
        return;
      }


      setSkins(skinsList);
      setPages(pagesList);
      setUsername(username);

  



    } catch (error) {
      console.error('Erro ao buscar skins:', error);
    } finally {
      setIsLoading(false); // Finaliza o carregamento
    }
  };

const hasNavigatedRef = useRef(false);

const navigateMainPage = (paginas) => {
  const mainPage = paginas.find((pagina) => pagina.is_main === true);
  skinLocal = localStorage.getItem('skinLocal');

  if (mainPage && skinLocal && !hasNavigatedRef.current) {
    hasNavigatedRef.current = true;
    navigate(`/${skinLocal}/${mainPage.nome}`);
       
  }
};


useEffect(() => {
  if (!Array.isArray(skins) || skins.length === 0 || !username || !hasNavigatedRef){
    return;
  }

  const timeoutId = setTimeout(async () => {
    await defineTheme(username, skins, setLayoutScript);
    console.log("Tema definido com sucesso.");

  
  }, 1);

  return () => clearTimeout(timeoutId);
}, [skins, username, hasNavigatedRef]);


useEffect(() => {
  if (paginas.length > 0 && !hasNavigatedRef.current) {
    navigateMainPage(paginas);
  }
}, [ paginas]);


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
          </>
        )}
      </div>
    </div>
  );
}

export default Estrutura;
