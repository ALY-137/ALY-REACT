const { getRequestOrigin, resolveProjectForRequest } = require("./_seoProject");

module.exports = async function handler(req, res) {
  const origin = getRequestOrigin(req);
  const context = await resolveProjectForRequest(req);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");

  if (!context.indexable) {
    res.status(200).send("User-agent: *\nDisallow: /\n");
    return;
  }

  res.status(200).send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /menu",
      "Disallow: /login",
      "Disallow: /loginowner",
      "Disallow: /__/auth",
      origin ? `Sitemap: ${origin}/sitemap.xml` : "",
      "",
    ]
      .filter((line) => line !== "")
      .join("\n")
  );
};

