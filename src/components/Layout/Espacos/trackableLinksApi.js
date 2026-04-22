import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  auth,
  db,
} from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { obterGeoAcessoAtual } from "../Sistema/acessoGeo";

const NAVIGATION_ID_STORAGE_KEY = "navegacaoHash";
const LEGACY_VISITOR_ID_STORAGE_KEY = "uxVisitorHash";
const TRACKING_CONTEXT_STORAGE_KEY = "alyTrackingContext";
const TRACKABLE_ACCESS_DEDUPE_MS = 2500;

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeNavigationId(value = "") {
  const navigationId = normalizeText(value);
  if (!navigationId) return "";
  return navigationId.startsWith("anon_") ? `nav_${navigationId.slice(5)}` : navigationId;
}

function buildNavigationId(value = "") {
  const input = normalizeText(value) || `${Date.now()}_${Math.random()}`;
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `nav_${(hash >>> 0).toString(16)}`;
}

function getOrCreateNavigationId() {
  if (typeof window === "undefined") return buildNavigationId("server");

  try {
    const navigationId = normalizeNavigationId(
      window.localStorage.getItem(NAVIGATION_ID_STORAGE_KEY)
    );
    if (navigationId) {
      window.localStorage.setItem(NAVIGATION_ID_STORAGE_KEY, navigationId);
      window.localStorage.setItem(LEGACY_VISITOR_ID_STORAGE_KEY, navigationId);
      return navigationId;
    }

    const legacyNavigationId = normalizeNavigationId(
      window.localStorage.getItem(LEGACY_VISITOR_ID_STORAGE_KEY)
    );
    if (legacyNavigationId) {
      window.localStorage.setItem(NAVIGATION_ID_STORAGE_KEY, legacyNavigationId);
      window.localStorage.setItem(LEGACY_VISITOR_ID_STORAGE_KEY, legacyNavigationId);
      return legacyNavigationId;
    }

    const seed =
      (typeof window.crypto?.randomUUID === "function" && window.crypto.randomUUID()) ||
      `${Date.now()}_${Math.random()}_${window.location.hostname}`;
    const navigationIdFromSeed = buildNavigationId(seed);
    window.localStorage.setItem(NAVIGATION_ID_STORAGE_KEY, navigationIdFromSeed);
    window.localStorage.setItem(LEGACY_VISITOR_ID_STORAGE_KEY, navigationIdFromSeed);
    return navigationIdFromSeed;
  } catch {
    return buildNavigationId(`${Date.now()}_${Math.random()}`);
  }
}

