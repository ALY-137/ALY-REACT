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

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  return normalizeText(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeSystemKey(value) {
  const slug = normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "";
}

function toEnvPrefix(systemKey) {
  return normalizeText(systemKey).replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
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

export function gerarBlocoEnvProjeto({
  systemKey = "",
  domains = [],
  firebaseConfig = {},
}) {
  const key = normalizeSystemKey(systemKey);
  const prefix = toEnvPrefix(key);
  const domainsNorm = normalizeList(domains).map((host) => normalizeHost(host)).filter(Boolean);

  const lines = [
    `REACT_APP_FIREBASE_${prefix}_KEY=${key}`,
    `REACT_APP_FIREBASE_${prefix}_API_KEY=${normalizeText(firebaseConfig.apiKey)}`,
    `REACT_APP_FIREBASE_${prefix}_AUTH_DOMAIN=${normalizeText(firebaseConfig.authDomain)}`,
    `REACT_APP_FIREBASE_${prefix}_PROJECT_ID=${normalizeText(firebaseConfig.projectId)}`,
    `REACT_APP_FIREBASE_${prefix}_STORAGE_BUCKET=${normalizeText(firebaseConfig.storageBucket)}`,
    `REACT_APP_FIREBASE_${prefix}_MESSAGING_SENDER_ID=${normalizeText(
      firebaseConfig.messagingSenderId
    )}`,
    `REACT_APP_FIREBASE_${prefix}_APP_ID=${normalizeText(firebaseConfig.appId)}`,
  ];

  const databaseURL = normalizeText(firebaseConfig.databaseURL);
  if (databaseURL) {
    lines.push(`REACT_APP_FIREBASE_${prefix}_DATABASE_URL=${databaseURL}`);
  }

  const functionsRegion = normalizeText(firebaseConfig.functionsRegion);
  if (functionsRegion) {
    lines.push(`REACT_APP_FIREBASE_${prefix}_FUNCTIONS_REGION=${functionsRegion}`);
  }

  if (domainsNorm.length) {
    lines.push(`REACT_APP_FIREBASE_${prefix}_DOMAINS=${domainsNorm.join(",")}`);
  }

  lines.push("");
  lines.push(`# Acrescente ${prefix} em REACT_APP_FIREBASE_PROJECT_KEYS`);

  return lines.join("\n");
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

export async function listarSistemasNoGerenciador() {
  const managerDb = getManagerDb();
  if (!managerDb) return [];

  const snap = await getDocs(collection(managerDb, MANAGER_COLLECTION));
  return snap.docs
    .map((docItem) => {
      const data = docItem.data() || {};
      return {
        id: docItem.id,
        systemKey: normalizeText(data.systemKey || docItem.id),
        nomeProjeto: normalizeText(data.nomeProjeto || data.systemName || docItem.id),
        firebaseProjectId: normalizeText(data.firebaseProjectId),
        domains: Array.isArray(data.domains) ? data.domains.map((d) => normalizeHost(d)) : [],
        firebaseRuntimeConfig:
          data.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
            ? data.firebaseRuntimeConfig
            : {},
        configSistema:
          data.configSistema && typeof data.configSistema === "object" ? data.configSistema : {},
      };
    })
    .sort((a, b) => a.systemKey.localeCompare(b.systemKey));
}

export async function criarSistemaNoGerenciador({
  nomeProjeto = "",
  systemKey = "",
  domains = [],
  firebaseConfig = {},
  criadoPorUid = null,
}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de sistemas nao configurado.");
  }

  const nomeNormalizado = normalizeText(nomeProjeto);
  const keyNormalizada = normalizeSystemKey(systemKey || nomeNormalizado);
  if (!keyNormalizada) {
    throw new Error("Nome/chave do sistema invalido.");
  }

  const domainsNorm = normalizeList(domains).map((host) => normalizeHost(host)).filter(Boolean);
  const payloadFirebase = {
    apiKey: normalizeText(firebaseConfig.apiKey),
    authDomain: normalizeText(firebaseConfig.authDomain),
    projectId: normalizeText(firebaseConfig.projectId),
    storageBucket: normalizeText(firebaseConfig.storageBucket),
    messagingSenderId: normalizeText(firebaseConfig.messagingSenderId),
    appId: normalizeText(firebaseConfig.appId),
    databaseURL: normalizeText(firebaseConfig.databaseURL),
    functionsRegion: normalizeText(firebaseConfig.functionsRegion || "us-central1"),
  };

  const obrigatorios = [
    payloadFirebase.apiKey,
    payloadFirebase.authDomain,
    payloadFirebase.projectId,
    payloadFirebase.storageBucket,
    payloadFirebase.messagingSenderId,
    payloadFirebase.appId,
  ];

  if (obrigatorios.some((item) => !item)) {
    throw new Error("Credenciais Firebase incompletas.");
  }

  const docRef = doc(managerDb, MANAGER_COLLECTION, keyNormalizada);
  const existente = await getDoc(docRef);
  if (existente.exists()) {
    throw new Error("Ja existe um sistema com essa chave.");
  }

  const configSistemaInicial = {
    tituloSistema: nomeNormalizado || keyNormalizada.toUpperCase(),
    temaPadraoSistema: "ALY_137",
    exibirTituloSistemaNoLogin: true,
    textoLogin: "EMBARQUE COM O GOOGLE",
  };

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      nomeProjeto: nomeNormalizado || keyNormalizada,
      firebaseProjectId: payloadFirebase.projectId,
      domains: domainsNorm,
      firebaseRuntimeConfig: payloadFirebase,
      configSistema: configSistemaInicial,
      criadoPorUid: criadoPorUid || null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    systemKey: keyNormalizada,
    nomeProjeto: nomeNormalizado || keyNormalizada,
    domains: domainsNorm,
    firebaseRuntimeConfig: payloadFirebase,
    configSistema: configSistemaInicial,
  };
}
