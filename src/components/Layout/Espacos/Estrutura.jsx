import React, { useState, useEffect, Suspense ,useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import { db } from "../../Banco/init-firebase";
import LoginButton from "../Geral/LoginButton";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";

import Navegacoes from "../../Scripts/navegacoes/Navegacoes";

import {getEspacosDaSkin} from "../../Banco/firebaseEspacos";

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
  const [espacos, setPages] = useState([]); // Passa as páginas para o componente Navbar
  const [userLocalId, setUserLocalId] = useState(null); // Estado para armazenar o ID do usuário
  const [isLoading, setIsLoading] = useState(false); // Gerenciar estado de carregamento

  

  const idGoogleCap = localStorage.getItem('idGoogleCap'); // USUÁRIO LOGADO
  const pathname = location.pathname;
  const urlUsername = pathname.split('/')[1];
const skinLocal = username;



  const skinLogadoUser = localStorage.getItem('skinLogadoUser');
  const skinIdAtual = localStorage.getItem("skinIdAtual");  

  const [fechskinRep, setFechskinRep] = useState(false);

useEffect(() => {
  if (urlUsername) { // verifica se urlUsername não é vazio, null ou undefined
    localStorage.setItem('skinLocal', urlUsername);
    fetchSkins(urlUsername);
  }else{

    if(skinLogadoUser){
      fetchSkins(skinLogadoUser);
      localStorage.setItem('skinLocal', skinLogadoUser);
    }else{
      navigate('/');
    }
    
  }
}, [urlUsername]);


const fetchSkins = async (username) => {
  setIsLoading(true);

  try {
    // 1. Encontrar user baseado no username que está dentro das skins
    const usersSnapshot = await db.collection("users").get();
    let userId = null;
    let skinId = null;

    for (const userDoc of usersSnapshot.docs) {
      const skinsSnap = await userDoc.ref
        .collection("skins")
        .where("username", "==", username)
        .get();

      if (!skinsSnap.empty) {
        userId = userDoc.id;

        // pegar a skin aberta
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
    const skinsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("skins")
      .get();

    const skinsList = skinsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 3. Buscar somente as ESPACOS RELACIONADOS A ESSA SKIN
 


const pagesList = await getEspacosDaSkin({
  userId,
  skinId
});

setPages(Array.isArray(pagesList) ? pagesList : []);



    console.log("pagesList recebido:", pagesList, Array.isArray(pagesList));

    // 4. Atualizar estados
    setSkins(skinsList);

    setUsername(username);


    console.log(skinId + "    AQuiioO000000000");

  } catch (error) {
    console.error("Erro ao buscar skins e páginas:", error);
  } finally {
    setIsLoading(false);
  }
};





useEffect(() => {
  if (!espacos.length || !username) return;

  const mainPage = espacos.find(p => p.is_main === true);

  if (!mainPage) {
    console.warn("Nenhuma home encontrada");
    return;
  }

  navigate(`/${username}/${mainPage.nome}`, { replace: true });
}, [espacos, username]);



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

         <Navegacoes />
              
              <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
              <div id="MatrixDesign"></div>
              <div id="MatrixDev"></div>
              <div id="MatrixHome"></div>
            </div>
            <div style={{ display: menuOpen ? 'none' : 'block' }}>
              <Navbar pages={espacos}/>
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
