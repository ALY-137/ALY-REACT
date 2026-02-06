// App.jsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { db } from './components/Banco/init-firebase';
import { collection, doc, getDocs } from 'firebase/firestore';


import SkinsManager from './components/Layout/Skins/SkinsManager';
import AnoAtualizado from './components/Scripts/data/AnoAtualizado';
import './App.css';
import { txtDefault } from './components/Layout/Temas/CYBERPINK/layout';
import Estrutura from './components/Layout/Espacos/Estrutura';
import Localiza from './components/Scripts/acesso/Acesso.jsx';
import { seforAdm } from './components/Scripts/verificações/verificaAdm.js';
import Acesso from './components/Scripts/acesso/Acesso.jsx';
import Navegacoes from './components/Scripts/navegacoes/Navegacoes.jsx';
import {buscarSkinLogada} from './components/Layout/Skins/buscarSkinLogada.jsx';

import LoginGoogle from './components/Layout/Geral/LoginGoogle.jsx';

import  {verificaUser ,auth}  from './components/Banco/init-firebase';

// Variáveis globais exportadas
let idGoogleCap = null;
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;

const App = () => {
  txtDefault();

  const [username, setUsername] = useState('');
  const [skins, setSkins] = useState([]);
  const [user, setUser] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const [skinLogado, setSkinLogado] = useState(
    JSON.parse(localStorage.getItem('skinLogado')) || false
  );

  const [localIdGoogle, setLocalIdGoogle] = useState(
    JSON.parse(localStorage.getItem('idGoogleCap')) || false
  );

  const [localPrimeiroNome, setLocalPrimeiroNome] = useState('');
  const [localEmail, setLocalEmail] = useState('');
  const [localPicGoogle, setLocalPicGoogle] = useState('');
  const [localFullname, setLocalFullname] = useState('');


  
const handleCallbackResponse = (response) => {
  const userObject = jwtDecode(response.credential);

  // Atualiza locais
  setLocalIdGoogle(userObject.sub);
  setLocalPrimeiroNome(userObject.given_name);
  setLocalEmail(userObject.email);
  setLocalPicGoogle(userObject.picture);
  setLocalFullname(userObject.name);

  // Atualiza storage
  localStorage.setItem('user', JSON.stringify(userObject));
  localStorage.setItem('idGoogleCap', userObject.sub);
  localStorage.setItem('primeiroNomeCap', userObject.given_name);

  // Atualiza estado
  setUser(userObject);
  verificaUser('idGoogleCap', userObject.sub);
};


const fetchSkins = async (id) => {
  try {
    // Referência ao documento do usuário
    const userRef = doc(db, 'users', id);

    // Referência à coleção de skins
    const skinsCol = collection(userRef, 'skins');

    // Busca todos os documentos da coleção
    const skinsSnapshot = await getDocs(skinsCol);

    const skinsList = skinsSnapshot.docs.map((doc) => doc.data());
    setSkins(skinsList);

    if (skinsList.length === 1) {
      const skinUser = skinsList[0].username;

      setUsername(skinUser);

      localStorage.setItem('skinLogadoUser', skinUser);
      localStorage.setItem('selectedTheme', skinsList[0].theme);
      localStorage.setItem('skinLogado', true);

      setSkinLogado(true);
    }
  } catch (error) {
    console.error('Erro ao buscar skins:', error);
  }
};


  useEffect(() => {
    window.google.accounts.id.initialize({
      client_id: '99960275074-f5d0bnogv6a9oq1ui4pkrbou60ffh43f.apps.googleusercontent.com',
      callback: handleCallbackResponse,
    });

    window.google.accounts.id.renderButton(
      document.getElementById('signInDiv'),
      {
        theme: 'outline',
        size: 'large',
        type: 'icon',
        shape: 'rectangular',
        text: '$ {button.text}',
        locale: 'pt-BR',
      }
    );

    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
      setUser(storedUser);
      setLocalIdGoogle(storedUser.sub);
      setLocalPrimeiroNome(storedUser.given_name);
      setLocalEmail(storedUser.email);
      setLocalPicGoogle(storedUser.picture);
      setLocalFullname(storedUser.name);
    }
  }, []);

  useEffect(() => {
    if (user && localIdGoogle) {
      fetchSkins(localIdGoogle);
    }
  }, [user, localIdGoogle]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMostrarLogin(true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Sincroniza globais exportadas com as variáveis locais
  useEffect(() => {
    idGoogleCap = localIdGoogle;
    primeiroNomeCap = localPrimeiroNome;
    emailCap = localEmail;
    picGoogleCap = localPicGoogle;
    fullnameCap = localFullname;
  }, [localIdGoogle, localPrimeiroNome, localEmail, localPicGoogle, localFullname]);

    useEffect(() => {
    const carregarSkinLogada = async () => {
      const skin = await buscarSkinLogada();
      if (skin) {
        console.log('Skin logadaA:', skin);
      }
    };

    carregarSkinLogada();
  }, []); 

const handleLogin = (user) => {
  // user vem direto do Firebase
  console.log("Usuário logado:", user);

  // atualiza estados locais
  setLocalIdGoogle(user.uid);
  setLocalPrimeiroNome(user.displayName.split(" ")[0]);
  setLocalEmail(user.email);
  setLocalPicGoogle(user.photoURL);
  setLocalFullname(user.displayName);

  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("idGoogleCap", user.uid);
  localStorage.setItem("primeiroNomeCap", user.displayName.split(" ")[0]);

  setUser(user);

  // cria/atualiza user no Firestore
  verificaUser("idGoogleCap", user.uid);
};
  return (
    <div>

      {!localIdGoogle && location.pathname === '/' ? (

        <div id="login" className={`containerLogin ${mostrarLogin ? 'fadeIn' : ''}`}>   

        {/*   <Acesso />  */}
               
              <Navegacoes />
<div id="iconsLogin">
  <img src="/logoNeon.png" id="logoLogin" alt="Logo" />
  <p id="logoTxt">ALY-137</p>
  <p id="textoLogin">EMBARQUE COM O GOOGLE</p>
  <LoginGoogle onLogin={handleLogin} />
</div>

            <p id="rodapeLogin">
                ALY-137© <AnoAtualizado />
            </p>
        </div>
      ) : skinLogado ? (
      
        <Estrutura username={username} skins={skins} />
                 
 
        
      ) : (
        <SkinsManager />
      )}
    </div>
  );
};

// Mantém as exportações para não quebrar outros componentes
export { idGoogleCap, primeiroNomeCap, emailCap, picGoogleCap, fullnameCap  };
export default App;
