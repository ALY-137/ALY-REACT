import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";

import {
  activeFirebaseProjectKey,
  auth,
  db,
} from "./components/Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "./components/Banco/projectDataRefs";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  estaConfigSistemaInicializada,
  isManagerProjectRuntime,
  isOneOwnerComEntradaPublica,
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  obterConfigSistemaCacheLocal,
  obterConfigSistema,
  usuarioCorrespondeOwnerConfigurado,
} from "./components/Layout/Sistema/configSistema";
import PropriedadesSistema from "./components/Layout/Menu/Gerenciador/PropriedadesSistema/PropriedadesSistema";
import { bootstrapUser, espelharUsuarioNoGerenciador } from "./components/Banco/bootstrapUser";
import {
  exibirNotificacaoAdminLocal,
  registrarTokenPushAdmin,
} from "./components/Layout/Notificacoes/adminPush";

import SkinsManager from "./components/Layout/Skins/SkinsManager";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import LoginGoogle from "./components/Layout/Geral/LoginGoogle.jsx";
import LoginTwitter from "./components/Layout/Geral/LoginTwitter.jsx";
import LoginCadastroEmail from "./components/Layout/Geral/LoginCadastroEmail.jsx";
import FirebaseProjectBadge from "./components/Layout/Geral/FirebaseProjectBadge.jsx";
import LgpdConsentGate from "./components/Layout/Geral/LgpdConsentGate.jsx";
import ProjectMaintenanceScreen from "./components/Layout/Geral/ProjectMaintenanceScreen.jsx";
import Acesso from "./components/Layout/Menu/Gerenciador/Acessos/Acesso";
import RitualLoaderSymbol from "./components/Projects/LoginTransitions/RitualLoaderSymbol";
import RitualLoginTransition from "./components/Projects/LoginTransitions/RitualLoginTransition";
import SpriteSheetLoginTransition from "./components/Projects/LoginTransitions/SpriteSheetLoginTransition";
import Navegacoes from "./components/Scripts/navegacoes/Navegacoes.jsx";
import AnoAtualizado from "./components/Scripts/data/AnoAtualizado";
import { seforAdm } from "./components/Scripts/verificacoes/verificaAdm";
import {
  normalizarTemaRegistrado,
  temaSistemaUsaLoginRitual,
} from "./components/Layout/Temas/themesRegistry";
import { isProjectInMaintenance } from "./components/Layout/Sistema/projectStatus";
import { verificarAcessoGerenciador } from "./components/Layout/Sistema/gerenciadorSistemasApi";
import { isLgpdConsentRequired } from "./components/Layout/Sistema/lgpdConsentApi";
import { usePageEdgeHorizontalScroll } from "./hooks/useEdgeHorizontalScroll";

import "./App.css";
import "./components/Layout/Temas/system-base-login.css";

// Variaveis globais exportadas
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;
const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";
const LOGIN_REVEAL_DELAY_DEFAULT_MS = 1000;
const LOGIN_REVEAL_DELAY_RITUAL_MS = 6200;
const LOGIN_REVEAL_DELAY_SPRITE_MS = 1200;
const LOCAL_FIREBASE_QUERY_PARAM = "firebaseProject";
const LOCAL_PROJECT_SYSTEM_QUERY_PARAM = "projectSystemKey";

