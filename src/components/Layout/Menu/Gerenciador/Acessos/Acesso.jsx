import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";

import { activeFirebaseProjectId, activeFirebaseProjectKey } from "../../../../Banco/init-firebase";
import { buildSharedFunctionsUrl } from "../../../../Banco/sharedFunctionsApi";
import {
  lerGeoAcessoCache,
  obterGeoAcessoAtual,
  salvarGeoAcessoCache,
} from "../../../Sistema/acessoGeo";
import {
  usuarioCorrespondeOwnerConfigurado,
} from "../../../Sistema/configSistema";
import { seforAdm } from "../../../../Scripts/verificacoes/verificaAdm";

const UX_VISITOR_HASH_STORAGE_KEY = "uxVisitorHash";
const UX_DEDUPE_WINDOW_MS = 1500;
const RESERVED_ROOT_SEGMENTS = new Set([
  "",
  "__",
  "error",
  "gerenciador",
  "home",
  "login",
  "loginowner",
  "menu",
]);
const RESERVED_MENU_SEGMENTS = new Set([
  "",
  "acessos",
  "config",
  "contatos",
  "conversas",
  "formularios",
  "gerenciador",
  "owner",
  "perfil",
  "propriedades",
  "propriedadessistema",
  "propriedades-sistema",
  "skins",
  "solicitacoes",
  "users",
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function hashString(value = "") {
  const input = normalizeText(value) || `${Date.now()}_${Math.random()}`;
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `anon_${(hash >>> 0).toString(16)}`;
}

function getOrCreateVisitorHash() {
  if (typeof window === "undefined") return hashString("server");

  try {
    const stored = normalizeText(localStorage.getItem(UX_VISITOR_HASH_STORAGE_KEY));
    if (stored) return stored;

    const seed =
      (typeof window.crypto?.randomUUID === "function" && window.crypto.randomUUID()) ||
      `${Date.now()}_${Math.random()}_${window.location.hostname}`;
    const hash = hashString(seed);
    localStorage.setItem(UX_VISITOR_HASH_STORAGE_KEY, hash);
    return hash;
  } catch {
    return hashString(`${Date.now()}_${Math.random()}`);
  }
}

function resolvePersistentAccessHash(user = null) {
  const uid = normalizeText(user?.uid);
  if (uid) {
    return hashString(`auth:${uid}:${normalizeText(user?.email).toLowerCase()}`);
  }

  return getOrCreateVisitorHash();
}

function resolvePerfilAcesso({ user, configSistema }) {
  if (!user?.uid) return "visitante";

  if (
    usuarioCorrespondeOwnerConfigurado(configSistema, {
      uid: user.uid,
      email: user?.email,
    }) ||
    seforAdm(user)
  ) {
    return "owner";
  }

  return "usuario";
}

function resolveRouteSkinUsername(pathname = "") {
  const segments = normalizeText(pathname)
    .split("/")
    .map((segment) => normalizeText(segment))
    .filter(Boolean);

  if (!segments.length) return "";

  const first = segments[0].toLowerCase();
  if (!RESERVED_ROOT_SEGMENTS.has(first)) {
    return segments[0];
  }

  if (first === "menu" && segments.length > 1) {
    const second = segments[1].toLowerCase();
    if (!RESERVED_MENU_SEGMENTS.has(second)) {
      return segments[1];
    }
  }

  return "";
}

function resolveSkinContext(location) {
  const routeSkinUsername = resolveRouteSkinUsername(location?.pathname || "");
  const skinUsernameAtiva =
    routeSkinUsername ||
    normalizeText(localStorage.getItem("skinLogadoUser")) ||
    normalizeText(localStorage.getItem("targetUsername"));
  const skinIdAtiva = normalizeText(localStorage.getItem("skinIdAtual"));

  return {
    skinUsername: skinUsernameAtiva || null,
    skinId: skinIdAtiva || null,
    skinUsernameRota: routeSkinUsername || null,
  };
}

function buildAcessoPayload({ user, configSistema, location }) {
  const projectSystemKey = normalizeText(
    configSistema?.projectSystemKey ||
      localStorage.getItem("systemProjectContextKey") ||
      activeFirebaseProjectKey
  ).toLowerCase();
  const path = normalizeText(location?.pathname) || "/";
  const search = normalizeText(location?.search);
  const urlHash = normalizeText(location?.hash);
  const skinContext = resolveSkinContext(location);
  const accessHash = resolvePersistentAccessHash(user);
  const visitorHash = user?.uid ? null : accessHash;

  return {
    uid: normalizeText(user?.uid) || null,
    email: normalizeText(user?.email) || null,
    displayName: normalizeText(user?.displayName) || null,
    autenticado: Boolean(user?.uid),
    perfilAcesso: resolvePerfilAcesso({ user, configSistema }),
    hash: accessHash,
    visitorHash,

    projectSystemKey: projectSystemKey || null,
    projectNome:
      normalizeText(configSistema?.nomeProjeto || configSistema?.tituloSistema) || null,
    runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
    runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
    tipoExperiencia: normalizeText(configSistema?.tipoExperiencia) || null,
    modoAcessoProjeto: normalizeText(configSistema?.modoAcessoProjeto) || null,

    skinUsername: skinContext.skinUsername,
    skinId: skinContext.skinId,
    skinUsernameRota: skinContext.skinUsernameRota,

    hostname:
      typeof window !== "undefined" ? normalizeText(window.location.hostname).toLowerCase() : null,
    path,
    search,
    urlHash,
    fullPath: `${path}${search}${urlHash}`,
    userAgent:
      typeof window !== "undefined" ? normalizeText(window.navigator?.userAgent) || null : null,
  };
}

function buildGeoFallbackPayload(geo = null) {
  if (!geo || typeof geo !== "object") {
    return {};
  }

  return {
    country: normalizeText(geo.country) || null,
    region: normalizeText(geo.region) || null,
    city: normalizeText(geo.city || geo.cidade) || null,
    regionCode: normalizeText(geo.regionCode || geo.uf) || null,
    uf: normalizeText(geo.uf || geo.regionCode) || null,
    org: normalizeText(geo.org) || null,
    cep: normalizeText(geo.cep) || null,
    logradouro: normalizeText(geo.logradouro) || null,
    bairro: normalizeText(geo.bairro) || null,
    cidade: normalizeText(geo.cidade || geo.city) || null,
    latitude: Number.isFinite(Number(geo.latitude)) ? Number(geo.latitude) : null,
    longitude: Number.isFinite(Number(geo.longitude)) ? Number(geo.longitude) : null,
  };
}

function buildPageSessionId(basePayload, location) {
  return [
    basePayload.projectSystemKey || basePayload.runtimeProjectKey || "sem-projeto",
    basePayload.uid || basePayload.hash || "anon",
    normalizeText(location?.key) || "sem-key",
    basePayload.fullPath || "/",
    Date.now(),
  ].join("|");
}

function isDuplicateEvent(eventoKey = "") {
  if (!eventoKey || typeof window === "undefined") return false;

  try {
    const cacheKey = `ux:evento:${eventoKey}`;
    const previous = Number(sessionStorage.getItem(cacheKey) || 0);
    const now = Date.now();
    if (previous && now - previous < UX_DEDUPE_WINDOW_MS) {
      return true;
    }
    sessionStorage.setItem(cacheKey, String(now));
  } catch {
    return false;
  }

  return false;
}

function resolveInteractiveElement(target) {
  if (!(target instanceof Element)) return null;

  return target.closest(
    "button, a, [role='button'], input[type='button'], input[type='submit'], input[type='reset']"
  );
}

function summarizeElementText(element) {
  const ariaLabel = normalizeText(element?.getAttribute?.("aria-label"));
  const title = normalizeText(element?.getAttribute?.("title"));
  const innerText = normalizeText(element?.innerText || element?.textContent || element?.value);
  return ariaLabel || title || innerText || "";
}

function Acesso({ configSistema = {}, user = null }) {
  const location = useLocation();
  const registrarAcessoUrl = useMemo(
    () => buildSharedFunctionsUrl("registrarAcessoPublico"),
    []
  );
  const pageSessionRef = useRef(null);
  const geoRef = useRef(lerGeoAcessoCache());

  const reportarErro = useCallback((error) => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.warn("Falha ao registrar acesso no gerenciador:", error);
    }
  }, []);

  const enviarEvento = useCallback(
    (payload, { dedupeKey = "" } = {}) => {
      if (!registrarAcessoUrl || !payload) return;
      if (dedupeKey && isDuplicateEvent(dedupeKey)) return;

      const geoPayload = buildGeoFallbackPayload(geoRef.current);

      fetch(registrarAcessoUrl, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...geoPayload,
          ...payload,
        }),
        keepalive: true,
      })
        .then(async (response) => {
          if (!response.ok) return null;
          try {
            return await response.json();
          } catch {
            return null;
          }
        })
        .then((data) => {
          if (data?.geo) {
            const geoSalvo = salvarGeoAcessoCache(data.geo);
            if (geoSalvo) {
              geoRef.current = geoSalvo;
            }
          }
        })
        .catch(reportarErro);
    },
    [registrarAcessoUrl, reportarErro]
  );

  useEffect(() => {
    let ativo = true;

    const geoCache = lerGeoAcessoCache();
    if (geoCache) {
      geoRef.current = geoCache;
    }

    obterGeoAcessoAtual()
      .then((geoAtual) => {
        if (!ativo || !geoAtual) return;
        geoRef.current = geoAtual;
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, []);

  const registrarSaidaPagina = useCallback(
    (motivo = "route_change") => {
      const sessaoAtual = pageSessionRef.current;
      if (!sessaoAtual || sessaoAtual.leaveSent) return;

      sessaoAtual.leaveSent = true;

      enviarEvento(
        {
          ...sessaoAtual.basePayload,
          eventoTipo: "page_leave",
          eventoAcao: motivo,
          pageSessionId: sessaoAtual.pageSessionId,
          duracaoMs: Math.max(0, Date.now() - sessaoAtual.startedAt),
        },
        {
          dedupeKey: `leave|${sessaoAtual.pageSessionId}|${motivo}`,
        }
      );
    },
    [enviarEvento]
  );

  useEffect(() => {
    const basePayload = buildAcessoPayload({ user, configSistema, location });
    const fullPath = basePayload.fullPath || "/";
    const currentSignature = `${normalizeText(location?.key) || "sem-key"}|${fullPath}`;

    if (pageSessionRef.current && pageSessionRef.current.signature !== currentSignature) {
      registrarSaidaPagina("route_change");
    }

    if (pageSessionRef.current && pageSessionRef.current.signature === currentSignature) {
      return;
    }

    const pageSessionId = buildPageSessionId(basePayload, location);
    pageSessionRef.current = {
      signature: currentSignature,
      pageSessionId,
      startedAt: Date.now(),
      basePayload,
      leaveSent: false,
    };

    enviarEvento(
      {
        ...basePayload,
        eventoTipo: "page_view",
        pageSessionId,
      },
      {
        dedupeKey: `view|${basePayload.projectSystemKey || basePayload.runtimeProjectKey}|${
          basePayload.uid || basePayload.hash || "anon"
        }|${currentSignature}`,
      }
    );
  }, [
    location.pathname,
    location.search,
    location.hash,
    location.key,
    user?.uid,
    user?.email,
    user?.displayName,
    configSistema,
    enviarEvento,
    registrarSaidaPagina,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        registrarSaidaPagina("visibility_hidden");
      }
    };

    const handleBeforeUnload = () => {
      registrarSaidaPagina("before_unload");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [registrarSaidaPagina]);

  useEffect(() => {
    const handleClickCapture = (event) => {
      const element = resolveInteractiveElement(event.target);
      if (!element) return;

      const basePayload = buildAcessoPayload({ user, configSistema, location });
      const elementoTexto = summarizeElementText(element).slice(0, 180);
      const elementoId = normalizeText(element.id || element.getAttribute("name")).slice(0, 80);
      const elementoHref =
        element.tagName === "A" ? normalizeText(element.getAttribute("href")).slice(0, 180) : "";
      const pageSessionId = pageSessionRef.current?.pageSessionId || null;

      enviarEvento({
        ...basePayload,
        eventoTipo: "ui_click",
        eventoAcao: "click",
        pageSessionId,
        elementoTag: normalizeText(element.tagName).toLowerCase() || null,
        elementoId: elementoId || null,
        elementoTexto: elementoTexto || null,
        elementoHref: elementoHref || null,
      });
    };

    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [
    user?.uid,
    user?.email,
    user?.displayName,
    configSistema,
    location.pathname,
    location.search,
    location.hash,
    enviarEvento,
  ]);

  return null;
}

export default Acesso;
