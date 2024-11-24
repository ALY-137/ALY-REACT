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

let idGoogle = null; // Variável global para exportação

function App() {
  const location = useLocation();
  const rotaAtual = location.pathname;

  const [user, setUser] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [estruturaRenderizada, setEstruturaRenderizada] = useState(false); // Estado para rastrear a renderização

  function handleCallbackResponse(response) {
    const { jwtDecode } = require('jwt-decode');
    const userObject = jwtDecode(response.credential);

    console.log(userObject);

    idGoogle = userObject.sub;
    localStorage.setItem('user', JSON.stringify(userObject));
    localStorage.setItem('idGoogle', idGoogle);

    setUser(userObject);

    const camp = 'idGoogle';
    verificaUser(camp, idGoogle);
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

    // Recuperar idGoogle do localStorage
    const storedIdGoogle = localStorage.getItem('idGoogle');
    if (storedIdGoogle) {
      idGoogle = storedIdGoogle;
      const storedUser = JSON.parse(localStorage.getItem('user'));
      setUser(storedUser);

      const camp = 'idGoogle';
      verificaUser(camp, idGoogle);
    }
  }, []);

  useEffect(() => {
    if (idGoogle && estruturaRenderizada) {
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
  }, [idGoogle, rotaAtual, estruturaRenderizada]); // Inclui estruturaRenderizada como dependência

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMostrarLogin(true);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div>
      {!idGoogle ? (
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
        <Estrutura onRender={() => setEstruturaRenderizada(true)} /> // Passa o callback onRender
      )}
    </div>
  );
}

export { idGoogle };
export default App;
