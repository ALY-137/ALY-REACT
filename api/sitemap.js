const {
  buildPublicSitemapEntries,
  buildSitemapXml,
  resolveProjectForRequest,
} = require("./_seoProject");

module.exports = async function handler(req, res) {
  const context = await resolveProjectForRequest(req);
  const entries = context.indexable
    ? await buildPublicSitemapEntries(context).catch(() => [])
    : [];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.status(200).send(buildSitemapXml(entries));
};

