import { initializeApp } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  deleteDoc,
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
  createFirestoreCompatInstance,
  db as dbProjetoAtivo,
  functions as functionsProjetoAtivo,
} from "../../Banco/init-firebase";

const MANAGER_APP_NAME = "system-manager-app";
const MANAGER_COLLECTION = "systems";
const MANAGER_COLLECTIONS_READ = ["systems"];
const MANAGER_COLLECTIONS_DELETE = ["systems", "sistemas"];
const FORCED_SHARED_STORAGE_BUCKET = "teste-aa015.appspot.com";

let managerDbSingleton = null;
const callLimparEnvsProjetoNoVercel = httpsCallable(
  functionsProjetoAtivo,
  "limparEnvsProjetoNoVercel"
);

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

function getOnepageRuntimeConfigFromEnv() {
  const apiKey = normalizeText(process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_API_KEY);
  const authDomain = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_AUTH_DOMAIN
  );
  const projectId = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_PROJECT_ID
  );
  const storageBucket = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_STORAGE_BUCKET
  );
  const messagingSenderId = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_MESSAGING_SENDER_ID
  );
  const appId = normalizeText(process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_APP_ID);
  const databaseURL = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_DATABASE_URL
  );
  const functionsRegion = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_FUNCTIONS_REGION || "us-central1"
  );

  const hasRequired =
    !!apiKey &&
    !!authDomain &&
    !!projectId &&
    !!storageBucket &&
    !!messagingSenderId &&
    !!appId;

  if (!hasRequired) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    databaseURL,
    functionsRegion,
  };
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

  // Quando o projeto ativo ja e o proprio gerenciador, reutiliza o Firestore
  // autenticado da app principal para preservar permissao de escrita.
  if (
    activeFirebaseProjectId &&
    managerConfig.projectId &&
    activeFirebaseProjectId === managerConfig.projectId
  ) {
    managerDbSingleton = dbProjetoAtivo;
    return managerDbSingleton;
  }

  const managerApp = initializeApp(managerConfig, MANAGER_APP_NAME);
  managerDbSingleton = createFirestoreCompatInstance(managerApp);
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
    `REACT_APP_FIREBASE_${prefix}_STORAGE_BUCKET=${FORCED_SHARED_STORAGE_BUCKET}`,
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
  domains = null,
  configSistema = {},
  atualizadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) return false;

  const keyNormalizada = normalizeText(projectKey);
  if (!keyNormalizada) return false;
  const uidAtualizacao = normalizeText(atualizadoPorUid);

  const hostNormalizado = normalizeHost(hostname);
  const docRef = doc(managerDb, MANAGER_COLLECTION, keyNormalizada);
  const docSnap = await getDoc(docRef);
  const dataAtual = docSnap.exists() ? docSnap.data() || {} : {};

  const domainsExistentes = Array.isArray(dataAtual?.domains)
    ? dataAtual.domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : [];

  const domainsInformados = Array.isArray(domains)
    ? domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : normalizeList(domains).map((domain) => normalizeHost(domain)).filter(Boolean);

  const domainsSet = domains === null ? new Set(domainsExistentes) : new Set(domainsInformados);
  if (hostNormalizado) domainsSet.add(hostNormalizado);

  const configSistemaFinal =
    configSistema && typeof configSistema === "object" && Object.keys(configSistema).length > 0
      ? configSistema
      : (dataAtual?.configSistema && typeof dataAtual.configSistema === "object"
          ? dataAtual.configSistema
          : {});

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      firebaseProjectId: normalizeText(projectId),
      domains: Array.from(domainsSet),
      configSistema: configSistemaFinal,
      ...(uidAtualizacao ? { criadoPorUid: uidAtualizacao } : {}),
      atualizadoPorUid: uidAtualizacao || null,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

export async function listarSistemasNoGerenciador() {
  const managerDb = getManagerDb();
  if (!managerDb) return [];

  const registros = [];
  for (const collectionName of MANAGER_COLLECTIONS_READ) {
    try {
      const snap = await getDocs(collection(managerDb, collectionName));
      snap.docs.forEach((docItem) => {
        const data = docItem.data() || {};
        registros.push({
          id: docItem.id,
          sourceCollection: collectionName,
          systemKey: normalizeText(data.systemKey || docItem.id),
          nomeProjeto: normalizeText(data.nomeProjeto || data.systemName || docItem.id),
          tipoProjeto: normalizeText(data.tipoProjeto || "multipage").toLowerCase(),
          firebaseProjectId: normalizeText(data.firebaseProjectId),
          domains: Array.isArray(data.domains)
            ? data.domains.map((d) => normalizeHost(d)).filter(Boolean)
            : [],
          firebaseRuntimeConfig:
            data.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
              ? data.firebaseRuntimeConfig
              : {},
          configSistema:
            data.configSistema && typeof data.configSistema === "object" ? data.configSistema : {},
        });
      });
    } catch {
      // Mantem leitura das demais colecoes.
    }
  }

  const dedup = new Map();
  registros.forEach((item) => {
    const key = normalizeText(item.systemKey || item.id);
    if (!key) return;

    if (!dedup.has(key)) {
      dedup.set(key, item);
      return;
    }

    const atual = dedup.get(key);
    const itemEhColecaoPrincipal = item.sourceCollection === MANAGER_COLLECTION;
    const atualEhColecaoPrincipal = atual.sourceCollection === MANAGER_COLLECTION;

    if (itemEhColecaoPrincipal && !atualEhColecaoPrincipal) {
      dedup.set(key, item);
    }
  });

  return Array.from(dedup.values()).sort((a, b) =>
    a.systemKey.localeCompare(b.systemKey)
  );
}

