import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import { db } from "../../Banco/init-firebase";
import violet from "../Temas/CYBERPINK/violet";

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

 const idGoogleCap =  localStorage.getItem('idGoogleCap');

  // Pega username da URL, se disponível
  const pathname = location.pathname;
  const urlUsername = pathname.split('/')[1];

  const fechExecutado = false;

  let skinLocal = null;

  // Função para buscar as skins do usuário a partir da subcoleção 'skins' de cada usuário
  const fetchSkins = async (username) => {
    try {
      console.log(`Buscando skins para o usuário: ${username}`);
      const usersSnapshot = await db.collection('users').get();
      let skinsList = [];

      for (const userDoc of usersSnapshot.docs) {
        const skinsSnapshot = await userDoc.ref.collection('skins').where('username', '==', username).get();
        skinsList = [...skinsList, ...skinsSnapshot.docs.map((doc) => doc.data())];
      }
      
      console.log(`Skins encontradas: ${JSON.stringify(skinsList)}`);
      setSkins(skinsList);
      setUsername(username);
      fechExecutado = true;

    } catch (error) {
      console.error('Erro ao buscar skins:', error);
    }
  };

  useEffect(() => {
    if (urlUsername) {
      console.log(`URL username: ${urlUsername}`);
      fetchSkins(urlUsername);
      console.log("id google: "+ idGoogleCap);
    }else{
      skinLocal = localStorage.getItem('skinLocal');
      fetchSkins(skinLocal);
    }
  }, [urlUsername]);


  useEffect(() => {
    if (!Array.isArray(skins) || skins.length === 0 || !username) {
      console.log("Skins não encontradas ou username não definido");
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log(`Definindo tema para o usuário: ${username}`);
      defineTheme(username, skins, setLayoutScript);
      violet();
    },1);

    return () => clearTimeout(timeoutId); // Limpa o timeout se o componente desmontar
  }, [skins, username, fechExecutado]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    navigate(menuOpen ? "/home" : `/menu/${idGoogleCap}`);
  };

  return (
    <div id="fundo">
      <div id="estrutura">
    {idGoogleCap && (
          <div
            id="navbar-menu"   
            style={{ textAlign: "center", display: menuOpen ? 'none' : 'block' }}
          >
            <p onClick={toggleMenu} style={{ cursor: "pointer", display: menuOpen ? 'none' : 'block' }}>
              ㆔
            </p>
          </div>
        )}  

        <div id="cardProfile" style={{ display: menuOpen ? 'none' : 'block' }}>
          <img
            src="/imagens/imgHome/busto.png"
            id="imgBustoHome"
            alt="imagem"
          />
          <div id="MatrixDesign"></div>
          <div id="MatrixDev"></div>
          <div id="MatrixHome"></div>
        </div>
        <div style={{ display: menuOpen ? 'none' : 'block' }}>
          <Navbar />
        </div>

        <div id="conteudo">
          <Outlet />
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