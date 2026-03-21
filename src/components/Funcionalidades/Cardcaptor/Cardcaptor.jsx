import { useEffect, useMemo } from "react";
import QRCodeImage from "../QRCode/QRCodeImage";
import "./cardcaptor.css";

function normalizeText(value) {
  return String(value || "").trim();
}

export default function Cardcaptor({
  aberto = false,
  onClose,
  skin = null,
  configSistema = null,
}) {
  const username = normalizeText(skin?.username);
  const projectTitle = normalizeText(configSistema?.tituloSistema || "Projeto");
  const nomeEspacoSingular = normalizeText(configSistema?.nomeEspacoSingular || "espaco");
  const avatarUrl = normalizeText(
    skin?.iconSkin || configSistema?.iconSkinPadraoUrl || ""
  );

  const urlPrincipal = useMemo(() => {
    if (!username || typeof window === "undefined") return "";
    const origin = String(window.location.origin || "").trim();
    if (!origin) return "";
    return `${origin}/${username}/home`;
  }, [username]);

  useEffect(() => {
    if (!aberto) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto, onClose]);

  if (!aberto || !skin) {
    return null;
  }

  return (
    <div className="cardcaptor-modal" role="dialog" aria-modal="true" onClick={() => onClose?.()}>
      <div className="cardcaptor-modal__surface" onClick={(event) => event.stopPropagation()}>
        <div className="cardcaptor-modal__header">
          <h3 className="cardcaptor-modal__title">Cardcaptor</h3>
          <button type="button" onClick={() => onClose?.()}>
            Fechar
          </button>
        </div>

        <div className="cardcaptor-modal__actions">
          <button type="button" onClick={() => window.print()}>
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => {
              if (!urlPrincipal || !navigator?.clipboard?.writeText) return;
              navigator.clipboard.writeText(urlPrincipal).catch(() => {});
            }}
          >
            Copiar link
          </button>
        </div>

        <div className="cardcaptor-card">
          <div>
            <div className="cardcaptor-card__brand">
              {avatarUrl ? (
                <img
                  className="cardcaptor-card__avatar"
                  src={avatarUrl}
                  alt={`Avatar de ${username || "skin"}`}
                />
              ) : null}
              <div>
                <p className="cardcaptor-card__project">{projectTitle}</p>
                <h2 className="cardcaptor-card__username">{username || "skin"}</h2>
              </div>
            </div>

            <p className="cardcaptor-card__meta">
              {`Cartao para divulgar o ${nomeEspacoSingular} principal desta skin.`}
            </p>

            <span className="cardcaptor-card__label">Link principal</span>
            <p className="cardcaptor-card__link">{urlPrincipal || "Link indisponivel."}</p>

            <p className="cardcaptor-card__hint">
              Aponte a camera para o QR code para abrir o espaco principal.
            </p>
          </div>

          <div className="cardcaptor-card__qr">
            <QRCodeImage
              value={urlPrincipal}
              size={220}
              alt={`QR code do espaco principal de ${username || "skin"}`}
              className="cardcaptor-card__qr-image"
            />
            <p className="cardcaptor-card__qr-caption">
              {username ? `QR code de @${username}` : "QR code do espaco principal"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
