import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { UserProvider } from './context/UserContext'; // ✅ Importando o UserProvider

import App from './App';
import Error from './components/Scripts/routes/Error';
import Menu from './components/Layout/Menu/Menu';
import ListaContatos from './components/Layout/Menu/Formularios/ListaContatos';
import ListaConversas from './components/Layout/Menu/Formularios/ListaConversas';
import Users from './components/Layout/Menu/Users/Users';
import Chat from './components/Layout/Menu/Formularios/Chat';
import Estrutura from './components/Layout/Paginas/Estrutura';
import SkinsManager from './components/Layout/Skins/SkinsManager';
import Development from './components/Scripts/routes/Development';
import Home from './components/Scripts/routes/Home';
import Design from './components/Scripts/routes/Design';


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
    ],
  },
  {
    path: ":skinsUsername",
    element: <Estrutura />, //  Página principal
    children: [
      { path: "development", element: <Development /> },
      { path: "home", element: <Home /> },
      { path: "design", element: <Design /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <UserProvider> {/*  Agora o UserProvider engloba o RouterProvider */}
    <RouterProvider router={router} />
  </UserProvider>
);
