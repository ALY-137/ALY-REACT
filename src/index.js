import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { UserProvider } from "./context/UserContext";
import { RoutesProvider } from "./context/RoutesContext";
import RouterComponent from "./RouterComponent";
import { initializeFirebaseRuntime } from "./components/Banco/init-firebase";

const root = createRoot(document.getElementById("root"));

async function bootstrap() {
  await initializeFirebaseRuntime();

  root.render(
    <UserProvider>
      <RoutesProvider>
        <RouterComponent />
      </RoutesProvider>
    </UserProvider>
  );
}

bootstrap();
