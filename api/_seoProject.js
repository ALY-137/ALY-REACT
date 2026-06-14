const ONEOWNER_RUNTIME_PROJECT_ID = "aly-onepages-runtime";
const DEFAULT_SITEMAP_LIMIT = 200;

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeHost(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function normalizeSystemKey(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-_.]+/g, "")
    .slice(0, 80);
}

function escapeXml(value = "") {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getRequestHost(req) {
  return normalizeHost(
    req.headers["x-forwarded-host"] ||
      req.headers.host ||
      ""
  );
}

function getRequestOrigin(req) {
  const host = getRequestHost(req);
  const proto = normalizeText(req.headers["x-forwarded-proto"] || "https").split(",")[0] || "https";
  return host ? `${proto}://${host}` : "";
}

function decodeFirestoreValue(value = {}) {
  if (!value || typeof value !== "object") return undefined;
  if ("stringValue" in value) return String(value.stringValue || "");
  if ("integerValue" in value) return Number(value.integerValue || 0);
  if ("doubleValue" in value) return Number(value.doubleValue || 0);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return String(value.timestampValue || "");
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, fieldValue]) => [key, decodeFirestoreValue(fieldValue)])
    );
  }
  if ("arrayValue" in value) {
    const values = Array.isArray(value.arrayValue?.values) ? value.arrayValue.values : [];
    return values.map((item) => decodeFirestoreValue(item));
  }
  return undefined;
}

function decodeFirestoreDocument(documentValue = {}) {
  const fields = documentValue?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, fieldValue]) => [key, decodeFirestoreValue(fieldValue)])
  );
}

function getManagerRuntimeConfig() {
  const apiKey = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_API_KEY);
  const projectId = normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID);
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId };
}

function getOneownerRuntimeConfig() {
  const apiKey = normalizeText(process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_API_KEY);
  const projectId =
    normalizeText(process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_PROJECT_ID) ||
    ONEOWNER_RUNTIME_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId };
}

async function queryManagerProjectByDomain(hostname) {
  const host = normalizeHost(hostname);
  const manager = getManagerRuntimeConfig();
  if (!host || !manager) return null;

  const aliases = host.startsWith("www.")
    ? [host, host.replace(/^www\./, "")]
    : [host, `www.${host}`];

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    manager.projectId
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(manager.apiKey)}`;

  for (const alias of aliases) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "systems" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "domains" },
              op: "ARRAY_CONTAINS",
              value: { stringValue: alias },
            },
          },
          limit: 1,
        },
      }),
    });

    if (!response.ok) continue;

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    const document = rows.find((item) => item?.document)?.document;
    if (!document) continue;

    return {
      id: normalizeText(document.name).split("/").pop() || "",
      ...decodeFirestoreDocument(document),
    };
  }

  return null;
}

function normalizeProjectType(value = "") {
  const tipo = normalizeText(value).toLowerCase();
  if (tipo === "onepage") return "oneowner";
  if (tipo === "manager" || tipo === "gerenciador") return "manager";
  return tipo === "oneowner" ? "oneowner" : "multiowner";
}

function isOneOwnerPublicProject(configSistema = {}) {
  const tipo = normalizeProjectType(configSistema.tipoExperiencia);
  const modo = normalizeText(configSistema.modoAcessoProjeto || "").toLowerCase();
  return (
    tipo === "oneowner" &&
    (modo === "publico_sem_login" || modo === "publico_com_area_restrita")
  );
}

function resolveRuntimeConfig(project = {}) {
  const configSistema = project.configSistema || {};
  const tipoProjeto = normalizeProjectType(configSistema.tipoExperiencia || project.tipoProjeto);
  const firebaseRuntimeConfig =
    project.firebaseRuntimeConfig && typeof project.firebaseRuntimeConfig === "object"
      ? project.firebaseRuntimeConfig
      : {};
  const runtimeProjectId = normalizeText(
    firebaseRuntimeConfig.projectId ||
      project.firebaseProjectId ||
      project.projectId ||
      ""
  );
  const runtimeApiKey = normalizeText(firebaseRuntimeConfig.apiKey || "");
  const oneownerRuntime = getOneownerRuntimeConfig();
  const shouldUseOneownerRuntime = tipoProjeto === "oneowner" && oneownerRuntime;
  const isOneownerRuntime =
    shouldUseOneownerRuntime ||
    runtimeProjectId === ONEOWNER_RUNTIME_PROJECT_ID ||
    runtimeProjectId === oneownerRuntime?.projectId;

  if (isOneownerRuntime && oneownerRuntime) {
    return {
      projectId: oneownerRuntime.projectId,
      apiKey: oneownerRuntime.apiKey,
      namespaced: true,
    };
  }

  return {
    projectId: runtimeProjectId || oneownerRuntime?.projectId || "",
    apiKey: runtimeApiKey || oneownerRuntime?.apiKey || "",
    namespaced: isOneownerRuntime,
  };
}

async function resolveProjectForRequest(req) {
  const host = getRequestHost(req);
  const project = await queryManagerProjectByDomain(host).catch(() => null);
  if (!project) {
    return {
      found: false,
      host,
      origin: getRequestOrigin(req),
      indexable: false,
      urls: [],
    };
  }

  const configSistema = project.configSistema || {};
  const runtime = resolveRuntimeConfig(project);
  const systemKey = normalizeSystemKey(
    project.systemKey ||
      configSistema.projectSystemKey ||
      project.id ||
      host.split(".")[0]
  );
  const ownerUid = normalizeText(
    configSistema.ownerUid ||
      configSistema.adminUid ||
      project.ownerUid ||
      project.adminUid ||
      ""
  );
  const configSeoPublica = {
    ...configSistema,
    tipoExperiencia: configSistema.tipoExperiencia || project.tipoProjeto,
    modoAcessoProjeto: configSistema.modoAcessoProjeto || project.modoAcessoProjeto,
  };
  const indexable =
    configSistema.seoBuscaGoogleLiberada === true &&
    configSistema.seoIndexacaoPublica === true &&
    isOneOwnerPublicProject(configSeoPublica);

  return {
    found: true,
    host,
    origin: getRequestOrigin(req),
    project,
    configSistema,
    runtime,
    systemKey,
    ownerUid,
    indexable,
  };
}

function buildFirestoreCollectionUrl({ projectId, apiKey, path, pageSize = DEFAULT_SITEMAP_LIMIT }) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/${path}?key=${encodeURIComponent(apiKey)}&pageSize=${pageSize}`;
}

