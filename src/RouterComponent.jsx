import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useRoutesContext } from "./context/RoutesContext";
import { activeFirebaseProjectKey } from "./components/Banco/init-firebase";

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
import GerenciadorSistemas from "./components/Layout/Menu/Gerenciador/GerenciadorSistemas";

export default function RouterComponent() {
  const { routes } = useRoutesContext();
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";
  const menuChildren = isManagerProject
    ? [
        {
          path: "configuracoes-gerenciador",
          element: <PropriedadesSistema tituloSecao="CONFIGURACOES DO GERENCIADOR" />,
        },
        { path: "gerenciador-sistemas", element: <GerenciadorSistemas /> },
      ]
    : [
        { path: "contatos", element: <ListaContatos /> },
        { path: "contatos/:contactId", element: <ListaConversas /> },
        { path: "contatos/:contactId/chat/:conversationId", element: <Chat /> },
        { path: "users", element: <Users /> },
        { path: "skins", element: <SkinsManager /> },
        { path: "acessos", element: <ListaAcessos /> },
        { path: "propriedades", element: <Propriedades /> },
        { path: "propriedades-sistema", element: <PropriedadesSistema /> },
        { path: "espacos", element: <EspacoManager /> },
      ];

  const router = createBrowserRouter([
    {
      path: "/",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "menu/:userId",
      element: <Menu />,
      children: menuChildren,
    },
    ...(!isManagerProject
      ? [
          {
            path: ":skinsUsername",
            element: <Estrutura />,
            children: [{ path: ":espacoNome", element: <EspacoPage /> }, ...routes],
          },
        ]
      : []),
  ]);

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
