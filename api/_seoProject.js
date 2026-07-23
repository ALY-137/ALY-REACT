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

function normalizeSitemapEntries(entries = [], origin = "") {
  const originUrl = normalizeText(origin);
  const originHost = normalizeHost(originUrl);
  const dedupe = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const loc = normalizeText(entry?.loc);
    if (!loc) return;

    let url;
    try {
      url = new URL(loc);
    } catch {
      return;
    }

    if (!["http:", "https:"].includes(url.protocol)) return;
    if (originHost && normalizeHost(url.host) !== originHost) return;

    const canonicalLoc = url.toString();
    if (dedupe.has(canonicalLoc)) return;

    const lastmod = getTimestampIso(entry?.lastmod);
    dedupe.set(canonicalLoc, {
      loc: canonicalLoc,
      lastmod,
    });
  });

  return Array.from(dedupe.values()).slice(0, 1000);
}

function cleanSeoText(value = "", maxLength = 300) {
  const text = normalizeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getFirstSeoValue(values = [], maxLength = 300) {
  for (const value of values) {
    const text = cleanSeoText(value, maxLength);
    if (text) return text;
  }
  return "";
}

function decodePathSegments(pathname = "") {
  const rawPath = normalizeText(pathname)
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0]
    .split("#")[0];

  return rawPath
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .map((segment) => normalizeText(segment))
    .filter(Boolean);
}

function normalizeRouteMatch(value = "") {
  return normalizeText(value).toLowerCase();
}

function getSpaceId(space = {}) {
  return normalizeText(space.data?.id_espaco || space.data?.id || space.id);
}

function getSpaceName(space = {}) {
  return normalizeText(space.data?.nome || space.data?.titulo || getSpaceId(space));
}

function getBlockTitle(block = {}) {
  return cleanSeoText(block.data?.titulo || block.data?.nome || block.id || "Bloco", 90);
}

function getBlockDescription(block = {}) {
  return cleanSeoText(
    getFirstSeoValue(
      [
        block.data?.descricao,
        block.data?.conteudo,
        block.data?.textoResumoPublico,
        block.data?.textoSubtitulo,
        block.data?.textoConteudoCriptografado ? "" : block.data?.textoCorpo,
        block.data?.textoModo,
      ],
      500
    ),
    500
  );
}

function getBlockImage(block = {}) {
  return normalizeText(
    block.data?.imagem ||
      block.data?.imagemUrl ||
      block.data?.urlImagem ||
      block.data?.capaUrl ||
      ""
  );
}

function normalizeSeoCard(card = {}, index = 0) {
  const data = card.data || card;
  const id = normalizeText(data?.id || card.id || `card_${index}`);
  const atributo = data?.atributoPersonalizado || data?.atributoCustomizado || data?.customAttribute || {};
  const descricaoCompleta = cleanSeoText(
    [
      data?.descricaoExtra,
      data?.descricaoCompleta,
      data?.descricaoPrevia,
      data?.descricao,
      atributo?.rotulo,
      atributo?.nome,
      atributo?.valor,
    ].join(" "),
    5000
  );

  return {
    id,
    ordem: Number.isFinite(Number(data?.ordem)) ? Number(data.ordem) : index,
    nome: cleanSeoText(data?.nome || data?.titulo || id, 90),
    descricao: descricaoCompleta,
    imagem: normalizeText(data?.imagem || data?.imagemUrl || data?.urlImagem || ""),
    visibilidade: data?.visibilidade,
  };
}

function isPublicSeoData(data = {}) {
  return isPublicVisibility(data?.visibilidade);
}

async function getPublicSpaces(context) {
  const { runtime, systemKey, ownerUid } = context;
  const espacosPath = getSpacePublicPath({ runtime, systemKey, ownerUid });
  const espacos = await fetchPublicVisibilityCollection({
    projectId: runtime.projectId,
    apiKey: runtime.apiKey,
    path: espacosPath,
    pageSize: 200,
  });

  return espacos
    .filter((item) => isPublicSeoData(item.data))
    .sort((a, b) => Number(a.data?.ordem || 0) - Number(b.data?.ordem || 0));
}

async function getPublicBlocks(context, espacoId) {
  const { runtime, systemKey, ownerUid } = context;
  const blocosPath = getBlocksPath({ runtime, systemKey, ownerUid, espacoId });
  const blocos = await fetchPublicVisibilityCollection({
    projectId: runtime.projectId,
    apiKey: runtime.apiKey,
    path: blocosPath,
    pageSize: 100,
  });

  return blocos
    .filter((item) => isPublicSeoData(item.data))
    .sort((a, b) => Number(a.data?.ordem || 0) - Number(b.data?.ordem || 0));
}

