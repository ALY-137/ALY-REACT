import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
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
  auth,
  createFirestoreCompatInstance,
  db as dbProjetoAtivo,
} from "../../Banco/init-firebase";
import { getPrimaryProjectCollection } from "../../Banco/projectDataRefs";
import { postSharedFunctionJson } from "../../Banco/sharedFunctionsApi";
import { PROJECT_STATUS_ACTIVE, normalizeProjectStatus } from "./projectStatus";

const MANAGER_APP_NAME = "system-manager-app";
const MANAGER_COLLECTION = "systems";
const PRECONFIG_COLLECTION = "systemPreconfigs";
const ICON_COLLECTION = "iconCollections";
const ADDON_COLLECTION = "add_ons";
const MANAGER_COLLECTIONS_READ = ["systems"];
const MANAGER_COLLECTIONS_DELETE = ["systems", "sistemas"];
const FORCED_SHARED_STORAGE_BUCKET = "teste-aa015.appspot.com";
const NON_CONFIGURABLE_MANAGER_SYSTEM_KEYS = new Set(["aly-onepages-runtime"]);

let managerDbSingleton = null;

async function callLimparEnvsProjetoNoVercel(data) {
  const user = auth?.currentUser;
  if (!user?.getIdToken) {
    throw new Error("Usuario autenticado obrigatorio para limpar ENV no Vercel.");
  }

  return postSharedFunctionJson("limparEnvsProjetoNoVercelHttp", {
    payload: data,
    idToken: await user.getIdToken(),
  });
}

async function callSharedManagerRead(endpoint, payload = {}) {
  const user = auth?.currentUser;
  if (!user?.getIdToken) {
    throw new Error("Usuario autenticado obrigatorio para consultar dados do gerenciador.");
  }

  return postSharedFunctionJson(endpoint, {
    payload,
    idToken: await user.getIdToken(),
  });
}

async function callSharedManagerAction(endpoint, payload = {}) {
  const user = auth?.currentUser;
  if (!user?.getIdToken) {
    throw new Error("Usuario autenticado obrigatorio para gerenciar dados do gerenciador.");
  }

  return postSharedFunctionJson(endpoint, {
    payload,
    idToken: await user.getIdToken(),
  });
}

function shouldFallbackToDirectManagerRead(error) {
  const code = normalizeText(error?.code).toLowerCase();
  const message = normalizeText(error?.message).toLowerCase();

  if (error instanceof TypeError) return true;
  if (code === "failed-precondition") return true;
  if (code === "unavailable") return true;
  if (code === "resource-exhausted") return true;
  if (code === "http-429") return true;
  if (code === "http-404") return true;
  if (code === "http-500") return true;
  if (message.includes("failed to fetch")) return true;
  if (message.includes("cors")) return true;
  if (message.includes("quota exceeded")) return true;
  if (message.includes("resource_exhausted")) return true;
  if (message.includes("backend compartilhado")) return true;
  if (message.includes("nao configurado")) return true;

  return false;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizarIpsBloqueadosRegistro(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeText(item).replace(/^::ffff:/, "").toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 500);
}

function normalizarUsuariosBloqueadosRegistro(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => {
          const normalized = normalizeText(item);
          return normalized.includes("@") ? normalized.toLowerCase() : normalized;
        })
        .filter(Boolean)
    )
  ).slice(0, 500);
}

function buildAccessRangeStart(startDate = "") {
  const normalized = normalizeText(startDate);
  if (!normalized) return null;
  const timestamp = new Date(`${normalized}T00:00:00.000`);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function buildAccessRangeEnd(endDate = "") {
  const normalized = normalizeText(endDate);
  if (!normalized) return null;
  const timestamp = new Date(`${normalized}T23:59:59.999`);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function getAccessTimestampMs(item = {}) {
  const value = item?.data || item?.criadoEm;
  if (!value) return NaN;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }
  if (typeof value?._seconds === "number") {
    return value._seconds * 1000;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const timestamp = Number.isFinite(Number(value)) ? Number(value) : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function filterAccessItemsByQuery(items = [], { projectSystemKey = "", startDate = "", endDate = "" } = {}) {
  const projectSystemKeyNormalizado = normalizeText(projectSystemKey).toLowerCase();
  const startAt = buildAccessRangeStart(startDate);
  const endAt = buildAccessRangeEnd(endDate);

  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemProjectKey = normalizeText(
      item?.projectSystemKey || item?.runtimeProjectKey
    ).toLowerCase();
    const itemTimestamp = getAccessTimestampMs(item);

    if (projectSystemKeyNormalizado && itemProjectKey !== projectSystemKeyNormalizado) {
      return false;
    }
    if (startAt && (!Number.isFinite(itemTimestamp) || itemTimestamp < startAt.getTime())) {
      return false;
    }
    if (endAt && (!Number.isFinite(itemTimestamp) || itemTimestamp > endAt.getTime())) {
      return false;
    }
    return true;
  });
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

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
  }
  return [];
}

function normalizeThemeIds(value) {
  return normalizeIdList(value).map((item) => item.toUpperCase());
}

function normalizeProjectType(value) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "manager" || raw === "menager" || raw === "gerenciador") return "manager";
  if (raw === "oneowner") return "oneowner";
  if (raw === "multipage") return "multiowner";
  if (raw === "onepage") return "oneowner";
  return raw === "oneowner" ? "oneowner" : "multiowner";
}

function isSharedOneownerRuntimeProjectId(projectId = "") {
  const normalized = normalizeText(projectId).toLowerCase();
  const runtimeProjectId = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_PROJECT_ID
  ).toLowerCase();

  return Boolean(
    normalized &&
      (
        normalized === "aly-onepages-runtime" ||
        (runtimeProjectId && normalized === runtimeProjectId)
      )
  );
}

function getManagerProjectIdNormalized() {
  return normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID).toLowerCase();
}

function resolveProjectTypeFromData(data = {}) {
  const managerProjectId = getManagerProjectIdNormalized();
  const systemKey = normalizeText(data?.systemKey || data?.id).toLowerCase();
  const firebaseProjectId = normalizeText(
    data?.firebaseProjectId || data?.projectId || data?.firebaseRuntimeConfig?.projectId
  ).toLowerCase();

  if (
    managerProjectId &&
    (systemKey === managerProjectId || firebaseProjectId === managerProjectId)
  ) {
    return "manager";
  }

  const configTipoExperiencia = normalizeText(data?.configSistema?.tipoExperiencia);
  if (configTipoExperiencia) {
    return normalizeProjectType(configTipoExperiencia);
  }
  return normalizeProjectType(data?.tipoProjeto || "multiowner");
}

function normalizeIconItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: normalizeText(item?.id || `icon_${index}`),
      label: normalizeText(item?.label || item?.nome || ""),
      url: normalizeText(item?.url || item?.iconUrl || ""),
      path: normalizeText(item?.path || item?.iconPath || ""),
    }))
    .filter((item) => item.id && item.label && item.url);
}

function normalizeAddOnItem(data = {}, fallbackId = "") {
  const nome = normalizeText(data?.nome || data?.label || data?.nomeAddOn || fallbackId);
  return {
    id: normalizeText(data?.id || fallbackId),
    nome,
    nomeBusca: normalizeText(data?.nomeBusca || nome).toLowerCase(),
    url_img: normalizeText(data?.url_img || data?.imageUrl || data?.url || ""),
    path_img: normalizeText(data?.path_img || data?.imagePath || data?.path || ""),
    descricao: normalizeText(data?.descricao || ""),
    ativo: typeof data?.ativo === "boolean" ? data.ativo : true,
    criadoPorUid: normalizeText(data?.criadoPorUid),
    atualizadoPorUid: normalizeText(data?.atualizadoPorUid),
  };
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

async function resolveAvailableSystemKey(managerDb, desiredKey = "") {
  const keyBase = normalizeSystemKey(desiredKey);
  if (!keyBase) return "";

  const docInicial = await getDoc(doc(managerDb, MANAGER_COLLECTION, keyBase));
  if (!docInicial.exists()) {
    return keyBase;
  }

  for (let index = 2; index <= 500; index += 1) {
    const candidato = `${keyBase}-${index}`;
    const snap = await getDoc(doc(managerDb, MANAGER_COLLECTION, candidato));
    if (!snap.exists()) {
      return candidato;
    }
  }

  throw new Error("Nao foi possivel gerar uma chave unica para o projeto.");
}

function isNonConfigurableManagerProject(item = {}) {
  const systemKey = normalizeText(item?.systemKey || item?.id).toLowerCase();
  return NON_CONFIGURABLE_MANAGER_SYSTEM_KEYS.has(systemKey);
}

function toEnvPrefix(systemKey) {
  return normalizeText(systemKey).replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

function getOneownerRuntimeConfigFromEnv() {
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

function buildManagerRuntimeConfigFromEnv() {
  const managerConfig = buildManagerConfigFromEnv();
  if (!managerConfig) return null;
  return {
    ...managerConfig,
    functionsRegion: normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_FUNCTIONS_REGION || "us-central1"),
  };
}

function sanitizePreconfigTemplate(configSistema = {}) {
  if (!configSistema || typeof configSistema !== "object") return {};

  const {
    id,
    sourceCollection,
    systemKey,
    systemName,
    nomeProjeto,
    nomePreconfig,
    preconfigKey,
    baseProjectSystemKey,
    tipoProjeto,
    firebaseProjectId,
    projectId,
    domains,
    firebaseRuntimeConfig,
    configSistema: configSistemaInterna,
    config: configInterna,
    criadoEm,
    atualizadoEm,
    criadoPorUid,
    atualizadoPorUid,
    tituloSistema,
    ownerUid,
    ownerEmail,
    adminUid,
    adminEmail,
    statusProjeto,
    projectSystemKey,
    projectOwnerUid,
    projectLastEditorUid,
    preconfigBaseKey,
    preconfigBaseName,
    ...resto
  } = configSistema;

  void id;
  void sourceCollection;
  void systemKey;
  void systemName;
  void nomeProjeto;
  void nomePreconfig;
  void preconfigKey;
  void baseProjectSystemKey;
  void tipoProjeto;
  void firebaseProjectId;
  void projectId;
  void domains;
  void firebaseRuntimeConfig;
  void configSistemaInterna;
  void configInterna;
  void criadoEm;
  void atualizadoEm;
  void criadoPorUid;
  void atualizadoPorUid;
  void tituloSistema;
  void ownerUid;
  void ownerEmail;
  void adminUid;
  void adminEmail;
  void statusProjeto;
  void projectSystemKey;
  void projectOwnerUid;
  void projectLastEditorUid;
  void preconfigBaseKey;
  void preconfigBaseName;

  return resto;
}

function sanitizeFirebaseTemplateForPreconfig(firebaseRuntimeConfig = {}, tipoProjeto = "multiowner") {
  const tipoNormalizado = normalizeProjectType(tipoProjeto);
  if (tipoNormalizado === "oneowner") {
    return {
      functionsRegion: normalizeText(firebaseRuntimeConfig?.functionsRegion || "us-central1"),
    };
  }

  return {
    functionsRegion: normalizeText(firebaseRuntimeConfig?.functionsRegion || "us-central1"),
    databaseURL: normalizeText(firebaseRuntimeConfig?.databaseURL || ""),
  };
}

function resolveRuntimeConfigForProjectType({
  tipoProjeto = "multiowner",
  dataAtual = {},
  projectId = "",
  firebaseConfig = {},
} = {}) {
  const tipoProjetoNormalizado = normalizeProjectType(tipoProjeto);

  if (tipoProjetoNormalizado === "oneowner") {
    const runtime = getOneownerRuntimeConfigFromEnv();
    if (!runtime) {
      throw new Error(
        "Runtime oneowner nao configurado no .env (REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_*)."
      );
    }
    return runtime;
  }

  if (tipoProjetoNormalizado === "manager") {
    const runtime = buildManagerRuntimeConfigFromEnv();
    if (!runtime) {
      throw new Error(
        "Projeto manager nao configurado no .env (REACT_APP_SYSTEM_MANAGER_*)."
      );
    }
    return runtime;
  }

  const runtimeAtual =
    dataAtual?.firebaseRuntimeConfig && typeof dataAtual.firebaseRuntimeConfig === "object"
      ? dataAtual.firebaseRuntimeConfig
      : {};
  const projectIdAtual = normalizeText(
    dataAtual?.firebaseProjectId ||
      dataAtual?.projectId ||
      dataAtual?.firebaseRuntimeConfig?.projectId
  );
  const runtimeProjectIdAtual = normalizeText(runtimeAtual?.projectId);
  const runtimeOneowner = getOneownerRuntimeConfigFromEnv();
  const runtimeOneownerProjectId = normalizeText(runtimeOneowner?.projectId);

  const projectIdFinal = normalizeText(projectId || firebaseConfig?.projectId || runtimeProjectIdAtual);
  const payload = {
    apiKey: normalizeText(firebaseConfig?.apiKey || runtimeAtual?.apiKey),
    authDomain: normalizeText(firebaseConfig?.authDomain || runtimeAtual?.authDomain),
    projectId: projectIdFinal,
    storageBucket: normalizeText(firebaseConfig?.storageBucket || runtimeAtual?.storageBucket),
    messagingSenderId: normalizeText(
      firebaseConfig?.messagingSenderId || runtimeAtual?.messagingSenderId
    ),
    appId: normalizeText(firebaseConfig?.appId || runtimeAtual?.appId),
    databaseURL: normalizeText(firebaseConfig?.databaseURL || runtimeAtual?.databaseURL),
    functionsRegion: normalizeText(
      firebaseConfig?.functionsRegion || runtimeAtual?.functionsRegion || "us-central1"
    ),
  };

  const obrigatorios = [
    payload.apiKey,
    payload.authDomain,
    payload.projectId,
    payload.storageBucket,
    payload.messagingSenderId,
    payload.appId,
  ];

  if (obrigatorios.some((item) => !item)) {
    const estavaEmOneowner =
      runtimeProjectIdAtual === runtimeOneownerProjectId || projectIdAtual === runtimeOneownerProjectId;
    if (estavaEmOneowner) {
      throw new Error(
        "Para converter este projeto para multiowner, informe primeiro as credenciais Firebase do projeto definitivo."
      );
    }
    throw new Error("Credenciais Firebase incompletas para o projeto multiowner.");
  }

  return payload;
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

export function obterFirestoreDoGerenciador() {
  return getManagerDb();
}

export async function listarUsuariosEspelhadosNoGerenciador({ limit: maxItems = 300 } = {}) {
  const managerDb = getManagerDb();

  try {
    const response = await callSharedManagerRead("listarUsuariosGerenciadorHttp", {
      limit: maxItems,
    });
    return Array.isArray(response?.items) ? response.items : [];
  } catch (error) {
    if (!managerDb || !shouldFallbackToDirectManagerRead(error)) {
      throw error;
    }
  }

  const snap = await getDocs(collection(managerDb, "usuarios_projetos"));
  return snap.docs
    .map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() || {}),
    }))
    .sort((a, b) => {
      const dataA = a?.ultimaSincronizacaoEm?.seconds || 0;
      const dataB = b?.ultimaSincronizacaoEm?.seconds || 0;
      return dataB - dataA;
    })
    .slice(0, maxItems);
}

