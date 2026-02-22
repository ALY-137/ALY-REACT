import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const MANAGER_APP_NAME = "system-manager-app";
const MANAGER_COLLECTION = "systems";

let managerDbSingleton = null;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeHost(value) {
  return normalizeText(value).toLowerCase().replace(/^https?:\/\//i, "").split("/")[0];
}

function buildManagerConfigFromEnv() {
  const apiKey = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_API_KEY);
  const authDomain = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_AUTH_DOMAIN);
  const projectId = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID);
  const storageBucket = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_STORAGE_BUCKET);
  const messagingSenderId = normalizeText(
    process.env.REACT_APP_SYSTEM_MANAGER_MESSAGING_SENDER_ID
  );
  const appId = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_APP_ID);
  const databaseURL = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_DATABASE_URL);

  const hasRequired =
    !!apiKey &&
    !!authDomain &&
    !!projectId &&
    !!storageBucket &&
    !!messagingSenderId &&
    !!appId;

  if (!hasRequired) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    databaseURL,
  };
}

function getManagerDb() {
  if (managerDbSingleton) return managerDbSingleton;

  const managerConfig = buildManagerConfigFromEnv();
  if (!managerConfig) return null;

  const managerApp = initializeApp(managerConfig, MANAGER_APP_NAME);
  managerDbSingleton = getFirestore(managerApp);
  return managerDbSingleton;
}

function extrairConfigSistemaDoDocumento(data = {}) {
  if (data && typeof data.configSistema === "object" && data.configSistema) {
    return data.configSistema;
  }
  if (data && typeof data.config === "object" && data.config) {
    return data.config;
  }
  return data;
}

export function gerenciadorSistemasHabilitado() {
  return !!buildManagerConfigFromEnv();
}

export async function obterConfigSistemaDoGerenciador({
  projectKey = "",
  projectId = "",
  hostname = "",
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) return null;

  const keyNormalizada = normalizeText(projectKey);
  const projectIdNormalizado = normalizeText(projectId);
  const hostNormalizado = normalizeHost(hostname);

  // 1) Prioridade: doc por key do sistema.
  if (keyNormalizada) {
    const docRef = doc(managerDb, MANAGER_COLLECTION, keyNormalizada);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return extrairConfigSistemaDoDocumento(docSnap.data());
    }
  }

  // 2) Busca por projectId Firebase.
  if (projectIdNormalizado) {
    const byProjectIdQuery = query(
      collection(managerDb, MANAGER_COLLECTION),
      where("firebaseProjectId", "==", projectIdNormalizado),
      limit(1)
    );
    const projectIdSnap = await getDocs(byProjectIdQuery);
    if (!projectIdSnap.empty) {
      return extrairConfigSistemaDoDocumento(projectIdSnap.docs[0].data());
    }
  }

  // 3) Busca por dominio.
  if (hostNormalizado) {
    const byDomainQuery = query(
      collection(managerDb, MANAGER_COLLECTION),
      where("domains", "array-contains", hostNormalizado),
      limit(1)
    );
    const domainSnap = await getDocs(byDomainQuery);
    if (!domainSnap.empty) {
      return extrairConfigSistemaDoDocumento(domainSnap.docs[0].data());
    }
  }

  return null;
}

export async function salvarConfigSistemaNoGerenciador({
  projectKey = "",
  projectId = "",
  hostname = "",
  configSistema = {},
  atualizadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) return false;

  const keyNormalizada = normalizeText(projectKey);
  if (!keyNormalizada) return false;

  const hostNormalizado = normalizeHost(hostname);
  const docRef = doc(managerDb, MANAGER_COLLECTION, keyNormalizada);
  const docSnap = await getDoc(docRef);

  const domainsExistentes = Array.isArray(docSnap.data()?.domains)
    ? docSnap.data().domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : [];

  const domainsSet = new Set(domainsExistentes);
  if (hostNormalizado) domainsSet.add(hostNormalizado);

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      firebaseProjectId: normalizeText(projectId),
      domains: Array.from(domainsSet),
      configSistema,
      atualizadoPorUid: atualizadoPorUid || null,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

