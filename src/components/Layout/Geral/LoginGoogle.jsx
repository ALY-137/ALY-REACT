import React from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
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

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, providerGoogle);
      const user = result.user;
      await user.getIdToken();

      const bootstrapResult = await bootstrapUser(user);

      if (onLogin) {
        onLogin(user, bootstrapResult);
      }

      const destinoSalvo = normalizarDestinoInterno(
        localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
      );

      if (destinoSalvo) {
        localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
        navigate(destinoSalvo, { replace: true });
      }
    } catch (err) {
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