function decodeRunQueryRows(payload = []) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((item) => item?.document)
    .filter(Boolean)
    .map((document) => ({
      id: normalizeText(document.name).split("/").pop() || "",
      path: normalizeText(document.name),
      data: decodeFirestoreDocument(document),
    }));
}

async function fetchCollection({ projectId, apiKey, path, pageSize = DEFAULT_SITEMAP_LIMIT }) {
  if (!projectId || !apiKey || !path) return [];
  const response = await fetch(buildFirestoreCollectionUrl({ projectId, apiKey, path, pageSize }));
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  return documents.map((document) => ({
    id: normalizeText(document.name).split("/").pop() || "",
    path: normalizeText(document.name),
    data: decodeFirestoreDocument(document),
  }));
}

async function runCollectionFieldQuery({
  projectId,
  apiKey,
  path,
  fieldPath,
  value,
  pageSize = DEFAULT_SITEMAP_LIMIT,
}) {
  if (!projectId || !apiKey || !path || !fieldPath) return [];
  const segments = normalizeText(path).split("/").filter(Boolean);
  const collectionId = segments.pop();
  if (!collectionId) return [];

  const parentPath = segments.join("/");
  const endpoint = parentPath
    ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents/${parentPath}:runQuery?key=${encodeURIComponent(apiKey)}`
    : `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;

  const firestoreValue =
    value === null
      ? { nullValue: null }
      : { stringValue: String(value || "") };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: firestoreValue,
          },
        },
        limit: pageSize,
      },
    }),
  });

  if (!response.ok) return [];
  return decodeRunQueryRows(await response.json().catch(() => []));
}

async function fetchPublicVisibilityCollection({
  projectId,
  apiKey,
  path,
  pageSize = DEFAULT_SITEMAP_LIMIT,
}) {
  const [publicos, nulos] = await Promise.all([
    runCollectionFieldQuery({
      projectId,
      apiKey,
      path,
      fieldPath: "visibilidade",
      value: "publico",
      pageSize,
    }),
    runCollectionFieldQuery({
      projectId,
      apiKey,
      path,
      fieldPath: "visibilidade",
      value: null,
      pageSize,
    }),
  ]);
  const mapa = new Map();
  [...publicos, ...nulos].forEach((item) => {
    if (!item.path || mapa.has(item.path)) return;
    mapa.set(item.path, item);
  });

  if (mapa.size) return Array.from(mapa.values());
  return fetchCollection({ projectId, apiKey, path, pageSize });
}

function isPublicVisibility(value) {
  const visibilidade = normalizeText(value || "publico").toLowerCase();
  return !visibilidade || visibilidade === "publico";
}

function encodePathSegment(value = "") {
  return encodeURIComponent(normalizeText(value));
}

