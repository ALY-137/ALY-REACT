const {
  buildSeoHtmlPage,
  getRequestOrigin,
  resolveProjectForRequest,
  resolveSeoPageForPath,
} = require("./_seoProject");

function normalizeText(value = "") {
  return String(value || "").trim();
}

function getRequestedPath(req) {
  try {
    const url = new URL(req.url || "", "https://seo.local");
    const fromQuery = normalizeText(url.searchParams.get("path") || "");
    if (fromQuery) return fromQuery.startsWith("/") ? fromQuery : `/${fromQuery}`;
  } catch {
    // Keep the function resilient for platform-specific URL shapes.
  }

  const originalUrl = normalizeText(
    req.headers["x-original-url"] ||
      req.headers["x-forwarded-uri"] ||
      req.headers["x-vercel-original-url"] ||
      ""
  );
  if (originalUrl) return originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`;

  return "/";
}

function buildFallbackPage({ context, path, title, statusText, indexable = false }) {
  const origin = getRequestOrigin({ headers: context?.host ? { host: context.host } : {} });
  const fallbackOrigin = context?.origin || origin || "";
  const safePath = normalizeText(path || "/");
  return buildSeoHtmlPage({
    indexable,
    title,
    description: statusText || title,
    canonicalUrl: fallbackOrigin ? `${fallbackOrigin.replace(/\/+$/, "")}${safePath}` : "",
    siteName: context?.configSistema?.tituloSistema || context?.host || "ALY-137",
    heading: title,
    bodyText: statusText || title,
  });
}

module.exports = async function handler(req, res) {
  const requestedPath = getRequestedPath(req);
  const context = await resolveProjectForRequest(req);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Vary", "User-Agent, Accept");

  if (!context.found) {
    res
      .status(404)
      .send(
        buildFallbackPage({
          context,
          path: requestedPath,
          title: "Pagina nao encontrada",
          statusText: "Este dominio nao esta associado a um projeto publico indexavel.",
        })
      );
    return;
  }

  if (!context.indexable) {
    res
      .status(200)
      .send(
        buildFallbackPage({
          context,
          path: requestedPath,
          title: "Pagina nao indexavel",
          statusText: "Este projeto nao esta liberado para indexacao publica.",
        })
      );
    return;
  }

  const page = await resolveSeoPageForPath(context, requestedPath).catch(() => null);
  if (!page) {
    res
      .status(404)
      .send(
        buildFallbackPage({
          context,
          path: requestedPath,
          title: "Pagina publica nao encontrada",
          statusText: "A rota solicitada nao possui conteudo publico indexavel.",
        })
      );
    return;
  }

  res.status(200).send(buildSeoHtmlPage(page));
};
