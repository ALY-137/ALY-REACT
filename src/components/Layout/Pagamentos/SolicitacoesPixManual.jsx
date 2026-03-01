import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  confirmarSolicitacaoPixManual,
  listarSolicitacoesPixManual,
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
  return "SOLICITAÇÃO ENVIADA";
}

export default function SolicitacoesPixManual() {
  const location = useLocation();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [atualizandoSolicitacaoId, setAtualizandoSolicitacaoId] = useState("");
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

  const solicitacoesOrdenadas = useMemo(
    () =>
      [...solicitacoes].sort(
        (a, b) =>
          Number(b?.__updatedAtMs || b?.__createdAtMs || 0) -
          Number(a?.__updatedAtMs || a?.__createdAtMs || 0)
      ),
    [solicitacoes]
  );

  const carregarSolicitacoes = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarSolicitacoesPixManual({ ownerUserId: ownerUserIdFiltro });
      setSolicitacoes(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setErro(err?.message || "Falha ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, [ownerUserIdFiltro]);

  const confirmarSolicitacao = async (solicitacao) => {
    const solicitacaoId = String(
      solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id || ""
    ).trim();
    if (!solicitacaoId) return;

    setAtualizandoSolicitacaoId(solicitacaoId);
    setErro("");
    setMensagem("");
    try {
      await confirmarSolicitacaoPixManual({ solicitacaoId });
      setSolicitacoes((prev) =>
        prev.map((item) =>
          String(item?.solicitacaoId || item?.pedidoId || item?.id || "").trim() ===
          solicitacaoId
            ? {
                ...item,
                status: "pagamento_confirmado",
              }
            : item
        )
      );
      setMensagem("Solicitação confirmada e acesso liberado.");
    } catch (err) {
      setErro(err?.message || "Falha ao confirmar solicitação.");
    } finally {
      setAtualizandoSolicitacaoId("");
    }
  };

  return (
    <div>
      <h2>SOLICITAÇÕES</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={carregarSolicitacoes}
          disabled={carregando || !!atualizandoSolicitacaoId}
        >
          {carregando ? "Atualizando..." : "Atualizar lista"}
        </button>
      </div>

      {!!mensagem && <p>{mensagem}</p>}
      {!!erro && <p style={{ color: "red" }}>{erro}</p>}

      {!carregando && !solicitacoesOrdenadas.length ? (
        <p>Nenhuma solicitação encontrada.</p>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {solicitacoesOrdenadas.map((solicitacao) => {
          const solicitacaoId = String(
            solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id || ""
          ).trim();
          const status = String(
            solicitacao?.status || "pedido_solicitado"
          ).toLowerCase();
          const precoFormatado = formatarPreco(
            solicitacao?.precoCentavos,
            solicitacao?.moeda || "BRL"
          );
          const qrUrl = String(solicitacao?.qrSelecionado?.imagemUrl || "").trim();
          const qrTitulo = String(solicitacao?.qrSelecionado?.titulo || "").trim();
          const podeConfirmar =
            Boolean(solicitacao?.__isOwner) && status !== "pagamento_confirmado";
          return (
            <div
              key={solicitacaoId}
              style={{ border: "1px solid #ccc", borderRadius: 8, padding: 10 }}
            >
              <p style={{ margin: "0 0 6px" }}>
                <strong>Solicitação:</strong> {solicitacaoId}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Bloco:</strong> {String(solicitacao?.blocoId || "-")}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Espaço:</strong> {String(solicitacao?.espacoId || "-")}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Comprador UID:</strong> {String(solicitacao?.compradorUid || "-")}
              </p>
              {!!solicitacao?.compradorEmail && (
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Email:</strong> {String(solicitacao.compradorEmail)}
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
                    alt="QR code PIX da solicitação"
                    style={{ width: 220, height: 220, objectFit: "cover", border: "1px solid #ddd" }}
                  />
                </div>
              ) : null}

              {podeConfirmar ? (
                <button
                  onClick={() => confirmarSolicitacao(solicitacao)}
                  disabled={!!atualizandoSolicitacaoId}
                >
                  {atualizandoSolicitacaoId === solicitacaoId
                    ? "Confirmando..."
                    : "Confirmar solicitação e liberar acesso"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
