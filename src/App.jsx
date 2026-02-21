import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs } from "firebase/firestore";

import { auth, db } from "./components/Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  estaConfigSistemaInicializada,
  obterConfigSistemaCacheLocal,
  obterConfigSistema,
} from "./components/Layout/Sistema/configSistema";
import PropriedadesSistema from "./components/Layout/Menu/PropriedadesSistema/PropriedadesSistema";

import SkinsManager from "./components/Layout/Skins/SkinsManager";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import LoginGoogle from "./components/Layout/Geral/LoginGoogle.jsx";
import LoginTwitter from "./components/Layout/Geral/LoginTwitter.jsx";
import LoginCadastroEmail from "./components/Layout/Geral/LoginCadastroEmail.jsx";
import FirebaseProjectBadge from "./components/Layout/Geral/FirebaseProjectBadge.jsx";
import Navegacoes from "./components/Scripts/navegacoes/Navegacoes.jsx";
import AnoAtualizado from "./components/Scripts/data/AnoAtualizado";

import "./App.css";

// Variaveis globais exportadas
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;

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
        console.error("Erro ao buscar skins:", error);
      } finally {
        setSkinsLoading(false);
      }
    };

    fetchSkins();
  }, [user]);

  useEffect(() => {
    let ativo = true;

    const resolverSetupAdmin = async () => {
      if (!user?.uid) {
        if (ativo) {
          setMostrarSetupAdmin(false);
          setSetupAdminBootstrap(false);
          setCarregandoSetupAdmin(false);
        }
        return;
      }

      setCarregandoSetupAdmin(true);

      try {
        const configInicializada = await estaConfigSistemaInicializada();
        if (!ativo) return;
        if (!configInicializada) {
          setMostrarSetupAdmin(true);
          setSetupAdminBootstrap(true);
          return;
        }

        setSetupAdminBootstrap(false);
        setMostrarSetupAdmin(false);
      } catch {
        if (!ativo) return;
        // Se Firestore ainda nao estiver inicializado, prioriza o onboarding
        // em Propriedades do Sistema para o admin.
        setMostrarSetupAdmin(true);
        setSetupAdminBootstrap(true);
      } finally {
        if (ativo) setCarregandoSetupAdmin(false);
      }
    };

    resolverSetupAdmin();

    return () => {
      ativo = false;
    };
  }, [user]);

  useEffect(() => {
    const timeout = setTimeout(() => setMostrarLogin(true), 1000);
    return () => clearTimeout(timeout);
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

  const isPublicProfileRoute = useMemo(() => {
    return location.pathname.split("/").length >= 2 && location.pathname !== "/";
  }, [location.pathname]);

  const exibindoFluxoSistema = !isPublicProfileRoute && (!user || skins.length !== 1);

  useLayoutEffect(() => {
    if (!exibindoFluxoSistema) return;
    aplicarTemaNoBody(configSistema.temaPadraoSistema);
  }, [exibindoFluxoSistema, configSistema.temaPadraoSistema]);

  if (!authLoading && user && skinsLoading) {
    return <div className="loader">Carregando skins...</div>;
  }

  if (!authLoading && user && carregandoSetupAdmin) {
    return <div className="loader">Carregando configuracoes do sistema...</div>;
  }

  if (exibindoFluxoSistema && !configSistemaPronta) {
    return <div className="loader">Carregando tema do sistema...</div>;
  }

  const logoLoginSrc = configSistema.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl;
  const tituloSistema = configSistema.tituloSistema || DEFAULT_SISTEMA_CONFIG.tituloSistema;
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
      ) : !user && !authLoading ? (
        <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
          <Navegacoes />
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
