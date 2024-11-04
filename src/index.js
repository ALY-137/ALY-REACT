import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import Home from './components/Scripts/routes/Home';
import Development from "./components/Scripts/routes/Development";
import Design from "./components/Scripts/routes/Design";
import Error from './components/Scripts/routes/Error';
import Menu from './components/Layout/Menu/Menu';
import ListaContatos from './components/Layout/Menu/Formularios/ListaContatos';
import ListaConversas from './components/Layout/Menu/Formularios/ListaConversas';
import Users from './components/Layout/Menu/Users/Users';
import Chat from './components/Layout/Menu/Formularios/Chat';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <Error />,
    children: [
      {
        path: "/", 
        element: <Home />
      },
      {
        path: "/home", 
        element: <Home />
      },
      {
        path: "/development",
        element: <Development />
      },
      {
        path: "/design",
        element: <Design />
      }
    ]
  },
  { 
    path: '/menu/:userId', // Adiciona userId aqui para escopo de menu
    element: <Menu />,
    children: [
      {
        path: "contatos", // Caminho para ListaContatos
        element: <ListaContatos />
      },
      {
        path: "contatos/:contactId", // Caminho para ListaConversas
        element: <ListaConversas />
      },
      {
        path: "contatos/:contactId/chat/:conversationId", // Caminho para Chat
        element: <Chat />
      },
      {
        path: "users", 
        element: <Users />
      }
    ]
  }
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);
