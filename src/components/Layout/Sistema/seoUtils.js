export function limparTextoSeo(value = "", maxLength = 300) {
  const texto = String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || texto.length <= maxLength) return texto;
  return `${texto.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function obterUrlAbsoluta(value = "") {
  const url = String(value || "").trim();
  if (!url || typeof window === "undefined") return url;

  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function setMeta(selector, attributes = {}) {
  if (typeof document === "undefined") return null;

  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("data-aly-seo", "true");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (typeof value === "undefined" || value === null || value === "") {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, String(value));
  });

  return element;
}

function setLink(selector, attributes = {}) {
  if (typeof document === "undefined") return null;

  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("data-aly-seo", "true");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (typeof value === "undefined" || value === null || value === "") {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, String(value));
  });

  return element;
}

function setJsonLd(data = null) {
  if (typeof document === "undefined") return;

  const selector = 'script[type="application/ld+json"][data-aly-seo="true"]';
  document.head.querySelectorAll(selector).forEach((item) => item.remove());

  if (!data || typeof data !== "object") return;

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-aly-seo", "true");
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function aplicarSeoPublico({
  title = "",
  description = "",
  image = "",
  url = "",
  type = "website",
  siteName = "",
  indexable = true,
  jsonLd = null,
} = {}) {
  if (typeof document === "undefined") return;

  const tituloLimpo = limparTextoSeo(title, 90);
  const descricaoLimpa = limparTextoSeo(description, 300);
  const imageUrl = obterUrlAbsoluta(image);
  const canonicalUrl = obterUrlAbsoluta(url);
  const siteNameLimpo = limparTextoSeo(siteName || tituloLimpo, 80);
  const robotsValue = indexable
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";

  if (tituloLimpo) {
    document.title = tituloLimpo;
  }

  setMeta('meta[name="description"]', {
    name: "description",
    content: descricaoLimpa,
  });
  setMeta('meta[name="robots"]', {
    name: "robots",
    content: robotsValue,
  });
  setLink('link[rel="canonical"]', {
    rel: "canonical",
    href: canonicalUrl,
  });

  setMeta('meta[property="og:title"]', {
    property: "og:title",
    content: tituloLimpo,
  });
  setMeta('meta[property="og:description"]', {
    property: "og:description",
    content: descricaoLimpa,
  });
  setMeta('meta[property="og:type"]', {
    property: "og:type",
    content: type || "website",
  });
  setMeta('meta[property="og:url"]', {
    property: "og:url",
    content: canonicalUrl,
  });
  setMeta('meta[property="og:site_name"]', {
    property: "og:site_name",
    content: siteNameLimpo,
  });
  setMeta('meta[property="og:image"]', {
    property: "og:image",
    content: imageUrl,
  });

  setMeta('meta[name="twitter:card"]', {
    name: "twitter:card",
    content: imageUrl ? "summary_large_image" : "summary",
  });
  setMeta('meta[name="twitter:title"]', {
    name: "twitter:title",
    content: tituloLimpo,
  });
  setMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: descricaoLimpa,
  });
  setMeta('meta[name="twitter:image"]', {
    name: "twitter:image",
    content: imageUrl,
  });

  setJsonLd(jsonLd);
}

