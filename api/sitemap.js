const {
  buildPublicSitemapEntries,
  buildSitemapXml,
  normalizeSitemapEntries,
  resolveProjectForRequest,
} = require("./_seoProject");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Vary", "Host, X-Forwarded-Host");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    res.status(405).send(buildSitemapXml([]));
    return;
  }

  try {
    const context = await resolveProjectForRequest(req);
    const rawEntries = context.indexable
      ? await buildPublicSitemapEntries(context).catch(() => [])
      : [];
    const entries = normalizeSitemapEntries(rawEntries, context.origin);
    const xml = buildSitemapXml(entries);

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    res.status(200).send(xml);
  } catch {
    const xml = buildSitemapXml([]);
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).send(xml);
  }
};
