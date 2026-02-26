import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import "./loginButton.css";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const LoginButton = () => {
  const userId = localStorage.getItem("userId");
  const location = useLocation();
  const navigate = useNavigate();
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const rotaLogin =
    configSistema?.modoAcessoProjeto === "publico_sem_login" ? "/login" : "/";

  if (userId) {
    return null;
  }

  const irParaLogin = () => {
    const destinoAtual = `${location.pathname}${location.search}${location.hash}`;
    const caminhoSemQuery = destinoAtual.split("?")[0].split("#")[0];
    const destinoInvalido =
      caminhoSemQuery === rotaLogin ||
      caminhoSemQuery === "/menu" ||
      caminhoSemQuery === "/menu/";

    if (destinoAtual && !destinoInvalido) {
      localStorage.setItem(POST_LOGIN_REDIRECT_KEY, destinoAtual);
    } else {
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    }

    navigate(rotaLogin);
  };

  return (
    <button className="loginButton" onClick={irParaLogin}>
      <img
        className="imgLoginButton"
        src="https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Ffoguete.png?alt=media&token=19c205b6-b36f-49df-b336-4afc6565c9a5"
        alt="Login Icon"
      />
      <span className="txtLoginButton"> LOGIN </span>
    </button>
  );
};

export default LoginButton;