function createFirestoreId(collectionName = "_trackableLinkIds") {
  try {
    return doc(collection(db, collectionName)).id;
  } catch {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function cleanPayload(payload = {}) {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function getTimestampMs(value = null) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function encodeRouteSegment(value = "") {
  return encodeURIComponent(normalizeText(value));
}

function buildAbsoluteUrl(route = "") {
  const normalizedRoute = normalizeText(route);
  if (!normalizedRoute) return "";
  try {
    return new URL(normalizedRoute, window.location.origin).href;
  } catch {
    return normalizedRoute;
  }
}

function buildSpaceKey(ownerUserId = "", espacoId = "") {
  return [normalizeText(ownerUserId), normalizeText(espacoId)].join("|");
}

function buildClientContext() {
  if (typeof window === "undefined") {
    return {
      userAgent: null,
      language: null,
      platform: null,
      hostname: null,
      path: null,
      search: null,
      urlHash: null,
      fullPath: null,
      referrer: null,
    };
  }

  const path = normalizeText(window.location.pathname) || "/";
  const search = normalizeText(window.location.search);
  const urlHash = normalizeText(window.location.hash);

  return {
    userAgent: normalizeText(window.navigator?.userAgent) || null,
    language: normalizeText(window.navigator?.language) || null,
    platform: normalizeText(window.navigator?.platform) || null,
    hostname: normalizeText(window.location.hostname).toLowerCase() || null,
    path,
    search,
    urlHash,
    fullPath: `${path}${search}${urlHash}`,
    referrer: normalizeText(document?.referrer) || null,
  };
}

function buildGeoFields(geo = null) {
  if (!geo || typeof geo !== "object") return {};
  return {
    ip: normalizeText(geo.ip) || null,
    country: normalizeText(geo.country) || null,
    region: normalizeText(geo.region) || null,
    city: normalizeText(geo.city || geo.cidade) || null,
    regionCode: normalizeText(geo.regionCode || geo.uf) || null,
    uf: normalizeText(geo.uf || geo.regionCode) || null,
    org: normalizeText(geo.org) || null,
    cidade: normalizeText(geo.cidade || geo.city) || null,
    latitude: Number.isFinite(Number(geo.latitude)) ? Number(geo.latitude) : null,
    longitude: Number.isFinite(Number(geo.longitude)) ? Number(geo.longitude) : null,
  };
}

function getTrackableLinkDocRefs(trackingId = "") {
  const normalizedTrackingId = normalizeText(trackingId);
  if (!normalizedTrackingId) return [];
  return getProjectDocCandidates(db, "trackableLinks", normalizedTrackingId);
}

function getPrimaryTrackableLinkDocRef(trackingId = "") {
  const normalizedTrackingId = normalizeText(trackingId);
  if (!normalizedTrackingId) return null;
  return getPrimaryProjectDoc(db, "trackableLinks", normalizedTrackingId);
}

function getPrimaryTrackableAccessCollection(trackingId = "") {
  const normalizedTrackingId = normalizeText(trackingId);
  if (!normalizedTrackingId) return null;
  return getPrimaryProjectCollection(db, "trackableLinks", normalizedTrackingId, "acessos");
}

function shouldSkipAccessByDedupe(trackingId = "") {
  if (typeof window === "undefined") return false;
  try {
    const key = `trackableAccess:${normalizeText(trackingId)}`;
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(key) || 0);
    if (previous > 0 && now - previous <= TRACKABLE_ACCESS_DEDUPE_MS) return true;
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Se sessionStorage falhar, registra normalmente.
  }
  return false;
}

export function salvarTrackingContext(link = {}) {
  if (typeof window === "undefined") return;
  const trackingId = normalizeText(link?.trackingId || link?.id);
  if (!trackingId) return;
  try {
    window.sessionStorage.setItem(
      TRACKING_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        trackingId,
        tipo: normalizeText(link?.tipo) || "link_espaco",
        destinoTipo: normalizeText(link?.destinoTipo) || "espaco",
        destinoUrl: normalizeText(link?.destinoUrl),
        origemPlanejada: normalizeText(link?.origemPlanejada || link?.descricao),
        registradoEmMs: Date.now(),
      })
    );
  } catch {
    // Contexto de rastreio e util, mas nao pode bloquear a navegacao.
  }
}