async function getPublicCards(context, espacoId, block) {
  const inlineCards = Array.isArray(block.data?.cards) ? block.data.cards : [];
  const cards = inlineCards
    .map((card, index) => normalizeSeoCard(card, index))
    .filter((card) => card.id && isPublicVisibility(card.visibilidade));

  const cardsPath = getCardsPath({
    runtime: context.runtime,
    systemKey: context.systemKey,
    ownerUid: context.ownerUid,
    espacoId,
    blocoId: block.id,
  });
  const cardDocs = await fetchCollection({
    projectId: context.runtime.projectId,
    apiKey: context.runtime.apiKey,
    path: cardsPath,
    pageSize: 100,
  });

  cardDocs
    .filter((cardDoc) => isPublicSeoData(cardDoc.data))
    .forEach((cardDoc, index) => cards.push(normalizeSeoCard(cardDoc, cards.length + index)));

  const dedupe = new Map();
  cards.forEach((card) => {
    if (!card.id || dedupe.has(card.id)) return;
    dedupe.set(card.id, card);
  });

  return Array.from(dedupe.values()).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}

function buildPublicUrl(origin = "", segments = []) {
  const path = segments
    .map((segment) => encodePathSegment(segment))
    .filter(Boolean)
    .join("/");
  return `${origin.replace(/\/+$/, "")}/${path}`;
}

async function resolveSeoPageForPath(context, pathname = "/") {
  if (
    !context?.indexable ||
    !context?.origin ||
    !context?.runtime?.projectId ||
    !context?.runtime?.apiKey ||
    !context?.ownerUid
  ) {
    return null;
  }

  const segments = decodePathSegments(pathname);
  const spaces = await getPublicSpaces(context);
  if (!spaces.length) return null;

  const requestedSpaceSegment = normalizeRouteMatch(segments[0] || "home");
  const space =
    spaces.find((item) => {
      const name = normalizeRouteMatch(getSpaceName(item));
      const id = normalizeRouteMatch(getSpaceId(item));
      return name === requestedSpaceSegment || id === requestedSpaceSegment;
    }) ||
    (!segments[0] ? spaces[0] : null);

  if (!space) return null;

  const espacoId = getSpaceId(space);
  const espacoName = getSpaceName(space);
  if (!espacoId || !espacoName) return null;

  const siteName = cleanSeoText(
    context.configSistema?.tituloSistema || context.project?.name || context.host || "ALY-137",
    90
  );
  const spaceUrl = buildPublicUrl(context.origin, [espacoName]);
  const blocks = await getPublicBlocks(context, espacoId);
  const isCardRoute =
    normalizeRouteMatch(segments[1]) === "card" &&
    normalizeText(segments[2]) &&
    normalizeText(segments[3]);

  if (isCardRoute) {
    const requestedBlockId = normalizeText(segments[2]);
    const requestedCardId = normalizeText(segments[3]);
    const block = blocks.find((item) => normalizeText(item.id) === requestedBlockId);
    if (!block) return null;

    const cards = await getPublicCards(context, espacoId, block).catch(() => []);
    const card = cards.find((item) => normalizeText(item.id) === requestedCardId);
    if (!card) return null;

    const title = `${card.nome || getBlockTitle(block)} | ${siteName}`;
    const bodyText =
      cleanSeoText(
        [
          card.nome,
          card.descricao,
          getBlockTitle(block),
          getBlockDescription(block),
        ].join(" "),
        5000
      ) || card.descricao;
    const description =
      cleanSeoText(card.descricao || getBlockDescription(block), 300) ||
      cleanSeoText(context.configSistema?.seoDescricaoPublica || siteName, 300);
    const canonicalUrl = buildPublicUrl(context.origin, [
      espacoName,
      "card",
      block.id,
      card.id,
    ]);

    return {
      kind: "card",
      indexable: true,
      title,
      description,
      image: card.imagem || getBlockImage(block) || context.configSistema?.seoImagemUrl || "",
      canonicalUrl,
      siteName,
      heading: card.nome || title,
      bodyText,
      links: [
        { href: spaceUrl, label: espacoName },
        ...cards
          .filter((item) => item.id !== card.id)
          .slice(0, 12)
          .map((item) => ({
            href: buildPublicUrl(context.origin, [espacoName, "card", block.id, item.id]),
            label: item.nome || item.id,
          })),
      ],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: card.nome || title,
        description,
        text: bodyText,
        image: card.imagem || undefined,
        url: canonicalUrl,
        inLanguage: "pt-BR",
        isPartOf: {
          "@type": "WebSite",
          name: siteName,
          url: context.origin,
        },
      },
    };
  }

  const blocksWithCards = [];
  for (const block of blocks.slice(0, 20)) {
    const cards = await getPublicCards(context, espacoId, block).catch(() => []);
    blocksWithCards.push({ block, cards });
  }

  const blockTexts = blocksWithCards
    .flatMap(({ block, cards }) => [
      getBlockTitle(block),
      getBlockDescription(block),
      ...cards.slice(0, 8).flatMap((card) => [card.nome, card.descricao]),
    ])
    .filter(Boolean);
  const title =
    normalizeRouteMatch(espacoName) === "home"
      ? siteName
      : `${cleanSeoText(espacoName, 80)} | ${siteName}`;
  const description =
    cleanSeoText(
      getFirstSeoValue(
        [
          context.configSistema?.seoDescricaoPublica,
          space.data?.descricao,
          space.data?.conteudo,
          ...blockTexts,
          siteName,
        ],
        500
      ),
      300
    ) || siteName;
  const links = [
    ...spaces
      .filter((item) => getSpaceId(item) !== espacoId)
      .slice(0, 20)
      .map((item) => ({
        href: buildPublicUrl(context.origin, [getSpaceName(item)]),
        label: getSpaceName(item),
      })),
    ...blocksWithCards.flatMap(({ block, cards }) =>
      cards.slice(0, 12).map((card) => ({
        href: buildPublicUrl(context.origin, [espacoName, "card", block.id, card.id]),
        label: card.nome || card.id,
      }))
    ),
  ];

  return {
    kind: "space",
    indexable: true,
    title,
    description,
    image:
      getFirstSeoValue(
        [
          ...blocksWithCards.flatMap(({ block, cards }) => [
            getBlockImage(block),
            ...cards.map((card) => card.imagem),
          ]),
          context.configSistema?.seoImagemUrl,
          context.configSistema?.logoLoginUrl,
        ],
        2000
      ) || "",
    canonicalUrl: spaceUrl,
    siteName,
    heading: title,
    bodyText: blockTexts.join(" "),
    links,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: spaceUrl,
      inLanguage: "pt-BR",
      isPartOf: {
        "@type": "WebSite",
        name: siteName,
        url: context.origin,
      },
    },
  };
}

