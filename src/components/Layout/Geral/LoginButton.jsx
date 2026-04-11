import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import DEFAULT_LOGIN_BUTTON_ICON from "../Temas/cyberpink/assets/cyberpink-rocket-login.svg";
import "./loginButton.css";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";
const LEGACY_DEFAULT_LOGIN_BUTTON_ICON_FRAGMENT =
  "imagens%2Fthemes%2Fcyberpink%2Fviolet%2Ffoguete.png";

function isSvgIconUrl(value = "") {
  const normalizado = String(value || "").trim().toLowerCase();
  return normalizado.endsWith(".svg") || normalizado.includes(".svg?") || normalizado.startsWith("data:image/svg+xml");
}

function buildMaskImageValue(rawUrl = "") {
  return `url("${String(rawUrl).replace(/"/g, '\\"')}")`;
}

function resolveLoginButtonIcon(value = "") {
  const normalizado = String(value || "").trim();
  if (!normalizado || normalizado.includes(LEGACY_DEFAULT_LOGIN_BUTTON_ICON_FRAGMENT)) {
    return DEFAULT_LOGIN_BUTTON_ICON;
  }
  return normalizado;
}

const LoginButton = () => {
  const userId = localStorage.getItem("userId");
  const location = useLocation();
  const navigate = useNavigate();
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const tipoExperiencia = String(configSistema?.tipoExperiencia || "").trim().toLowerCase();
  const loginButtonIconSrc = resolveLoginButtonIcon(configSistema?.loginButtonIconUrl);
  const loginButtonIconIsSvg = isSvgIconUrl(loginButtonIconSrc);
  const rotaLogin = tipoExperiencia === "oneowner" ? "/login" : "/";

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
      {loginButtonIconIsSvg ? (
        <span
          className="imgLoginButton imgLoginButton--svg"
          style={{
            WebkitMaskImage: buildMaskImageValue(loginButtonIconSrc),
            maskImage: buildMaskImageValue(loginButtonIconSrc),
          }}
          aria-hidden="true"
        />
      ) : (
        <img
          className="imgLoginButton"
          src={loginButtonIconSrc}
          alt=""
          aria-hidden="true"
        />
      )}
      <span className="txtLoginButton"> LOGIN </span>
    </button>
  );
};

export default LoginButton;