export function obterTrackingContextSessao() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TRACKING_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function criarLinkRastreavelEspaco({
  ownerUserId = "",
  espacoId = "",
  espacoNome = "",
  skinsUsername = "",
  destinoUrl = "",
  descricao = "",
  origemPlanejada = "",
  permissaoCriarLinks = "",
  permissaoHistoricoLinks = "",
} = {}) {
  const trackingId = createFirestoreId("trackableLinks");
  const normalizedOwnerUserId = normalizeText(ownerUserId);
  const normalizedEspacoId = normalizeText(espacoId);
  const normalizedDestinoUrl = normalizeText(destinoUrl);
  const trackingRoute = `/r/${encodeRouteSegment(trackingId)}`;
  const urlRastreavel = buildAbsoluteUrl(trackingRoute);
  const linkRef = getPrimaryTrackableLinkDocRef(trackingId);
  const currentUser = auth.currentUser;

  if (!linkRef || !normalizedOwnerUserId || !normalizedEspacoId || !normalizedDestinoUrl) {
    throw new Error("Dados insuficientes para criar link rastreavel.");
  }

  await setDoc(
    linkRef,
    cleanPayload({
      id: trackingId,
      trackingId,
      tipo: "link_espaco",
      targetType: "espaco",
      destinoTipo: "espaco",
      ownerUserId: normalizedOwnerUserId,
      espacoId: normalizedEspacoId,
      espacoNome: normalizeText(espacoNome) || null,
      skinsUsername: normalizeText(skinsUsername) || null,
      spaceKey: buildSpaceKey(normalizedOwnerUserId, normalizedEspacoId),
      destinoUrl: normalizedDestinoUrl,
      trackingRoute,
      urlRastreavel,
      descricao: normalizeText(descricao) || null,
      origemPlanejada: normalizeText(origemPlanejada || descricao) || null,
      permissaoCriarLinks: normalizeText(permissaoCriarLinks) || null,
      permissaoHistoricoLinks: normalizeText(permissaoHistoricoLinks) || null,
      ativo: true,
      status: "ativo",
      modoRastreabilidade: "preferencial",
      runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
      runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
      criadoPor: normalizeText(currentUser?.uid) || null,
      criadoPorEmail: normalizeText(currentUser?.email) || null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
  );

  return {
    trackingId,
    trackingRoute,
    urlRastreavel,
    destinoUrl: normalizedDestinoUrl,
  };
}

export async function listarLinksRastreaveisEspaco({
  ownerUserId = "",
  espacoId = "",
  limite = 50,
} = {}) {
  const normalizedOwnerUserId = normalizeText(ownerUserId);
  const normalizedEspacoId = normalizeText(espacoId);
  if (!normalizedOwnerUserId || !normalizedEspacoId) return [];

  const linksRef = getPrimaryProjectCollection(db, "trackableLinks");
  const linksQuery = query(
    linksRef,
    where("spaceKey", "==", buildSpaceKey(normalizedOwnerUserId, normalizedEspacoId)),
    limit(Math.max(1, Math.min(Number(limite) || 50, 100)))
  );
  const snapshot = await getDocs(linksQuery);

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => {
      const status = normalizeText(item?.status).toLowerCase();
      return item?.ativo !== false && item?.excluido !== true && status !== "excluido";
    })
    .sort(
      (a, b) =>
        getTimestampMs(b.criadoEm || b.atualizadoEm) -
        getTimestampMs(a.criadoEm || a.atualizadoEm)
    );
}

export async function listarAcessosLinkRastreavelEspaco({
  trackingId = "",
  limite = 50,
} = {}) {
  const normalizedTrackingId = normalizeText(trackingId);
  const acessosRef = getPrimaryTrackableAccessCollection(normalizedTrackingId);
  const maxItems = Math.max(1, Math.min(Number(limite) || 50, 100));
  if (!normalizedTrackingId || !acessosRef) return [];

  try {
    const snapshot = await getDocs(
      query(acessosRef, orderBy("data", "desc"), limit(maxItems))
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") {
      throw error;
    }

    const snapshot = await getDocs(query(acessosRef, limit(maxItems)));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort(
        (a, b) =>
          getTimestampMs(b.data || b.criadoEm) - getTimestampMs(a.data || a.criadoEm)
      );
  }
}

export async function excluirLinkRastreavelEspaco(trackingId = "") {
  const normalizedTrackingId = normalizeText(trackingId);
  const linkRef = getPrimaryTrackableLinkDocRef(normalizedTrackingId);
  const currentUser = auth.currentUser;
  if (!normalizedTrackingId || !linkRef) {
    throw new Error("Link rastreavel invalido para exclusao.");
  }

  await setDoc(
    linkRef,
    cleanPayload({
      ativo: false,
      excluido: true,
      status: "excluido",
      excluidoPor: normalizeText(currentUser?.uid) || null,
      excluidoPorEmail: normalizeText(currentUser?.email) || null,
      excluidoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }),
    { merge: true }
  );

  return true;
}

export async function obterLinkRastreavel(trackingId = "") {
  const refs = getTrackableLinkDocRefs(trackingId);
  for (const refItem of refs) {
    const snap = await getDoc(refItem);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  }
  return null;
}

export async function registrarAcessoLinkRastreavel({
  trackingId = "",
  link = null,
  origem = "trackable_link_route",
} = {}) {
  const normalizedTrackingId = normalizeText(trackingId || link?.trackingId || link?.id);
  const acessosRef = getPrimaryTrackableAccessCollection(normalizedTrackingId);
  if (!normalizedTrackingId || !acessosRef || shouldSkipAccessByDedupe(normalizedTrackingId)) {
    return null;
  }

  const geo = await obterGeoAcessoAtual({ forceRefresh: false }).catch(() => null);
  const currentUser = auth.currentUser;
  const payload = cleanPayload({
    trackingId: normalizedTrackingId,
    eventoTipo: "access_link",
    tipo: "access_link",
    origem: normalizeText(origem) || "trackable_link_route",
    data: serverTimestamp(),
    criadoEm: serverTimestamp(),
    navigationId: getOrCreateNavigationId(),
    uid: normalizeText(currentUser?.uid) || null,
    email: normalizeText(currentUser?.email) || null,
    autenticado: Boolean(currentUser?.uid),
    ownerUserId: normalizeText(link?.ownerUserId) || null,
    espacoId: normalizeText(link?.espacoId) || null,
    espacoNome: normalizeText(link?.espacoNome) || null,
    skinsUsername: normalizeText(link?.skinsUsername) || null,
    destinoTipo: normalizeText(link?.destinoTipo) || null,
    destinoUrl: normalizeText(link?.destinoUrl) || null,
    origemPlanejada: normalizeText(link?.origemPlanejada || link?.descricao) || null,
    runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
    runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
    ...buildClientContext(),
    ...buildGeoFields(geo),
  });

  const accessRef = doc(acessosRef);
  await setDoc(accessRef, payload);
  return { id: accessRef.id, ...payload };
}
