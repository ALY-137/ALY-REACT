import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { activeFirebaseProjectKey, db } from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";

const CONSENT_DOC_ID = "current";
const CONSENT_COLLECTION = "lgpd_consents";
const CONSENT_EVENTS_COLLECTION = "lgpd_consent_events";
const REQUESTS_COLLECTION = "lgpd_requests";
const FALLBACK_CONSENT_FIELD = "lgpdConsentCurrent";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function getProjectSystemKey(configSistema = {}) {
  const fromConfig = normalizeLower(configSistema?.projectSystemKey || configSistema?.systemKey);
  if (fromConfig) return fromConfig;

  try {
    const fromStorage = normalizeLower(localStorage.getItem("systemProjectContextKey"));
    if (fromStorage) return fromStorage;
  } catch {
    // Ignora indisponibilidade de storage.
  }

  return normalizeLower(activeFirebaseProjectKey);
}

export function isLgpdConsentRequired(configSistema = {}) {
  return configSistema?.exigirAceiteLgpdNoLogin === true;
}

export function resolveLgpdPolicySnapshot(configSistema = {}) {
  const termosUsoVersao = normalizeText(configSistema?.termosUsoVersao) || "1.0";
  const politicaPrivacidadeVersao =
    normalizeText(configSistema?.politicaPrivacidadeVersao) || "1.0";
  const termosUsoUrl = normalizeText(configSistema?.termosUsoUrl);
  const politicaPrivacidadeUrl = normalizeText(configSistema?.politicaPrivacidadeUrl);
  const projectSystemKey = getProjectSystemKey(configSistema);

  return {
    projectSystemKey,
    runtimeProjectKey: normalizeLower(activeFirebaseProjectKey),
    termosUsoUrl,
    termosUsoVersao,
    politicaPrivacidadeUrl,
    politicaPrivacidadeVersao,
    policyKey: [
      projectSystemKey || "default",
      `terms:${termosUsoVersao}`,
      `privacy:${politicaPrivacidadeVersao}`,
      termosUsoUrl || "sem-termos-url",
      politicaPrivacidadeUrl || "sem-politica-url",
    ].join("|"),
  };
}

function buildConsentRef(uid = "") {
  return getPrimaryProjectDoc(db, "users", uid, CONSENT_COLLECTION, CONSENT_DOC_ID);
}

function buildUserRef(uid = "") {
  return getPrimaryProjectDoc(db, "users", uid);
}

function buildConsentEventsCollection(uid = "") {
  return getPrimaryProjectCollection(db, "users", uid, CONSENT_EVENTS_COLLECTION);
}

function buildRequestsCollection(uid = "") {
  return getPrimaryProjectCollection(db, "users", uid, REQUESTS_COLLECTION);
}

function buildRequestRef(uid = "", requestId = "") {
  return getPrimaryProjectDoc(db, "users", uid, REQUESTS_COLLECTION, requestId);
}

function resolveTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isPermissionDeniedError(error) {
  const code = normalizeLower(error?.code);
  const message = normalizeLower(error?.message);
  return code.includes("permission-denied") || message.includes("permission-denied");
}

async function obterConsentimentoLgpdFallback(uid = "") {
  if (!uid) return null;
  const userSnap = await getDoc(buildUserRef(uid));
  if (!userSnap.exists()) return null;
  const data = userSnap.data() || {};
  const fallbackData =
    data?.[FALLBACK_CONSENT_FIELD] && typeof data[FALLBACK_CONSENT_FIELD] === "object"
      ? data[FALLBACK_CONSENT_FIELD]
      : null;
  return fallbackData;
}

