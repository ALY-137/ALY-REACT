import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDocs } from "firebase/firestore";

import {
  activeFirebaseProjectKey,
  auth,
  db,
} from "./components/Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  estaConfigSistemaInicializada,
  obterConfigSistemaCacheLocal,
  obterConfigSistema,
} from "./components/Layout/Sistema/configSistema";
import PropriedadesSistema from "./components/Layout/Menu/PropriedadesSistema/PropriedadesSistema";
import { bootstrapUser } from "./components/Layout/Menu/Users/bootstrapUser";

import SkinsManager from "./components/Layout/Skins/SkinsManager";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import LoginGoogle from "./components/Layout/Geral/LoginGoogle.jsx";
import LoginTwitter from "./components/Layout/Geral/LoginTwitter.jsx";
import LoginCadastroEmail from "./components/Layout/Geral/LoginCadastroEmail.jsx";
import FirebaseProjectBadge from "./components/Layout/Geral/FirebaseProjectBadge.jsx";
import Navegacoes from "./components/Scripts/navegacoes/Navegacoes.jsx";
import AnoAtualizado from "./components/Scripts/data/AnoAtualizado";
import { seforAdm } from "./components/Scripts/verificacoes/verificaAdm";

import "./App.css";

// Variaveis globais exportadas
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;
const CHAVES_SESSAO = [
  "targetUsername",
  "skinLogadoUser",
  "skinLogado",
  "skinIdAtual",
  "selectedTheme",
  "userId",
  "nomeSkin",
  "skinOwner",
];
const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const App = () => {
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";
  const [user, setUser] = useState(null);
  const [skins, setSkins] = useState([]);
  const [username, setUsername] = useState("");
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [skinsLoading, setSkinsLoading] = useState(false);
  const [configSistema, setConfigSistema] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const [configSistemaPronta, setConfigSistemaPronta] = useState(
    () => Boolean(obterConfigSistemaCacheLocal())
  );
  const [carregandoSetupAdmin, setCarregandoSetupAdmin] = useState(false);
  const [mostrarSetupAdmin, setMostrarSetupAdmin] = useState(false);
  const [setupAdminBootstrap, setSetupAdminBootstrap] = useState(false);
  const [encerrandoSessaoGerenciador, setEncerrandoSessaoGerenciador] = useState(false);
  const [erroAcessoGerenciador, setErroAcessoGerenciador] = useState("");

  const location = useLocation();

  const aplicarConfigSistemaLocal = (config) => {
    setConfigSistema(config);
    setConfigSistemaPronta(true);
    aplicarBrandingNoDocumento(config);
    if (config?.adminUid) {
      localStorage.setItem("systemAdminUid", config.adminUid);
    } else {
      localStorage.removeItem("systemAdminUid");
    }
    if (config?.adminEmail) {
      localStorage.setItem("systemAdminEmail", String(config.adminEmail).toLowerCase());
    } else {
      localStorage.removeItem("systemAdminEmail");
    }
  };

  useEffect(() => {
    let ativo = true;

    const carregarConfigSistema = async () => {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        aplicarConfigSistemaLocal(config);
      } catch (error) {
        // Se falhar, segue com defaults locais.
      } finally {
        if (ativo) setConfigSistemaPronta(true);
      }
    };

    carregarConfigSistema();

    return () => {
      ativo = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    const handleConfigSistemaAtualizada = (event) => {
      const configAtualizada = event?.detail;
      if (!configAtualizada || typeof configAtualizada !== "object") return;
      aplicarConfigSistemaLocal(configAtualizada);
    };

    window.addEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    return () => {
      window.removeEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.uid) {
        localStorage.setItem("userId", firebaseUser.uid);
      } else {
        localStorage.removeItem("userId");
      }

      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isManagerProject) return;
    if (!user?.uid) return;

    const garantirDocumentoUsuario = async () => {
      try {
        await bootstrapUser(user);
      } catch (error) {
        if (error?.code !== "permission-denied") {
          console.warn("Falha ao garantir bootstrap do usuario autenticado:", error);
        }
      }
    };

    garantirDocumentoUsuario();
  }, [isManagerProject, user]);

  useEffect(() => {
    let ativo = true;

    const validarAcessoGerenciador = async () => {
      if (!isManagerProject) return;
      if (authLoading) return;
      if (!configSistemaPronta) return;

      if (!user?.uid) {
        if (!ativo) return;
        setEncerrandoSessaoGerenciador(false);
        setErroAcessoGerenciador("");
        return;
      }

      const adminUidConfig = (
        configSistema?.adminUid ||
        localStorage.getItem("systemAdminUid") ||
        process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID ||
        ""
      ).trim();
      const adminEmailConfig = String(
        configSistema?.adminEmail ||
          localStorage.getItem("systemAdminEmail") ||
          process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
          ""
      )
        .trim()
        .toLowerCase();
      const userEmailAtual = String(user?.email || "")
        .trim()
        .toLowerCase();

      if (!adminUidConfig) {
        if (!ativo) return;
        setErroAcessoGerenciador("");
        setEncerrandoSessaoGerenciador(false);
        return;
      }

      const usuarioEhAdminGerenciador =
        (adminUidConfig && user.uid === adminUidConfig) ||
        (adminEmailConfig && userEmailAtual === adminEmailConfig) ||
        seforAdm(user);

      if (usuarioEhAdminGerenciador) {
        if (!ativo) return;
        setErroAcessoGerenciador("");
        setEncerrandoSessaoGerenciador(false);
        return;
      }

      if (!ativo) return;
      setErroAcessoGerenciador("Acesso permitido apenas para administradores.");
      setEncerrandoSessaoGerenciador(false);
    };

    validarAcessoGerenciador();

    return () => {
      ativo = false;
    };
  }, [
    isManagerProject,
    authLoading,
    configSistemaPronta,
    configSistema?.adminUid,
    user?.uid,
  ]);

  useEffect(() => {
    if (isManagerProject) {
      setSkins([]);
      setSkinsLoading(false);
      return;
    }
    if (!configSistemaPronta) return;

    const onePagePublicaAtivaProjeto =
      configSistema?.tipoExperiencia === "onepage" &&
      configSistema?.modoAcessoProjeto === "publico_sem_login";
    if (onePagePublicaAtivaProjeto) {
      setSkins([]);
      setSkinsLoading(false);
      return;
    }

    if (!user?.uid) return;

    setSkinsLoading(true);

    const fetchSkins = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const skinsCol = collection(userRef, "skins");
        const skinsSnapshot = await getDocs(skinsCol);
        const skinsList = skinsSnapshot.docs.map((docItem) => docItem.data());

        setSkins(skinsList);

        if (skinsList.length === 1) {
          const skin = skinsList[0];
          setUsername(skin.username);
          localStorage.setItem("targetUsername", skin.username);
          localStorage.setItem("skinLogadoUser", skin.username);
          localStorage.setItem("selectedTheme", skin.theme);
        }
      } catch (error) {
        if (error?.code !== "permission-denied") {
          console.error("Erro ao buscar skins:", error);
        }
      } finally {
        setSkinsLoading(false);
      }
    };

    fetchSkins();
  }, [
    isManagerProject,
    user,
    configSistemaPronta,
    configSistema?.tipoExperiencia,
    configSistema?.modoAcessoProjeto,
  ]);

  useEffect(() => {
    setMostrarSetupAdmin(false);
    setSetupAdminBootstrap(false);
    setCarregandoSetupAdmin(false);
  }, [isManagerProject, user]);

  useEffect(() => {
    let ativo = true;

    const avaliarSetupAdmin = async () => {
      if (!isManagerProject) return;
      if (authLoading) return;
      if (!user?.uid) {
        setMostrarSetupAdmin(false);
        setSetupAdminBootstrap(false);
        setCarregandoSetupAdmin(false);
        return;
      }

      setCarregandoSetupAdmin(true);
      try {
        const configInicializada = await estaConfigSistemaInicializada();
        if (!ativo) return;

        const adminUidConfig = configSistema?.adminUid || localStorage.getItem("systemAdminUid");
        const possuiAdminDefinido = Boolean(adminUidConfig);

        if (!configInicializada || !possuiAdminDefinido) {
          setSetupAdminBootstrap(true);
          setMostrarSetupAdmin(true);
          return;
        }

        setSetupAdminBootstrap(false);
        setMostrarSetupAdmin(false);
      } catch {
        if (!ativo) return;
        const adminUidConfig = configSistema?.adminUid || localStorage.getItem("systemAdminUid");
        if (!adminUidConfig) {
          setSetupAdminBootstrap(true);
          setMostrarSetupAdmin(true);
        } else {
          setSetupAdminBootstrap(false);
          setMostrarSetupAdmin(false);
        }
      } finally {
        if (ativo) setCarregandoSetupAdmin(false);
      }
    };

    avaliarSetupAdmin();

    return () => {
      ativo = false;
    };
  }, [
    isManagerProject,
    authLoading,
    user?.uid,
    configSistema?.adminUid,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => setMostrarLogin(true), 1000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    try {
      const destino = localStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "";
      const caminhoSemQuery = destino.split("?")[0].split("#")[0];
      if (caminhoSemQuery === "/menu" || caminhoSemQuery === "/menu/") {
        localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      }
    } catch {
      // Ignora indisponibilidade de storage.
    }
  }, []);

  useLayoutEffect(() => {
    aplicarBrandingNoDocumento(configSistema);
  }, [configSistema.tituloSistema, configSistema.faviconUrl]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const largura = Number(configSistema?.larguraIconsLoginPx);

    if (Number.isFinite(largura) && largura > 0) {
      root.style.setProperty("--icons-login-width", `${Math.round(largura)}px`);
    } else {
      root.style.removeProperty("--icons-login-width");
    }
  }, [configSistema.larguraIconsLoginPx]);

  const rotaAtual = String(location.pathname || "").toLowerCase();
  const isAdminLoginRoute = !isManagerProject && rotaAtual === "/login";
  const modoAcessoProjeto = configSistema?.modoAcessoProjeto || DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto;
  const tipoExperiencia = configSistema?.tipoExperiencia || DEFAULT_SISTEMA_CONFIG.tipoExperiencia;
  const acessoPublicoSemLogin =
    !isManagerProject && modoAcessoProjeto === "publico_sem_login";
  const onePagePublicaAtiva = acessoPublicoSemLogin && tipoExperiencia === "onepage";
  const exibirHomePublica = acessoPublicoSemLogin && !isAdminLoginRoute;

  const isPublicProfileRoute = useMemo(() => {
    if (isManagerProject) return false;
    if (isAdminLoginRoute) return false;
    return location.pathname.split("/").length >= 2 && location.pathname !== "/";
  }, [isManagerProject, isAdminLoginRoute, location.pathname]);

  const exibindoFluxoSistema =
    !isPublicProfileRoute && (exibirHomePublica || !user || skins.length !== 1);
  const temaSistemaEfetivo =
    isManagerProject &&
    (!configSistema.temaPadraoSistema || configSistema.temaPadraoSistema === "PADRAO_INICIAL")
      ? "ALY_137"
      : configSistema.temaPadraoSistema;

  useLayoutEffect(() => {
    if (!exibindoFluxoSistema) return;
    aplicarTemaNoBody(temaSistemaEfetivo);
  }, [exibindoFluxoSistema, temaSistemaEfetivo]);

  if (!authLoading && user && skinsLoading) {
    return <div className="loader">Carregando skins...</div>;
  }

  if (!authLoading && user && carregandoSetupAdmin) {
    return <div className="loader">Carregando configuracoes do sistema...</div>;
  }

  if (encerrandoSessaoGerenciador) {
    return <div className="loader">Validando acesso do administrador...</div>;
  }

  if (exibindoFluxoSistema && !configSistemaPronta) {
    return <div className="loader" aria-live="polite" />;
  }

  const logoLoginSrc = configSistema.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl;
  const tituloSistema = isManagerProject
    ? configSistema.tituloSistema || "GERENCIADO DE PROJETOS"
    : configSistema.tituloSistema || DEFAULT_SISTEMA_CONFIG.tituloSistema;
  const exibirTituloSistemaNoLogin = configSistema.exibirTituloSistemaNoLogin !== false;
  const textoLogin = configSistema.textoLogin || DEFAULT_SISTEMA_CONFIG.textoLogin;
  const loginComGoogleHabilitado =
    configSistema?.metodosLoginHabilitados?.google !== false;
  const loginComTwitterHabilitado =
    configSistema?.metodosLoginHabilitados?.twitter !== false;
  const loginComEmailSenhaHabilitado =
    configSistema?.metodosLoginHabilitados?.emailSenha !== false;
  const possuiMetodoLoginHabilitado =
    loginComGoogleHabilitado || loginComTwitterHabilitado || loginComEmailSenhaHabilitado;
  const uidAdminProjetoConfigurado = String(
    configSistema?.adminUid || localStorage.getItem("systemAdminUid") || ""
  ).trim();
  const emailAdminProjetoConfigurado = String(
    configSistema?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const emailUsuarioAtual = String(user?.email || "")
    .trim()
    .toLowerCase();
  const usuarioEhAdminProjeto = Boolean(
    user?.uid &&
      ((uidAdminProjetoConfigurado && user.uid === uidAdminProjetoConfigurado) ||
        (emailAdminProjetoConfigurado &&
          emailUsuarioAtual === emailAdminProjetoConfigurado) ||
        (!uidAdminProjetoConfigurado &&
          !emailAdminProjetoConfigurado &&
          seforAdm(user)))
  );
  const adminUidGerenciadorConfigurado = String(
    configSistema?.adminUid ||
      localStorage.getItem("systemAdminUid") ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID ||
      ""
  ).trim();
  const adminEmailGerenciadorConfigurado = String(
    configSistema?.adminEmail ||
      localStorage.getItem("systemAdminEmail") ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
      ""
  )
    .trim()
    .toLowerCase();
  const usuarioEhAdminGerenciador = Boolean(
    user?.uid &&
      ((adminUidGerenciadorConfigurado &&
        user.uid === adminUidGerenciadorConfigurado) ||
        (adminEmailGerenciadorConfigurado &&
          emailUsuarioAtual === adminEmailGerenciadorConfigurado) ||
        (!adminUidGerenciadorConfigurado &&
          !adminEmailGerenciadorConfigurado &&
          seforAdm(user)))
  );

  if (!authLoading && user && acessoPublicoSemLogin && isAdminLoginRoute) {
    if (onePagePublicaAtiva) {
      return <Navigate to="/" replace />;
    }
    if (usuarioEhAdminProjeto) {
      return <Navigate to="/menu/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <FirebaseProjectBadge />
      {mostrarSetupAdmin && !isPublicProfileRoute ? (
        <PropriedadesSistema
          modoBootstrap={setupAdminBootstrap}
          onConfigSalva={(configSalva) => {
            aplicarConfigSistemaLocal(configSalva);
            setSetupAdminBootstrap(false);
            setMostrarSetupAdmin(false);
          }}
        />
      ) : isPublicProfileRoute ? (
        <Estrutura />
      ) : (!user || exibirHomePublica) && !authLoading ? (
        onePagePublicaAtiva && !isAdminLoginRoute ? (
          <Estrutura />
        ) : acessoPublicoSemLogin && !isAdminLoginRoute ? (
          <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                <img src={logoLoginSrc} id="logoLogin" alt="Logo" />
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>
              <div
                id="divLogin"
                style={{
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <p id="textoLogin">Pagina publica ativa neste projeto.</p>
                <a
                  href="/login"
                  className="loginCadastroButton"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  ACESSO ADMIN
                </a>
              </div>
            </div>
            <p id="rodapeLogin">
              {`${tituloSistema}\u00A9`} <AnoAtualizado />
            </p>
          </div>
        ) : (
          <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
            <Navegacoes />
            {erroAcessoGerenciador ? (
              <p
                style={{
                  margin: "0 auto 12px auto",
                  maxWidth: 460,
                  textAlign: "center",
                }}
              >
                {erroAcessoGerenciador}
              </p>
            ) : null}
            <div id="iconsLogin">

              <div id="loginMain">
                <img src={logoLoginSrc} id="logoLogin" alt="Logo" />
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>

              {loginComEmailSenhaHabilitado ? <LoginCadastroEmail /> : null}
              <div id="divLogin">
                {possuiMetodoLoginHabilitado ? (
                  <div id="loginDivider" aria-hidden="true" />
                ) : null}
                <p id="textoLogin">{textoLogin}</p>
                {possuiMetodoLoginHabilitado ? (
                  
                  <div id="loginMetodos">
                    {loginComGoogleHabilitado || loginComTwitterHabilitado ? (
                      <div className="loginSocialButtons">
                        {loginComGoogleHabilitado ? <LoginGoogle /> : null}
                        {loginComTwitterHabilitado ? <LoginTwitter /> : null}
                      </div>
                    ) : null}
                    
                  </div>
                ) : (
                  <p id="loginSemMetodoAviso">Nenhum metodo de login habilitado.</p>
                )}
              </div>
            </div>
            <p id="rodapeLogin">
              {`${tituloSistema}\u00A9`} <AnoAtualizado />
            </p>
          </div>
        )
      ) : isManagerProject ? (
        usuarioEhAdminGerenciador ? (
          <Navigate to="/menu/gerenciador" replace />
        ) : (
          <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                <img src={logoLoginSrc} id="logoLogin" alt="Logo" />
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>
              <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                <p id="textoLogin">
                  {erroAcessoGerenciador || "Acesso permitido apenas para administradores."}
                </p>
                <button
                  className="loginCadastroButton"
                  type="button"
                  onClick={async () => {
                    try {
                      await signOut(auth);
                    } catch {
                      // Segue fluxo mesmo com erro de provider.
                    }
                  }}
                >
                  TROCAR CONTA
                </button>
              </div>
            </div>
            <p id="rodapeLogin">
              {`${tituloSistema}\u00A9`} <AnoAtualizado />
            </p>
          </div>
        )
      ) : skins.length === 1 ? (
        <Estrutura username={username} skins={skins} />
      ) : (
        <SkinsManager user={user} />
      )}
    </div>
  );
};

export { primeiroNomeCap, emailCap, picGoogleCap, fullnameCap };
export default App;
