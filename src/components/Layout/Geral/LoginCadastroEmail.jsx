import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../Banco/init-firebase";
import { bootstrapUser } from "../Menu/Users/bootstrapUser";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const normalizarDestinoInterno = (valor) => {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//")) return null;
  if (valor === "/") return null;
  return valor;
};

const mapearErroAuth = (codigo) => {
  switch (codigo) {
    case "auth/invalid-email":
      return "Email invalido.";
    case "auth/weak-password":
      return "Senha fraca. Use ao menos 6 caracteres.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou senha invalidos.";
    case "auth/user-not-found":
      return "Conta nao encontrada.";
    case "auth/operation-not-allowed":
      return "Metodo de login por email/senha nao habilitado no Firebase Auth.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente em instantes.";
    default:
      return "Nao foi possivel autenticar com email e senha.";
  }
};

function LoginCadastroEmail({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (enviando) return;

    const emailLimpo = email.trim();
    if (!emailLimpo || !senha) {
      setErro("Informe email e senha.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const credenciais = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
      await finalizarLogin(credenciais.user);
      return;
    } catch (erroCadastro) {
      if (erroCadastro?.code !== "auth/email-already-in-use") {
        setErro(mapearErroAuth(erroCadastro?.code));
        setEnviando(false);
        return;
      }
    }

    try {
      const credenciaisExistentes = await signInWithEmailAndPassword(auth, emailLimpo, senha);
      await finalizarLogin(credenciaisExistentes.user);
    } catch (erroLogin) {
      setErro(mapearErroAuth(erroLogin?.code));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="loginCadastroForm" onSubmit={handleSubmit}>
      <input
        className="loginCadastroInput"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        autoComplete="email"
        required
      />
      <input
        className="loginCadastroInput"
        type="password"
        value={senha}
        onChange={(event) => setSenha(event.target.value)}
        placeholder="Senha"
        autoComplete="current-password"
        minLength={6}
        required
      />
      <button className="loginCadastroButton" type="submit" disabled={enviando}>
        {enviando ? "Processando..." : "Cadastrar"}
      </button>
      {erro ? <p className="loginCadastroErro">{erro}</p> : null}
    </form>
  );
}

export default LoginCadastroEmail;
