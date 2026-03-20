import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  confirmarSolicitacaoPixManual,
  listarSolicitacoesPixManual,
} from "./mercadoPagoApi";
import { auth, db, storage } from "../../Banco/init-firebase";
import {
  obterUrlArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
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
  return "AGUARDANDO CONFIRMACAO";
}

function parseLiveMs(valorMs = null, valorIso = "") {
  const ms = Number(valorMs);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const fromIso = Date.parse(String(valorIso || "").trim());
  return Number.isFinite(fromIso) ? fromIso : null;
}

function formatarDataHoraLive(valorMs) {
  const ms = Number(valorMs);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString("pt-BR");
  }
}

function sanitizeLiveToken(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function montarLiveContactId({ ownerUserId = "", espacoId = "", blocoId = "" } = {}) {
  const owner = sanitizeLiveToken(ownerUserId);
  const espaco = sanitizeLiveToken(espacoId);
  const bloco = sanitizeLiveToken(blocoId);
  return `live_${owner}_${espaco}_${bloco}`.slice(0, 180);
}

function obterSolicitacaoId(solicitacao = {}) {
  return String(
    solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id || ""
  ).trim();
}

function extrairMiniaturaSolicitacao(solicitacao = {}) {
  const url = String(
    solicitacao?.blocoMiniaturaUrl ||
      solicitacao?.blocoPreviewUrl ||
      solicitacao?.blocoThumbUrl ||
      ""
  ).trim();
  const originalUrl = String(
    solicitacao?.blocoOriginalUrl ||
      solicitacao?.blocoConteudoUrl ||
      ""
  ).trim();
  const titulo = String(
    solicitacao?.blocoMiniaturaTitulo || solicitacao?.blocoTitulo || ""
  ).trim();
  const originalPath = String(solicitacao?.blocoOriginalPath || "").trim();
  return {
    url,
    originalUrl,
    originalPath,
    titulo,
  };
}

function extrairMiniaturaDoBloco(blocoData = {}) {
  const cards = Array.isArray(blocoData?.cards) ? blocoData.cards : [];
  const imagensPreview = Array.isArray(blocoData?.imagensPreview)
    ? blocoData.imagensPreview
    : [];
  const imagensOriginaisPublicas = Array.isArray(blocoData?.imagensOriginaisPublicas)
    ? blocoData.imagensOriginaisPublicas
    : [];
  const imagensLegado = Array.isArray(blocoData?.imagens) ? blocoData.imagens : [];
  const imagensOriginaisPaths = Array.isArray(blocoData?.imagensOriginaisPaths)
    ? blocoData.imagensOriginaisPaths
    : [];

  const cardComImagem = cards.find((card) => String(card?.imagem || "").trim());
  const previewUrl =
    String(cardComImagem?.imagem || "").trim() ||
    String(imagensPreview[0] || "").trim() ||
    String(imagensOriginaisPublicas[0] || "").trim() ||
    String(imagensLegado[0] || "").trim();
  const originalUrl =
    String(imagensOriginaisPublicas[0] || "").trim() ||
    String(cardComImagem?.imagem || "").trim();
  const originalPath =
    String(imagensOriginaisPaths[0] || "").trim() ||
    String(cardComImagem?.imagemPath || "").trim();
  const titulo =
    String(cardComImagem?.nome || "").trim() ||
    String(blocoData?.titulo || "").trim() ||
    String(blocoData?.nome || "").trim();

  return {
    url: previewUrl,
    originalUrl,
    originalPath,
    titulo,
  };
}

async function resolverUrlArquivoPorPath(path = "") {
  const pathLimpo = String(path || "").trim();
  if (!pathLimpo) return "";

  if (usandoBucketCompartilhadoCrossProject()) {
    const userAtual = auth?.currentUser || null;
    if (!userAtual) return "";
    return String(
      (await obterUrlArquivoNoBucketCompartilhado({ user: userAtual, path: pathLimpo })) || ""
    ).trim();
  }

  return String((await getDownloadURL(ref(storage, pathLimpo))) || "").trim();
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
  const [miniaturasFallback, setMiniaturasFallback] = useState({});
  const [imagemModal, setImagemModal] = useState({
    aberto: false,
    url: "",
    titulo: "",
    alt: "Imagem ampliada",
  });

  const configSistemaCache = useMemo(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG,
    [location.search]
  );

  const ownerUserIdFiltro = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const fromQuery = String(params.get("ownerUserId") || "").trim();
    if (fromQuery) return fromQuery;

    const onePagePublica = isOneOwnerComEntradaPublica(configSistemaCache);
    if (!onePagePublica) return "";
    return String(configSistemaCache?.ownerUid || configSistemaCache?.adminUid || "").trim();
  }, [location.search, configSistemaCache]);

  const solicitacaoStatusAguardandoSpriteUrl = String(
    configSistemaCache?.solicitacaoStatusAguardandoSpriteUrl || ""
  ).trim();
  const solicitacaoStatusConfirmadoIconUrl = String(
    configSistemaCache?.solicitacaoStatusConfirmadoIconUrl || ""
  ).trim();

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
    menuUserId || localStorage.getItem("skinLogadoUser") || "owner"
  ).trim();

  useEffect(() => {
    let ativo = true;

    const carregar = async ({ silencioso = false } = {}) => {
      if (!silencioso) setCarregando(true);
      setErro("");
      try {
        const lista = await listarSolicitacoesPixManual({ ownerUserId: ownerUserIdFiltro });
        if (!ativo) return;
        setSolicitacoes(Array.isArray(lista) ? lista : []);
      } catch (err) {
        if (!ativo) return;
        setErro(err?.message || "Falha ao carregar solicitacoes.");
      } finally {
        if (!ativo) return;
        if (!silencioso) setCarregando(false);
      }
    };

    carregar();
    const timer = window.setInterval(() => {
      carregar({ silencioso: true });
    }, 7000);

    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [ownerUserIdFiltro]);

  useEffect(() => {
    let cancelado = false;
    const faltantes = solicitacoes
      .map((solicitacao) => {
        const solicitacaoId = obterSolicitacaoId(solicitacao);
        if (!solicitacaoId || miniaturasFallback[solicitacaoId]) return null;
        const miniaturaDocumento = extrairMiniaturaSolicitacao(solicitacao);
        const originalDiferenteDaMiniatura =
          miniaturaDocumento.originalUrl &&
          miniaturaDocumento.originalUrl !== miniaturaDocumento.url;
        if (miniaturaDocumento.url && originalDiferenteDaMiniatura) {
          return null;
        }
        return {
          solicitacaoId,
          ownerUserId: String(solicitacao?.ownerUserId || "").trim(),
          espacoId: String(solicitacao?.espacoId || "").trim(),
          blocoId: String(solicitacao?.blocoId || "").trim(),
          previewUrlDocumento: String(miniaturaDocumento.url || "").trim(),
          originalUrlDocumento: String(miniaturaDocumento.originalUrl || "").trim(),
          originalPathDocumento: String(miniaturaDocumento.originalPath || "").trim(),
        };
      })
      .filter(Boolean);

    if (!faltantes.length) return undefined;

    (async () => {
      const atualizacoes = {};
      for (const item of faltantes) {
        const miniaturaAtualizada = {
          url: String(item.previewUrlDocumento || "").trim(),
          originalUrl: String(item.originalUrlDocumento || "").trim(),
          originalPath: String(item.originalPathDocumento || "").trim(),
          titulo: "",
        };

        if (
          miniaturaAtualizada.originalPath &&
          (!miniaturaAtualizada.originalUrl ||
            miniaturaAtualizada.originalUrl === miniaturaAtualizada.url)
        ) {
          try {
            miniaturaAtualizada.originalUrl = await resolverUrlArquivoPorPath(
              miniaturaAtualizada.originalPath
            );
          } catch {
            // Ignora; tenta fallback pelo documento do bloco.
          }
        }

        if (!item.ownerUserId || !item.espacoId || !item.blocoId) {
          if (miniaturaAtualizada.originalUrl || miniaturaAtualizada.url) {
            atualizacoes[item.solicitacaoId] = miniaturaAtualizada;
          }
          continue;
        }

        try {
          const blocoSnap = await getDoc(
            doc(
              db,
              "users",
              item.ownerUserId,
              "espacos",
              item.espacoId,
              "blocos",
              item.blocoId
            )
          );
          if (!blocoSnap.exists()) continue;
          const miniatura = extrairMiniaturaDoBloco(blocoSnap.data() || {});
          miniaturaAtualizada.url = String(
            miniaturaAtualizada.url || miniatura.url || ""
          ).trim();
          miniaturaAtualizada.titulo = String(
            miniaturaAtualizada.titulo || miniatura.titulo || ""
          ).trim();
          miniaturaAtualizada.originalPath = String(
            miniaturaAtualizada.originalPath || miniatura.originalPath || ""
          ).trim();
          const originalUrlPreferencial = String(miniatura.originalUrl || "").trim();
          if (originalUrlPreferencial && originalUrlPreferencial !== miniaturaAtualizada.url) {
            miniaturaAtualizada.originalUrl = originalUrlPreferencial;
          }

          if (
            (!miniaturaAtualizada.originalUrl ||
              miniaturaAtualizada.originalUrl === miniaturaAtualizada.url) &&
            miniaturaAtualizada.originalPath
          ) {
            try {
              miniaturaAtualizada.originalUrl = await resolverUrlArquivoPorPath(
                miniaturaAtualizada.originalPath
              );
            } catch {
              // Mantem fallback de preview.
            }
          }

          if (!miniaturaAtualizada.url) continue;
          atualizacoes[item.solicitacaoId] = miniaturaAtualizada;
        } catch {
          // Em contextos onde o comprador nao pode ler o bloco, seguimos sem miniatura.
          if (miniaturaAtualizada.originalUrl || miniaturaAtualizada.url) {
            atualizacoes[item.solicitacaoId] = miniaturaAtualizada;
          }
        }
      }

      if (cancelado || !Object.keys(atualizacoes).length) return;
      setMiniaturasFallback((prev) => ({
        ...prev,
        ...atualizacoes,
      }));
    })();

    return () => {
      cancelado = true;
    };
  }, [solicitacoes, miniaturasFallback]);

  useEffect(() => {
    if (!imagemModal.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setImagemModal((prev) => ({ ...prev, aberto: false }));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imagemModal.aberto]);

  const confirmarSolicitacao = async (solicitacao) => {
    const solicitacaoId = obterSolicitacaoId(solicitacao);
    if (!solicitacaoId) return;

    setAtualizandoSolicitacaoId(solicitacaoId);
    setErro("");
    setMensagem("");
    try {
      const response = await confirmarSolicitacaoPixManual({ solicitacaoId });
      setSolicitacoes((prev) =>
        prev.map((item) =>
          obterSolicitacaoId(item) === solicitacaoId
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
    const blocoTipo = String(solicitacao?.blocoTipo || "").trim().toLowerCase();
    const liveContactId =
      blocoTipo === "live"
        ? montarLiveContactId({
            ownerUserId: String(solicitacao?.ownerUserId || "").trim(),
            espacoId: String(solicitacao?.espacoId || "").trim(),
            blocoId: String(solicitacao?.blocoId || "").trim(),
          })
        : "";
    const contactId = String(
      liveContactId || solicitacao?.sessionContactId || ""
    ).trim();
    const conversationId = String(
      solicitacao?.sessionConversationId || "principal"
    ).trim();
    if (!contactId) return;
    navigate(`/menu/${menuTargetUser}/contatos/${contactId}/chat/${conversationId}`);
  };

  const abrirModalImagem = ({ url = "", titulo = "", alt = "Imagem ampliada" } = {}) => {
    const imagemUrl = String(url || "").trim();
    if (!imagemUrl) return;
    setImagemModal({
      aberto: true,
      url: imagemUrl,
      titulo: String(titulo || "").trim(),
      alt: String(alt || "Imagem ampliada").trim() || "Imagem ampliada",
    });
  };

  return (
    <div>
      <h2>SOLICITACOES</h2>

      {!!mensagem && <p>{mensagem}</p>}
      {!!erro && <p style={{ color: "red" }}>{erro}</p>}

      {!carregando && !solicitacoesOrdenadas.length ? (
        <p>Nenhuma solicitacao encontrada.</p>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {solicitacoesOrdenadas.map((solicitacao) => {
          const solicitacaoId = obterSolicitacaoId(solicitacao);
          const status = String(solicitacao?.status || "pedido_solicitado").toLowerCase();
          const statusConfirmado = status === "pagamento_confirmado";
          const precoFormatado = formatarPreco(
            solicitacao?.precoCentavos,
            solicitacao?.moeda || "BRL"
          );
          const qrUrl = String(solicitacao?.qrSelecionado?.imagemUrl || "").trim();
          const qrTitulo = String(solicitacao?.qrSelecionado?.titulo || "").trim();
          const miniaturaDoDocumento = extrairMiniaturaSolicitacao(solicitacao);
          const miniaturaFallback = miniaturasFallback[solicitacaoId] || {};
          const miniaturaUrl = String(
            miniaturaDoDocumento.url || miniaturaFallback.url || ""
          ).trim();
          const miniaturaOriginalDocumentoUrl = String(
            miniaturaDoDocumento.originalUrl || ""
          ).trim();
          const miniaturaOriginalFallbackUrl = String(
            miniaturaFallback.originalUrl || ""
          ).trim();
          let miniaturaOriginalUrl = miniaturaOriginalDocumentoUrl;
          if (
            (!miniaturaOriginalUrl || miniaturaOriginalUrl === miniaturaUrl) &&
            miniaturaOriginalFallbackUrl
          ) {
            miniaturaOriginalUrl = miniaturaOriginalFallbackUrl;
          }
          miniaturaOriginalUrl = String(miniaturaOriginalUrl || miniaturaUrl).trim();
          const miniaturaExibicaoUrl = String(
            statusConfirmado ? miniaturaOriginalUrl || miniaturaUrl : miniaturaUrl
          ).trim();
          const miniaturaTitulo = String(
            miniaturaDoDocumento.titulo || miniaturaFallback.titulo || solicitacao?.blocoId || ""
          ).trim();
          const exibirQr = Boolean(qrUrl) && !statusConfirmado;
          const possuiColunaMidia = Boolean(exibirQr || miniaturaUrl);
          const podeConfirmar = Boolean(solicitacao?.__isOwner) && !statusConfirmado;
          const chatDisponivel = Boolean(String(solicitacao?.sessionContactId || "").trim());
          const blocoTipo = String(solicitacao?.blocoTipo || "").trim().toLowerCase();
          const blocoEhLive = blocoTipo === "live";
          const liveInicioMs = parseLiveMs(
            solicitacao?.blocoLiveInicioEmMs,
            solicitacao?.blocoLiveInicioEmIso
          );
          const liveFimMs = parseLiveMs(
            solicitacao?.blocoLiveFimEmMs,
            solicitacao?.blocoLiveFimEmIso
          );
          const chatLiveDisponivel =
            blocoEhLive &&
            Boolean(
              montarLiveContactId({
                ownerUserId: String(solicitacao?.ownerUserId || "").trim(),
                espacoId: String(solicitacao?.espacoId || "").trim(),
                blocoId: String(solicitacao?.blocoId || "").trim(),
              })
            );
          const chatSessaoDisponivel =
            statusConfirmado &&
            (blocoEhLive ? chatLiveDisponivel : chatDisponivel);
          const miniaturaPodeAmpliar = Boolean(miniaturaExibicaoUrl) && statusConfirmado;
          const gridClassName = [
            "solicitacao-pix-card__grid",
            possuiColunaMidia ? "solicitacao-pix-card__grid--com-qr" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={solicitacaoId}
              className="solicitacao-pix-card"
            >
              <div className={gridClassName}>
                <div className="solicitacao-pix-card__details">
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
                    <strong>Tipo:</strong> {blocoEhLive ? "Live" : "Conteudo"}
                  </p>
                  {blocoEhLive ? (
                    <>
                      <p style={{ margin: "0 0 4px" }}>
                        <strong>Inicio:</strong> {formatarDataHoraLive(liveInicioMs)}
                      </p>
                      <p style={{ margin: "0 0 4px" }}>
                        <strong>Fim:</strong> {formatarDataHoraLive(liveFimMs)}
                      </p>
                    </>
                  ) : null}
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

                  <div className="solicitacao-pix-card__status-box">
                    <p className="solicitacao-pix-card__status-label">
                      <strong>Status:</strong> {formatarStatus(status)}
                    </p>
                    <div className="solicitacao-pix-card__status-media">
                      {statusConfirmado ? (
                        solicitacaoStatusConfirmadoIconUrl ? (
                          <img
                            className="solicitacao-pix-card__status-confirmado-icon"
                            src={solicitacaoStatusConfirmadoIconUrl}
                            alt="Pagamento confirmado"
                          />
                        ) : (
                          <span className="solicitacao-pix-card__status-confirmado-texto">
                            Confirmado
                          </span>
                        )
                      ) : solicitacaoStatusAguardandoSpriteUrl ? (
                        <span
                          className="solicitacao-pix-card__status-aguardando-sprite"
                          style={{ backgroundImage: `url("${solicitacaoStatusAguardandoSpriteUrl}")` }}
                          title="Aguardando confirmacao do pagamento"
                          aria-label="Aguardando confirmacao do pagamento"
                        />
                      ) : (
                        <span className="solicitacao-pix-card__status-aguardando-texto">
                          Aguardando confirmacao...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {possuiColunaMidia ? (
                  <div className="solicitacao-pix-card__media-stack">
                    {exibirQr ? (
                      <div className="solicitacao-pix-card__qr">
                        {!!qrTitulo && (
                          <p style={{ margin: "0 0 4px" }}>
                            <strong>QR:</strong> {qrTitulo}
                          </p>
                        )}
                        <button
                          className="solicitacao-pix-card__qr-button"
                          type="button"
                          onClick={() =>
                            abrirModalImagem({
                              url: qrUrl,
                              titulo: qrTitulo || "QR code PIX",
                              alt: "QR code PIX ampliado",
                            })
                          }
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

                    {miniaturaExibicaoUrl ? (
                      <div className="solicitacao-pix-card__thumb">
                        {miniaturaPodeAmpliar ? (
                          <button
                            className="solicitacao-pix-card__thumb-button"
                            type="button"
                            onClick={() =>
                              abrirModalImagem({
                                url: statusConfirmado
                                  ? miniaturaOriginalUrl || miniaturaExibicaoUrl
                                  : miniaturaExibicaoUrl,
                                titulo: miniaturaTitulo || "Conteudo desbloqueado",
                                alt: "Conteudo desbloqueado ampliado",
                              })
                            }
                            title="Clique para ampliar o conteudo desbloqueado"
                          >
                            <img
                              className={`solicitacao-pix-card__thumb-image${
                                statusConfirmado ? "" : " solicitacao-pix-card__thumb-image--bloqueado"
                              }`}
                              src={miniaturaExibicaoUrl}
                              alt="Miniatura do conteudo bloqueado"
                            />
                          </button>
                        ) : (
                          <div className="solicitacao-pix-card__thumb-frame">
                            <img
                              className="solicitacao-pix-card__thumb-image solicitacao-pix-card__thumb-image--bloqueado"
                              src={miniaturaExibicaoUrl}
                              alt="Miniatura do conteudo bloqueado"
                            />
                          </div>
                        )}
                        <p className="solicitacao-pix-card__thumb-helper">
                          {miniaturaPodeAmpliar
                            ? "Clique para ampliar"
                            : "Disponivel apos confirmacao"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="solicitacao-pix-card__actions" style={{ marginTop: 8 }}>
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

                {chatSessaoDisponivel ? (
                  <button
                    onClick={() => abrirChatSessao(solicitacao)}
                    style={{ marginLeft: podeConfirmar ? 8 : 0 }}
                  >
                    {blocoEhLive ? "Abrir chat da live" : "Abrir chat da sessao"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {imagemModal.aberto && imagemModal.url ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setImagemModal((prev) => ({ ...prev, aberto: false }))}
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
            {!!imagemModal.titulo && (
              <p style={{ margin: 0, color: "#fff", textAlign: "center" }}>
                <strong>{imagemModal.titulo}</strong>
              </p>
            )}
            <img
              src={imagemModal.url}
              alt={imagemModal.alt}
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
              onClick={() => setImagemModal((prev) => ({ ...prev, aberto: false }))}
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

