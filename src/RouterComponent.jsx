import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
  useParams,
} from "react-router-dom";
import { useRoutesContext } from "./context/RoutesContext";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarTemaNoBody,
  isManagerProjectRuntime,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
} from "./components/Layout/Sistema/configSistema";
import { isProjectInMaintenance } from "./components/Layout/Sistema/projectStatus";
import { normalizarTemaRegistrado } from "./components/Layout/Temas/themesRegistry";

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
import GerenciadorAddOns from "./components/Layout/Menu/Gerenciador/GerenciadorAddOns";
import SegurancaGerenciador from "./components/Layout/Menu/Gerenciador/SegurancaGerenciador";
import Auditoria from "./components/Layout/Menu/Gerenciador/Auditoria/Auditoria";
import SolicitacoesPixManual from "./components/Layout/Pagamentos/SolicitacoesPixManual";
import GerenciadorVendas from "./components/Layout/Vendas/GerenciadorVendas";
import Privacidade from "./components/Layout/Menu/Privacidade/Privacidade";
import CardRoutePage from "./components/Layout/Espacos/CardRoutePage";
import CardPrintRedirectPage from "./components/Layout/Espacos/CardPrintRedirectPage";
import TrackableLinkRedirectPage from "./components/Layout/Espacos/TrackableLinkRedirectPage";
import ProjectMaintenanceScreen from "./components/Layout/Geral/ProjectMaintenanceScreen";

function RedirectOneOwnerLegacyPath() {
  const { espacoNome } = useParams();
  return <Navigate to={`/${espacoNome || "home"}`} replace />;
}

function resolveProjectThemeId(configSistema = {}) {
  const tema = String(configSistema?.temaPadraoSistema || "").trim();
  if (!tema || tema === "PADRAO_INICIAL") return "CYBERPINK";
  return normalizarTemaRegistrado(tema);
}

function isLocalHostRuntime(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function ProjectMaintenanceRouteGate({ configSistema = {}, children }) {
  const location = useLocation();
  const themeId = resolveProjectThemeId(configSistema);
  const hostnameAtual =
    typeof window !== "undefined" ? String(window.location.hostname || "") : "";
  const bloqueadoPorManutencao =
    !isManagerProjectRuntime(configSistema) &&
    !isLocalHostRuntime(hostnameAtual) &&
    isProjectInMaintenance(configSistema);

  useEffect(() => {
    if (!bloqueadoPorManutencao) return;
    aplicarTemaNoBody(themeId);
  }, [bloqueadoPorManutencao, themeId, location.pathname]);

  if (bloqueadoPorManutencao) {
    return <ProjectMaintenanceScreen configSistema={configSistema} themeId={themeId} />;
  }

  return children;
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
  const protegerRotaPublica = (element) =>
    !isManagerProject ? (
      <ProjectMaintenanceRouteGate configSistema={configSistemaCache}>
        {element}
      </ProjectMaintenanceRouteGate>
    ) : (
      element
    );
  const menuChildren = isManagerProject
    ? [
        {
          path: "configuracoes-gerenciador",
          element: <Navigate to="../gerenciador-projetos" replace />,
        },
        { path: "users", element: <Users /> },
        { path: "acessos", element: <ListaAcessos modo="acessos" /> },
        { path: "rastreabilidade", element: <ListaAcessos modo="rastreabilidade" /> },
        { path: "auditoria", element: <Auditoria /> },
        { path: "gerenciador-icones", element: <GerenciadorIcones /> },
        { path: "gerenciador-addons", element: <Navigate to="../gerenciador-projetos" replace /> },
        { path: "gerenciador-projetos", element: <GerenciadorProjetos /> },
        { path: "seguranca-gerenciador", element: <SegurancaGerenciador /> },
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
        { path: "addons", element: <GerenciadorAddOns /> },
        { path: "vendas", element: <GerenciadorVendas /> },
        { path: "privacidade", element: <Privacidade /> },
      ];

  const estruturaRoutes = !isManagerProject
    ? oneOwnerPublicaAtiva
      ? [
          {
            path: ":espacoNome",
            element: protegerRotaPublica(<Estrutura />),
            children: [
              { path: "card/r/:printId", element: <CardPrintRedirectPage /> },
              { path: "card/:blocoId/:cardId", element: <CardRoutePage /> },
              { index: true, element: <EspacoPage /> },
              ...routes,
            ],
          },
          {
            path: ":skinsUsername/:espacoNome",
            element: protegerRotaPublica(<RedirectOneOwnerLegacyPath />),
          },
        ]
      : [
          {
            path: ":skinsUsername",
            element: protegerRotaPublica(<Estrutura />),
            children: [
              { path: ":espacoNome/card/r/:printId", element: <CardPrintRedirectPage /> },
              { path: ":espacoNome/card/:blocoId/:cardId", element: <CardRoutePage /> },
              { path: ":espacoNome", element: <EspacoPage /> },
              ...routes,
            ],
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
      path: "r/:trackingId",
      element: protegerRotaPublica(<TrackableLinkRedirectPage />),
      errorElement: <Error />,
    },
    {
      path: "menu/:userId",
      element: protegerRotaPublica(<Menu />),
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