const isLocalHostRuntime = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const App = () => {
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
  const [gateSegurancaGerenciador, setGateSegurancaGerenciador] = useState({
    carregando: false,
    bloqueado: false,
    mensagem: "",
    ip: "",
  });
  const [erroResolucaoProjeto, setErroResolucaoProjeto] = useState("");
  const [splashEntradaPublicaConcluida, setSplashEntradaPublicaConcluida] = useState(false);
  const [lgpdConsentLiberado, setLgpdConsentLiberado] = useState(false);
  const snapshotSolicitacoesInicializadoRef = useRef(false);
  const solicitacoesVistasRef = useRef(new Set());

  const location = useLocation();
  const hostnameAtual =
    typeof window !== "undefined" ? String(window.location.hostname || "") : "";
  const isManagerProject = isManagerProjectRuntime(configSistema);


  const aplicarConfigSistemaLocal = (config) => {
    const projectSystemKey = String(config?.projectSystemKey || "").trim().toLowerCase();
    if (projectSystemKey) {
      try {
        localStorage.setItem("systemProjectContextKey", projectSystemKey);
      } catch {
        // Ignora indisponibilidade de storage local.
      }
    }
    setConfigSistema(config);
    setConfigSistemaPronta(true);
    aplicarBrandingNoDocumento(config);
    const ownerUidConfig = obterOwnerUidConfigurado(config);
    const ownerEmailConfig = obterOwnerEmailConfigurado(config);
    if (ownerUidConfig) {
      localStorage.setItem("systemOwnerUid", ownerUidConfig);
      localStorage.setItem("systemAdminUid", ownerUidConfig);
    } else {
      localStorage.removeItem("systemOwnerUid");
      localStorage.removeItem("systemAdminUid");
    }
    if (ownerEmailConfig) {
      localStorage.setItem("systemOwnerEmail", ownerEmailConfig);
      localStorage.setItem("systemAdminEmail", ownerEmailConfig);
    } else {
      localStorage.removeItem("systemOwnerEmail");
      localStorage.removeItem("systemAdminEmail");
    }
  };

  useEffect(() => {
    let ativo = true;

    const carregarConfigSistema = async () => {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setErroResolucaoProjeto("");
        aplicarConfigSistemaLocal(config);
      } catch (error) {
        if (!ativo) return;
        if (String(error?.code || "").trim().toLowerCase() === "project-domain-not-bound") {
          const hostnameAtual = typeof window !== "undefined" ? window.location.hostname || "" : "";
          setErroResolucaoProjeto(
            `O dominio '${hostnameAtual}' nao esta vinculado a nenhum projeto no gerenciador.`
          );
          return;
        }
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
    if (typeof window === "undefined") return;
    if (!configSistemaPronta || erroResolucaoProjeto) return;
    if (isManagerProject) return;

    const hostnameAtual = String(window.location.hostname || "").trim().toLowerCase();
    if (!isLocalHostRuntime(hostnameAtual)) return;

    const sharedRuntimeKey = String(
      process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_KEY || ""
    )
      .trim()
      .toLowerCase();
    const projectSystemKey =
      String(configSistema?.projectSystemKey || "")
        .trim()
        .toLowerCase() ||
      String(window.localStorage.getItem("systemProjectContextKey") || "")
        .trim()
        .toLowerCase();

    if (!sharedRuntimeKey || !projectSystemKey) return;
    if (activeFirebaseProjectKey === sharedRuntimeKey) return;

    const urlAtual = new URL(window.location.href);
    const explicitTarget = String(
      urlAtual.searchParams.get(LOCAL_FIREBASE_QUERY_PARAM) || ""
    )
      .trim()
      .toLowerCase();
    const explicitSystemKey = String(
      urlAtual.searchParams.get(LOCAL_PROJECT_SYSTEM_QUERY_PARAM) || ""
    )
      .trim()
      .toLowerCase();

    if (explicitTarget || explicitSystemKey) return;

    try {
      window.localStorage.setItem("firebaseProjectTarget", sharedRuntimeKey);
      window.localStorage.setItem("systemProjectContextKey", projectSystemKey);
    } catch {
      // Segue com redirect mesmo sem storage local.
    }

    urlAtual.searchParams.set(LOCAL_FIREBASE_QUERY_PARAM, sharedRuntimeKey);
    urlAtual.searchParams.set(LOCAL_PROJECT_SYSTEM_QUERY_PARAM, projectSystemKey);
    window.location.replace(`${urlAtual.pathname}${urlAtual.search}${urlAtual.hash}`);
  }, [
    configSistema,
    configSistemaPronta,
    erroResolucaoProjeto,
    isManagerProject,
  ]);

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
      if (firebaseUser?.uid && firebaseUser?.isAnonymous !== true) {
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
    if (erroResolucaoProjeto) return;
    if (!configSistemaPronta) return;
    if (!user?.uid) return;
    if (user?.isAnonymous === true) return;

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
  }, [
    isManagerProject,
    erroResolucaoProjeto,
    configSistemaPronta,
    user,
  ]);

  useEffect(() => {
    let ativo = true;

    const verificarGateGerenciador = async () => {
      if (!isManagerProject || !configSistemaPronta) {
        if (ativo) {
          setGateSegurancaGerenciador({
            carregando: false,
            bloqueado: false,
            mensagem: "",
            ip: "",
          });
        }
        return;
      }

      const hostname =
        typeof window !== "undefined" ? String(window.location.hostname || "") : "";
      if (isLocalHostRuntime(hostname)) {
        if (ativo) {
          setGateSegurancaGerenciador({
            carregando: false,
            bloqueado: false,
            mensagem: "",
            ip: "",
          });
        }
        return;
      }

      setGateSegurancaGerenciador((prev) => ({
        ...prev,
        carregando: true,
        mensagem: "",
      }));

      try {
        const resultado = await verificarAcessoGerenciador({
          hostname,
          path:
            typeof window !== "undefined"
              ? `${window.location.pathname || "/"}${window.location.search || ""}`
              : location.pathname || "/",
        });
        if (!ativo) return;

        setGateSegurancaGerenciador({
          carregando: false,
          bloqueado: resultado?.allowed === false,
          mensagem:
            resultado?.allowed === false
              ? "Acesso administrativo indisponivel para esta rede."
              : "",
          ip: resultado?.ip || "",
        });
      } catch (error) {
        if (!ativo) return;
        console.warn("Falha ao verificar seguranca do gerenciador:", error);
        setGateSegurancaGerenciador({
          carregando: false,
          bloqueado: true,
          mensagem:
            "Nao foi possivel validar a rede de acesso. Por seguranca, o gerenciador foi bloqueado.",
          ip: "",
        });
      }
    };

    void verificarGateGerenciador();

    return () => {
      ativo = false;
    };
  }, [isManagerProject, configSistemaPronta, location.pathname, location.search]);

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

      const ownerUidConfig = (
        obterOwnerUidConfigurado(configSistema) ||
        process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID ||
        ""
      ).trim();
      const ownerEmailConfig = String(
        obterOwnerEmailConfigurado(configSistema) ||
          process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
          ""
      )
        .trim()
        .toLowerCase();
      const userEmailAtual = String(user?.email || "")
        .trim()
        .toLowerCase();

      if (!ownerUidConfig) {
        if (!ativo) return;
        setErroAcessoGerenciador("");
        setEncerrandoSessaoGerenciador(false);
        return;
      }

      const usuarioEhOwnerGerenciador =
        (ownerUidConfig && user.uid === ownerUidConfig) ||
        (!ownerUidConfig && ownerEmailConfig && userEmailAtual === ownerEmailConfig) ||
        seforAdm(user);

      if (usuarioEhOwnerGerenciador) {
        if (!ativo) return;
        setErroAcessoGerenciador("");
        setEncerrandoSessaoGerenciador(false);
        return;
      }

      if (!ativo) return;
      setErroAcessoGerenciador("Acesso permitido apenas para owner.");
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
    configSistema?.ownerUid,
    user?.uid,
  ]);

  useEffect(() => {
    if (isManagerProject) {
      setSkins([]);
      setSkinsLoading(false);
      return;
    }
    if (erroResolucaoProjeto) {
      setSkins([]);
      setSkinsLoading(false);
      return;
    }
    if (!configSistemaPronta) return;

    const oneOwnerPublicaAtivaProjeto = isOneOwnerComEntradaPublica(configSistema);
    if (oneOwnerPublicaAtivaProjeto) {
      setSkins([]);
      setSkinsLoading(false);
      return;
    }

    if (!user?.uid || user?.isAnonymous === true) return;

    setSkinsLoading(true);

    const fetchSkins = async () => {
      try {
        const userRef = getPrimaryProjectDoc(db, "users", user.uid);
        const skinsCol = collection(userRef, "skins");
        const skinsSnapshot = await getDocs(skinsCol);
        const skinsList = skinsSnapshot.docs.map((docItem) => docItem.data());

        setSkins(skinsList);
        try {
          await espelharUsuarioNoGerenciador(user, {
            skinsResumo: skinsSnapshot.docs.map((docItem) => ({
              id: docItem.id,
              username: String(docItem.data()?.username || "").trim(),
              is_main: Boolean(docItem.data()?.is_main),
              theme: String(docItem.data()?.theme || "").trim(),
            })),
          });
        } catch (error) {
          console.warn("Falha ao atualizar skins do usuario no gerenciador:", error);
        }

        if (skinsList.length === 1) {
          const skin = skinsList[0];
          setUsername(skin.username);
          localStorage.setItem("targetUsername", skin.username);
          localStorage.setItem("skinLogadoUser", skin.username);
          localStorage.setItem(
            "selectedTheme",
            normalizarTemaRegistrado(skin.theme || "CYBERPINK")
          );
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
    erroResolucaoProjeto,
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

        const ownerUidConfig = obterOwnerUidConfigurado(configSistema);
        const possuiOwnerDefinido = Boolean(ownerUidConfig);

        if (!configInicializada || !possuiOwnerDefinido) {
          setSetupAdminBootstrap(true);
          setMostrarSetupAdmin(true);
          return;
        }

        setSetupAdminBootstrap(false);
        setMostrarSetupAdmin(false);
      } catch {
        if (!ativo) return;
        const ownerUidConfig = obterOwnerUidConfigurado(configSistema);
        if (!ownerUidConfig) {
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
    configSistema?.ownerUid,
  ]);

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
  const isAuthHandlerRoute = rotaAtual.startsWith("/__/auth/handler");
  const isUserLoginRoute = !isManagerProject && rotaAtual === "/login";
  const isAdminLoginRoute = !isManagerProject && rotaAtual === "/loginowner";
  const isLoginUiRoute = isUserLoginRoute || isAdminLoginRoute || isAuthHandlerRoute;
  usePageEdgeHorizontalScroll({
    enabled: !isAuthHandlerRoute,
  });

  const modoAcessoProjeto = configSistema?.modoAcessoProjeto || DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto;
  const tipoExperiencia = configSistema?.tipoExperiencia || DEFAULT_SISTEMA_CONFIG.tipoExperiencia;
  const oneOwnerPublicaAtiva =
    !isManagerProject &&
    isOneOwnerComEntradaPublica({
      tipoExperiencia,
      modoAcessoProjeto,
    });
  const exibirHomePublica = oneOwnerPublicaAtiva && !isLoginUiRoute;
  const rotaEntradaRaiz = location.pathname === "/";
  const precisaSplashEntradaPublica =
    !isLoginUiRoute && rotaEntradaRaiz && (oneOwnerPublicaAtiva || !configSistemaPronta);

  const isPublicProfileRoute = useMemo(() => {
    if (isManagerProject) return false;
    const path = String(location.pathname || "").toLowerCase();
    if (path === "/" || path === "/login" || path === "/loginowner") {
      return false;
    }
    if (path.startsWith("/menu")) return false;
    if (path.startsWith("/__/")) return false;
    return path.split("/").length >= 2;
  }, [isManagerProject, location.pathname]);

  useEffect(() => {
    setLgpdConsentLiberado(false);
  }, [
    user?.uid,
    configSistema?.projectSystemKey,
    configSistema?.termosUsoUrl,
    configSistema?.termosUsoVersao,
    configSistema?.politicaPrivacidadeUrl,
    configSistema?.politicaPrivacidadeVersao,
    configSistema?.exigirAceiteLgpdNoLogin,
    configSistema?.exigirAceiteTermosNoCadastro,
  ]);

  const handleLgpdConsentAccepted = useCallback(() => {
    setLgpdConsentLiberado(true);
  }, []);

  const exibindoFluxoSistema =
    !isPublicProfileRoute && (exibirHomePublica || !user || skins.length !== 1);
  const temaSistemaEfetivo =
    !configSistema.temaPadraoSistema || configSistema.temaPadraoSistema === "PADRAO_INICIAL"
      ? "CYBERPINK"
      : normalizarTemaRegistrado(configSistema.temaPadraoSistema);
  const exibirTelaManutencaoProjeto =
    !isManagerProject &&
    configSistemaPronta &&
    !isLocalHostRuntime(hostnameAtual) &&
    isProjectInMaintenance(configSistema);
  const loginLoadingMode = String(configSistema?.loginLoadingMode || "auto")
    .trim()
    .toLowerCase();
  const loginLoadingSpriteUrl = String(configSistema?.loginLoadingSpriteUrl || "").trim();
  const usarTransicaoSprite = Boolean(loginLoadingSpriteUrl);
  const usarTransicaoRitual =
    !usarTransicaoSprite &&
    (
      loginLoadingMode === "ritual" ||
      (loginLoadingMode === "auto" && temaSistemaUsaLoginRitual(temaSistemaEfetivo))
    );
  const loginRevealDelayMs = usarTransicaoSprite
    ? LOGIN_REVEAL_DELAY_SPRITE_MS
    : usarTransicaoRitual
      ? LOGIN_REVEAL_DELAY_RITUAL_MS
      : LOGIN_REVEAL_DELAY_DEFAULT_MS;

  const renderTelaCarregamento = () => {
    if (usarTransicaoSprite) {
      return (
        <div id="login" className="sprite-loader-transition-shell" aria-live="polite">
          <div className="sprite-loader-layer">
            <div
              className="loader-cherry"
              aria-hidden="true"
              style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
            />
          </div>
        </div>
      );
    }

    if (usarTransicaoRitual) {
      return (
        <div id="login" className="ritual-login-transition-shell" aria-live="polite">
          <div className="ritual-loader-layer">
            <RitualLoaderSymbol />
          </div>
        </div>
      );
    }

    return <div className="loader" aria-live="polite" />;
  };

  useEffect(() => {
    setMostrarLogin(false);
    const timeout = setTimeout(() => setMostrarLogin(true), loginRevealDelayMs);
    return () => clearTimeout(timeout);
  }, [loginRevealDelayMs]);

  useEffect(() => {
    if (!precisaSplashEntradaPublica) {
      if (!configSistemaPronta || authLoading || isAuthHandlerRoute) {
        setSplashEntradaPublicaConcluida(false);
      } else {
        setSplashEntradaPublicaConcluida(true);
      }
      return;
    }

    if (authLoading || !configSistemaPronta || isAuthHandlerRoute) {
      setSplashEntradaPublicaConcluida(false);
      return;
    }

    setSplashEntradaPublicaConcluida(false);
    const timeout = setTimeout(() => {
      setSplashEntradaPublicaConcluida(true);
    }, loginRevealDelayMs);

    return () => clearTimeout(timeout);
  }, [
    precisaSplashEntradaPublica,
    authLoading,
    configSistemaPronta,
    isAuthHandlerRoute,
    loginRevealDelayMs,
  ]);

  useLayoutEffect(() => {
    if (!exibindoFluxoSistema && !exibirTelaManutencaoProjeto) return;
    aplicarTemaNoBody(temaSistemaEfetivo);
  }, [exibindoFluxoSistema, exibirTelaManutencaoProjeto, temaSistemaEfetivo]);

  const logoLoginSrc = String(
    configSistema.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl || ""
  ).trim();
  const tituloSistema = isManagerProject
    ? configSistema.tituloSistema || "GERENCIADOR DE PROJETOS"
    : configSistema.tituloSistema || DEFAULT_SISTEMA_CONFIG.tituloSistema;
  const exibirTituloSistemaNoLogin = configSistema.exibirTituloSistemaNoLogin !== false;
  const exibirBadgeProjetoFirebase = configSistema.exibirBadgeProjetoFirebase !== false;
  const textoLogin = configSistema.textoLogin || DEFAULT_SISTEMA_CONFIG.textoLogin;
  const loginComGoogleHabilitado =
    configSistema?.metodosLoginHabilitados?.google !== false;
  const loginComTwitterHabilitado =
    configSistema?.metodosLoginHabilitados?.twitter !== false;
  const loginComEmailSenhaHabilitado =
    configSistema?.metodosLoginHabilitados?.emailSenha !== false;
  const possuiMetodoLoginHabilitado =
    loginComGoogleHabilitado || loginComTwitterHabilitado || loginComEmailSenhaHabilitado;
  const uidOwnerProjetoConfigurado = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const emailOwnerProjetoConfigurado = String(obterOwnerEmailConfigurado(configSistema) || "")
    .trim()
    .toLowerCase();
  const emailUsuarioAtual = String(user?.email || "")
    .trim()
    .toLowerCase();
  const usuarioEhOwnerProjeto = Boolean(
    user?.uid &&
      (usuarioCorrespondeOwnerConfigurado(configSistema, {
        uid: user.uid,
        email: user?.email,
      }) ||
        (!uidOwnerProjetoConfigurado &&
          !emailOwnerProjetoConfigurado &&
          seforAdm(user)))
  );
  const ownerUidGerenciadorConfigurado = String(
    obterOwnerUidConfigurado(configSistema) ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID ||
      ""
  ).trim();
  const ownerEmailGerenciadorConfigurado = String(
    obterOwnerEmailConfigurado(configSistema) ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
      ""
  )
    .trim()
    .toLowerCase();
  const usuarioEhOwnerGerenciador = Boolean(
    user?.uid &&
      ((ownerUidGerenciadorConfigurado &&
        user.uid === ownerUidGerenciadorConfigurado) ||
        (!ownerUidGerenciadorConfigurado &&
          ownerEmailGerenciadorConfigurado &&
          emailUsuarioAtual === ownerEmailGerenciadorConfigurado) ||
        (!ownerUidGerenciadorConfigurado &&
          !ownerEmailGerenciadorConfigurado &&
          seforAdm(user)))
  );

  useEffect(() => {
    if (isManagerProject) return;
    if (!usuarioEhOwnerProjeto) return;
    if (!user?.uid) return;

    registrarTokenPushAdmin().catch((err) => {
      console.warn(
        "[PUSH-ADMIN] Falha ao registrar token de notificacao:",
        err?.code || err?.message || err
      );
    });
  }, [isManagerProject, usuarioEhOwnerProjeto, user?.uid]);

  useEffect(() => {
    if (isManagerProject) return undefined;
    if (!usuarioEhOwnerProjeto) return undefined;

    const ownerUid = String(user?.uid || "").trim();
    if (!ownerUid) return undefined;

    // A colecao continua "pedidos" no Firestore por compatibilidade.
    const solicitacoesRef = getPrimaryProjectCollection(db, "users", ownerUid, "pedidos");
    const solicitacoesQuery = query(
      solicitacoesRef,
      where("status", "==", "pedido_solicitado")
    );

    const unsubscribe = onSnapshot(
      solicitacoesQuery,
      (snapshot) => {
        if (!snapshotSolicitacoesInicializadoRef.current) {
          snapshot.docs.forEach((docSnap) => solicitacoesVistasRef.current.add(docSnap.id));
          snapshotSolicitacoesInicializadoRef.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;

          const solicitacaoId = String(change.doc.id || "").trim();
          if (!solicitacaoId || solicitacoesVistasRef.current.has(solicitacaoId)) return;
          solicitacoesVistasRef.current.add(solicitacaoId);

          const data = change.doc.data() || {};
          const compradorNome =
            String(data?.compradorNome || "").trim() ||
            String(data?.compradorEmail || "").trim() ||
            String(data?.compradorUid || "").trim() ||
            "Usuario";
          const valorCentavos = Number(data?.precoCentavos);
          const valorTexto =
            Number.isFinite(valorCentavos) && valorCentavos > 0
              ? ` de R$ ${(valorCentavos / 100).toFixed(2).replace(".", ",")}`
              : "";
          const destino = `/menu/owner/solicitacoes?ownerUserId=${encodeURIComponent(ownerUid)}`;

          exibirNotificacaoAdminLocal({
            title: "Nova solicitacao de desbloqueio",
            body: `${compradorNome} solicitou desbloqueio${valorTexto}.`,
            link: destino,
          }).catch(() => {
            // Mantem fallback silencioso em navegadores que bloqueiam notificacao.
          });
        });
      },
      (err) => {
        console.warn(
          "[SOLICITACOES-ONSNAPSHOT] Falha ao observar solicitacoes:",
          err?.code || err?.message || err
        );
      }
    );

    return () => {
      unsubscribe();
      snapshotSolicitacoesInicializadoRef.current = false;
      solicitacoesVistasRef.current = new Set();
    };
  }, [isManagerProject, usuarioEhOwnerProjeto, user?.uid]);

  if (authLoading) {
    return renderTelaCarregamento();
  }

  if (user && skinsLoading) {
    return renderTelaCarregamento();
  }

  if (user && carregandoSetupAdmin) {
    return renderTelaCarregamento();
  }

  if (encerrandoSessaoGerenciador) {
    return renderTelaCarregamento();
  }

  if (isManagerProject && gateSegurancaGerenciador.carregando) {
    return renderTelaCarregamento();
  }

  if (isManagerProject && gateSegurancaGerenciador.bloqueado) {
    return (
      <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
        <div id="iconsLogin">
          <div id="loginMain">
            <p id="logoTxt">ACESSO INDISPONIVEL</p>
          </div>
          <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
            <p id="textoLogin">
              {gateSegurancaGerenciador.mensagem ||
                "Acesso administrativo indisponivel para esta rede."}
            </p>
            {gateSegurancaGerenciador.ip ? (
              <p id="rodapeLogin" style={{ marginTop: 12 }}>
                IP detectado: {gateSegurancaGerenciador.ip}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (erroResolucaoProjeto) {
    return (
      <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
        <div id="iconsLogin">
          <div id="loginMain">
            <p id="logoTxt">PROJETO NAO VINCULADO</p>
          </div>
          <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
            <p id="textoLogin">{erroResolucaoProjeto}</p>
            <p id="rodapeLogin" style={{ marginTop: 12 }}>
              Vincule este dominio em Gerenciador de Projetos -> Dominios autorizados do projeto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthHandlerRoute && !authLoading) {
    return <Navigate to={oneOwnerPublicaAtiva ? "/login" : "/"} replace />;
  }

  if (exibindoFluxoSistema && !configSistemaPronta && !isAuthHandlerRoute) {
    return renderTelaCarregamento();
  }

  if (exibirTelaManutencaoProjeto) {
    return (
      <div>
        <Acesso configSistema={configSistema} user={user} />
        {exibirBadgeProjetoFirebase ? <FirebaseProjectBadge /> : null}
        <ProjectMaintenanceScreen
          configSistema={configSistema}
          themeId={temaSistemaEfetivo}
        />
      </div>
    );
  }

  if (precisaSplashEntradaPublica && !splashEntradaPublicaConcluida) {
    return renderTelaCarregamento();
  }

  const rotaPrivadaOuLoginLgpd =
    isLoginUiRoute || rotaEntradaRaiz || String(location.pathname || "").startsWith("/menu");
  if (
    !authLoading &&
    user?.uid &&
    user?.isAnonymous !== true &&
    !isManagerProject &&
    configSistemaPronta &&
    !isAuthHandlerRoute &&
    rotaPrivadaOuLoginLgpd &&
    isLgpdConsentRequired(configSistema) &&
    !lgpdConsentLiberado
  ) {
    return (
      <LgpdConsentGate
        user={user}
        configSistema={configSistema}
        onAccepted={handleLgpdConsentAccepted}
      />
    );
  }

  if (!authLoading && user && oneOwnerPublicaAtiva && isUserLoginRoute) {
    return <Navigate to="/home" replace />;
  }

  if (!authLoading && user && oneOwnerPublicaAtiva && isAdminLoginRoute && usuarioEhOwnerProjeto) {
    return <Navigate to="/home" replace />;
  }

  const exibirBloqueioAdminOnePage =
    !authLoading &&
    user &&
    oneOwnerPublicaAtiva &&
    isAdminLoginRoute &&
    !usuarioEhOwnerProjeto;

  return (
    <div>
      <Acesso configSistema={configSistema} user={user} />
      {exibirBadgeProjetoFirebase ? <FirebaseProjectBadge /> : null}
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
      ) : exibirBloqueioAdminOnePage ? (
        usarTransicaoSprite ? (
          <SpriteSheetLoginTransition
            mostrarLogin={mostrarLogin}
            spriteUrl={loginLoadingSpriteUrl}
          >
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>
              <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                <p id="textoLogin">Acesso permitido apenas para owner.</p>
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
          </SpriteSheetLoginTransition>
        ) : usarTransicaoRitual ? (
          <RitualLoginTransition mostrarLogin={mostrarLogin}>
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>
              <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                <p id="textoLogin">Acesso permitido apenas para owner.</p>
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
          </RitualLoginTransition>
        ) : (
          <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
              </div>
              <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                <p id="textoLogin">Acesso permitido apenas para owner.</p>
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
      ) : (!user || exibirHomePublica) && !authLoading ? (
        oneOwnerPublicaAtiva && !isLoginUiRoute ? (
          <Estrutura />
        ) : oneOwnerPublicaAtiva && !isLoginUiRoute ? (
          <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
            <Navegacoes />
            <div id="iconsLogin">
              <div id="loginMain">
                {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
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
              </div>
            </div>
            <p id="rodapeLogin">
              {`${tituloSistema}\u00A9`} <AnoAtualizado />
            </p>
          </div>
        ) : (
          usarTransicaoSprite ? (
            <SpriteSheetLoginTransition
              mostrarLogin={mostrarLogin}
              spriteUrl={loginLoadingSpriteUrl}
            >
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
              ) : isAdminLoginRoute && !usuarioEhOwnerProjeto && user ? (
                <p
                  style={{
                    margin: "0 auto 12px auto",
                    maxWidth: 460,
                    textAlign: "center",
                  }}
                >
                  Acesso permitido apenas para owner.
                </p>
              ) : null}
              <div id="iconsLogin">

                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>

                {loginComEmailSenhaHabilitado ? (
                  <LoginCadastroEmail configSistema={configSistema} />
                ) : null}
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
            </SpriteSheetLoginTransition>
          ) : usarTransicaoRitual ? (
            <RitualLoginTransition mostrarLogin={mostrarLogin}>
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
              ) : isAdminLoginRoute && !usuarioEhOwnerProjeto && user ? (
                <p
                  style={{
                    margin: "0 auto 12px auto",
                    maxWidth: 460,
                    textAlign: "center",
                  }}
                >
                  Acesso permitido apenas para owner.
                </p>
              ) : null}
              <div id="iconsLogin">

                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>

                {loginComEmailSenhaHabilitado ? (
                  <LoginCadastroEmail configSistema={configSistema} />
                ) : null}
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
            </RitualLoginTransition>
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
              ) : isAdminLoginRoute && !usuarioEhOwnerProjeto && user ? (
                <p
                  style={{
                    margin: "0 auto 12px auto",
                    maxWidth: 460,
                    textAlign: "center",
                  }}
                >
                  Acesso permitido apenas para owner.
                </p>
              ) : null}
              <div id="iconsLogin">

                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>

                {loginComEmailSenhaHabilitado ? (
                  <LoginCadastroEmail configSistema={configSistema} />
                ) : null}
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
        )
      ) : isManagerProject ? (
        usuarioEhOwnerGerenciador ? (
          <Navigate to="/menu/gerenciador" replace />
        ) : (
          usarTransicaoSprite ? (
            <SpriteSheetLoginTransition
              mostrarLogin={mostrarLogin}
              spriteUrl={loginLoadingSpriteUrl}
            >
              <Navegacoes />
              <div id="iconsLogin">
                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>
                <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                  <p id="textoLogin">
                    {erroAcessoGerenciador || "Acesso permitido apenas para owner."}
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
            </SpriteSheetLoginTransition>
          ) : usarTransicaoRitual ? (
            <RitualLoginTransition mostrarLogin={mostrarLogin}>
              <Navegacoes />
              <div id="iconsLogin">
                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>
                <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                  <p id="textoLogin">
                    {erroAcessoGerenciador || "Acesso permitido apenas para owner."}
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
            </RitualLoginTransition>
          ) : (
            <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
              <Navegacoes />
              <div id="iconsLogin">
                <div id="loginMain">
                  {logoLoginSrc ? <img src={logoLoginSrc} id="logoLogin" alt="Logo" /> : null}
                  {exibirTituloSistemaNoLogin ? <p id="logoTxt">{tituloSistema}</p> : null}
                </div>
                <div id="divLogin" style={{ justifyContent: "center", gap: 10 }}>
                  <p id="textoLogin">
                    {erroAcessoGerenciador || "Acesso permitido apenas para owner."}
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
