import { useEffect, useMemo, useState } from "react";

function normalizeText(value) {
  return String(value || "").trim();
}

function clampColorChannel(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, Math.min(255, Math.round(numero)));
}

function tripletFromHex(value) {
  const clean = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return clean
      .split("")
      .map((char) => parseInt(`${char}${char}`, 16))
      .join("-");
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)]
      .map((part) => parseInt(part, 16))
      .join("-");
  }
  return "";
}

function tripletFromCssColor(value) {
  const color = normalizeText(value);
  const hex = tripletFromHex(color);
  if (hex) return hex;

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((part) => clampColorChannel(part.trim()));
    if (channels.length === 3) return channels.join("-");
  }

  const colorSrgbMatch = color.match(/^color\(srgb\s+([^)]+)\)$/i);
  if (colorSrgbMatch) {
    const channels = colorSrgbMatch[1]
      .split(/\s+/)
      .filter((part) => part && part !== "/")
      .slice(0, 3)
      .map((part) => clampColorChannel(Number(part) * 255));
    if (channels.length === 3) return channels.join("-");
  }

  return "";
}

function resolveQrColor(value) {
  const raw = normalizeText(value);
  if (!raw) return "";

  const direct = tripletFromCssColor(raw);
  if (direct) return direct;

  if (typeof document === "undefined") return "";

  const probe = document.createElement("span");
  probe.style.color = raw;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);

  return tripletFromCssColor(computed);
}

export default function QRCodeImage({
  value = "",
  size = 220,
  alt = "QR code",
  className = "",
  color = "",
  bgColor = "",
}) {
  const texto = normalizeText(value);
  const sizeSafe = Number.isFinite(Number(size)) ? Math.max(96, Number(size)) : 220;
  const [resolvedColors, setResolvedColors] = useState(() => ({
    color: tripletFromCssColor(color),
    bgColor: tripletFromCssColor(bgColor),
  }));

  useEffect(() => {
    setResolvedColors({
      color: resolveQrColor(color),
      bgColor: resolveQrColor(bgColor),
    });
  }, [color, bgColor]);

  const src = useMemo(() => {
    if (!texto) return "";
    const params = new URLSearchParams({
      size: `${sizeSafe}x${sizeSafe}`,
      data: texto,
      margin: "0",
      ecc: "M",
    });
    if (resolvedColors.color) params.set("color", resolvedColors.color);
    if (resolvedColors.bgColor) params.set("bgcolor", resolvedColors.bgColor);
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  }, [texto, sizeSafe, resolvedColors]);

  if (!src) {
    return null;
  }

  return (
    <img
      className={className}
      src={src}
      alt={normalizeText(alt) || "QR code"}
      width={sizeSafe}
      height={sizeSafe}
      loading="lazy"
    />
  );
}