export async function criarSistemaNoGerenciador({
  nomeProjeto = "",
  systemKey = "",
  domains = [],
  tipoProjeto = "multipage",
  firebaseConfig = {},
  criadoPorUid = null,
}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const nomeNormalizado = normalizeText(nomeProjeto);
  const keyNormalizada = normalizeSystemKey(systemKey || nomeNormalizado);
  const tipoProjetoNormalizado =
    normalizeText(tipoProjeto).toLowerCase() === "onepage" ? "onepage" : "multipage";
  if (!keyNormalizada) {
    throw new Error("Nome/chave do projeto invalido.");
  }

  const domainsNorm = normalizeList(domains).map((host) => normalizeHost(host)).filter(Boolean);
  const payloadFirebase =
    tipoProjetoNormalizado === "onepage"
      ? getOnepageRuntimeConfigFromEnv()
      : {
          apiKey: normalizeText(firebaseConfig.apiKey),
          authDomain: normalizeText(firebaseConfig.authDomain),
          projectId: normalizeText(firebaseConfig.projectId),
          storageBucket: normalizeText(firebaseConfig.storageBucket),
          messagingSenderId: normalizeText(firebaseConfig.messagingSenderId),
          appId: normalizeText(firebaseConfig.appId),
          databaseURL: normalizeText(firebaseConfig.databaseURL),
          functionsRegion: normalizeText(firebaseConfig.functionsRegion || "us-central1"),
        };

  if (!payloadFirebase) {
    throw new Error(
      "Runtime onepage nao configurado no .env (REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_*)."
    );
  }

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
    throw new Error("Ja existe um projeto com essa chave.");
  }

  const configSistemaInicial = {
    tituloSistema: nomeNormalizado || keyNormalizada.toUpperCase(),
    temaPadraoSistema: "ALY_137",
    loginPresetId: "manual",
    exibirTituloSistemaNoLogin: true,
    textoLogin: "EMBARQUE COM O GOOGLE",
    ...(tipoProjetoNormalizado === "onepage"
      ? {
          tipoExperiencia: "onepage",
          modoAcessoProjeto: "publico_sem_login",
        }
      : {}),
  };

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      nomeProjeto: nomeNormalizado || keyNormalizada,
      tipoProjeto: tipoProjetoNormalizado,
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
    tipoProjeto: tipoProjetoNormalizado,
    domains: domainsNorm,
    firebaseRuntimeConfig: payloadFirebase,
    configSistema: configSistemaInicial,
  };
}

export async function listarProjetosNoGerenciador() {
  return listarSistemasNoGerenciador();
}

export async function criarProjetoNoGerenciador(payload = {}) {
  return criarSistemaNoGerenciador(payload);
}

export async function obterConfigProjetoDoGerenciador(params = {}) {
  return obterConfigSistemaDoGerenciador(params);
}

export async function salvarConfigProjetoNoGerenciador(params = {}) {
  return salvarConfigSistemaNoGerenciador(params);
}

export async function limparEnvsProjetoNoVercel({ systemKey = "" } = {}) {
  const keyNormalizada = normalizeSystemKey(systemKey);
  if (!keyNormalizada) {
    throw new Error("Chave do projeto invalida para limpar ENV no Vercel.");
  }

  const response = await callLimparEnvsProjetoNoVercel({
    systemKey: keyNormalizada,
  });
  return response?.data || { ok: false };
}

export async function removerProjetoNoGerenciador({
  systemKey = "",
  removerEnvVercel = true,
  ignorarErroLimpezaEnv = false,
} = {}) {
  const keyNormalizada = normalizeSystemKey(systemKey);
  if (!keyNormalizada) {
    throw new Error("Chave do projeto invalida para remocao.");
  }

  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  let resultadoLimpezaEnv = null;
  let erroLimpezaEnv = null;
  if (removerEnvVercel) {
    try {
      resultadoLimpezaEnv = await limparEnvsProjetoNoVercel({
        systemKey: keyNormalizada,
      });
    } catch (error) {
      erroLimpezaEnv = normalizeText(error?.message || "Falha ao limpar ENV no Vercel.");
      if (!ignorarErroLimpezaEnv) {
        throw error;
      }
    }
  }

  const docsRemovidos = [];
  const idsRemovidos = new Set();

  for (const collectionName of MANAGER_COLLECTIONS_DELETE) {
    const docRefDireta = doc(managerDb, collectionName, keyNormalizada);
    const docSnapDireta = await getDoc(docRefDireta);

    if (docSnapDireta.exists()) {
      await deleteDoc(docRefDireta);
      docsRemovidos.push(`${collectionName}/${keyNormalizada}`);
      idsRemovidos.add(`${collectionName}:${keyNormalizada}`);
    }

    const bySystemKeyQuery = query(
      collection(managerDb, collectionName),
      where("systemKey", "==", keyNormalizada),
      limit(25)
    );
    const bySystemKeySnap = await getDocs(bySystemKeyQuery);

    for (const item of bySystemKeySnap.docs) {
      const dedupeKey = `${collectionName}:${item.id}`;
      if (idsRemovidos.has(dedupeKey)) continue;

      await deleteDoc(doc(managerDb, collectionName, item.id));
      docsRemovidos.push(`${collectionName}/${item.id}`);
      idsRemovidos.add(dedupeKey);
    }
  }

  return {
    ok: true,
    systemKey: keyNormalizada,
    envCleanup: resultadoLimpezaEnv || null,
    envCleanupError: erroLimpezaEnv || null,
    docsRemovidos,
  };
}
