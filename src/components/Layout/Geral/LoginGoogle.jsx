import React from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, providerGoogle } from "../../Banco/init-firebase";
import { bootstrapUser } from "../Menu/Users/bootstrapUser";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const normalizarDestinoInterno = (valor) => {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//")) return null;
  if (valor === "/") return null;
  return valor;
};

function LoginGoogle({ onLogin }) {
  const navigate = useNavigate();

  const finalizarLogin = async (firebaseUser) => {
    await firebaseUser.getIdToken();
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
        await signInWithRedirect(auth, providerGoogle);
        return;
      }

      if (codigo === "auth/unauthorized-domain") {
        alert(
          `Dominio nao autorizado no Firebase Auth: ${window.location.hostname}. Adicione este dominio em Authentication > Settings > Authorized domains.`
        );
        return;
      }

      console.error("Erro no login:", err);
    }
  };

  return (
    <button onClick={handleLogin} className="loginGoogleButton">
      Entrar com Google
    </button>
  );
}

export default LoginGoogle;
