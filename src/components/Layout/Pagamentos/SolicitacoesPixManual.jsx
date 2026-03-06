import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  confirmarSolicitacaoPixManual,
  listarSolicitacoesPixManual,
} from "./mercadoPagoApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
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

export default function SolicitacoesPixManual() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: menuUserId } = useParams();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [atualizandoSolicitacaoId, setAtualizandoSolicitacaoId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [qrModalAberto, setQrModalAberto] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState("");
  const [qrModalTitulo, setQrModalTitulo] = useState("");
  const ownerUserIdFiltro = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const fromQuery = String(params.get("ownerUserId") || "").trim();
    if (fromQuery) return fromQuery;

    const cfg = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
    const onePagePublica = isOnePageComEntradaPublica(cfg);
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

  const menuTargetUser = String(
    menuUserId || localStorage.getItem("skinLogadoUser") || "admin"
  ).trim();

  const carregarSolicitacoes = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarSolicitacoesPixManual({ ownerUserId: ownerUserIdFiltro });
      setSolicitacoes(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setErro(err?.message || "Falha ao carregar solicitacoes.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, [ownerUserIdFiltro]);

  useEffect(() => {
    if (!qrModalAberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setQrModalAberto(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [qrModalAberto]);

  const confirmarSolicitacao = async (solicitacao) => {
    const solicitacaoId = String(
      solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id || ""
    ).trim();
    if (!solicitacaoId) return;

    setAtualizandoSolicitacaoId(solicitacaoId);
    setErro("");
    setMensagem("");
    try {
      const response = await confirmarSolicitacaoPixManual({ solicitacaoId });
      setSolicitacoes((prev) =>
        prev.map((item) =>
          String(item?.solicitacaoId || item?.pedidoId || item?.id || "").trim() ===
          solicitacaoId
            ? {
                ...item,
                status: "pagamento_confirmado",
                sessionStatus: response?.sessionStatus || "confirmada",
                sessionContactId: String(response?.sessionContactId || item?.sessionContactId || ""),
                sessionConversationId: String(
                  response?.sessionConversationId || item?.sessionConversationId || "principal"
                ),
              }
            : item
        )
      );
      setMensagem("Solicitacao confirmada e acesso liberado.");
    } catch (err) {
      setErro(err?.message || "Falha ao confirmar solicitacao.");
    } finally {
      setAtualizandoSolicitacaoId("");
    }
  };

  const abrirChatSessao = (solicitacao) => {
    const contactId = String(solicitacao?.sessionContactId || "").trim();
    const conversationId = String(solicitacao?.sessionConversationId || "principal").trim();
    if (!contactId) return;
    navigate(`/menu/${menuTargetUser}/contatos/${contactId}/chat/${conversationId}`);
  };

  const abrirModalQr = ({ url = "", titulo = "" } = {}) => {
    const qr = String(url || "").trim();
    if (!qr) return;
    setQrModalUrl(qr);
    setQrModalTitulo(String(titulo || "").trim());
    setQrModalAberto(true);
  };

  return (
    <div>
      <h2>SOLICITACOES</h2>
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
        <p>Nenhuma solicitacao encontrada.</p>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {solicitacoesOrdenadas.map((solicitacao) => {
          const solicitacaoId = String(
            solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id || ""
          ).trim();
          const status = String(solicitacao?.status || "pedido_solicitado").toLowerCase();
          const precoFormatado = formatarPreco(
            solicitacao?.precoCentavos,
            solicitacao?.moeda || "BRL"
          );
          const qrUrl = String(solicitacao?.qrSelecionado?.imagemUrl || "").trim();
          const qrTitulo = String(solicitacao?.qrSelecionado?.titulo || "").trim();
          const podeConfirmar =
            Boolean(solicitacao?.__isOwner) && status !== "pagamento_confirmado";
          const chatDisponivel = Boolean(String(solicitacao?.sessionContactId || "").trim());
          return (
            <div
              key={solicitacaoId}
              className="solicitacao-pix-card"
            >
              <div
                className="solicitacao-pix-card__grid"
                style={{
                  gridTemplateColumns: qrUrl ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 6px" }}>
                    <strong>Solicitacao:</strong> {solicitacaoId}
                  </p>
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>Bloco:</strong> {String(solicitacao?.blocoId || "-")}
                  </p>
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>Espaco:</strong> {String(solicitacao?.espacoId || "-")}
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
                </div>

                {qrUrl ? (
                  <div className="solicitacao-pix-card__qr">
                    {!!qrTitulo && (
                      <p style={{ margin: "0 0 4px" }}>
                        <strong>QR:</strong> {qrTitulo}
                      </p>
                    )}
                    <button
                      className="solicitacao-pix-card__qr-button"
                      type="button"
                      onClick={() => abrirModalQr({ url: qrUrl, titulo: qrTitulo })}
                      title="Clique para ampliar o QR code"
                    >
                      <img
                        className="solicitacao-pix-card__qr-preview"
                        src={qrUrl}
                        alt="QR code PIX da solicitacao (clique para ampliar)"
                      />
                    </button>
                    <p className="solicitacao-pix-card__qr-helper">Clique para ampliar</p>
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 8 }}>
                {podeConfirmar ? (
                  <button
                    onClick={() => confirmarSolicitacao(solicitacao)}
                    disabled={!!atualizandoSolicitacaoId}
                  >
                    {atualizandoSolicitacaoId === solicitacaoId
                      ? "Confirmando..."
                      : "Confirmar solicitacao e liberar acesso"}
                  </button>
                ) : null}

                {chatDisponivel ? (
                  <button
                    onClick={() => abrirChatSessao(solicitacao)}
                    style={{ marginLeft: podeConfirmar ? 8 : 0 }}
                  >
                    Abrir chat da sessao
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {qrModalAberto && qrModalUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setQrModalAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(96vw, 1024px)",
              maxHeight: "95vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            {!!qrModalTitulo && (
              <p style={{ margin: 0, color: "#fff", textAlign: "center" }}>
                <strong>{qrModalTitulo}</strong>
              </p>
            )}
            <img
              src={qrModalUrl}
              alt="QR code PIX ampliado"
              style={{
                width: "min(92vw, 900px)",
                height: "auto",
                maxHeight: "82vh",
                objectFit: "contain",
                border: "1px solid rgba(255,255,255,0.35)",
                background: "#fff",
              }}
            />
            <button
              type="button"
              onClick={() => setQrModalAberto(false)}
              style={{ cursor: "pointer" }}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
