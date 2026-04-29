import { addDoc, serverTimestamp, Timestamp } from "firebase/firestore";

import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  auth,
  db,
} from "../../Banco/init-firebase";
import { getPrimaryProjectCollection } from "../../Banco/projectDataRefs";
import { resolveProjectDataNamespaceKey } from "../../Banco/projectDataNamespace";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "./configSistema";
import { resolveAuditSeverity } from "./auditSeverity";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function resolveProjectSystemKey() {
  const namespaceKey = normalizeText(resolveProjectDataNamespaceKey(activeFirebaseProjectKey));
  return namespaceKey || normalizeText(activeFirebaseProjectKey) || null;
}

function buildClientContext() {
  if (typeof window === "undefined") {
    return {
      path: null,
      hostname: null,
      referrer: null,
      userAgent: null,
    };
  }

  return {
    path: normalizeText(`${window.location.pathname}${window.location.search}${window.location.hash}`) || null,
    hostname: normalizeText(window.location.hostname).toLowerCase() || null,
    referrer: normalizeText(document?.referrer) || null,
    userAgent: normalizeText(window.navigator?.userAgent) || null,
  };
}

function serializeFirestoreSafe(value, depth = 0) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (depth > 4) return "[max-depth]";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => serializeFirestoreSafe(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (key.startsWith("__")) return acc;
      if (typeof item === "function") return acc;
      acc[key] = serializeFirestoreSafe(item, depth + 1);
      return acc;
    }, {});
  }
  return String(value);
}

function cleanPayload(payload = {}) {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

const AUDIT_CATEGORY_BY_ENTITY = {
  acesso: "acessos",
  accessSettings: "acessos",
  usuario_projeto: "acessos",
  qrPrint: "rastreaveis",
  trackableLink: "rastreaveis",
  system: "configuracoes",
  systemConfig: "configuracoes",
  systemPreconfig: "configuracoes",
  iconCollection: "configuracoes",
  espaco: "conteudo",
  bloco: "conteudo",
  card: "conteudo",
  skin: "conteudo",
  addOn: "conteudo",
  addOnUsuario: "conteudo",
};

function resolveAuditCategory({ entityType = "", action = "", metadata = null } = {}) {
  const explicitCategory = normalizeText(metadata?.auditCategory || metadata?.categoriaAuditoria);
  if (explicitCategory) return explicitCategory;

  const normalizedEntityType = normalizeText(entityType);
  if (AUDIT_CATEGORY_BY_ENTITY[normalizedEntityType]) {
    return AUDIT_CATEGORY_BY_ENTITY[normalizedEntityType];
  }

  const normalizedAction = normalizeText(action).toLowerCase();
  if (normalizedAction.includes("rastreavel")) return "rastreaveis";
  if (normalizedAction.includes("acesso")) return "acessos";
  if (normalizedAction.includes("config") || normalizedAction.includes("projeto")) {
    return "configuracoes";
  }
  return "conteudo";
}

function auditCategoryEnabled(configSistema = DEFAULT_SISTEMA_CONFIG, category = "conteudo") {
  if (configSistema?.auditoriaAtiva === false) return false;

  if (category === "acessos") return configSistema?.auditarAcessos !== false;
  if (category === "rastreaveis") return configSistema?.auditarRastreaveis !== false;
  if (category === "configuracoes") return configSistema?.auditarConfiguracoes !== false;
  return configSistema?.auditarConteudo !== false;
}

function normalizeAuditRetentionDays(value, fallback = 180) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  const rounded = Math.round(numberValue);
  if (rounded < 0) return 0;
  if (rounded > 3650) return 3650;
  return rounded;
}

function buildAuditExpiresAt(configSistema = DEFAULT_SISTEMA_CONFIG) {
  const retentionDays = normalizeAuditRetentionDays(configSistema?.auditoriaRetencaoDias, 180);
  if (!retentionDays) return null;
  return Timestamp.fromDate(new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000));
}

function shouldRegisterAuditLog({ action = "", entityType = "", metadata = null } = {}) {
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const auditCategory = resolveAuditCategory({ action, entityType, metadata });
  return {
    auditCategory,
    enabled: auditCategoryEnabled(configSistema, auditCategory),
    configSistema,
  };
}

export async function registrarAuditLog({
  action = "",
  entityType = "",
  entityId = "",
  ownerUserId = "",
  espacoId = "",
  espacoNome = "",
  blocoId = "",
  cardId = "",
  projectSystemKey = "",
  motivo = "",
  source = "client",
  snapshotAntes = null,
  snapshotDepois = null,
  metadata = null,
} = {}) {
  const normalizedAction = normalizeText(action);
  const normalizedEntityType = normalizeText(entityType);
  const normalizedEntityId = normalizeText(entityId);
  const currentUser = auth.currentUser;

  if (!normalizedAction || !normalizedEntityType || !normalizedEntityId) {
    return null;
  }

  const { auditCategory, enabled, configSistema } = shouldRegisterAuditLog({
    action: normalizedAction,
    entityType: normalizedEntityType,
    metadata,
  });

  if (!enabled) {
    return null;
  }
  const auditSeverity = resolveAuditSeverity({
    action: normalizedAction,
    entityType: normalizedEntityType,
    metadata,
  });

  try {
    const auditRef = getPrimaryProjectCollection(db, "auditLogs");
    const docRef = await addDoc(
      auditRef,
      cleanPayload({
        action: normalizedAction,
        entityType: normalizedEntityType,
        entityId: normalizedEntityId,
        projectSystemKey: normalizeText(projectSystemKey) || resolveProjectSystemKey(),
        runtimeProjectKey: normalizeText(activeFirebaseProjectKey) || null,
        runtimeProjectId: normalizeText(activeFirebaseProjectId) || null,
        ownerUserId: normalizeText(ownerUserId) || null,
        espacoId: normalizeText(espacoId) || null,
        espacoNome: normalizeText(espacoNome) || null,
        blocoId: normalizeText(blocoId) || null,
        cardId: normalizeText(cardId) || null,
        actorUid: normalizeText(currentUser?.uid) || null,
        actorEmail: normalizeText(currentUser?.email).toLowerCase() || null,
        actorDisplayName: normalizeText(currentUser?.displayName) || null,
        motivo: normalizeText(motivo) || null,
        source: normalizeText(source) || "client",
        auditCategory,
        severity: auditSeverity,
        snapshotAntes: snapshotAntes ? serializeFirestoreSafe(snapshotAntes) : null,
        snapshotDepois: snapshotDepois ? serializeFirestoreSafe(snapshotDepois) : null,
        metadata: metadata ? serializeFirestoreSafe(metadata) : null,
        clientContext: buildClientContext(),
        criadoEm: serverTimestamp(),
        expiresAt: buildAuditExpiresAt(configSistema),
      })
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auditoria-resumo-atualizado"));
    }
    return docRef;
  } catch (error) {
    console.warn("Falha ao registrar auditoria:", error?.message || error);
    return null;
  }
}
