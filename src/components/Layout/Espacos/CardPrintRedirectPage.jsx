import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import {
  montarRotaCardDeQrPrint,
  obterQrPrint,
  registrarLeituraQrPrint,
} from "./qrPrintsApi";

export default function CardPrintRedirectPage() {
  const navigate = useNavigate();
  const { skinsUsername, espacoNome, printId } = useParams();
  const { oneOwnerPublicaAtiva: oneOwnerPublicaAtivaContexto = false } =
    useOutletContext() || {};
  const leituraRegistradaRef = useRef(false);
  const [estado, setEstado] = useState({
    loading: true,
    erro: "",
  });

  useEffect(() => {
    let cancelado = false;

    async function abrirQrPrint() {
      if (!printId) {
        setEstado({
          loading: false,
          erro: "QR incompleto.",
        });
        return;
      }

      try {
        const print = await obterQrPrint(printId);
        if (!print) {
          throw new Error("Registro rastreavel nao encontrado.");
        }
        if (print.ativo === false || String(print.status || "").toLowerCase() === "inativo") {
          throw new Error("Este QR nao esta ativo.");
        }

        const rotaCard = montarRotaCardDeQrPrint(print, {
          espacoNome,
          skinsUsername,
          oneOwnerPublicaAtiva: oneOwnerPublicaAtivaContexto,
        });

        if (!rotaCard) {
          throw new Error("Nao foi possivel resolver a rota do card.");
        }

        if (!leituraRegistradaRef.current) {
          leituraRegistradaRef.current = true;
          await registrarLeituraQrPrint({
            printId,
            print,
            origem: "qr_print_route",
          }).catch((error) => {
            console.warn("Nao foi possivel registrar leitura do QR:", error);
          });
        }

        if (!cancelado) {
          navigate(rotaCard, {
            replace: true,
            state: {
              qrPrintId: printId,
              origem: "qr_print",
            },
          });
        }
      } catch (error) {
        if (cancelado) return;
        setEstado({
          loading: false,
          erro: error?.message || "Nao foi possivel abrir este QR.",
        });
      }
    }

    abrirQrPrint();

    return () => {
      cancelado = true;
    };
  }, [espacoNome, navigate, oneOwnerPublicaAtivaContexto, printId, skinsUsername]);

  if (estado.loading) {
    return (
      <main className="card-route-page card-print-redirect-page" aria-live="polite">
        <p className="card-route-page__status">Registrando leitura do QR...</p>
      </main>
    );
  }

  return (
    <main className="card-route-page card-print-redirect-page" aria-live="polite">
      <div className="card-route-page__error">
        <strong>QR indisponivel</strong>
        <p>{estado.erro || "Nao foi possivel abrir este QR."}</p>
      </div>
    </main>
  );
}
