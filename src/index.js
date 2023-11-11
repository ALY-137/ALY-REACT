import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';

import {createBrowserRouter, RouterProvider} from 'react-router-dom';

import Home from "./routes/Home";
import Development from "./routes/Development";
import Design from "./routes/Design";
import Error from './routes/Error';


const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      errorElement: <Error />,
      children: 
      [
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
  
  ]
)

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />

  );