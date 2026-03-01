import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { useRoutesContext } from "./context/RoutesContext";
import { activeFirebaseProjectKey } from "./components/Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "./components/Layout/Sistema/configSistema";

import App from "./App";
import Error from "./components/Scripts/routes/Error";
import Menu from "./components/Layout/Menu/Menu";
import ListaContatos from "./components/Layout/Menu/Formularios/ListaContatos";
import ListaConversas from "./components/Layout/Menu/Formularios/ListaConversas";
import Chat from "./components/Layout/Menu/Formularios/Chat";
import Users from "./components/Layout/Menu/Users/Users";
import Estrutura from "./components/Layout/Espacos/Estrutura";
import SkinsManager from "./components/Layout/Skins/SkinsManager";
import ListaAcessos from "./components/Scripts/acesso/ListaAcessos";
import Propriedades from "./components/Layout/Menu/Propriedades/Propriedades";
import EspacoManager from "./components/Layout/Espacos/EspacoManager";
import EspacoPage from "./components/Layout/Espacos/EspacoPage";
import PropriedadesSistema from "./components/Layout/Menu/PropriedadesSistema/PropriedadesSistema";
import GerenciadorProjetos from "./components/Layout/Menu/Gerenciador/GerenciadorProjetos";
import GerenciarLayouts from "./components/Layout/Menu/Layouts/GerenciarLayouts";
import SolicitacoesPixManual from "./components/Layout/Pagamentos/SolicitacoesPixManual";

function RedirectOnePageLegacyPath() {
  const { espacoNome } = useParams();
  return <Navigate to={`/${espacoNome || "home"}`} replace />;
}

export default function RouterComponent() {
  const { routes } = useRoutesContext();
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";
  const [configSistemaCache, setConfigSistemaCache] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );

  useEffect(() => {
    const syncConfig = () => {
      const cache = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
      setConfigSistemaCache(cache);
    };

    syncConfig();
    window.addEventListener("sistema-config-atualizada", syncConfig);
    return () => {
      window.removeEventListener("sistema-config-atualizada", syncConfig);
    };
  }, []);

  const onePagePublicaAtiva =
    !isManagerProject &&
    configSistemaCache?.tipoExperiencia === "onepage" &&
    configSistemaCache?.modoAcessoProjeto === "publico_sem_login";
  const menuChildren = isManagerProject
    ? [
        {
          path: "configuracoes-gerenciador",
          element: <PropriedadesSistema tituloSecao="CONFIGURACOES DO GERENCIADOR" />,
        },
        { path: "gerenciar-layouts", element: <GerenciarLayouts /> },
        { path: "gerenciador-projetos", element: <GerenciadorProjetos /> },
      ]
    : [
        { path: "contatos", element: <ListaContatos /> },
        { path: "contatos/:contactId", element: <ListaConversas /> },
        { path: "contatos/:contactId/chat/:conversationId", element: <Chat /> },
        { path: "users", element: <Users /> },
        { path: "skins", element: <SkinsManager /> },
        { path: "acessos", element: <ListaAcessos /> },
        { path: "propriedades", element: <Propriedades /> },
        { path: "solicitacoes", element: <SolicitacoesPixManual /> },
        { path: "pedidos", element: <Navigate to="../solicitacoes" replace /> },
        { path: "propriedades-sistema", element: <PropriedadesSistema /> },
        { path: "espacos", element: <EspacoManager /> },
      ];

  const estruturaRoutes = !isManagerProject
    ? onePagePublicaAtiva
      ? [
          {
            path: ":espacoNome",
            element: <Estrutura />,
            children: [{ index: true, element: <EspacoPage /> }, ...routes],
          },
          {
            path: ":skinsUsername/:espacoNome",
            element: <RedirectOnePageLegacyPath />,
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
