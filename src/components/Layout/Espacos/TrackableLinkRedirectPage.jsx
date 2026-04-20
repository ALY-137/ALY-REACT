import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  obterLinkRastreavel,
  registrarAcessoLinkRastreavel,
  salvarTrackingContext,
} from "./trackableLinksApi";

export default function TrackableLinkRedirectPage() {
  const navigate = useNavigate();
  const { trackingId } = useParams();
  const acessoRegistradoRef = useRef(false);
  const [estado, setEstado] = useState({
    loading: true,
    erro: "",
  });

  useEffect(() => {
    let cancelado = false;

    async function abrirLinkRastreavel() {
      if (!trackingId) {
        setEstado({
          loading: false,
          erro: "Link rastreavel incompleto.",
        });
        return;
      }

      try {
        const link = await obterLinkRastreavel(trackingId);
        if (!link) {
          throw new Error("Link rastreavel nao encontrado.");
        }
        if (
          link.ativo === false ||
          ["inativo", "excluido"].includes(String(link.status || "").toLowerCase())
        ) {
          throw new Error("Este link rastreavel nao esta ativo.");
        }

        const destinoUrl = String(link.destinoUrl || "").trim();
        if (!destinoUrl) {
          throw new Error("Nao foi possivel resolver o destino deste link.");
        }

        salvarTrackingContext(link);

        if (!acessoRegistradoRef.current) {
          acessoRegistradoRef.current = true;
          await registrarAcessoLinkRastreavel({
            trackingId,
            link,
            origem: "trackable_link_route",
          }).catch((error) => {
            console.warn("Nao foi possivel registrar acesso do link rastreavel:", error);
          });
        }

        if (!cancelado) {
          navigate(destinoUrl, {
            replace: true,
            state: {
              trackingId,
              origem: "link_rastreavel",
            },
          });
        }
      } catch (error) {
        if (cancelado) return;
        setEstado({
          loading: false,
          erro: error?.message || "Nao foi possivel abrir este link rastreavel.",
        });
      }
    }

    abrirLinkRastreavel();

    return () => {
      cancelado = true;
    };
  }, [navigate, trackingId]);

  if (estado.loading) {
    return (
      <main className="card-route-page card-print-redirect-page" aria-live="polite">
        <p className="card-route-page__status">Registrando origem do link...</p>
      </main>
    );
  }

  return (
    <main className="card-route-page card-print-redirect-page" aria-live="polite">
      <div className="card-route-page__error">
        <strong>Link indisponivel</strong>
        <p>{estado.erro || "Nao foi possivel abrir este link rastreavel."}</p>
      </div>
    </main>
  );
}
