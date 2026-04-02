import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../../Banco/init-firebase";
import { getFirstExistingProjectDocSnapshot } from "../../Banco/projectDataRefs";
import {
  DEFAULT_SISTEMA_CONFIG,
  resolverBloqueioCompraAssinaturaPorLocalizacao,
} from "../Sistema/configSistema";
import { obterGeoAcessoAtual } from "../Sistema/acessoGeo";
import {
  confirmarPagamentoBlocoMercadoPago,
  criarCheckoutBlocoMercadoPago,
  obterCheckoutPixManualBloco,
  solicitarSolicitacaoPixManualBloco,
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

function normalizarMetodosPagamentoBloco(bloco = {}, fallback = {}) {
  const metodos = bloco?.metodosPagamento || bloco?.metodosPagamentoPermitidos || {};
  return {
    mercadoPago:
      typeof metodos?.mercadoPago === "boolean"
        ? metodos.mercadoPago
        : Boolean(fallback?.mercadoPago ?? true),
    pixManual:
      typeof metodos?.pixManual === "boolean"
        ? metodos.pixManual
        : Boolean(fallback?.pixManual ?? true),
  };
}

export default function CheckoutBlocoMercadoPago({
  skinLogadoUser,
  mercadoPagoHabilitado = true,
  pixManualHabilitado = true,
  configSistema = DEFAULT_SISTEMA_CONFIG,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [carregandoBloco, setCarregandoBloco] = useState(false);
  const [blocoInfo, setBlocoInfo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [processandoPix, setProcessandoPix] = useState(false);
  const [processandoSolicitacao, setProcessandoSolicitacao] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [pixCheckoutInfo, setPixCheckoutInfo] = useState(null);
  const [solicitacaoPixInfo, setSolicitacaoPixInfo] = useState(null);
  const confirmedPaymentIdRef = useRef("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const blocoId = params.get("comprarBloco") || "";
  const espacoId = params.get("espacoId") || "";
  const ownerUserId = params.get("ownerUserId") || "";
  const returnTo = params.get("returnTo") || "";
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";
  const statusRetorno =
    params.get("status") || params.get("collection_status") || params.get("mpStatus") || "";
  const menuBasePath = useMemo(() => {
    const match = String(location.pathname || "").match(/^\/menu\/[^/]+/);
    if (match?.[0]) return match[0];
    if (skinLogadoUser) return `/menu/${skinLogadoUser}`;
    return "/menu/owner";
  }, [location.pathname, skinLogadoUser]);

  const checkoutAtivo = Boolean(blocoId && espacoId && ownerUserId);
  const metodosPagamentoBloco = useMemo(
    () => normalizarMetodosPagamentoBloco(blocoInfo, { mercadoPago: true, pixManual: true }),
    [blocoInfo]
  );
  const mercadoPagoCheckoutHabilitado =
    Boolean(mercadoPagoHabilitado) && Boolean(metodosPagamentoBloco.mercadoPago);
  const pixManualCheckoutHabilitado =
    Boolean(pixManualHabilitado) && Boolean(metodosPagamentoBloco.pixManual);

  useEffect(() => {
    if (!checkoutAtivo) {
      setBlocoInfo(null);
      return;
    }

    let cancelado = false;
    async function carregarBloco() {
      setCarregandoBloco(true);
      try {
        const blocoSnap = await getFirstExistingProjectDocSnapshot(
          db,
          "users",
          ownerUserId,
          "espacos",
          espacoId,
          "blocos",
          blocoId
        );
        if (!cancelado) {
          setBlocoInfo(blocoSnap?.exists?.() ? { id: blocoSnap.id, ...blocoSnap.data() } : null);
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

  const validarBloqueioRegional = async () => {
    const geoAtual = await obterGeoAcessoAtual();
    const bloqueio = resolverBloqueioCompraAssinaturaPorLocalizacao(
      configSistema || DEFAULT_SISTEMA_CONFIG,
      geoAtual || {}
    );
    if (!bloqueio?.bloqueado) {
      return false;
    }

    setMensagem(
      `Compra/assinatura bloqueada para sua localizacao (${bloqueio.valorAtual || bloqueio.valor}).`
    );
    return true;
  };

  const abrirCheckout = async () => {
    if (!mercadoPagoCheckoutHabilitado) {
      setMensagem("Mercado Pago desativado para esta live.");
      return;
    }
    if (await validarBloqueioRegional()) {
      return;
    }
    setProcessando(true);
    setMensagem("");
    setPixCheckoutInfo(null);
    setSolicitacaoPixInfo(null);
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

  const abrirPixManual = async () => {
    if (!pixManualCheckoutHabilitado) {
      setMensagem("PIX manual desativado para esta live.");
      return;
    }
    if (await validarBloqueioRegional()) {
      return;
    }
    setProcessandoPix(true);
    setMensagem("");
    setSolicitacaoPixInfo(null);
    try {
      const data = await obterCheckoutPixManualBloco({
        ownerUserId,
        espacoId,
        blocoId,
      });

      if (data?.alreadyPurchased) {
        setMensagem(data?.message || "Esse bloco ja foi comprado e esta liberado.");
        setPixCheckoutInfo(null);
        return;
      }

      if (!data?.pagamento?.chavePix) {
        throw new Error("Dados do PIX manual indisponiveis para este bloco.");
      }

      setPixCheckoutInfo(data.pagamento);
      setMensagem(
        "Pagamento manual por PIX carregado. Realize o pagamento e envie comprovante ao vendedor."
      );
    } catch (err) {
      setMensagem(err?.message || "Erro ao iniciar pagamento manual por PIX.");
      setPixCheckoutInfo(null);
    } finally {
      setProcessandoPix(false);
    }
  };

  const copiarTexto = async (texto = "") => {
    const valor = String(texto || "").trim();
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setMensagem("Copiado para a area de transferencia.");
    } catch {
      setMensagem("Nao foi possivel copiar automaticamente.");
    }
  };

  const solicitarSolicitacaoPix = async () => {
    if (!pixCheckoutInfo?.chavePix) {
      setMensagem("Carregue o PIX manual antes de enviar a solicitacao.");
      return;
    }
    if (await validarBloqueioRegional()) {
      return;
    }
    setProcessandoSolicitacao(true);
    setMensagem("");
    try {
      const data = await solicitarSolicitacaoPixManualBloco({
        ownerUserId,
        espacoId,
        blocoId,
      });

      if (data?.alreadyPurchased) {
        setMensagem(data?.message || "Esse bloco ja foi comprado e esta liberado.");
        setSolicitacaoPixInfo(null);
        return;
      }

      setSolicitacaoPixInfo({
        solicitacaoId: data?.solicitacaoId || data?.pedidoId || "",
        status: data?.status || "pedido_solicitado",
      });
      setMensagem("Solicitacao enviada. Aguarde confirmacao do pagamento pelo owner.");
    } catch (err) {
      setMensagem(err?.message || "Erro ao enviar solicitacao de pagamento.");
    } finally {
      setProcessandoSolicitacao(false);
    }
  };

  const fecharCheckout = () => {
    navigate(menuBasePath, { replace: true });
  };

  const voltarAoEspaco = () => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(menuBasePath, { replace: true });
  };

  return (
    <div style={painelStyle}>
      <h3 style={{ marginTop: 0 }}>Checkout do Bloco</h3>
      {mercadoPagoCheckoutHabilitado && pixManualCheckoutHabilitado ? (
        <p style={{ margin: "4px 0 8px" }}>
          Escolha como pagar: Mercado Pago ou PIX manual (alternativo).
        </p>
      ) : null}
      {!mercadoPagoCheckoutHabilitado && !pixManualCheckoutHabilitado ? (
        <p style={{ margin: "4px 0 8px" }}>
          Esta live nao possui nenhum metodo de pagamento habilitado.
        </p>
      ) : null}
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
        {mercadoPagoCheckoutHabilitado ? (
          <button
            onClick={abrirCheckout}
            disabled={
              processando || processandoPix || processandoSolicitacao || carregandoBloco
            }
          >
            {processando ? "Processando..." : "Pagar com Mercado Pago (PIX e Cartao)"}
          </button>
        ) : null}
        {pixManualCheckoutHabilitado ? (
          <button
            onClick={abrirPixManual}
            disabled={
              processando || processandoPix || processandoSolicitacao || carregandoBloco
            }
          >
            {processandoPix ? "Carregando PIX..." : "Pagar por PIX manual"}
          </button>
        ) : null}
        <button
          onClick={fecharCheckout}
          disabled={processando || processandoPix || processandoSolicitacao}
        >
          Fechar
        </button>
        <button
          onClick={voltarAoEspaco}
          disabled={processando || processandoPix || processandoSolicitacao}
        >
          Voltar ao espaco
        </button>
      </div>

      {pixCheckoutInfo?.chavePix ? (
        <div style={{ marginTop: 12, borderTop: "1px solid #ccc", paddingTop: 12 }}>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Chave PIX:</strong> {pixCheckoutInfo.chavePix}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => copiarTexto(pixCheckoutInfo.chavePix)}>
              Copiar chave PIX
            </button>
            {pixCheckoutInfo.pixCopiaECola ? (
              <button onClick={() => copiarTexto(pixCheckoutInfo.pixCopiaECola)}>
                Copiar PIX copia e cola
              </button>
            ) : null}
          </div>
          {pixCheckoutInfo?.qrSelecionado?.imagemUrl ? (
            <div style={{ margin: "8px 0" }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>QR para este valor:</strong>
              </p>
              <img
                src={pixCheckoutInfo.qrSelecionado.imagemUrl}
                alt="QR code PIX"
                style={{ width: 220, height: 220, objectFit: "cover", border: "1px solid #ddd" }}
              />
            </div>
          ) : null}
          {!!pixCheckoutInfo.nomeRecebedor && (
            <p style={{ margin: "4px 0" }}>
              Recebedor: <strong>{pixCheckoutInfo.nomeRecebedor}</strong>
            </p>
          )}
          {!!pixCheckoutInfo.cidadeRecebedor && (
            <p style={{ margin: "4px 0" }}>
              Cidade: <strong>{pixCheckoutInfo.cidadeRecebedor}</strong>
            </p>
          )}
          {!!pixCheckoutInfo.instrucoes && (
            <p style={{ margin: "6px 0 0" }}>{pixCheckoutInfo.instrucoes}</p>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={solicitarSolicitacaoPix}
              disabled={
                processandoSolicitacao ||
                solicitacaoPixInfo?.status === "pedido_solicitado"
              }
            >
              {processandoSolicitacao
                ? "Enviando solicitacao..."
                : solicitacaoPixInfo?.status === "pedido_solicitado"
                  ? "Solicitacao enviada"
                  : "Ja fiz o pagamento"}
            </button>
          </div>
          {solicitacaoPixInfo?.solicitacaoId ? (
            <p style={{ marginTop: 8 }}>
              Solicitacao: <strong>{solicitacaoPixInfo.solicitacaoId}</strong> | Status:{" "}
              <strong>{solicitacaoPixInfo.status}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
    </div>
  );
}
