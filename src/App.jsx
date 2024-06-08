import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { verificaUser } from './components/Banco/init-firebase';
import { jwtDecode } from 'jwt-decode';
import './App.css';

import violet from './components/Layout/home';
import blue from './components/Layout/dev';
import pink from './components/Layout/design';
import layout from './components/Layout/layout';
import Estrutura from './components/Layout/Estrutura';
import AnoAtualizado from './components/Scripts/data/AnoAtualizado';

let idGoogle;
let nomeCompleto;

function App() {
  const location = useLocation();
  const rotaAtual = location.pathname;

  const [user, setUser] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  function handleCallbackResponse(response) {
    const userObject = jwtDecode(response.credential);
    console.log(userObject);
    setUser(userObject);
    document.getElementById('signInDiv').hidden = true;
    window.given_name.textContent = userObject.given_name;
    window.fullName.textContent = userObject.name;
    window.sub.textContent = userObject.sub;
    window.family_name.textContent = userObject.family_name;
    window.email.textContent = userObject.email;
    window.verifiedEmail.textContent = userObject.email_verified;
    window.picture.setAttribute("src", userObject.picture);

    const login = document.getElementById('login');
    login.style.display = "none";

    const camp = 'idGoogle';
    idGoogle = userObject.sub;
    nomeCompleto = userObject.name;

    verificaUser(camp, idGoogle);

    // Armazenar usuário no localStorage
    localStorage.setItem('user', JSON.stringify(userObject));

    layout();

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

  useEffect(() => {
    // Inicialização do Google
    window.google.accounts.id.initialize({
      client_id: "99960275074-f5d0bnogv6a9oq1ui4pkrbou60ffh43f.apps.googleusercontent.com",
      callback: handleCallbackResponse
    });

    window.google.accounts.id.renderButton(
      document.getElementById("signInDiv"), {
        theme: "outline",
        size: "large",
        type: "icon",
        shape: "rectangular",
        text: "$ {button.text}",
        locale: "pt-BR"
      }
    );

    // Verificar localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userObject = JSON.parse(storedUser);
      setUser(userObject);
      document.getElementById('signInDiv').hidden = true;
      window.given_name.textContent = userObject.given_name;
      window.fullName.textContent = userObject.name;
      window.sub.textContent = userObject.sub;
      window.family_name.textContent = userObject.family_name;
      window.email.textContent = userObject.email;
      window.verifiedEmail.textContent = userObject.email_verified;
      window.picture.setAttribute("src", userObject.picture);

      const login = document.getElementById('login');
      login.style.display = "none";

      const camp = 'idGoogle';
      idGoogle = userObject.sub;
      nomeCompleto = userObject.name;

      verificaUser(camp, idGoogle);

      layout();

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

    // Adicionar listener de resize
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      console.log("Window resized! New width: " + window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    // Limpar o listener de resize ao desmontar o componente
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [rotaAtual]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMostrarLogin(true);
    }, 80);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div>
      <Estrutura windowWidth={windowWidth} />
      <div id='login' className={`containerLogin ${mostrarLogin ? 'fadeIn' : ''}`}>
        <div id='iconsLogin'>
          <img src='/logoNeon.png' id='logoLogin' />
          <p id='logoTxt'>ALY-137©</p>
          <p id='textoLogin'>EMBARQUE COM O GOOGLE</p>
          <div id="signInDiv"></div>
        </div>
        <p id='rodapeLogin'>ALY-137© <AnoAtualizado /></p>
      </div>
      <p id="fullName"></p>
      <p id="sub"></p>
      <p id="given_name"></p>
      <p id="family_name"></p>
      <p id="email"></p>
      <p id="verifiedEmail"></p>
      <img id="picture" />
    </div>
  );
}

export { idGoogle };
export { nomeCompleto };
export default App;