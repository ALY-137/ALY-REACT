import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { useRoutesContext } from "./context/RoutesContext";
import {
  DEFAULT_SISTEMA_CONFIG,
  isManagerProjectRuntime,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
} from "./components/Layout/Sistema/configSistema";

import App from "./App";
import Error from "./components/Scripts/routes/Error";
import Menu from "./components/Layout/Menu/Menu";
import ListaContatos from "./components/Layout/Menu/Formularios/ListaContatos";
import ListaConversas from "./components/Layout/Menu/Formularios/ListaConversas";
import Chat from "./components/Layout/Menu/Formularios/Chat";
import Users from "./components/Layout/Menu/Gerenciador/Users/Users";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import SkinsManager from "./components/Layout/Skins/SkinsManager";
import ListaAcessos from "./components/Layout/Menu/Gerenciador/Acessos/ListaAcessos";
import Propriedades from "./components/Layout/Menu/Propriedades/Propriedades";
import EspacoManager from "./components/Layout/Espacos/EspacoManager";
import EspacoPage from "./components/Layout/Espacos/EspacoPage";
import PropriedadesSistema from "./components/Layout/Menu/Gerenciador/PropriedadesSistema/PropriedadesSistema";
import GerenciadorProjetos from "./components/Layout/Menu/Gerenciador/GerenciadorProjetos";
import GerenciadorIcones from "./components/Layout/Menu/Gerenciador/GerenciadorIcones";
import SolicitacoesPixManual from "./components/Layout/Pagamentos/SolicitacoesPixManual";

function RedirectOneOwnerLegacyPath() {
  const { espacoNome } = useParams();
  return <Navigate to={`/${espacoNome || "home"}`} replace />;
}

export default function RouterComponent() {
  const { routes } = useRoutesContext();
  const configCacheInicial = obterConfigSistemaCacheLocal();
  const [configSistemaCache, setConfigSistemaCache] = useState(
    () => configCacheInicial || DEFAULT_SISTEMA_CONFIG
  );
  const [configSistemaHidratada, setConfigSistemaHidratada] = useState(
    () => Boolean(configCacheInicial)
  );
  const isManagerProject = isManagerProjectRuntime(configSistemaCache);

  useEffect(() => {
    let ativo = true;

    const syncConfig = () => {
      const cache = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
      setConfigSistemaCache(cache);
      setConfigSistemaHidratada(true);
    };

    syncConfig();
    obterConfigSistema()
      .then((config) => {
        if (!ativo || !config) return;
        setConfigSistemaCache(config);
        setConfigSistemaHidratada(true);
      })
      .catch(() => {
        if (!ativo) return;
        setConfigSistemaHidratada(true);
      });

    window.addEventListener("sistema-config-atualizada", syncConfig);
    return () => {
      ativo = false;
      window.removeEventListener("sistema-config-atualizada", syncConfig);
    };
  }, []);

  if (!isManagerProject && !configSistemaHidratada) {
    return <div className="loader" aria-live="polite" />;
  }

  const oneOwnerPublicaAtiva =
    !isManagerProject && isOneOwnerComEntradaPublica(configSistemaCache);
  const menuChildren = isManagerProject
    ? [
        {
          path: "configuracoes-gerenciador",
          element: <PropriedadesSistema tituloSecao="CONFIGURACOES DO GERENCIADOR" />,
        },
        { path: "users", element: <Users /> },
        { path: "acessos", element: <ListaAcessos /> },
        { path: "gerenciador-icones", element: <GerenciadorIcones /> },
        { path: "gerenciador-projetos", element: <GerenciadorProjetos /> },
      ]
    : [
        { path: "contatos", element: <ListaContatos /> },
        { path: "contatos/:contactId", element: <ListaConversas /> },
        { path: "contatos/:contactId/chat/:conversationId", element: <Chat /> },
        { path: "skins", element: <SkinsManager /> },
        { path: "propriedades", element: <Propriedades /> },
        { path: "solicitacoes", element: <SolicitacoesPixManual /> },
        { path: "pedidos", element: <Navigate to="../solicitacoes" replace /> },
        { path: "propriedades-sistema", element: <PropriedadesSistema /> },
        { path: "espacos", element: <EspacoManager /> },
      ];

  const estruturaRoutes = !isManagerProject
    ? oneOwnerPublicaAtiva
      ? [
          {
            path: ":espacoNome",
            element: <Estrutura />,
            children: [{ index: true, element: <EspacoPage /> }, ...routes],
          },
          {
            path: ":skinsUsername/:espacoNome",
            element: <RedirectOneOwnerLegacyPath />,
          },
        ]
      : [
          {
            path: ":skinsUsername",
            element: <Estrutura />,
            children: [{ path: ":espacoNome", element: <EspacoPage /> }, ...routes],
          },
        ]
    : [];

  const router = createBrowserRouter([
    {
      path: "/",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "/__/auth/handler",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "/__/auth/*",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "/login",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "/loginadmin",
      element: <Navigate to="/loginowner" replace />,
      errorElement: <Error />,
    },
    {
      path: "/loginowner",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "menu/:userId",
      element: <Menu />,
      children: menuChildren,
    },
    {
      path: "menu",
      element: <Navigate to="/" replace />,
    },
    ...estruturaRoutes,
  ]);

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

