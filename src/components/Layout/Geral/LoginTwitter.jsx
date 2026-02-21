import React from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, providerTwitter } from "../../Banco/init-firebase";
import { bootstrapUser } from "../Menu/Users/bootstrapUser";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const normalizarDestinoInterno = (valor) => {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//")) return null;
  if (valor === "/") return null;
  return valor;
};

function LoginTwitter({ onLogin }) {
  const navigate = useNavigate();

  const finalizarLogin = async (firebaseUser) => {
    const bootstrapResult = await bootstrapUser(firebaseUser);

    if (onLogin) {
      onLogin(firebaseUser, bootstrapResult);
    }

    const destinoSalvo = normalizarDestinoInterno(
      localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    );

    if (destinoSalvo) {
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      navigate(destinoSalvo, { replace: true });
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
        if (err?.code === "auth/network-request-failed") {
          alert("Falha de rede ao autenticar com X/Twitter. Verifique sua conexao e DNS.");
          return;
        }
        console.error("Erro ao concluir login por redirect (X/Twitter):", err);
      }
    };

    resolverRedirect();

    return () => {
      ativo = false;
    };
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, providerTwitter);
      await finalizarLogin(result.user);
    } catch (err) {
      const codigo = err?.code || "";

      if (
        codigo === "auth/popup-blocked" ||
        codigo === "auth/popup-closed-by-user" ||
        codigo === "auth/cancelled-popup-request" ||
        codigo === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, providerTwitter);
        return;
      }

      if (codigo === "auth/operation-not-allowed") {
        alert("Login com X/Twitter nao habilitado no Firebase Authentication.");
        return;
      }

      if (codigo === "auth/unauthorized-domain") {
        alert(
          `Dominio nao autorizado no Firebase Auth: ${window.location.hostname}. Adicione este dominio em Authentication > Settings > Authorized domains.`
        );
        return;
      }

      if (codigo === "auth/network-request-failed") {
        alert("Falha de rede ao autenticar com X/Twitter. Verifique sua conexao e DNS.");
        return;
      }

      console.error("Erro no login com X/Twitter:", err);
    }
  };

  return (
    <button
      onClick={handleLogin}
      className="loginTwitterButton"
      type="button"
      aria-label="Entrar com X/Twitter"
      title="Entrar com X/Twitter"
    >
      <svg
        className="loginTwitterIcon"
        viewBox="0 0 1200 1227"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M714 519L1160 0H1054L667 450L358 0H0L468 681L0 1227H106L515 756L842 1227H1200L714 519ZM569 699L521 631L144 99H307L611 533L659 601L1054 1130H891L569 699Z"
        />
      </svg>
    </button>
  );
}

export default LoginTwitter;
