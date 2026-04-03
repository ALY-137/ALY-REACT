export const PROJECT_STATUS_ACTIVE = "ativo";
export const PROJECT_STATUS_MAINTENANCE = "manutencao";

export const PROJECT_STATUS_OPTIONS = [
  { value: PROJECT_STATUS_ACTIVE, label: "ATIVO" },
  { value: PROJECT_STATUS_MAINTENANCE, label: "EM MANUTEN\u00c7\u00c3O" },
];

const DEFAULT_MAINTENANCE_KEYS = new Set(["aly-137", "teste-aa015", "teste-aa15"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getProjectStatusDefault({
  projectSystemKey = "",
  firebaseProjectId = "",
  systemKey = "",
  nomeProjeto = "",
  tituloSistema = "",
} = {}) {
  const candidates = [
    projectSystemKey,
    firebaseProjectId,
    systemKey,
    nomeProjeto,
    tituloSistema,
  ]
    .map((item) => normalizeKey(item))
    .filter(Boolean);

  return candidates.some((item) => DEFAULT_MAINTENANCE_KEYS.has(item))
    ? PROJECT_STATUS_MAINTENANCE
    : PROJECT_STATUS_ACTIVE;
}

export function normalizeProjectStatus(
  value,
  {
    projectSystemKey = "",
    firebaseProjectId = "",
    systemKey = "",
    nomeProjeto = "",
    tituloSistema = "",
    fallback = null,
  } = {}
) {
  const raw = normalizeText(value).toLowerCase();

  if (
    raw === PROJECT_STATUS_ACTIVE ||
    raw === "active"
  ) {
    return PROJECT_STATUS_ACTIVE;
  }

  if (
    raw === PROJECT_STATUS_MAINTENANCE ||
    raw === "maintenance" ||
    raw === "em-manutencao" ||
    raw === "em manutencao"
  ) {
    return PROJECT_STATUS_MAINTENANCE;
  }

  if (fallback === PROJECT_STATUS_ACTIVE || fallback === PROJECT_STATUS_MAINTENANCE) {
    return fallback;
  }

  return getProjectStatusDefault({
    projectSystemKey,
    firebaseProjectId,
    systemKey,
    nomeProjeto,
    tituloSistema,
  });
}

export function getProjectStatusLabel(status = PROJECT_STATUS_ACTIVE) {
  return status === PROJECT_STATUS_MAINTENANCE ? "EM MANUTEN\u00c7\u00c3O" : "ATIVO";
}

export function isProjectInMaintenance(statusOrConfig = null, context = {}) {
  if (statusOrConfig && typeof statusOrConfig === "object") {
    return (
      normalizeProjectStatus(statusOrConfig?.statusProjeto, {
        projectSystemKey: statusOrConfig?.projectSystemKey,
        firebaseProjectId: statusOrConfig?.firebaseProjectId,
        systemKey: statusOrConfig?.systemKey,
        nomeProjeto: statusOrConfig?.nomeProjeto,
        tituloSistema: statusOrConfig?.tituloSistema,
      }) === PROJECT_STATUS_MAINTENANCE
    );
  }

  return normalizeProjectStatus(statusOrConfig, context) === PROJECT_STATUS_MAINTENANCE;
}
