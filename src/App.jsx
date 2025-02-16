import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verificaUser, db } from './components/Banco/init-firebase';
import 'firebase/firestore';
import SkinsManager from './components/Layout/Skins/SkinsManager';
import AnoAtualizado from './components/Scripts/data/AnoAtualizado';
import './App.css';
import { txtDefault } from './components/Layout/Temas/CYBERPINK/layout';
import Estrutura from './components/Layout/Paginas/Estrutura';

let idGoogleCap = null;
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;
let skinLocal = null;

let skinLogado = JSON.parse(localStorage.getItem('skinLogado')) || false;

const App = () => {
  txtDefault();

  const [SkinSelecionada, setSkinSelecionada] = useState(false);
  const [username, setUsername] = useState('');
  const [skins, setSkins] = useState([]);
  const [user, setUser] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();


  const handleCallbackResponse = (response) => {
    const { jwtDecode } = require('jwt-decode');
    const userObject = jwtDecode(response.credential);

    idGoogleCap = userObject.sub;
    primeiroNomeCap = userObject.given_name;
    emailCap = userObject.email;
    picGoogleCap = userObject.picture;
    fullnameCap = userObject.name;

    localStorage.setItem('user', JSON.stringify(userObject));
    localStorage.setItem('idGoogleCap', idGoogleCap);

    setUser(userObject);
    verificaUser('idGoogleCap', idGoogleCap);
    fetchSkins(); // Fetch skins after login
  };
  const fetchSkins = async () => {
    try {
      const userRef = db.collection('users').doc(idGoogleCap);
      const skinsSnapshot = await userRef.collection('skins').get();
      const skinsList = skinsSnapshot.docs.map((doc) => doc.data());
      setSkins(skinsList);
  
      if (skinsList.length === 1) { // Se existir somente uma skin
        setSkinSelecionada(true);
        const skinUser = skinsList[0].username;
        setUsername(skinUser);
        localStorage.setItem('selectedTheme', skinsList[0].theme); // Persistir o tema no localStorage
        localStorage.setItem('skinLogado', true); // Altera estado de skinLogado para true
        skinLogado = localStorage.getItem('skinLogado');
        localStorage.setItem('skinLocal', skinUser); // Armazenar username no localStorage
        skinLocal = localStorage.getItem('skinLocal');
        console.log("User..." + skinUser);
      }
    } catch (error) {
      console.error('Erro ao buscar skins:', error);
    }
  }  
  useEffect(() => {
    // Inicialização do Google Sign-In
    window.google.accounts.id.initialize({
      client_id: "99960275074-f5d0bnogv6a9oq1ui4pkrbou60ffh43f.apps.googleusercontent.com",
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

    const storedIdGoogle = localStorage.getItem('idGoogleCap');
    if (storedIdGoogle) {
      idGoogleCap = storedIdGoogle;
      const storedUser = JSON.parse(localStorage.getItem('user'));
      primeiroNomeCap = storedUser?.given_name || null;

      console.log(primeiroNomeCap);

      localStorage.setItem('primeiroNomeCap',primeiroNomeCap);
      setUser(storedUser);
      fetchSkins();
    } else {
      idGoogleCap = false;
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMostrarLogin(true);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div>
      {!idGoogleCap && location.pathname === '/' ? (
        <div id="login" className={`containerLogin ${mostrarLogin ? 'fadeIn' : ''}`}>
          <div id="iconsLogin">
            <img src="/logoNeon.png" id="logoLogin" alt="Logo" />
            <p id="logoTxt">ALY-137</p>
            <p id="textoLogin">EMBARQUE COM O GOOGLE</p>
            <div id="signInDiv"></div>
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

export { idGoogleCap, primeiroNomeCap, emailCap, picGoogleCap, fullnameCap };
export default App;