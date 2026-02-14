import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../Banco/init-firebase";
import {
  confirmarPagamentoBlocoMercadoPago,
  criarCheckoutBlocoMercadoPago,
} from "./mercadoPagoApi";

const painelStyle = {
  marginTop: 16,
  padding: 16,
  border: "1px solid #999",
  borderRadius: 8,
  background: "#f7f7f7",
};

function formatarPreco(precoCentavos, moeda = "BRL") {
  const valorNumerico = Number(precoCentavos);
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda || "BRL",
    }).format(valorNumerico / 100);
  } catch {
    return `R$ ${(valorNumerico / 100).toFixed(2)}`;
  }
}

export default function CheckoutBlocoMercadoPago({ skinLogadoUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [carregandoBloco, setCarregandoBloco] = useState(false);
  const [blocoInfo, setBlocoInfo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const confirmedPaymentIdRef = useRef("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const blocoId = params.get("comprarBloco") || "";
  const espacoId = params.get("espacoId") || "";
  const ownerUserId = params.get("ownerUserId") || "";
  const returnTo = params.get("returnTo") || "";
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";
  const statusRetorno =
    params.get("status") || params.get("collection_status") || params.get("mpStatus") || "";

  const checkoutAtivo = Boolean(blocoId && espacoId && ownerUserId);

  useEffect(() => {
    if (!checkoutAtivo) {
      setBlocoInfo(null);
      return;
    }

    let cancelado = false;
    async function carregarBloco() {
      setCarregandoBloco(true);
      try {
        const blocoRef = doc(
          db,
          "users",
          ownerUserId,
          "espacos",
          espacoId,
          "blocos",
          blocoId
        );
        const blocoSnap = await getDoc(blocoRef);
        if (!cancelado) {
          setBlocoInfo(blocoSnap.exists() ? { id: blocoSnap.id, ...blocoSnap.data() } : null);
        }
      } catch (err) {
        if (!cancelado) {
          setBlocoInfo(null);
          setMensagem(err?.message || "Nao foi possivel carregar o bloco.");
        }
      } finally {
        if (!cancelado) setCarregandoBloco(false);
      }
    }

    carregarBloco();
    return () => {
      cancelado = true;
    };
  }, [checkoutAtivo, ownerUserId, espacoId, blocoId]);

  useEffect(() => {
    if (!checkoutAtivo || !paymentId || confirmedPaymentIdRef.current === paymentId) return;
    confirmedPaymentIdRef.current = paymentId;

    async function confirmar() {
      setProcessando(true);
      setMensagem("Confirmando pagamento...");
      try {
        const result = await confirmarPagamentoBlocoMercadoPago({
          ownerUserId,
          espacoId,
          blocoId,
          paymentId,
        });

        if (result?.approved) {
          setMensagem("Pagamento aprovado. Bloco liberado.");
        } else if (result?.status) {
          setMensagem(`Pagamento em status: ${result.status}.`);
        } else {
          setMensagem("Pagamento recebido, aguardando confirmacao.");
        }
      } catch (err) {
        setMensagem(err?.message || "Falha ao confirmar pagamento.");
      } finally {
        setProcessando(false);
      }
    }

    confirmar();
  }, [checkoutAtivo, paymentId, ownerUserId, espacoId, blocoId]);

  if (!checkoutAtivo) return null;

  const precoFormatado = formatarPreco(blocoInfo?.precoCentavos, blocoInfo?.moeda || "BRL");

  const abrirCheckout = async () => {
    setProcessando(true);
    setMensagem("");
    try {
      const data = await criarCheckoutBlocoMercadoPago({
        ownerUserId,
        espacoId,
        blocoId,
        skinUsername: skinLogadoUser,
        returnTo,
        baseUrl: window.location.origin,
      });

      if (data?.alreadyPurchased) {
        setMensagem(data?.message || "Esse bloco ja foi comprado e esta liberado.");
        return;
      }

      const checkoutUrl = data?.checkoutUrl || data?.initPoint || data?.sandboxInitPoint;
      if (!checkoutUrl) {
        throw new Error("Nao foi possivel iniciar checkout.");
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setMensagem(err?.message || "Erro ao iniciar checkout do Mercado Pago.");
    } finally {
      setProcessando(false);
    }
  };

  const fecharCheckout = () => {
    navigate(`/menu/${skinLogadoUser}`, { replace: true });
  };

  const voltarAoEspaco = () => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(`/menu/${skinLogadoUser}`, { replace: true });
  };

  return (
    <div style={painelStyle}>
      <h3 style={{ marginTop: 0 }}>Checkout do Bloco</h3>
      {!!statusRetorno && (
        <p style={{ margin: "4px 0 8px" }}>
          Retorno Mercado Pago: <strong>{statusRetorno}</strong>
        </p>
      )}
      {carregandoBloco ? (
        <p>Carregando bloco...</p>
      ) : (
        <>
          <p style={{ margin: "4px 0" }}>
            Bloco: <strong>{blocoId}</strong>
          </p>
          {!!precoFormatado && (
            <p style={{ margin: "4px 0 10px" }}>
              Valor: <strong>{precoFormatado}</strong>
            </p>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={abrirCheckout} disabled={processando || carregandoBloco}>
          {processando ? "Processando..." : "Pagar com Mercado Pago (PIX e Cartao)"}
        </button>
        <button onClick={fecharCheckout} disabled={processando}>
          Fechar
        </button>
        <button onClick={voltarAoEspaco} disabled={processando}>
          Voltar ao espaco
        </button>
      </div>

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
    </div>
  );
}
