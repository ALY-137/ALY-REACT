import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./termos-privacidade-modal.css";

const normalizeText = (value = "") => String(value || "").trim();

function TermosPrivacidadeModal({
  aberto = false,
  initialTab = "termos",
  termosUsoUrl = "",
  termosUsoVersao = "1.0",
  politicaPrivacidadeUrl = "",
  politicaPrivacidadeVersao = "1.0",
  onClose,
}) {
  const [abaAtiva, setAbaAtiva] = useState(initialTab === "politica" ? "politica" : "termos");

  useEffect(() => {
    if (!aberto) return;
    setAbaAtiva(initialTab === "politica" ? "politica" : "termos");
  }, [aberto, initialTab]);

  useEffect(() => {
    if (!aberto) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const overflowAnterior = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && typeof onClose === "function") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [aberto, onClose]);

  const documentos = useMemo(
    () => ({
      termos: {
        label: "Termos de uso",
        version: normalizeText(termosUsoVersao) || "1.0",
        url: normalizeText(termosUsoUrl),
      },
      politica: {
        label: "Politica de privacidade",
        version: normalizeText(politicaPrivacidadeVersao) || "1.0",
        url: normalizeText(politicaPrivacidadeUrl),
      },
    }),
    [politicaPrivacidadeUrl, politicaPrivacidadeVersao, termosUsoUrl, termosUsoVersao]
  );

  if (!aberto || typeof document === "undefined") return null;

  const documentoAtual = documentos[abaAtiva] || documentos.termos;

  return createPortal(
    <div className="termos-privacidade-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="termos-privacidade-modal__backdrop"
        onClick={onClose}
        aria-label="Fechar documentos"
      />
      <section className="termos-privacidade-modal__panel">
        <header className="termos-privacidade-modal__header">
          <div>
            <p>Privacidade e termos</p>
            <h2>{documentoAtual.label}</h2>
            <span>{`Versao ${documentoAtual.version}`}</span>
          </div>
          <button
            type="button"
            className="termos-privacidade-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </header>

        <div className="termos-privacidade-modal__tabs" role="tablist" aria-label="Documentos">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "termos"}
            className={abaAtiva === "termos" ? "is-active" : ""}
            onClick={() => setAbaAtiva("termos")}
          >
            Termos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "politica"}
            className={abaAtiva === "politica" ? "is-active" : ""}
            onClick={() => setAbaAtiva("politica")}
          >
            Politica
          </button>
        </div>

        <div className="termos-privacidade-modal__content">
          {documentoAtual.url ? (
            <iframe
              title={`${documentoAtual.label} v${documentoAtual.version}`}
              src={documentoAtual.url}
              loading="lazy"
            />
          ) : (
            <div className="termos-privacidade-modal__empty">
              <strong>Documento nao configurado</strong>
              <p>
                Configure a URL deste documento nas propriedades do projeto para que o
                usuario consiga consultar o conteudo antes do aceite.
              </p>
            </div>
          )}
        </div>

        <footer className="termos-privacidade-modal__footer">
          {documentoAtual.url ? (
            <a href={documentoAtual.url} target="_blank" rel="noreferrer">
              Abrir em nova aba
            </a>
          ) : (
            <span>Sem URL configurada</span>
          )}
          <button type="button" onClick={onClose}>
            Voltar ao aceite
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

export default TermosPrivacidadeModal;
