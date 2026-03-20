import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { activeFirebaseProjectId, activeFirebaseProjectKey } from "../../../../Banco/init-firebase";
import {
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
} from "../../../Sistema/configSistema";
import { seforAdm } from "../../../../Scripts/verificacoes/verificaAdm";

function normalizeText(value) {
  return String(value || "").trim();
}

function getManagerFunctionsBaseUrl() {
  const projectId = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID);
  const region =
    normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_FUNCTIONS_REGION) || "us-central1";
  if (!projectId) return "";
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

function resolvePerfilAcesso({ user, configSistema }) {
  if (!user?.uid) return "visitante";

  const ownerUid = normalizeText(obterOwnerUidConfigurado(configSistema));
  const ownerEmail = normalizeText(obterOwnerEmailConfigurado(configSistema)).toLowerCase();
  const userEmail = normalizeText(user?.email).toLowerCase();

  if (
    (ownerUid && user.uid === ownerUid) ||
    (ownerEmail && userEmail === ownerEmail) ||
    seforAdm(user)
  ) {
    return "owner";
  }

  return "usuario";
}

function buildAcessoPayload({ user, configSistema, location }) {
  const projectSystemKey = normalizeText(
    configSistema?.projectSystemKey ||
      localStorage.getItem("systemProjectContextKey") ||
      activeFirebaseProjectKey
  ).toLowerCase();
  const path = normalizeText(location?.pathname) || "/";
  const search = normalizeText(location?.search);
  const hash = normalizeText(location?.hash);

  return {
    uid: normalizeText(user?.uid) || null,
    email: normalizeText(user?.email) || null,
    displayName: normalizeText(user?.displayName) || null,
    autenticado: Boolean(user?.uid),
    perfilAcesso: resolvePerfilAcesso({ user, configSistema }),
    projectSystemKey: projectSystemKey || null,
    projectNome:
      normalizeText(configSistema?.nomeProjeto || configSistema?.tituloSistema) || null,
    runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
    runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
    tipoExperiencia: normalizeText(configSistema?.tipoExperiencia) || null,
    modoAcessoProjeto: normalizeText(configSistema?.modoAcessoProjeto) || null,
    hostname:
      typeof window !== "undefined" ? normalizeText(window.location.hostname).toLowerCase() : null,
    path,
    search,
    hash,
    fullPath: `${path}${search}${hash}`,
    userAgent:
      typeof window !== "undefined" ? normalizeText(window.navigator?.userAgent) || null : null,
  };
}

function Acesso({ configSistema = {}, user = null }) {
  const location = useLocation();
  const managerBaseUrl = useMemo(() => getManagerFunctionsBaseUrl(), []);

  useEffect(() => {
    if (!managerBaseUrl) return;

    const payload = buildAcessoPayload({ user, configSistema, location });
    const dedupeKey = [
      payload.projectSystemKey || payload.runtimeProjectKey || "sem-projeto",
      payload.uid || "anon",
      payload.fullPath || "/",
    ].join("|");

    try {
      if (sessionStorage.getItem(`acesso:${dedupeKey}`) === "1") {
        return;
      }
      sessionStorage.setItem(`acesso:${dedupeKey}`, "1");
    } catch {
      // Continua mesmo sem sessionStorage.
    }

    fetch(`${managerBaseUrl}/registrarAcessoPublico`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.warn("Falha ao registrar acesso no gerenciador:", error);
    });
  }, [managerBaseUrl, user?.uid, user?.email, user?.displayName, location, configSistema]);

  return null;
}

export default Acesso;
