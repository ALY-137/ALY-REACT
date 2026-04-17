import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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

const NAVIGATION_HASH_STORAGE_KEY = "navegacaoHash";
const VISITOR_HASH_STORAGE_KEY = "uxVisitorHash";
const QR_SCAN_DEDUPE_MS = 2500;

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeNavigationHash(value = "") {
  const hash = normalizeText(value);
  if (!hash) return "";
  return hash.startsWith("anon_") ? `nav_${hash.slice(5)}` : hash;
}

function hashString(value = "") {
  const input = normalizeText(value) || `${Date.now()}_${Math.random()}`;
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `nav_${(hash >>> 0).toString(16)}`;
}

function getOrCreateNavigationHash() {
  if (typeof window === "undefined") return hashString("server");

  try {
    const navigationHash = normalizeNavigationHash(
      window.localStorage.getItem(NAVIGATION_HASH_STORAGE_KEY)
    );
    if (navigationHash) {
      window.localStorage.setItem(NAVIGATION_HASH_STORAGE_KEY, navigationHash);
      window.localStorage.setItem(VISITOR_HASH_STORAGE_KEY, navigationHash);
      return navigationHash;
    }

    const visitorHash = normalizeNavigationHash(
      window.localStorage.getItem(VISITOR_HASH_STORAGE_KEY)
    );
    if (visitorHash) {
      window.localStorage.setItem(NAVIGATION_HASH_STORAGE_KEY, visitorHash);
      window.localStorage.setItem(VISITOR_HASH_STORAGE_KEY, visitorHash);
      return visitorHash;
    }

    const seed =
      (typeof window.crypto?.randomUUID === "function" && window.crypto.randomUUID()) ||
      `${Date.now()}_${Math.random()}_${window.location.hostname}`;
    const hash = hashString(seed);
    window.localStorage.setItem(NAVIGATION_HASH_STORAGE_KEY, hash);
    window.localStorage.setItem(VISITOR_HASH_STORAGE_KEY, hash);
    return hash;
  } catch {
    return hashString(`${Date.now()}_${Math.random()}`);
  }
}

function encodeRouteSegment(value = "") {
  return encodeURIComponent(normalizeText(value));
}

function createFirestoreId(collectionName = "_qrPrintIds") {
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

function buildCardKey(ownerUserId = "", espacoId = "", blocoId = "", cardId = "") {
  return [
    normalizeText(ownerUserId),
    normalizeText(espacoId),
    normalizeText(blocoId),
    normalizeText(cardId),
  ].join("|");
}

function getTimestampMs(value = null) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (Number.isFinite(Number(value?.seconds))) {
    return Number(value.seconds) * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
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

function buildQrRoute({ oneOwnerPublicaAtiva = false, skinsUsername = "", espacoNome = "", printId = "" } = {}) {
  const printIdSegment = encodeRouteSegment(printId);
  const espacoSegment = encodeRouteSegment(espacoNome);
  const skinSegment = encodeRouteSegment(skinsUsername);

  if (!printIdSegment || !espacoSegment) return "";
  if (oneOwnerPublicaAtiva || !skinSegment) {
    return `/${espacoSegment}/card/r/${printIdSegment}`;
  }
  return `/${skinSegment}/${espacoSegment}/card/r/${printIdSegment}`;
}

function getQrPrintDocRefs(printId = "") {
  const normalizedPrintId = normalizeText(printId);
  if (!normalizedPrintId) return [];
  return getProjectDocCandidates(db, "qrPrints", normalizedPrintId);
}

function getPrimaryQrPrintDocRef(printId = "") {
  const normalizedPrintId = normalizeText(printId);
  if (!normalizedPrintId) return null;
  return getPrimaryProjectDoc(db, "qrPrints", normalizedPrintId);
}

function getPrimaryQrPrintLeiturasCollection(printId = "") {
  const normalizedPrintId = normalizeText(printId);
  if (!normalizedPrintId) return null;
  return getPrimaryProjectCollection(db, "qrPrints", normalizedPrintId, "leituras");
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
    cep: normalizeText(geo.cep) || null,
    logradouro: normalizeText(geo.logradouro) || null,
    bairro: normalizeText(geo.bairro) || null,
    cidade: normalizeText(geo.cidade || geo.city) || null,
    latitude: Number.isFinite(Number(geo.latitude)) ? Number(geo.latitude) : null,
    longitude: Number.isFinite(Number(geo.longitude)) ? Number(geo.longitude) : null,
  };
}

function shouldSkipScanByDedupe(printId = "") {
  if (typeof window === "undefined") return false;

  try {
    const key = `qrPrintScan:${normalizeText(printId)}`;
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(key) || 0);
    if (previous > 0 && now - previous <= QR_SCAN_DEDUPE_MS) {
      return true;
    }
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Se sessionStorage falhar, registra normalmente.
  }

  return false;
}

