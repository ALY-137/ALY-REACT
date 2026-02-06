// src/components/Layout/Geral/LoginGoogle.jsx
import React from "react";
import { auth } from "../../Banco/init-firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

function LoginGoogle({ onLogin }) {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Usuário logado:", user);

      // chama callback no App.jsx
      if (onLogin) onLogin(user);
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
