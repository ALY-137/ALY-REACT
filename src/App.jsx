import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { verificaUser } from './components/Banco/init-firebase';

import './App.css';

import violet from './components/Layout/violet';
import blue from './components/Layout/blue';
import pink from './components/Layout/pink';

import layout from './components/Layout/layout';
import Estrutura from './components/Layout/Estrutura';
import AnoAtualizado from './components/Scripts/data/AnoAtualizado';

// Variáveis globais para exportação
let idGoogleCap = null;
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;

function App() {
  const location = useLocation();
  const rotaAtual = location.pathname;

  const [user, setUser] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [estruturaRenderizada, setEstruturaRenderizada] = useState(false); // Estado para rastrear a renderização

  function handleCallbackResponse(response) {
    const { jwtDecode } = require('jwt-decode');
    const userObject = jwtDecode(response.credential);



    idGoogleCap = userObject.sub;
    primeiroNomeCap = userObject.given_name; // Atualiza a variável global
    emailCap = userObject.email;
    picGoogleCap = userObject.picture;
    fullnameCap = userObject.name;

    localStorage.setItem('user', JSON.stringify(userObject));
    localStorage.setItem('idGoogleCap', idGoogleCap);

    setUser(userObject);
    verificaUser('idGoogleCap', idGoogleCap);
  }

  useEffect(() => {
    // Inicialização do Google
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

    // Recuperar idGoogleCap e primeiroNomeCap do localStorage
    const storedIdGoogle = localStorage.getItem('idGoogleCap');
    if (storedIdGoogle) {
      idGoogleCap = storedIdGoogle;
      const storedUser = JSON.parse(localStorage.getItem('user'));
      primeiroNomeCap = storedUser?.given_name || null; // Atualiza a variável global
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    if (idGoogleCap && estruturaRenderizada) {
      layout(); // Chama layout apenas após Estrutura ser renderizado
      switch (rotaAtual) {
        case '/':
        case '/home/':
        case '/home':
          violet();
          break;
        case '/development/':
        case '/development':
          blue();
          break;
        case '/design/':
        case '/design':
          pink();
          break;
        default:
      }
    }
  }, [idGoogleCap, rotaAtual, estruturaRenderizada]); // Inclui estruturaRenderizada como dependência

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMostrarLogin(true);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div>
      {!idGoogleCap ? (
        <div id="login" className={`containerLogin ${mostrarLogin ? 'fadeIn' : ''}`}>
          <div id="iconsLogin">
            <img src="/logoNeon.png" id="logoLogin" />
            <p id="logoTxt">ALY-137</p>
            <p id="textoLogin">EMBARQUE COM O GOOGLE</p>
            <div id="signInDiv"></div>
          </div>
          <p id="rodapeLogin">
            ALY-137© <AnoAtualizado />
          </p>
        </div>
      ) : (
        <Estrutura 
          onRender={() => setEstruturaRenderizada(true)} 
          primeiroNomeCap={primeiroNomeCap} // Passa o nome para o componente Estrutura
        />
      )}
    </div>
  );
}

export { idGoogleCap, primeiroNomeCap ,emailCap , picGoogleCap , fullnameCap }; // Exporta ambas as variáveis globais
export default App;