export async function criarQrPrintCard({
  ownerUserId = "",
  espacoId = "",
  espacoNome = "",
  skinsUsername = "",
  oneOwnerPublicaAtiva = false,
  bloco = null,
  card = null,
  rotaCard = "",
  urlCard = "",
  descricaoRegistro = "",
} = {}) {
  const printId = createFirestoreId("qrPrints");
  const normalizedOwnerUserId = normalizeText(ownerUserId);
  const normalizedEspacoId = normalizeText(espacoId);
  const normalizedBlocoId = normalizeText(bloco?.id);
  const normalizedCardId = normalizeText(card?.id);
  const cardKey = buildCardKey(
    normalizedOwnerUserId,
    normalizedEspacoId,
    normalizedBlocoId,
    normalizedCardId
  );
  const normalizedRotaCard = normalizeText(rotaCard);
  const normalizedUrlCard = normalizeText(urlCard) || buildAbsoluteUrl(normalizedRotaCard);
  const normalizedDescricaoRegistro = normalizeText(descricaoRegistro);
  const rotaQr = buildQrRoute({
    oneOwnerPublicaAtiva,
    skinsUsername,
    espacoNome,
    printId,
  });
  const urlQr = buildAbsoluteUrl(rotaQr);
  const printRef = getPrimaryQrPrintDocRef(printId);
  const currentUser = auth.currentUser;

  if (!printRef || !normalizedOwnerUserId || !normalizedEspacoId || !normalizedBlocoId || !normalizedCardId) {
    throw new Error("Dados insuficientes para criar QR rastreavel.");
  }

  await setDoc(
    printRef,
    cleanPayload({
      id: printId,
      printId,
      alvoTipo: "card",
      targetType: "card",
      ownerUserId: normalizedOwnerUserId,
      espacoId: normalizedEspacoId,
      espacoNome: normalizeText(espacoNome) || null,
      skinsUsername: normalizeText(skinsUsername) || null,
      oneOwnerPublicaAtiva: Boolean(oneOwnerPublicaAtiva),
      blocoId: normalizedBlocoId,
      blocoTitulo: normalizeText(bloco?.titulo || bloco?.nome) || null,
      cardId: normalizedCardId,
      cardKey,
      cardNome: normalizeText(card?.nome) || null,
      descricaoRegistro: normalizedDescricaoRegistro || null,
      rotaCard: normalizedRotaCard || null,
      urlCard: normalizedUrlCard || null,
      rotaQr: rotaQr || null,
      urlQr: urlQr || null,
      ativo: true,
      status: "ativo",
      runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
      runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
      criadoPor: normalizeText(currentUser?.uid) || null,
      criadoPorEmail: normalizeText(currentUser?.email) || null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
  );

  return {
    printId,
    rotaQr,
    urlQr,
    rotaCard: normalizedRotaCard,
    urlCard: normalizedUrlCard,
  };
}

export async function listarQrPrintsDoCard({
  ownerUserId = "",
  espacoId = "",
  blocoId = "",
  cardId = "",
  limite = 50,
} = {}) {
  const normalizedOwnerUserId = normalizeText(ownerUserId);
  const normalizedEspacoId = normalizeText(espacoId);
  const normalizedBlocoId = normalizeText(blocoId);
  const normalizedCardId = normalizeText(cardId);
  const cardKey = buildCardKey(
    normalizedOwnerUserId,
    normalizedEspacoId,
    normalizedBlocoId,
    normalizedCardId
  );

  if (!normalizedOwnerUserId || !normalizedEspacoId || !normalizedBlocoId || !normalizedCardId) {
    return [];
  }

  const printsRef = getPrimaryProjectCollection(db, "qrPrints");
  const printsQuery = query(
    printsRef,
    where("cardKey", "==", cardKey),
    limit(Math.max(1, Math.min(Number(limite) || 50, 100)))
  );
  const snapshot = await getDocs(printsQuery);

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort(
      (a, b) =>
        getTimestampMs(b.criadoEm || b.atualizadoEm) -
        getTimestampMs(a.criadoEm || a.atualizadoEm)
    );
}

export async function listarLeiturasQrPrint(printId = "", { limite = 80 } = {}) {
  const normalizedPrintId = normalizeText(printId);
  const leiturasRef = getPrimaryQrPrintLeiturasCollection(normalizedPrintId);
  if (!normalizedPrintId || !leiturasRef) return [];

  const leiturasQuery = query(
    leiturasRef,
    limit(Math.max(1, Math.min(Number(limite) || 80, 150)))
  );
  const snapshot = await getDocs(leiturasQuery);

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort(
      (a, b) =>
        getTimestampMs(b.data || b.criadoEm) -
        getTimestampMs(a.data || a.criadoEm)
    );
}

export async function obterQrPrint(printId = "") {
  const refs = getQrPrintDocRefs(printId);
  for (const refItem of refs) {
    const snapshot = await getDoc(refItem).catch(() => null);
    if (snapshot?.exists?.()) {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      };
    }
  }
  return null;
}

export function montarRotaCardDeQrPrint(
  print = {},
  { espacoNome = "", skinsUsername = "", oneOwnerPublicaAtiva = false } = {}
) {
  const rotaCard = normalizeText(print?.rotaCard);
  if (rotaCard) return rotaCard;

  const blocoSegment = encodeRouteSegment(print?.blocoId);
  const cardSegment = encodeRouteSegment(print?.cardId);
  const espacoSegment = encodeRouteSegment(print?.espacoNome || espacoNome);
  const skinSegment = encodeRouteSegment(print?.skinsUsername || skinsUsername);

  if (!blocoSegment || !cardSegment || !espacoSegment) return "";
  if (oneOwnerPublicaAtiva || print?.oneOwnerPublicaAtiva || !skinSegment) {
    return `/${espacoSegment}/card/${blocoSegment}/${cardSegment}`;
  }
  return `/${skinSegment}/${espacoSegment}/card/${blocoSegment}/${cardSegment}`;
}

export async function registrarLeituraQrPrint({
  printId = "",
  print = null,
  origem = "qr_print_route",
} = {}) {
  const normalizedPrintId = normalizeText(printId || print?.printId || print?.id);
  const leituraCollection = getPrimaryQrPrintLeiturasCollection(normalizedPrintId);

  if (!normalizedPrintId || !leituraCollection || shouldSkipScanByDedupe(normalizedPrintId)) {
    return null;
  }

  const geo = await obterGeoAcessoAtual({ forceRefresh: false }).catch(() => null);
  const currentUser = auth.currentUser;
  const payload = cleanPayload({
    printId: normalizedPrintId,
    qrPrintId: normalizedPrintId,
    eventoTipo: "scan_qr",
    tipo: "scan_qr",
    origem: normalizeText(origem) || "qr_print_route",
    data: serverTimestamp(),
    criadoEm: serverTimestamp(),
    hash: getOrCreateNavigationHash(),
    visitorHash: getOrCreateNavigationHash(),
    uid: normalizeText(currentUser?.uid) || null,
    email: normalizeText(currentUser?.email) || null,
    autenticado: Boolean(currentUser?.uid),
    ownerUserId: normalizeText(print?.ownerUserId) || null,
    espacoId: normalizeText(print?.espacoId) || null,
    espacoNome: normalizeText(print?.espacoNome) || null,
    skinsUsername: normalizeText(print?.skinsUsername) || null,
    blocoId: normalizeText(print?.blocoId) || null,
    blocoTitulo: normalizeText(print?.blocoTitulo) || null,
    cardId: normalizeText(print?.cardId) || null,
    cardNome: normalizeText(print?.cardNome) || null,
    rotaCard: normalizeText(print?.rotaCard) || null,
    urlCard: normalizeText(print?.urlCard) || null,
    runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
    runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
    ...buildClientContext(),
    ...buildGeoFields(geo),
  });

  return addDoc(leituraCollection, payload);
}
