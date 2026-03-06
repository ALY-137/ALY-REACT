import React from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, providerGoogle } from "../../Banco/init-firebase";
import { bootstrapUser } from "../Menu/Users/bootstrapUser";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const normalizarDestinoInterno = (valor) => {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//")) return null;
  if (valor === "/") return null;
  const caminhoSemQuery = valor.split("?")[0].split("#")[0];
  if (caminhoSemQuery === "/menu" || caminhoSemQuery === "/menu/") return null;
  return valor;
};

const mostrarAjudaRedeAuth = () => {
  alert(
    "Falha de rede no Firebase Auth (securetoken.googleapis.com). Verifique DNS/VPN/firewall e tente novamente."
  );
};

const isErroAcessoAdmin = (erro) => {
  const codigo = String(erro?.code || "").toLowerCase();
  const mensagem = String(erro?.message || "").toLowerCase();
  return (
    codigo.includes("permission-denied") ||
    (codigo === "auth/internal-error" &&
      (mensagem.includes("administrador") || mensagem.includes("permission-denied")))
  );
};

const isAmbienteLocal = () => {
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const authDomainFirebasePadrao = () => {
  const authDomain = String(auth?.config?.authDomain || "")
    .trim()
    .toLowerCase();
  return authDomain.endsWith(".firebaseapp.com") || authDomain.endsWith(".web.app");
};

function LoginGoogle({ onLogin }) {
  const navigate = useNavigate();

  const resolverDestinoPosLoginPadrao = () => {
    const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
    if (isOnePageComEntradaPublica(configSistema)) {
      return "/home";
    }
    return null;
  };

  const finalizarLogin = async (firebaseUser) => {
    if (firebaseUser?.uid) {
      localStorage.setItem("userId", firebaseUser.uid);
    }
    if (typeof firebaseUser?.getIdToken === "function") {
      try {
        await firebaseUser.getIdToken(true);
      } catch {
        // Mantem fluxo de login e deixa bootstrap tentar persistir depois.
      }
    }

    let bootstrapResult = null;
    try {
      bootstrapResult = await bootstrapUser(firebaseUser);
    } catch (bootstrapError) {
      // Nao bloqueia sessao se o bootstrap falhar por regra/permissao.
      if (bootstrapError?.code !== "permission-denied") {
        console.warn("Falha no bootstrap do usuario apos login Google:", bootstrapError);
      }
    }

    if (onLogin) {
      onLogin(firebaseUser, bootstrapResult);
    }

    const destinoBruto = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    const destinoSalvo = normalizarDestinoInterno(destinoBruto);

    if (destinoSalvo) {
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      navigate(destinoSalvo, { replace: true });
      return;
    }
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);

    const destinoPadrao = resolverDestinoPosLoginPadrao();
    if (destinoPadrao) {
      navigate(destinoPadrao, { replace: true });
    }
  };

  useEffect(() => {
    let ativo = true;

    const resolverRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user || !ativo) return;
        await finalizarLogin(result.user);
      } catch (err) {
        if (isErroAcessoAdmin(err)) {
          alert("Acesso permitido apenas para administradores.");
          return;
        }
        if (err?.code === "auth/network-request-failed") {
          mostrarAjudaRedeAuth();
          return;
        }
        console.error("Erro ao concluir login por redirect:", err);
      }
    };

    resolverRedirect();

    return () => {
      ativo = false;
    };
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, providerGoogle);
      await finalizarLogin(result.user);
    } catch (err) {
      const codigo = err?.code || "";

      if (
        codigo === "auth/popup-blocked" ||
        codigo === "auth/popup-closed-by-user" ||
        codigo === "auth/cancelled-popup-request" ||
        codigo === "auth/operation-not-supported-in-this-environment"
      ) {
        // Em dominios nao-Firebase (ex.: Vercel), redirect pode ficar preso em /__/auth/handler.
        // Nesses casos forca o usuario a liberar popup.
        if (!isAmbienteLocal() && !authDomainFirebasePadrao()) {
          alert(
            "Popup bloqueado. Permita popups para este dominio e tente novamente."
          );
          return;
        }
        await signInWithRedirect(auth, providerGoogle);
        return;
      }

      if (codigo === "auth/unauthorized-domain") {
        alert(
          `Dominio nao autorizado no Firebase Auth: ${window.location.hostname}. Adicione este dominio em Authentication > Settings > Authorized domains.`
        );
        return;
      }

      if (codigo === "auth/operation-not-allowed") {
        alert("Login com Google nao habilitado no Firebase Authentication deste projeto.");
        return;
      }

      if (codigo === "auth/network-request-failed") {
        mostrarAjudaRedeAuth();
        return;
      }

      if (isErroAcessoAdmin(err)) {
        alert("Acesso permitido apenas para administradores.");
        return;
      }

      try {
        if (isAmbienteLocal() || authDomainFirebasePadrao()) {
          await signInWithRedirect(auth, providerGoogle);
          return;
        }
      } catch {
        // Cai no log de erro original.
      }

      console.error("Erro no login:", err);
    }
  };

  return (
    <button
      onClick={handleLogin}
      className="loginGoogleButton"
      type="button"
      aria-label="Entrar com Google"
      title="Entrar com Google"
    >
      <svg
        className="loginGoogleIcon"
        viewBox="0 0 18 18"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0795-1.7972 2.7177v2.2582h2.9086c1.7018-1.5668 2.6845-3.8727 2.6845-6.6168z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1782l-2.9086-2.2582c-.8059.54-1.8368.8591-3.0478.8591-2.3441 0-4.3282-1.5832-5.0368-3.7105H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.9632 10.7122C3.7823 10.1727 3.68 9.5968 3.68 9s.1023-1.1727.2832-1.7123V4.9559H.9573C.3477 6.1705 0 7.5482 0 9s.3477 2.8295.9573 4.0441l3.0059-2.3319z"
        />
        <path
          fill="#EA4335"
          d="M9 3.5773c1.3214 0 2.5077.4541 3.4405 1.345L15.0291 2.334C13.4632.8777 11.43 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9559l3.0059 2.3318C4.6718 5.1605 6.6559 3.5773 9 3.5773z"
        />
      </svg>
    </button>
  );
}

export default LoginGoogle;
