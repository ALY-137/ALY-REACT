// index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { RoutesProvider, useRoutesContext } from './context/RoutesContext';

import App from './App';
import Error from './components/Scripts/routes/Error';
import Menu from './components/Layout/Menu/Menu';
import ListaContatos from './components/Layout/Menu/Formularios/ListaContatos';
import ListaConversas from './components/Layout/Menu/Formularios/ListaConversas';
import Users from './components/Layout/Menu/Users/Users';
import Chat from './components/Layout/Menu/Formularios/Chat';
import Estrutura from './components/Layout/Espacos/Estrutura';
import SkinsManager from './components/Layout/Skins/SkinsManager';
import Navbar from './components/Layout/Navbar/Navbar';
import ListaAcessos from './components/Scripts/acesso/ListaAcessos';
import Propriedades from './components/Layout/Menu/Propriedades/Propriedades';
import EspacoManager from './components/Layout/Espacos/EspacoManager';

const RouterComponent = () => {
  const { routes } = useRoutesContext();

  const router = createBrowserRouter([
    {
      path: "/",
      element: <App />,
      errorElement: <Error />,
    },
    {
      path: "menu/:userId",
      element: <Menu />,
      children: [
        { path: "contatos", element: <ListaContatos /> },
        { path: "contatos/:contactId", element: <ListaConversas /> },
        { path: "contatos/:contactId/chat/:conversationId", element: <Chat /> },
        { path: "users", element: <Users /> },
        { path: "skins", element: <SkinsManager /> },
        { path: "acessos", element: <ListaAcessos /> },
        { path: "propriedades", element: <Propriedades /> },
        { path: "espacos", element:  <EspacoManager />},
      ],
    },
    {
      path: ":skinsUsername/*", // Adicionado /* para capturar todas as sub-rotas
      element: <Estrutura />,
      children: routes,
    },
  ]);

  return (
    <> 

      <RouterProvider router={router}>    
      <Navbar /> 
      </RouterProvider>
    </>

  );
};

createRoot(document.getElementById("root")).render(
  <UserProvider>
    <RoutesProvider>     
      <RouterComponent />
    </RoutesProvider>
  </UserProvider>
);
