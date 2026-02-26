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
  const caminhoSemQuery = valor.split("?")[0].split("#")[0];
  if (caminhoSemQuery === "/menu" || caminhoSemQuery === "/menu/") return null;
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
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexao e DNS.";
    default:
      return "Nao foi possivel autenticar com email e senha.";
  }
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

function LoginCadastroEmail({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const finalizarLogin = async (firebaseUser) => {
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
      if (bootstrapError?.code !== "permission-denied") {
        console.warn("Falha no bootstrap do usuario apos login email:", bootstrapError);
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
      if (isErroAcessoAdmin(erroCadastro)) {
        setErro("Acesso permitido apenas para administradores.");
        setEnviando(false);
        return;
      }
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
      if (isErroAcessoAdmin(erroLogin)) {
        setErro("Acesso permitido apenas para administradores.");
      } else {
        setErro(mapearErroAuth(erroLogin?.code));
      }
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