export async function listarAcessosNoGerenciador({
  limit: maxItems = 100,
  projectSystemKey = "",
  startDate = "",
  endDate = "",
} = {}) {
  const managerDb = getManagerDb();
  const projectSystemKeyNormalizado = normalizeText(projectSystemKey).toLowerCase();
  const startAt = buildAccessRangeStart(startDate);
  const endAt = buildAccessRangeEnd(endDate);

  try {
    const response = await callSharedManagerRead("listarAcessosGerenciadorHttp", {
      limit: maxItems,
      projectSystemKey: projectSystemKeyNormalizado || null,
      startDate: normalizeText(startDate) || null,
      endDate: normalizeText(endDate) || null,
    });
    return Array.isArray(response?.items) ? response.items : [];
  } catch (error) {
    if (!managerDb || !shouldFallbackToDirectManagerRead(error)) {
      throw error;
    }
  }

  const constraints = [];
  if (projectSystemKeyNormalizado) {
    constraints.push(where("projectSystemKey", "==", projectSystemKeyNormalizado));
  }
  if (startAt) {
    constraints.push(where("data", ">=", startAt));
  }
  if (endAt) {
    constraints.push(where("data", "<=", endAt));
  }
  constraints.push(orderBy("data", "desc"));
  constraints.push(limit(maxItems));

  try {
    const snap = await getDocs(query(collection(managerDb, "acessos"), ...constraints));
    return snap.docs
      .map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() || {}),
      }))
      .sort((a, b) => {
        const dataA = a?.data?.seconds || 0;
        const dataB = b?.data?.seconds || 0;
        return dataB - dataA;
      })
      .slice(0, maxItems);
  } catch (error) {
    if (error?.code !== "failed-precondition") {
      throw error;
    }

    const fallbackSnap = await getDocs(
      query(collection(managerDb, "acessos"), orderBy("data", "desc"), limit(maxItems))
    );

    return filterAccessItemsByQuery(
      fallbackSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() || {}),
      })),
      {
        projectSystemKey: projectSystemKeyNormalizado,
        startDate,
        endDate,
      }
    ).slice(0, maxItems);
  }
}

export async function obterConfigAcessosNoGerenciador() {
  const managerDb = getManagerDb();

  try {
    const response = await callSharedManagerRead("obterConfigAcessosGerenciadorHttp", {});
    return {
      ipsBloqueadosRegistro: normalizarIpsBloqueadosRegistro(
        response?.ipsBloqueadosRegistro || response?.ipsBloqueados || response?.blockedIps
      ),
      usuariosBloqueadosRegistro: normalizarUsuariosBloqueadosRegistro(
        response?.usuariosBloqueadosRegistro ||
          response?.usuariosBloqueados ||
          response?.blockedUsers ||
          response?.uidsBloqueadosRegistro
      ),
    };
  } catch (error) {
    if (!managerDb || !shouldFallbackToDirectManagerRead(error)) {
      throw error;
    }
  }

  const snap = await getDoc(doc(managerDb, "access_settings", "registro"));
  const data = snap.exists() ? snap.data() || {} : {};

  return {
    ipsBloqueadosRegistro: normalizarIpsBloqueadosRegistro(
      data.ipsBloqueadosRegistro || data.ipsBloqueados || data.blockedIps
    ),
    usuariosBloqueadosRegistro: normalizarUsuariosBloqueadosRegistro(
      data.usuariosBloqueadosRegistro ||
        data.usuariosBloqueados ||
        data.blockedUsers ||
        data.uidsBloqueadosRegistro
    ),
  };
}