function buildSeoHtmlPage(page = {}) {
  const indexable = page.indexable === true;
  const title = cleanSeoText(page.title || "Pagina", 90);
  const description = cleanSeoText(page.description || title, 300);
  const canonicalUrl = normalizeText(page.canonicalUrl || "");
  const siteName = cleanSeoText(page.siteName || title, 90);
  const image = normalizeText(page.image || "");
  const heading = cleanSeoText(page.heading || title, 120);
  const bodyText = cleanSeoText(page.bodyText || description, 5000);
  const robots = indexable
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";
  const links = Array.isArray(page.links) ? page.links : [];
  const jsonLd = page.jsonLd && typeof page.jsonLd === "object" ? page.jsonLd : null;
  const jsonLdTag = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";
  const imageTags = image
    ? [
        `<meta property="og:image" content="${escapeXml(image)}" />`,
        `<meta name="twitter:image" content="${escapeXml(image)}" />`,
      ].join("\n    ")
    : "";
  const linksHtml = links
    .filter((link) => link?.href && link?.label)
    .slice(0, 80)
    .map(
      (link) =>
        `<li><a href="${escapeXml(link.href)}">${escapeXml(cleanSeoText(link.label, 120))}</a></li>`
    )
    .join("\n        ");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(title)}</title>
    <meta name="description" content="${escapeXml(description)}" />
    <meta name="robots" content="${escapeXml(robots)}" />
    ${canonicalUrl ? `<link rel="canonical" href="${escapeXml(canonicalUrl)}" />` : ""}
    <meta property="og:title" content="${escapeXml(title)}" />
    <meta property="og:description" content="${escapeXml(description)}" />
    <meta property="og:type" content="${page.kind === "card" ? "article" : "website"}" />
    ${canonicalUrl ? `<meta property="og:url" content="${escapeXml(canonicalUrl)}" />` : ""}
    <meta property="og:site_name" content="${escapeXml(siteName)}" />
    ${imageTags}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${escapeXml(title)}" />
    <meta name="twitter:description" content="${escapeXml(description)}" />
    ${jsonLdTag}
  </head>
  <body>
    <main>
      <h1>${escapeXml(heading)}</h1>
      <p>${escapeXml(bodyText || description)}</p>
      ${linksHtml ? `<nav aria-label="Conteudo publico relacionado"><ul>${linksHtml}</ul></nav>` : ""}
      ${canonicalUrl ? `<p><a href="${escapeXml(canonicalUrl)}">Abrir pagina publica</a></p>` : ""}
    </main>
  </body>
</html>
`;
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
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

module.exports = {
  buildSeoHtmlPage,
  buildPublicSitemapEntries,
  buildSitemapXml,
  escapeXml,
  getRequestOrigin,
  normalizeSitemapEntries,
  resolveProjectForRequest,
  resolveSeoPageForPath,
};
