import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../Banco/init-firebase";
import { bootstrapUser } from "../../Banco/bootstrapUser";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
  resolverDestinoPosLoginPadrao as resolverDestinoPosLoginProjeto,
} from "../Sistema/configSistema";
import { registrarConsentimentoLgpd } from "../Sistema/lgpdConsentApi";
import TermosPrivacidadeModal from "./TermosPrivacidadeModal";

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
    case "auth/email-already-in-use":
      return "Ja existe uma conta com este email.";
    case "auth/operation-not-allowed":
      return "Metodo de login por email/senha nao habilitado no Firebase Auth.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente em instantes.";
    case "auth/missing-email":
      return "Informe um email valido.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexao e DNS.";
    default:
      return "Nao foi possivel autenticar com email e senha.";
  }
};

const isErroAcessoOwner = (erro) => {
  const codigo = String(erro?.code || "").toLowerCase();
  const mensagem = String(erro?.message || "").toLowerCase();
  return (
    codigo.includes("permission-denied") ||
    (codigo === "auth/internal-error" &&
      ((mensagem.includes("owner") || mensagem.includes("administrador") || mensagem.includes("permission-denied"))))
  );
};

function LoginCadastroEmail({ onLogin, configSistema = null }) {
  const navigate = useNavigate();
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [modalDocumentos, setModalDocumentos] = useState({
    aberto: false,
    aba: "termos",
  });

  const termosUsoUrl = String(configSistema?.termosUsoUrl || "").trim();
  const politicaPrivacidadeUrl = String(configSistema?.politicaPrivacidadeUrl || "").trim();
  const exigirAceiteTermosNoCadastro = configSistema?.exigirAceiteTermosNoCadastro === true;
  const mostrarBlocoTermos =
    modo === "cadastro" &&
    (exigirAceiteTermosNoCadastro || Boolean(termosUsoUrl || politicaPrivacidadeUrl));

  const textoBotao = useMemo(() => {
    if (enviando) return "Processando...";
    return modo === "cadastro" ? "Cadastrar" : "Entrar";
  }, [enviando, modo]);
  const textoBotaoTrocaModo = modo === "cadastro" ? "Alterar para login" : "Cadastrar";

  const resolverDestinoPosLoginPadrao = () => {
    const configEmCache = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
    const configEfetiva =
      configSistema && typeof configSistema === "object"
        ? { ...configEmCache, ...configSistema }
        : configEmCache;

    return resolverDestinoPosLoginProjeto(configEfetiva);
  };

  const finalizarLogin = async (firebaseUser, loginContext = {}) => {
    if (typeof firebaseUser?.getIdToken === "function") {
      try {
        await firebaseUser.getIdToken(true);
      } catch {
        // Mantem fluxo de login e deixa bootstrap tentar persistir depois.
      }
    }

    let bootstrapResult = null;
    try {
      bootstrapResult = await bootstrapUser(firebaseUser, {
        loginMethod: "email_password",
        authProvider: "password",
        loginFlow: loginContext.loginFlow || "login",
        emailForHash: loginContext.emailForHash || firebaseUser?.email || "",
      });
    } catch (bootstrapError) {
      if (bootstrapError?.code !== "permission-denied") {
        console.warn("Falha no bootstrap do usuario apos login email:", bootstrapError);
      }
    }

    if (loginContext.consentimentoLgpdAceito === true) {
      try {
        await registrarConsentimentoLgpd({
          user: firebaseUser,
          configSistema,
          origem: "cadastro_email_senha",
          accepted: true,
        });
      } catch (consentError) {
        console.warn("Falha ao registrar aceite LGPD no cadastro:", consentError);
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

  const resetarMensagens = () => {
    setErro("");
    setMensagem("");
  };

  const alternarModo = (proximoModo) => {
    if (proximoModo === modo) return;
    setModo(proximoModo);
    setSenha("");
    setConfirmacaoSenha("");
    setAceitouTermos(false);
    resetarMensagens();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (enviando) return;

    const emailLimpo = email.trim();
    if (!emailLimpo || !senha) {
      setErro("Informe email e senha.");
      setMensagem("");
      return;
    }

    if (modo === "cadastro") {
      if (senha.length < 6) {
        setErro("Senha fraca. Use ao menos 6 caracteres.");
        setMensagem("");
        return;
      }
      if (senha !== confirmacaoSenha) {
        setErro("A confirmacao da senha nao confere.");
        setMensagem("");
        return;
      }
      if (exigirAceiteTermosNoCadastro && !aceitouTermos) {
        setErro("Voce precisa aceitar os termos para concluir o cadastro.");
        setMensagem("");
        return;
      }
    }

    setEnviando(true);
    resetarMensagens();

    try {
      if (modo === "cadastro") {
        const credenciais = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
        await finalizarLogin(credenciais.user, {
          loginFlow: "cadastro",
          emailForHash: emailLimpo,
          consentimentoLgpdAceito: aceitouTermos,
        });
      } else {
        const credenciais = await signInWithEmailAndPassword(auth, emailLimpo, senha);
        await finalizarLogin(credenciais.user, {
          loginFlow: "login",
          emailForHash: emailLimpo,
        });
      }
    } catch (erroAuth) {
      if (isErroAcessoOwner(erroAuth)) {
        setErro("Acesso permitido apenas para owners.");
      } else {
        setErro(mapearErroAuth(erroAuth?.code));
      }
    } finally {
      setEnviando(false);
    }
  };

  const handlePasswordReset = async () => {
    if (enviandoReset) return;

    const emailLimpo = email.trim();
    if (!emailLimpo) {
      setErro("Informe o email para recuperar a senha.");
      setMensagem("");
      return;
    }

    setEnviandoReset(true);
    resetarMensagens();

    try {
      await sendPasswordResetEmail(auth, emailLimpo);
      setMensagem("Email de recuperacao enviado.");
    } catch (erroReset) {
      setErro(mapearErroAuth(erroReset?.code));
    } finally {
      setEnviandoReset(false);
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
        autoComplete={modo === "cadastro" ? "new-password" : "current-password"}
        minLength={6}
        required
      />

      {modo === "cadastro" ? (
        <input
          className="loginCadastroInput"
          type="password"
          value={confirmacaoSenha}
          onChange={(event) => setConfirmacaoSenha(event.target.value)}
          placeholder="Confirmar senha"
          autoComplete="new-password"
          minLength={6}
          required
        />
      ) : null}

      {mostrarBlocoTermos ? (
        <div className="loginCadastroTerms">
          <label className="loginCadastroTerms__check">
            <input
              type="checkbox"
              checked={aceitouTermos}
              onChange={(event) => setAceitouTermos(event.target.checked)}
            />
            <span>Li e aceito os termos aplicaveis.</span>
          </label>
          <span className="loginCadastroTerms__actions">
            <button
              type="button"
              onClick={() => setModalDocumentos({ aberto: true, aba: "termos" })}
            >
              Ver termos
            </button>
            <button
              type="button"
              onClick={() => setModalDocumentos({ aberto: true, aba: "politica" })}
            >
              Ver politica
            </button>
          </span>
        </div>
      ) : null}

      <TermosPrivacidadeModal
        aberto={modalDocumentos.aberto}
        initialTab={modalDocumentos.aba}
        termosUsoUrl={termosUsoUrl}
        termosUsoVersao={configSistema?.termosUsoVersao || "1.0"}
        politicaPrivacidadeUrl={politicaPrivacidadeUrl}
        politicaPrivacidadeVersao={configSistema?.politicaPrivacidadeVersao || "1.0"}
        onClose={() => setModalDocumentos((prev) => ({ ...prev, aberto: false }))}
      />

      <button className="loginCadastroButton" type="submit" disabled={enviando}>
        {textoBotao}
      </button>

      <button
        className="loginCadastroSecondaryButton loginCadastroModeToggle"
        type="button"
        onClick={() => alternarModo(modo === "cadastro" ? "login" : "cadastro")}
        disabled={enviando || enviandoReset}
      >
        {textoBotaoTrocaModo}
      </button>

      {modo === "login" ? (
        <button
          className="loginCadastroSecondaryButton loginCadastroForgotButton"
          type="button"
          onClick={handlePasswordReset}
          disabled={enviando || enviandoReset}
        >
          {enviandoReset ? "Enviando..." : "Esqueci minha senha"}
        </button>
      ) : null}

      {erro ? <p className="loginCadastroErro">{erro}</p> : null}
      {!erro && mensagem ? <p className="loginCadastroMensagem">{mensagem}</p> : null}
    </form>
  );
}

export default LoginCadastroEmail;



