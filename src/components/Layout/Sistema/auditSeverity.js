function normalizeText(value = "") {
  return String(value || "").trim();
}

export const AUDIT_SEVERITIES = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
];

export function normalizeAuditSeverity(value = "") {
  const normalized = normalizeText(value).toLowerCase();
  return AUDIT_SEVERITIES.some((item) => item.value === normalized) ? normalized : "";
}

export function resolveAuditSeverity({
  action = "",
  entityType = "",
  metadata = null,
} = {}) {
  const explicitSeverity = normalizeAuditSeverity(
    metadata?.auditSeverity || metadata?.severity || metadata?.severidade
  );
  if (explicitSeverity) return explicitSeverity;

  const normalizedAction = normalizeText(action).toLowerCase();
  const normalizedEntityType = normalizeText(entityType);

  if (
    normalizedAction.includes("exclu") ||
    normalizedAction.includes("removeu") ||
    normalizedAction.includes("bloque") ||
    normalizedAction.includes("limpou_env") ||
    normalizedAction.includes("permiss")
  ) {
    return "alto";
  }

  if (["accessSettings", "usuario_projeto"].includes(normalizedEntityType)) {
    return "alto";
  }

  if (
    normalizedAction.includes("config") ||
    normalizedAction.includes("projeto") ||
    normalizedAction.includes("rastreavel") ||
    normalizedAction.includes("preconfig")
  ) {
    return "medio";
  }

  if (["system", "systemConfig", "systemPreconfig", "trackableLink", "qrPrint"].includes(normalizedEntityType)) {
    return "medio";
  }

  return "baixo";
}

export function humanizeAuditSeverity(severity = "") {
  const normalized = normalizeAuditSeverity(severity) || "baixo";
  return AUDIT_SEVERITIES.find((item) => item.value === normalized)?.label || "Baixo";
}

export function isAuditSeverityCritical(severity = "") {
  return normalizeAuditSeverity(severity) === "alto";
}
