import { useMemo } from "react";

function normalizeText(value) {
  return String(value || "").trim();
}

export default function QRCodeImage({
  value = "",
  size = 220,
  alt = "QR code",
  className = "",
}) {
  const texto = normalizeText(value);
  const sizeSafe = Number.isFinite(Number(size)) ? Math.max(96, Number(size)) : 220;

  const src = useMemo(() => {
    if (!texto) return "";
    const params = new URLSearchParams({
      size: `${sizeSafe}x${sizeSafe}`,
      data: texto,
      margin: "0",
      ecc: "M",
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  }, [texto, sizeSafe]);

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
