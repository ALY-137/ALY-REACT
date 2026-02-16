import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs } from "firebase/firestore";

import { auth, db } from "./components/Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarTemaNoBody,
  obterConfigSistema,
} from "./components/Layout/Sistema/configSistema";

import SkinsManager from "./components/Layout/Skins/SkinsManager";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import LoginGoogle from "./components/Layout/Geral/LoginGoogle.jsx";
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
  const [configSistema, setConfigSistema] = useState(DEFAULT_SISTEMA_CONFIG);

  const location = useLocation();

  useEffect(() => {
    let ativo = true;

    const carregarConfigSistema = async () => {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistema(config);
      } catch (error) {
        // Se falhar, segue com defaults locais.
      }
    };

    carregarConfigSistema();

    return () => {
      ativo = false;
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
        await user.getIdToken();
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
    const timeout = setTimeout(() => setMostrarLogin(true), 1000);
    return () => clearTimeout(timeout);
  }, []);

  const isPublicProfileRoute = useMemo(() => {
    return location.pathname.split("/").length >= 2 && location.pathname !== "/";
  }, [location.pathname]);

  const exibindoFluxoSistema = !isPublicProfileRoute && (!user || skins.length !== 1);

  useEffect(() => {
    if (!exibindoFluxoSistema) return;
    aplicarTemaNoBody(configSistema.temaPadraoSistema);
  }, [exibindoFluxoSistema, configSistema.temaPadraoSistema]);

  if (!authLoading && user && skinsLoading) {
    return <div className="loader">Carregando skins...</div>;
  }

  const logoLoginSrc = configSistema.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl;

  return (
    <div>
      {isPublicProfileRoute ? (
        <Estrutura />
      ) : !user && !authLoading ? (
        <div id="login" className={`containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
          <Navegacoes />
          <div id="iconsLogin">
            <img src={logoLoginSrc} id="logoLogin" alt="Logo" />
            <p id="logoTxt">ALY-137</p>
            <p id="textoLogin">EMBARQUE COM O GOOGLE</p>
            <LoginGoogle />
          </div>
          <p id="rodapeLogin">
            ALY-137&#169; <AnoAtualizado />
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
