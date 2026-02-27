import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  confirmarPedidoPixManual,
  listarPedidosPixManual,
} from "./mercadoPagoApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

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

function formatarStatus(status = "") {
  const normalizado = String(status || "").trim().toLowerCase();
  if (normalizado === "pagamento_confirmado") return "PAGAMENTO CONFIRMADO";
  return "SOLICITACAO ENVIADA";
}

export default function PedidosPixManual() {
  const location = useLocation();
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [atualizandoPedidoId, setAtualizandoPedidoId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const ownerUserIdFiltro = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const fromQuery = String(params.get("ownerUserId") || "").trim();
    if (fromQuery) return fromQuery;

    const cfg = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
    const onePagePublica =
      cfg?.tipoExperiencia === "onepage" &&
      cfg?.modoAcessoProjeto === "publico_sem_login";
    if (!onePagePublica) return "";
    return String(cfg?.adminUid || "").trim();
  }, [location.search]);

  const pedidosOrdenados = useMemo(
    () =>
      [...pedidos].sort(
        (a, b) =>
          Number(b?.__updatedAtMs || b?.__createdAtMs || 0) -
          Number(a?.__updatedAtMs || a?.__createdAtMs || 0)
      ),
    [pedidos]
  );

  const carregarPedidos = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarPedidosPixManual({ ownerUserId: ownerUserIdFiltro });
      setPedidos(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setErro(err?.message || "Falha ao carregar solicitacoes.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPedidos();
  }, [ownerUserIdFiltro]);

  const confirmarPedido = async (pedido) => {
    const pedidoId = String(pedido?.pedidoId || pedido?.id || "").trim();
    if (!pedidoId) return;

    setAtualizandoPedidoId(pedidoId);
    setErro("");
    setMensagem("");
    try {
      await confirmarPedidoPixManual({ pedidoId });
      setPedidos((prev) =>
        prev.map((item) =>
          String(item?.pedidoId || item?.id || "").trim() === pedidoId
            ? {
                ...item,
                status: "pagamento_confirmado",
              }
            : item
        )
      );
      setMensagem("Solicitacao confirmada e acesso liberado.");
    } catch (err) {
      setErro(err?.message || "Falha ao confirmar solicitacao.");
    } finally {
      setAtualizandoPedidoId("");
    }
  };

  return (
    <div>
      <h2>SOLICITACOES</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={carregarPedidos} disabled={carregando || !!atualizandoPedidoId}>
          {carregando ? "Atualizando..." : "Atualizar lista"}
        </button>
      </div>

      {!!mensagem && <p>{mensagem}</p>}
      {!!erro && <p style={{ color: "red" }}>{erro}</p>}

      {!carregando && !pedidosOrdenados.length ? <p>Nenhuma solicitacao encontrada.</p> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {pedidosOrdenados.map((pedido) => {
          const pedidoId = String(pedido?.pedidoId || pedido?.id || "").trim();
          const status = String(pedido?.status || "pedido_solicitado").toLowerCase();
          const precoFormatado = formatarPreco(pedido?.precoCentavos, pedido?.moeda || "BRL");
          const qrUrl = String(pedido?.qrSelecionado?.imagemUrl || "").trim();
          const qrTitulo = String(pedido?.qrSelecionado?.titulo || "").trim();
          const podeConfirmar = Boolean(pedido?.__isOwner) && status !== "pagamento_confirmado";
          return (
            <div
              key={pedidoId}
              style={{ border: "1px solid #ccc", borderRadius: 8, padding: 10 }}
            >
              <p style={{ margin: "0 0 6px" }}>
                <strong>Solicitacao:</strong> {pedidoId}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Bloco:</strong> {String(pedido?.blocoId || "-")}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Espaco:</strong> {String(pedido?.espacoId || "-")}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Comprador UID:</strong> {String(pedido?.compradorUid || "-")}
              </p>
              {!!pedido?.compradorEmail && (
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Email:</strong> {String(pedido.compradorEmail)}
                </p>
              )}
              {!!precoFormatado && (
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Valor:</strong> {precoFormatado}
                </p>
              )}
              <p style={{ margin: "0 0 8px" }}>
                <strong>Status:</strong> {formatarStatus(status)}
              </p>

              {qrUrl ? (
                <div style={{ margin: "0 0 8px" }}>
                  {!!qrTitulo && (
                    <p style={{ margin: "0 0 4px" }}>
                      <strong>QR:</strong> {qrTitulo}
                    </p>
                  )}
                  <img
                    src={qrUrl}
                    alt="QR code PIX da solicitacao"
                    style={{ width: 220, height: 220, objectFit: "cover", border: "1px solid #ddd" }}
                  />
                </div>
              ) : null}

              {podeConfirmar ? (
                <button
                  onClick={() => confirmarPedido(pedido)}
                  disabled={!!atualizandoPedidoId}
                >
                  {atualizandoPedidoId === pedidoId
                    ? "Confirmando..."
                    : "Confirmar solicitacao e liberar acesso"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