async function salvarConsentimentoLgpdFallback(uid = "", payload = {}) {
  if (!uid) return false;
  await setDoc(
    buildUserRef(uid),
    {
      [FALLBACK_CONSENT_FIELD]: payload,
      lgpdConsentPolicyKey: payload?.policyKey || "",
      lgpdConsentAccepted: payload?.accepted === true,
      lgpdConsentStatus: payload?.status || "",
      lgpdConsentUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

export function isLgpdConsentCurrent(consentData = {}, configSistema = {}) {
  if (!consentData || typeof consentData !== "object") return false;
  if (consentData.accepted !== true && consentData.status !== "aceito") return false;

  const snapshot = resolveLgpdPolicySnapshot(configSistema);
  return (
    normalizeText(consentData.policyKey) === snapshot.policyKey ||
    (
      normalizeText(consentData.termosUsoVersao) === snapshot.termosUsoVersao &&
      normalizeText(consentData.politicaPrivacidadeVersao) === snapshot.politicaPrivacidadeVersao &&
      normalizeText(consentData.termosUsoUrl) === snapshot.termosUsoUrl &&
      normalizeText(consentData.politicaPrivacidadeUrl) === snapshot.politicaPrivacidadeUrl
    )
  );
}

export async function obterConsentimentoLgpdAtual({ user, configSistema = {} } = {}) {
  if (!user?.uid) {
    return {
      exists: false,
      data: null,
      required: isLgpdConsentRequired(configSistema),
      current: false,
      policy: resolveLgpdPolicySnapshot(configSistema),
    };
  }

  let exists = false;
  let data = null;
  try {
    const snap = await getDoc(buildConsentRef(user.uid));
    exists = snap.exists();
    data = snap.exists() ? snap.data() || {} : null;
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
    data = await obterConsentimentoLgpdFallback(user.uid);
    exists = Boolean(data);
  }
  const required = isLgpdConsentRequired(configSistema);
  const current = data ? isLgpdConsentCurrent(data, configSistema) : false;

  return {
    exists,
    data,
    required,
    current,
    policy: resolveLgpdPolicySnapshot(configSistema),
  };
}

export async function registrarConsentimentoLgpd({
  user,
  configSistema = {},
  origem = "login",
  accepted = true,
} = {}) {
  if (!user?.uid) {
    throw new Error("Usuario autenticado obrigatorio para registrar aceite LGPD.");
  }

  const policy = resolveLgpdPolicySnapshot(configSistema);
  const payload = {
    uid: user.uid,
    email: normalizeText(user.email),
    accepted: accepted === true,
    status: accepted === true ? "aceito" : "revogado",
    origem: normalizeText(origem) || "login",
    projectSystemKey: policy.projectSystemKey,
    runtimeProjectKey: policy.runtimeProjectKey,
    termosUsoUrl: policy.termosUsoUrl,
    termosUsoVersao: policy.termosUsoVersao,
    politicaPrivacidadeUrl: policy.politicaPrivacidadeUrl,
    politicaPrivacidadeVersao: policy.politicaPrivacidadeVersao,
    policyKey: policy.policyKey,
    userAgent:
      typeof navigator !== "undefined" ? normalizeText(navigator.userAgent).slice(0, 800) : "",
    path:
      typeof window !== "undefined"
        ? `${window.location.pathname || "/"}${window.location.search || ""}`.slice(0, 800)
        : "",
    updatedAt: serverTimestamp(),
    acceptedAt: accepted === true ? serverTimestamp() : null,
    revokedAt: accepted === true ? null : serverTimestamp(),
  };

  let savedInFallback = false;
  try {
    await setDoc(buildConsentRef(user.uid), payload, { merge: true });
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
    savedInFallback = await salvarConsentimentoLgpdFallback(user.uid, payload);
  }

  let eventRef = null;
  if (!savedInFallback) {
    try {
      eventRef = await addDoc(buildConsentEventsCollection(user.uid), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } catch (eventError) {
      console.warn("Aceite LGPD salvo sem evento historico:", {
        code: eventError?.code,
        message: eventError?.message,
      });
    }
  }

  return {
    id: CONSENT_DOC_ID,
    eventId: eventRef?.id || "",
    eventPersisted: Boolean(eventRef?.id),
    savedInFallback,
    ...payload,
  };
}

export async function listarSolicitacoesLgpd({ user, limit: maxItems = 50 } = {}) {
  if (!user?.uid) return [];
  const safeLimit = Math.max(1, Math.min(Number(maxItems) || 50, 100));
  const snap = await getDocs(
    query(buildRequestsCollection(user.uid), orderBy("createdAt", "desc"), limit(safeLimit))
  );
  return snap.docs.map((docItem) => ({
    id: docItem.id,
    ...(docItem.data() || {}),
  }));
}

export async function criarSolicitacaoLgpd({
  user,
  configSistema = {},
  tipo = "",
  descricao = "",
} = {}) {
  if (!user?.uid) {
    throw new Error("Usuario autenticado obrigatorio para abrir solicitacao LGPD.");
  }

  const tipoNormalizado = normalizeLower(tipo) || "informacoes";
  const descricaoNormalizada = normalizeText(descricao).slice(0, 3000);
  const policy = resolveLgpdPolicySnapshot(configSistema);

  const ref = await addDoc(buildRequestsCollection(user.uid), {
    uid: user.uid,
    email: normalizeText(user.email),
    tipo: tipoNormalizado,
    descricao: descricaoNormalizada,
    status: "aberta",
    resposta: "",
    resolvidaEm: null,
    projectSystemKey: policy.projectSystemKey,
    runtimeProjectKey: policy.runtimeProjectKey,
    termosUsoVersao: policy.termosUsoVersao,
    politicaPrivacidadeVersao: policy.politicaPrivacidadeVersao,
    policyKey: policy.policyKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    tipo: tipoNormalizado,
    status: "aberta",
  };
}

export async function listarSolicitacoesLgpdDoProjeto({ limit: maxItems = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(maxItems) || 100, 200));
  const usersSnap = await getDocs(query(getPrimaryProjectCollection(db, "users"), limit(300)));
  const requests = [];

  for (const userDoc of usersSnap.docs) {
    if (requests.length >= safeLimit) break;
    const userData = userDoc.data() || {};
    const requestsSnap = await getDocs(
      query(collection(userDoc.ref, REQUESTS_COLLECTION), orderBy("createdAt", "desc"), limit(20))
    );

    requestsSnap.docs.forEach((requestDoc) => {
      const data = requestDoc.data() || {};
      requests.push({
        id: requestDoc.id,
        userId: userDoc.id,
        userEmail: normalizeText(data?.email || userData?.emailGoogle || userData?.email),
        userName: normalizeText(userData?.nomeCompletoGoogle || userData?.nomeGoogle),
        path: requestDoc.ref.path,
        ...data,
      });
    });
  }

  return requests
    .sort((a, b) => resolveTimestampMs(b?.createdAt) - resolveTimestampMs(a?.createdAt))
    .slice(0, safeLimit);
}

export async function atualizarSolicitacaoLgpd({
  user,
  targetUid = "",
  requestId = "",
  status = "em_analise",
  resposta = "",
} = {}) {
  if (!user?.uid) {
    throw new Error("Usuario autenticado obrigatorio para responder solicitacao LGPD.");
  }
  const targetUidNormalizado = normalizeText(targetUid);
  const requestIdNormalizado = normalizeText(requestId);
  if (!targetUidNormalizado || !requestIdNormalizado) {
    throw new Error("Solicitacao LGPD invalida.");
  }

  const statusNormalizado = normalizeLower(status) || "em_analise";
  const statusFinal = ["concluida", "recusada_justificada"].includes(statusNormalizado);
  const respostaNormalizada = normalizeText(resposta).slice(0, 5000);

  await updateDoc(buildRequestRef(targetUidNormalizado, requestIdNormalizado), {
    status: statusNormalizado,
    resposta: respostaNormalizada,
    atendidaPorUid: user.uid,
    atendidaPorEmail: normalizeText(user.email),
    updatedAt: serverTimestamp(),
    resolvidaEm: statusFinal ? serverTimestamp() : null,
  });

  return {
    id: requestIdNormalizado,
    userId: targetUidNormalizado,
    status: statusNormalizado,
  };
}
