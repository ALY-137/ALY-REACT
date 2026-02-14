import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { UserProvider } from "./context/UserContext";
import { RoutesProvider } from "./context/RoutesContext";
import RouterComponent from "./RouterComponent";

createRoot(document.getElementById("root")).render(
  <UserProvider>
    <RoutesProvider>
      <RouterComponent />
    </RoutesProvider>
  </UserProvider>
);
