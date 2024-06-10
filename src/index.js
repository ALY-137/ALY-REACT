import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import Home from './components/Scripts/routes/Home';
import Development from "./components/Scripts/routes/Development";
import Design from "./components/Scripts/routes/Design";
import Error from './components/Scripts/routes/Error';

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
  }
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);