function getTimestampIso(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function getSpacePublicPath({ runtime, systemKey, ownerUid }) {
  const base = ["users", ownerUid, "espacos_publicos"].map(encodePathSegment).join("/");
  if (runtime.namespaced && systemKey) {
    return ["projetos", systemKey, base].map((part) => String(part).replace(/^\/+|\/+$/g, "")).join("/");
  }
  return base;
}

function getBlocksPath({ runtime, systemKey, ownerUid, espacoId }) {
  const base = ["users", ownerUid, "espacos", espacoId, "blocos"]
    .map(encodePathSegment)
    .join("/");
  if (runtime.namespaced && systemKey) {
    return ["projetos", systemKey, base].map((part) => String(part).replace(/^\/+|\/+$/g, "")).join("/");
  }
  return base;
}

function getCardsPath({ runtime, systemKey, ownerUid, espacoId, blocoId }) {
  const base = ["users", ownerUid, "espacos", espacoId, "blocos", blocoId, "cards"]
    .map(encodePathSegment)
    .join("/");
  if (runtime.namespaced && systemKey) {
    return ["projetos", systemKey, base].map((part) => String(part).replace(/^\/+|\/+$/g, "")).join("/");
  }
  return base;
}

function buildUrlEntry(loc, lastmod = "", priority = "0.7") {
  return {
    loc,
    lastmod,
    priority,
  };
}

async function buildPublicSitemapEntries(context) {
  const { origin, indexable, runtime, systemKey, ownerUid } = context;
  if (!origin || !indexable || !runtime?.projectId || !runtime?.apiKey || !ownerUid) {
    return [];
  }

  const entries = [];
  const espacosPath = getSpacePublicPath({ runtime, systemKey, ownerUid });
  const espacos = await fetchPublicVisibilityCollection({
    projectId: runtime.projectId,
    apiKey: runtime.apiKey,
    path: espacosPath,
    pageSize: 200,
  });

  const espacosPublicos = espacos
    .filter((item) => isPublicVisibility(item.data?.visibilidade))
    .sort((a, b) => Number(a.data?.ordem || 0) - Number(b.data?.ordem || 0));

  for (const espaco of espacosPublicos) {
    const espacoNome = normalizeText(espaco.data?.nome || espaco.data?.id_espaco || espaco.id);
    const espacoId = normalizeText(espaco.data?.id_espaco || espaco.id);
    if (!espacoNome || !espacoId) continue;

    const espacoUrl = `${origin}/${encodePathSegment(espacoNome)}`;
    entries.push(buildUrlEntry(espacoUrl, getTimestampIso(espaco.data?.atualizadoEm), "0.8"));

    const blocosPath = getBlocksPath({ runtime, systemKey, ownerUid, espacoId });
    const blocos = await fetchPublicVisibilityCollection({
      projectId: runtime.projectId,
      apiKey: runtime.apiKey,
      path: blocosPath,
      pageSize: 100,
    });

    for (const bloco of blocos.filter((item) => isPublicVisibility(item.data?.visibilidade))) {
      const blocoId = normalizeText(bloco.id);
      if (!blocoId) continue;
      const cardsInline = Array.isArray(bloco.data?.cards) ? bloco.data.cards : [];
      cardsInline.forEach((card, index) => {
        const cardId = normalizeText(card?.id || `card_${index}`);
        if (!cardId) return;
        entries.push(
          buildUrlEntry(
            `${espacoUrl}/card/${encodePathSegment(blocoId)}/${encodePathSegment(cardId)}`,
            getTimestampIso(bloco.data?.atualizadoEm),
            "0.6"
          )
        );
      });

      const cardsPath = getCardsPath({ runtime, systemKey, ownerUid, espacoId, blocoId });
      const cardsDocs = await fetchCollection({
        projectId: runtime.projectId,
        apiKey: runtime.apiKey,
        path: cardsPath,
        pageSize: 100,
      });
      cardsDocs.forEach((cardDoc) => {
        const cardId = normalizeText(cardDoc.id);
        if (!cardId) return;
        entries.push(
          buildUrlEntry(
            `${espacoUrl}/card/${encodePathSegment(blocoId)}/${encodePathSegment(cardId)}`,
            getTimestampIso(cardDoc.data?.atualizadoEm || bloco.data?.atualizadoEm),
            "0.6"
          )
        );
      });
    }
  }

  const dedupe = new Map();
  entries.forEach((entry) => {
    if (!entry.loc || dedupe.has(entry.loc)) return;
    dedupe.set(entry.loc, entry);
  });

  return Array.from(dedupe.values()).slice(0, 1000);
}

function buildSitemapXml(entries = []) {
  const urls = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      const priority = entry.priority ? `\n    <priority>${escapeXml(entry.priority)}</priority>` : "";
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}${priority}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

module.exports = {
  buildPublicSitemapEntries,
  buildSitemapXml,
  escapeXml,
  getRequestOrigin,
  resolveProjectForRequest,
};