export async function salvarConfigAcessosNoGerenciador({
  ipsBloqueadosRegistro = [],
  usuariosBloqueadosRegistro = [],
} = {}) {
  const ipsNormalizados = normalizarIpsBloqueadosRegistro(ipsBloqueadosRegistro);
  const usuariosNormalizados = normalizarUsuariosBloqueadosRegistro(
    usuariosBloqueadosRegistro
  );
  const managerDb = getManagerDb();

  try {
    const response = await callSharedManagerAction("salvarConfigAcessosGerenciadorHttp", {
      ipsBloqueadosRegistro: ipsNormalizados,
      usuariosBloqueadosRegistro: usuariosNormalizados,
    });
    return {
      ipsBloqueadosRegistro: normalizarIpsBloqueadosRegistro(
        response?.ipsBloqueadosRegistro || ipsNormalizados
      ),
      usuariosBloqueadosRegistro: normalizarUsuariosBloqueadosRegistro(
        response?.usuariosBloqueadosRegistro || usuariosNormalizados
      ),
    };
  } catch (error) {
    if (!managerDb || !shouldFallbackToDirectManagerRead(error)) {
      throw error;
    }
  }

  await setDoc(
    doc(managerDb, "access_settings", "registro"),
    {
      ipsBloqueadosRegistro: ipsNormalizados,
      usuariosBloqueadosRegistro: usuariosNormalizados,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ipsBloqueadosRegistro: ipsNormalizados,
    usuariosBloqueadosRegistro: usuariosNormalizados,
  };
}

function extrairConfigSistemaDoDocumento(data = {}) {
  if (data && typeof data.configSistema === "object" && data.configSistema) {
    return {
      ...data,
      ...data.configSistema,
    };
  }
  if (data && typeof data.config === "object" && data.config) {
    return {
      ...data,
      ...data.config,
    };
  }
  return data;
}

function montarResultadoConfigSistema(docSnap) {
  if (!docSnap?.exists?.()) return null;
  const data = docSnap.data() || {};
  const configBase = extrairConfigSistemaDoDocumento(data);
  const statusProjeto = normalizeProjectStatus(
    configBase?.statusProjeto || data?.statusProjeto,
    {
      projectSystemKey: configBase?.projectSystemKey || data?.systemKey || docSnap.id,
      firebaseProjectId:
        configBase?.firebaseProjectId ||
        data?.firebaseProjectId ||
        data?.projectId ||
        data?.firebaseRuntimeConfig?.projectId,
      systemKey: data?.systemKey || docSnap.id,
      nomeProjeto: data?.nomeProjeto || configBase?.nomeProjeto,
      tituloSistema: configBase?.tituloSistema || data?.tituloSistema,
    }
  );
  return {
    ...configBase,
    systemKey: normalizeText(data.systemKey || docSnap.id),
    statusProjeto,
  };
}

export function gerenciadorSistemasHabilitado() {
  return !!buildManagerConfigFromEnv();
}

export async function listarIconCollectionsNoGerenciador() {
  const managerDb = getManagerDb();
  if (!managerDb) return [];

  const snap = await getDocs(collection(managerDb, ICON_COLLECTION));
  return snap.docs
    .map((docItem) => {
      const data = docItem.data() || {};
      return {
        id: docItem.id,
        nome: normalizeText(data.nome || data.nomeColecao || docItem.id),
        themeIds: normalizeThemeIds(data.themeIds || data.temasPermitidos),
        icons: normalizeIconItems(data.icons),
        criadoPorUid: normalizeText(data.criadoPorUid),
        atualizadoPorUid: normalizeText(data.atualizadoPorUid),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function listarAddOnsNoGerenciador({
  search = "",
  onlyActive = false,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) return [];

  const buscaNormalizada = normalizeText(search).toLowerCase();
  const snap = await getDocs(collection(managerDb, ADDON_COLLECTION));

  return snap.docs
    .map((docItem) => normalizeAddOnItem(docItem.data() || {}, docItem.id))
    .filter((item) => item.id && item.id !== "sistema_config")
    .filter((item) => (onlyActive ? item.ativo !== false : true))
    .filter((item) => {
      if (!buscaNormalizada) return true;
      return (
        item.nome.toLowerCase().includes(buscaNormalizada) ||
        item.nomeBusca.includes(buscaNormalizada)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarAddOnNoGerenciador({
  nome = "",
  descricao = "",
  criadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const nomeNormalizado = normalizeText(nome);
  if (!nomeNormalizado) {
    throw new Error("Informe o nome do add-on.");
  }

  const docRef = doc(collection(managerDb, ADDON_COLLECTION));
  await setDoc(
    docRef,
    {
      nome: nomeNormalizado,
      nomeBusca: nomeNormalizado.toLowerCase(),
      descricao: normalizeText(descricao),
      url_img: "",
      path_img: "",
      ativo: true,
      criadoPorUid: normalizeText(criadoPorUid),
      atualizadoPorUid: normalizeText(criadoPorUid),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: docRef.id,
    nome: nomeNormalizado,
    nomeBusca: nomeNormalizado.toLowerCase(),
    descricao: normalizeText(descricao),
    url_img: "",
    path_img: "",
    ativo: true,
  };
}

export async function salvarAddOnNoGerenciador({
  addOnId = "",
  nome,
  descricao,
  url_img,
  path_img,
  ativo,
  atualizadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const addOnIdNormalizado = normalizeText(addOnId);
  if (!addOnIdNormalizado || addOnIdNormalizado === "sistema_config") {
    throw new Error("Add-on invalido.");
  }

  const payload = {
    atualizadoPorUid: normalizeText(atualizadoPorUid),
    atualizadoEm: serverTimestamp(),
  };

  if (typeof nome !== "undefined") {
    const nomeNormalizado = normalizeText(nome);
    payload.nome = nomeNormalizado;
    payload.nomeBusca = nomeNormalizado.toLowerCase();
  }
  if (typeof descricao !== "undefined") {
    payload.descricao = normalizeText(descricao);
  }
  if (typeof url_img !== "undefined") {
    payload.url_img = normalizeText(url_img);
  }
  if (typeof path_img !== "undefined") {
    payload.path_img = normalizeText(path_img);
  }
  if (typeof ativo === "boolean") {
    payload.ativo = ativo;
  }

  await setDoc(doc(managerDb, ADDON_COLLECTION, addOnIdNormalizado), payload, {
    merge: true,
  });

  return true;
}

export async function removerAddOnNoGerenciador({
  addOnId = "",
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const addOnIdNormalizado = normalizeText(addOnId);
  if (!addOnIdNormalizado || addOnIdNormalizado === "sistema_config") {
    throw new Error("Add-on invalido.");
  }

  await deleteDoc(doc(managerDb, ADDON_COLLECTION, addOnIdNormalizado));
  return true;
}

function getAddOnsUsuarioProjetoCollection(ownerUserId = "") {
  const ownerUidNormalizado = normalizeText(ownerUserId);
  if (!ownerUidNormalizado) {
    throw new Error("Usuario owner obrigatorio para gerenciar add-ons.");
  }

  return getPrimaryProjectCollection(
    dbProjetoAtivo,
    "users",
    ownerUidNormalizado,
    ADDON_COLLECTION
  );
}

export async function listarAddOnsDoUsuarioProjeto({
  ownerUserId = "",
  search = "",
  onlyActive = false,
} = {}) {
  const buscaNormalizada = normalizeText(search).toLowerCase();
  const snap = await getDocs(getAddOnsUsuarioProjetoCollection(ownerUserId));

  return snap.docs
    .map((docItem) => normalizeAddOnItem(docItem.data() || {}, docItem.id))
    .filter((item) => item.id && item.id !== "sistema_config")
    .filter((item) => (onlyActive ? item.ativo !== false : true))
    .filter((item) => {
      if (!buscaNormalizada) return true;
      return (
        item.nome.toLowerCase().includes(buscaNormalizada) ||
        item.nomeBusca.includes(buscaNormalizada)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarAddOnDoUsuarioProjeto({
  ownerUserId = "",
  nome = "",
  descricao = "",
  criadoPorUid = null,
} = {}) {
  const nomeNormalizado = normalizeText(nome);
  if (!nomeNormalizado) {
    throw new Error("Informe o nome do add-on.");
  }

  const docRef = doc(getAddOnsUsuarioProjetoCollection(ownerUserId));
  await setDoc(
    docRef,
    {
      nome: nomeNormalizado,
      nomeBusca: nomeNormalizado.toLowerCase(),
      descricao: normalizeText(descricao),
      url_img: "",
      path_img: "",
      ativo: true,
      ownerUserId: normalizeText(ownerUserId),
      criadoPorUid: normalizeText(criadoPorUid),
      atualizadoPorUid: normalizeText(criadoPorUid),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: docRef.id,
    nome: nomeNormalizado,
    nomeBusca: nomeNormalizado.toLowerCase(),
    descricao: normalizeText(descricao),
    url_img: "",
    path_img: "",
    ativo: true,
    ownerUserId: normalizeText(ownerUserId),
  };
}

export async function salvarAddOnDoUsuarioProjeto({
  ownerUserId = "",
  addOnId = "",
  nome,
  descricao,
  url_img,
  path_img,
  ativo,
  atualizadoPorUid = null,
} = {}) {
  const addOnIdNormalizado = normalizeText(addOnId);
  if (!addOnIdNormalizado || addOnIdNormalizado === "sistema_config") {
    throw new Error("Add-on invalido.");
  }

  const payload = {
    ownerUserId: normalizeText(ownerUserId),
    atualizadoPorUid: normalizeText(atualizadoPorUid),
    atualizadoEm: serverTimestamp(),
  };

  if (typeof nome !== "undefined") {
    const nomeNormalizado = normalizeText(nome);
    payload.nome = nomeNormalizado;
    payload.nomeBusca = nomeNormalizado.toLowerCase();
  }
  if (typeof descricao !== "undefined") {
    payload.descricao = normalizeText(descricao);
  }
  if (typeof url_img !== "undefined") {
    payload.url_img = normalizeText(url_img);
  }
  if (typeof path_img !== "undefined") {
    payload.path_img = normalizeText(path_img);
  }
  if (typeof ativo === "boolean") {
    payload.ativo = ativo;
  }

  await setDoc(
    doc(getAddOnsUsuarioProjetoCollection(ownerUserId), addOnIdNormalizado),
    payload,
    { merge: true }
  );

  return true;
}

export async function removerAddOnDoUsuarioProjeto({
  ownerUserId = "",
  addOnId = "",
} = {}) {
  const addOnIdNormalizado = normalizeText(addOnId);
  if (!addOnIdNormalizado || addOnIdNormalizado === "sistema_config") {
    throw new Error("Add-on invalido.");
  }

  await deleteDoc(doc(getAddOnsUsuarioProjetoCollection(ownerUserId), addOnIdNormalizado));
  return true;
}

export async function criarIconCollectionNoGerenciador({
  nome = "",
  themeIds = [],
  criadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const nomeNormalizado = normalizeText(nome);
  const themeIdsNormalizados = normalizeThemeIds(themeIds);
  if (!nomeNormalizado) {
    throw new Error("Informe o nome da colecao.");
  }
  if (!themeIdsNormalizados.length) {
    throw new Error("Selecione ao menos um tema permitido para a colecao.");
  }

  const docRef = doc(collection(managerDb, ICON_COLLECTION));
  await setDoc(
    docRef,
    {
      nome: nomeNormalizado,
      themeIds: themeIdsNormalizados,
      icons: [],
      criadoPorUid: normalizeText(criadoPorUid),
      atualizadoPorUid: normalizeText(criadoPorUid),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: docRef.id,
    nome: nomeNormalizado,
    themeIds: themeIdsNormalizados,
    icons: [],
  };
}

export async function salvarIconCollectionNoGerenciador({
  collectionId = "",
  nome = "",
  themeIds = [],
  icons = [],
  atualizadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const collectionIdNormalizado = normalizeText(collectionId);
  if (!collectionIdNormalizado) {
    throw new Error("Colecao de icones invalida.");
  }

  const payload = {
    atualizadoPorUid: normalizeText(atualizadoPorUid),
    atualizadoEm: serverTimestamp(),
  };

  if (normalizeText(nome)) {
    payload.nome = normalizeText(nome);
  }
  if (Array.isArray(themeIds)) {
    payload.themeIds = normalizeThemeIds(themeIds);
  }
  if (Array.isArray(icons)) {
    payload.icons = normalizeIconItems(icons);
  }

  await setDoc(doc(managerDb, ICON_COLLECTION, collectionIdNormalizado), payload, {
    merge: true,
  });

  return true;
}

export async function removerIconCollectionNoGerenciador({
  collectionId = "",
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const collectionIdNormalizado = normalizeText(collectionId);
  if (!collectionIdNormalizado) {
    throw new Error("Colecao de icones invalida.");
  }

  await deleteDoc(doc(managerDb, ICON_COLLECTION, collectionIdNormalizado));
  return true;
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
  strictDomainMatch = false,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) return null;

  const keyNormalizada = normalizeText(projectKey);
  const keySistemaNormalizada = normalizeSystemKey(projectKey);
  const projectIdNormalizado = normalizeText(projectId);
  const hostNormalizado = normalizeHost(hostname);

  if (strictDomainMatch && hostNormalizado) {
    const byDomainQuery = query(
      collection(managerDb, MANAGER_COLLECTION),
      where("domains", "array-contains", hostNormalizado),
      limit(1)
    );
    const domainSnap = await getDocs(byDomainQuery);
    if (!domainSnap.empty) {
      return montarResultadoConfigSistema(domainSnap.docs[0]);
    }
    return null;
  }

  // 1) Prioridade: doc por key do sistema.
  const systemKeyCandidates = Array.from(
    new Set([keyNormalizada, keySistemaNormalizada].filter(Boolean))
  );
  for (const systemKeyCandidate of systemKeyCandidates) {
    const docRef = doc(managerDb, MANAGER_COLLECTION, systemKeyCandidate);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return montarResultadoConfigSistema(docSnap);
    }
  }

  // 2) Busca por dominio.
  if (hostNormalizado) {
    const byDomainQuery = query(
      collection(managerDb, MANAGER_COLLECTION),
      where("domains", "array-contains", hostNormalizado),
      limit(1)
    );
    const domainSnap = await getDocs(byDomainQuery);
    if (!domainSnap.empty) {
      return montarResultadoConfigSistema(domainSnap.docs[0]);
    }
  }

  // 3) Busca por projectId Firebase.
  // Importante: projectId pode ser compartilhado entre varios projetos oneowner.
  // Por isso ele deve ficar depois da busca por dominio.
  const podeResolverPorProjectId =
    projectIdNormalizado &&
    (
      !isSharedOneownerRuntimeProjectId(projectIdNormalizado) ||
      Boolean(hostNormalizado) ||
      !systemKeyCandidates.length
    );

  if (podeResolverPorProjectId) {
    const byProjectIdQuery = query(
      collection(managerDb, MANAGER_COLLECTION),
      where("firebaseProjectId", "==", projectIdNormalizado),
      limit(1)
    );
    const projectIdSnap = await getDocs(byProjectIdQuery);
    if (!projectIdSnap.empty) {
      return montarResultadoConfigSistema(projectIdSnap.docs[0]);
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
  firebaseConfig = {},
  preconfigBaseKey = "",
  preconfigBaseName = "",
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
  const tipoProjetoFinal = resolveProjectTypeFromData({
    ...dataAtual,
    configSistema: configSistemaFinal,
  });
  const runtimeConfigFinal = resolveRuntimeConfigForProjectType({
    tipoProjeto: tipoProjetoFinal,
    dataAtual,
    projectId,
    firebaseConfig,
  });
  const statusProjetoFinal = normalizeProjectStatus(
    configSistemaFinal?.statusProjeto || dataAtual?.statusProjeto,
    {
      projectSystemKey:
        configSistemaFinal?.projectSystemKey || dataAtual?.systemKey || keyNormalizada,
      firebaseProjectId:
        runtimeConfigFinal?.projectId ||
        projectId ||
        dataAtual?.firebaseProjectId ||
        dataAtual?.projectId ||
        dataAtual?.firebaseRuntimeConfig?.projectId,
      systemKey: dataAtual?.systemKey || keyNormalizada,
      nomeProjeto: dataAtual?.nomeProjeto,
      tituloSistema: configSistemaFinal?.tituloSistema,
      fallback: PROJECT_STATUS_ACTIVE,
    }
  );
  const projectSystemKeyFinal = normalizeText(
    configSistemaFinal?.projectSystemKey || keyNormalizada
  );

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      tipoProjeto: tipoProjetoFinal,
      statusProjeto: statusProjetoFinal,
      firebaseProjectId: normalizeText(runtimeConfigFinal?.projectId || projectId),
      domains: Array.from(domainsSet),
      firebaseRuntimeConfig: runtimeConfigFinal,
      configSistema: {
        ...configSistemaFinal,
        statusProjeto: statusProjetoFinal,
        projectSystemKey: projectSystemKeyFinal || keyNormalizada,
      },
      preconfigBaseKey: normalizeText(preconfigBaseKey || dataAtual?.preconfigBaseKey || ""),
      preconfigBaseName: normalizeText(preconfigBaseName || dataAtual?.preconfigBaseName || ""),
      ...(uidAtualizacao ? { criadoPorUid: uidAtualizacao } : {}),
      atualizadoPorUid: uidAtualizacao || null,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    systemKey: keyNormalizada,
    tipoProjeto: tipoProjetoFinal,
    statusProjeto: statusProjetoFinal,
    firebaseProjectId: normalizeText(runtimeConfigFinal?.projectId || projectId),
    firebaseRuntimeConfig: runtimeConfigFinal,
    configSistema: {
      ...configSistemaFinal,
      statusProjeto: statusProjetoFinal,
      projectSystemKey: projectSystemKeyFinal || keyNormalizada,
    },
    preconfigBaseKey: normalizeText(preconfigBaseKey || dataAtual?.preconfigBaseKey || ""),
    preconfigBaseName: normalizeText(preconfigBaseName || dataAtual?.preconfigBaseName || ""),
  };
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
          tipoProjeto: resolveProjectTypeFromData(data),
          firebaseProjectId: normalizeText(
            data.firebaseProjectId || data.projectId || data?.firebaseRuntimeConfig?.projectId
          ),
          domains: Array.isArray(data.domains)
            ? data.domains.map((d) => normalizeHost(d)).filter(Boolean)
            : [],
          firebaseRuntimeConfig:
            data.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
              ? data.firebaseRuntimeConfig
              : {},
          statusProjeto: normalizeProjectStatus(
            data?.configSistema?.statusProjeto || data?.statusProjeto,
            {
              projectSystemKey: data.systemKey || docItem.id,
              firebaseProjectId:
                data.firebaseProjectId || data.projectId || data?.firebaseRuntimeConfig?.projectId,
              systemKey: data.systemKey || docItem.id,
              nomeProjeto: data.nomeProjeto,
              tituloSistema: data?.configSistema?.tituloSistema,
            }
          ),
          preconfigBaseKey: normalizeText(data.preconfigBaseKey),
          preconfigBaseName: normalizeText(data.preconfigBaseName),
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

  return Array.from(dedup.values())
    .filter((item) => !isNonConfigurableManagerProject(item))
    .sort((a, b) => a.systemKey.localeCompare(b.systemKey));
}

export async function criarSistemaNoGerenciador({
  nomeProjeto = "",
  systemKey = "",
  domains = [],
  tipoProjeto = "multiowner",
  firebaseConfig = {},
  criadoPorUid = null,
  ownerUid = "",
  preconfigInicial = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const nomeNormalizado = normalizeText(nomeProjeto);
  const systemKeyInformada = normalizeText(systemKey);
  const keyDesejada = normalizeSystemKey(systemKeyInformada || nomeNormalizado);
  const keyNormalizada = systemKeyInformada
    ? keyDesejada
    : await resolveAvailableSystemKey(managerDb, keyDesejada);
  const tipoProjetoNormalizado = normalizeProjectType(tipoProjeto);
  if (!keyNormalizada) {
    throw new Error("Nome/chave do projeto invalido.");
  }

  const domainsNorm = normalizeList(domains).map((host) => normalizeHost(host)).filter(Boolean);
  const preconfigNormalizada =
    preconfigInicial && typeof preconfigInicial === "object" ? preconfigInicial : null;
  const payloadFirebase = resolveRuntimeConfigForProjectType({
    tipoProjeto: tipoProjetoNormalizado,
    firebaseConfig,
  });

  const docRef = doc(managerDb, MANAGER_COLLECTION, keyNormalizada);
  const existente = await getDoc(docRef);
  if (existente.exists()) {
    throw new Error(
      tipoProjetoNormalizado === "oneowner"
        ? "Ja existe um projeto com essa chave de sistema. Em oneowner o runtime Firebase pode ser compartilhado, mas a chave/slug do projeto precisa ser unica."
        : "Ja existe um projeto com essa chave de sistema."
    );
  }

  const configTemplate =
    preconfigNormalizada?.configSistemaTemplate &&
    typeof preconfigNormalizada.configSistemaTemplate === "object"
      ? preconfigNormalizada.configSistemaTemplate
      : {};
  const temaPreconfig =
    normalizeText(
      configTemplate?.temaPadraoSistema ||
        preconfigNormalizada?.temaPadraoSistema ||
        preconfigNormalizada?.configSistema?.temaPadraoSistema
    ) || "CYBERPINK";
  const ownerUidNormalizado = normalizeText(ownerUid || configTemplate?.ownerUid);

  const configSistemaInicial = {
    ...configTemplate,
    tituloSistema: nomeNormalizado || keyNormalizada.toUpperCase(),
    temaPadraoSistema: temaPreconfig,
    statusProjeto: normalizeProjectStatus(configTemplate?.statusProjeto, {
      projectSystemKey: keyNormalizada,
      firebaseProjectId: payloadFirebase.projectId,
      systemKey: keyNormalizada,
      nomeProjeto: nomeNormalizado || keyNormalizada,
      tituloSistema: nomeNormalizado || keyNormalizada.toUpperCase(),
      fallback: PROJECT_STATUS_ACTIVE,
    }),
    loginPresetId: normalizeText(configTemplate?.loginPresetId || "manual") || "manual",
    destinoPosLogin:
      normalizeText(configTemplate?.destinoPosLogin || "home_skin_usuario") || "home_skin_usuario",
    exibirTituloSistemaNoLogin:
      typeof configTemplate?.exibirTituloSistemaNoLogin === "boolean"
        ? configTemplate.exibirTituloSistemaNoLogin
        : true,
    textoLogin: normalizeText(configTemplate?.textoLogin || "EMBARQUE COM O GOOGLE"),
    ownerUid: ownerUidNormalizado,
    adminUid: ownerUidNormalizado,
    projectSystemKey: keyNormalizada,
    projectOwnerUid: normalizeText(criadoPorUid || ownerUidNormalizado),
    ...(tipoProjetoNormalizado === "manager"
      ? {
          tipoExperiencia: "manager",
          modoAcessoProjeto: "privado_com_login",
          destinoPosLogin: "home_central_projeto",
        }
      : {}),
    ...(tipoProjetoNormalizado === "oneowner"
      ? {
          tipoExperiencia: "oneowner",
          modoAcessoProjeto: "publico_com_area_restrita",
          destinoPosLogin: "home_central_projeto",
        }
      : {}),
  };

  await setDoc(
    docRef,
    {
      systemKey: keyNormalizada,
      nomeProjeto: nomeNormalizado || keyNormalizada,
      tipoProjeto: tipoProjetoNormalizado,
      statusProjeto: configSistemaInicial.statusProjeto,
      firebaseProjectId: payloadFirebase.projectId,
      domains: domainsNorm,
      firebaseRuntimeConfig: payloadFirebase,
      configSistema: configSistemaInicial,
      preconfigBaseKey: normalizeText(preconfigNormalizada?.preconfigKey),
      preconfigBaseName: normalizeText(preconfigNormalizada?.nomePreconfig),
      criadoPorUid: normalizeText(criadoPorUid) || null,
      atualizadoPorUid: normalizeText(criadoPorUid) || null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    systemKey: keyNormalizada,
    nomeProjeto: nomeNormalizado || keyNormalizada,
    tipoProjeto: tipoProjetoNormalizado,
    statusProjeto: configSistemaInicial.statusProjeto,
    domains: domainsNorm,
    firebaseRuntimeConfig: payloadFirebase,
    configSistema: configSistemaInicial,
    preconfigBaseKey: normalizeText(preconfigNormalizada?.preconfigKey),
    preconfigBaseName: normalizeText(preconfigNormalizada?.nomePreconfig),
  };
}

export async function listarPreconfiguracoesNoGerenciador() {
  const managerDb = getManagerDb();
  if (!managerDb) return [];

  const snap = await getDocs(collection(managerDb, PRECONFIG_COLLECTION));
  return snap.docs
    .map((docItem) => {
      const data = docItem.data() || {};
      const configSistemaTemplate =
        data.configSistemaTemplate && typeof data.configSistemaTemplate === "object"
          ? data.configSistemaTemplate
          : {};
      return {
        id: docItem.id,
        preconfigKey: normalizeText(data.preconfigKey || docItem.id),
        nomePreconfig: normalizeText(data.nomePreconfig || data.nome || docItem.id),
        tipoProjeto: normalizeProjectType(data.tipoProjeto || data?.configSistemaTemplate?.tipoExperiencia),
        baseProjectSystemKey: normalizeText(data.baseProjectSystemKey),
        configSistemaTemplate,
        temaPadraoSistema: normalizeText(
          configSistemaTemplate?.temaPadraoSistema || data.temaPadraoSistema
        ),
        firebaseRuntimeTemplate:
          data.firebaseRuntimeTemplate && typeof data.firebaseRuntimeTemplate === "object"
            ? data.firebaseRuntimeTemplate
            : {},
        criadoPorUid: normalizeText(data.criadoPorUid),
        atualizadoPorUid: normalizeText(data.atualizadoPorUid),
      };
    })
    .sort((a, b) => a.nomePreconfig.localeCompare(b.nomePreconfig));
}

export async function salvarPreconfiguracaoProjetoNoGerenciador({
  projeto = null,
  preconfigKey = "",
  nomePreconfig = "",
  atualizadoPorUid = null,
} = {}) {
  const managerDb = getManagerDb();
  if (!managerDb) {
    throw new Error("Gerenciador de projetos nao configurado.");
  }

  const projetoBase = projeto && typeof projeto === "object" ? projeto : {};
  const tipoProjeto = resolveProjectTypeFromData(projetoBase);
  const keyNormalizada = normalizeSystemKey(
    preconfigKey ||
      projetoBase?.preconfigBaseKey ||
      projetoBase?.systemKey ||
      projetoBase?.nomeProjeto ||
      nomePreconfig
  );
  const nomeFinal =
    normalizeText(nomePreconfig) ||
    normalizeText(projetoBase?.preconfigBaseName) ||
    normalizeText(projetoBase?.nomeProjeto) ||
    keyNormalizada;

  if (!keyNormalizada) {
    throw new Error("Nome/chave da preconfiguracao invalido.");
  }

  let configSistemaFonte =
    projetoBase?.configSistema && typeof projetoBase.configSistema === "object"
      ? projetoBase.configSistema
      : {};

  if (normalizeText(projetoBase?.systemKey)) {
    try {
      const configAtualGerenciador = await obterConfigSistemaDoGerenciador({
        projectKey: projetoBase.systemKey,
        projectId:
          projetoBase?.firebaseProjectId ||
          projetoBase?.projectId ||
          projetoBase?.firebaseRuntimeConfig?.projectId ||
          "",
        hostname: Array.isArray(projetoBase?.domains) ? projetoBase.domains[0] || "" : "",
      });
      if (configAtualGerenciador && typeof configAtualGerenciador === "object") {
        configSistemaFonte = {
          ...configSistemaFonte,
          ...configAtualGerenciador,
        };
      }
    } catch {
      // Mantem o objeto em memoria quando a leitura mais atual falha.
    }
  }

  const configSistemaTemplate = sanitizePreconfigTemplate(configSistemaFonte);
  const firebaseRuntimeTemplate = sanitizeFirebaseTemplateForPreconfig(
    projetoBase?.firebaseRuntimeConfig || {},
    tipoProjeto
  );
  const docRef = doc(managerDb, PRECONFIG_COLLECTION, keyNormalizada);

  await setDoc(
    docRef,
    {
      preconfigKey: keyNormalizada,
      nomePreconfig: nomeFinal,
      tipoProjeto,
      baseProjectSystemKey: normalizeText(projetoBase?.systemKey),
      configSistemaTemplate,
      temaPadraoSistema: normalizeText(configSistemaTemplate?.temaPadraoSistema),
      firebaseRuntimeTemplate,
      atualizadoPorUid: normalizeText(atualizadoPorUid) || null,
      atualizadoEm: serverTimestamp(),
      criadoPorUid: normalizeText(atualizadoPorUid) || null,
      criadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  if (normalizeText(projetoBase?.systemKey)) {
    await setDoc(
      doc(managerDb, MANAGER_COLLECTION, normalizeText(projetoBase.systemKey)),
      {
        preconfigBaseKey: keyNormalizada,
        preconfigBaseName: nomeFinal,
        atualizadoPorUid: normalizeText(atualizadoPorUid) || null,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    ok: true,
    preconfigKey: keyNormalizada,
    nomePreconfig: nomeFinal,
    tipoProjeto,
    configSistemaTemplate,
    temaPadraoSistema: normalizeText(configSistemaTemplate?.temaPadraoSistema),
    firebaseRuntimeTemplate,
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
  return response || { ok: false };
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
  const avisos = [];

  for (const collectionName of MANAGER_COLLECTIONS_DELETE) {
    try {
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
    } catch (error) {
      if (collectionName === MANAGER_COLLECTION) {
        throw error;
      }
      avisos.push(
        `${collectionName}: ${normalizeText(error?.message || "falha ao remover registros legados")}`
      );
    }
  }

  return {
    ok: true,
    systemKey: keyNormalizada,
    envCleanup: resultadoLimpezaEnv || null,
    envCleanupError: erroLimpezaEnv || null,
    docsRemovidos,
    warnings: avisos,
  };
}

