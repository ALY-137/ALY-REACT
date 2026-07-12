import { useEffect, useMemo, useState } from "react";
import Card from "../../Objects/Objetos/Card";
import Container from "../../Objects/Containers/Container";
import EditorBloco from "../../Blocos/EditorBloco";
import { formatarDataHoraLive } from "../live/liveUtils";
import {
  criarPedidoVenda,
  formatarPrecoVenda,
  normalizarProdutoVenda,
} from "../../Vendas/vendasApi";
import {
  getCyberpinkSubthemeIconColor,
  getCyberpinkSubthemeIconFilter,
  normalizeCyberpinkSubtheme,
} from "../../Temas/cyberpink/subthemes";
import {
  decryptTextBlockContent,
  isEncryptedTextBlockPayload,
} from "../../../Banco/textBlockCrypto";
import useEdgeHorizontalScroll from "../../../../hooks/useEdgeHorizontalScroll";

const POST_LOGIN_REDIRECT_KEY = "postLoginRedirectPath";

const CAMPOS_MEDIDAS_OBRIGATORIAS_VENDA = [
  ["busto", "Busto"],
  ["cintura", "Cintura"],
  ["quadril", "Quadril"],
  ["altura", "Altura"],
];

function EdgeHorizontalScrollArea({ className = "", children, ...props }) {
  const edgeScroll = useEdgeHorizontalScroll();

  return (
    <div
      {...props}
      ref={edgeScroll.ref}
      className={`${className} edge-horizontal-scroll`.trim()}
      data-edge-horizontal-scroll="true"
      onMouseEnter={edgeScroll.onMouseEnter}
      onMouseMove={edgeScroll.onMouseMove}
      onMouseLeave={edgeScroll.onMouseLeave}
      onBlur={edgeScroll.onBlur}
    >
      {children}
    </div>
  );
}

function CardActionIcon({ type }) {
  if (type === "eye") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M3.5 16s4.8-8 12.5-8 12.5 8 12.5 8-4.8 8-12.5 8S3.5 16 3.5 16Z" />
        <circle cx="16" cy="16" r="4.2" />
      </svg>
    );
  }
  if (type === "gear") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M18.8 3.5 19.7 7a10.8 10.8 0 0 1 2.2.9l3-1.8 2.4 4.1-2.8 2.3c.1.6.2 1.2.2 1.9s-.1 1.3-.2 1.9l2.8 2.3-2.4 4.1-3-1.8c-.7.4-1.4.7-2.2.9l-.9 3.5h-5.6l-.9-3.5a10.8 10.8 0 0 1-2.2-.9l-3 1.8-2.4-4.1 2.8-2.3a11 11 0 0 1-.2-1.9c0-.7.1-1.3.2-1.9L4.7 10.2l2.4-4.1 3 1.8c.7-.4 1.4-.7 2.2-.9l.9-3.5h5.6Z" />
        <circle cx="16" cy="16" r="4.6" />
      </svg>
    );
  }
  if (type === "audit") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M7 4.5h18v23H7v-23Z" />
        <path d="M11 10h10M11 15h10M11 20h6" />
        <path d="M21 21.5 25.5 26" />
        <circle cx="20" cy="20" r="4" />
      </svg>
    );
  }
  if (type === "copy") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M11 9.5h13.5v17H11v-17Z" />
        <path d="M7.5 22.5v-17H21" />
        <path d="M15 15h5.5M15 19h5.5" />
      </svg>
    );
  }
  if (type === "share") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle cx="8" cy="16" r="3.5" />
        <circle cx="22" cy="8" r="3.5" />
        <circle cx="22" cy="24" r="3.5" />
        <path d="M11.2 14.4 18.8 9.6M11.2 17.6l7.6 4.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M6.5 6.5h19v19h-19v-19Z" />
    </svg>
  );
}

export default function BlocoPublicoRenderer({
  bloco,
  blocoIndex,
  tituloBloco,
  iconeBloco,
  podeGerenciar,
  bloqueado,
  imagensParaExibir,
  abrirModalImagem,
  nomeBlocoSingularCapitalizado,
  blocoEhLive,
  liveBannerUrl,
  liveInicioMs,
  liveFimMs,
  liveEmAndamento,
  liveAgendada,
  liveEncerrada,
  abrirLiveBloco,
  blocoEhCards,
  cardsDoBloco,
  cardAtivo,
  indiceCardAtivo,
  imagensCardsPorBloco,
  isRenderableUrl,
  selecionarCardDoBloco,
  iniciarArrasteCardDoBloco,
  atualizarArrasteCardDoBloco,
  finalizarArrasteCardDoBloco,
  cardArrastePorBloco,
  addOnsDisponiveisProjetoPorId,
  normalizarAddOnIds,
  normalizarAddOnSubthemes,
  montarRotaCardDoBloco,
  abrirFichaAddOn,
  abrirFichaCardFragmento,
  navigate,
  abrirEditorBlocoCards,
  abrirEditorCardDoBloco,
  podeVerAuditoriaConteudo,
  abrirAuditoriaEntidade,
  podeVerAuditoriaRastreaveis,
  abrirPreviewImpressaoCard,
  currentUid,
  tipoRestricao,
  sessaoChatBloco,
  abrirChatSessaoBloco,
  renderCtaRestricao,
  nomeBlocoSingular,
  precoCompradorFormatado,
  blocoEhAddOns,
  blocoEhVenda,
  blocoEhTexto,
  produtosVenda,
  ownerUserId,
  currentUidAutenticado,
  authUserAtual,
  abrirChatProdutoVenda,
  addOnsPorSubBloco,
  normalizarSubtemaAddOnOpcional,
  isSvgAssetUrl,
  aly137ResumoAddOnsPorId,
  excluirBloco,
  atualizarBloco,
  blocoEmAtualizacaoId,
  blocoEmExclusaoId,
  imagensEditor,
  espacoId,
}) {
  const imagemBlocoParaExibir = imagensParaExibir || [];
  const produtosVendaNormalizados = (Array.isArray(produtosVenda) ? produtosVenda : [])
    .map((produto) => normalizarProdutoVenda(produto, produto?.id))
    .filter((produto) => produto.id && produto.nome && produto.ativo !== false);
  const [draftsPedidoVenda, setDraftsPedidoVenda] = useState({});
  const [statusPedidoVenda, setStatusPedidoVenda] = useState({});
  const [statusChatProdutoVenda, setStatusChatProdutoVenda] = useState({});
  const [textoChaveLeitura, setTextoChaveLeitura] = useState("");
  const [textoDescriptografado, setTextoDescriptografado] = useState("");
  const [textoStatusCripto, setTextoStatusCripto] = useState("");
  const textoCriptografado = Boolean(bloco?.textoConteudoCriptografado);
  const textoCriptografiaValida = isEncryptedTextBlockPayload(bloco?.textoCriptografia);
  const textoCorpoVisivel = textoCriptografado
    ? textoDescriptografado
    : String(bloco?.textoCorpo || bloco?.conteudo || bloco?.descricao || "").trim();
  const textoParagrafos = useMemo(
    () =>
      String(textoCorpoVisivel || "")
        .split(/\n{2,}/)
        .map((trecho) => trecho.trim())
        .filter(Boolean),
    [textoCorpoVisivel]
  );
  const textoImagens = useMemo(
    () =>
      (Array.isArray(bloco?.textoImagens) ? bloco.textoImagens : [])
        .map((item) => ({
          url: String(item?.url || "").trim(),
          nome: String(item?.nome || "").trim(),
        }))
        .filter((item) => item.url),
    [bloco?.textoImagens]
  );

  useEffect(() => {
    setTextoChaveLeitura("");
    setTextoDescriptografado("");
    setTextoStatusCripto("");
  }, [bloco?.id, bloco?.textoCriptografia?.data]);

  const descriptografarTexto = async () => {
    if (!textoCriptografiaValida) {
      setTextoStatusCripto("Conteudo criptografado invalido.");
      return;
    }
    if (!String(textoChaveLeitura || "").trim()) {
      setTextoStatusCripto("Informe a chave para ler este texto.");
      return;
    }

    setTextoStatusCripto("Descriptografando...");
    try {
      const textoAberto = await decryptTextBlockContent(
        bloco.textoCriptografia,
        textoChaveLeitura
      );
      setTextoDescriptografado(textoAberto);
      setTextoStatusCripto("Conteudo descriptografado nesta sessao.");
    } catch {
      setTextoDescriptografado("");
      setTextoStatusCripto("Chave incorreta ou conteudo indisponivel.");
    }
  };

  const irParaLoginComRetorno = () => {
    if (typeof window !== "undefined") {
      const destinoAtual = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
      const caminhoSemQuery = destinoAtual.split("?")[0].split("#")[0];
      if (destinoAtual && caminhoSemQuery !== "/login") {
        try {
          window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, destinoAtual);
        } catch {
          // Segue para login mesmo sem storage local.
        }
      }
    }

    if (typeof navigate === "function") {
      navigate("/login");
    } else if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  };

  const getDraftPedidoVenda = (produto = {}) => {
    const produtoId = String(produto?.id || "").trim();
    const locais = Array.isArray(produto?.locaisRecebimento) ? produto.locaisRecebimento : [];
    const primeiroLocal = locais[0] || {};
    const entregaHabilitada = produto?.entregaDomicilio?.habilitada === true;
    const tipoRecebimento = primeiroLocal?.id ? "retirada" : entregaHabilitada ? "entrega" : "";

    return {
      tamanhoSelecionado: "",
      medidas: {
        busto: "",
        cintura: "",
        quadril: "",
        altura: "",
        observacoes: "",
      },
      recebimentoTipo: tipoRecebimento,
      localId: String(primeiroLocal?.id || "").trim(),
      enderecoEntrega: "",
      observacoes: "",
      ...(draftsPedidoVenda[produtoId] || {}),
    };
  };

  const atualizarDraftPedidoVenda = (produtoId, patch = {}) => {
    const id = String(produtoId || "").trim();
    if (!id) return;
    setDraftsPedidoVenda((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
    limparStatusPedidoVenda(id);
  };

  const atualizarMedidaPedidoVenda = (produtoId, campo, valor) => {
    const id = String(produtoId || "").trim();
    if (!id) return;
    setDraftsPedidoVenda((prev) => {
      const draftAtual = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...draftAtual,
          medidas: {
            ...(draftAtual.medidas || {}),
            [campo]: valor,
          },
        },
      };
    });
    limparStatusPedidoVenda(id);
  };

  const definirStatusPedidoVenda = (produtoId, mensagem, tipo = "info") => {
    const id = String(produtoId || "").trim();
    if (!id) return;
    setStatusPedidoVenda((prev) => ({
      ...prev,
      [id]: {
        mensagem,
        tipo,
      },
    }));
  };

  const limparStatusPedidoVenda = (produtoId) => {
    const id = String(produtoId || "").trim();
    if (!id) return;
    setStatusPedidoVenda((prev) => {
      const atual = prev[id];
      if (!atual || atual.tipo === "enviando") return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const definirStatusChatProdutoVenda = (produtoId, mensagem, tipo = "info") => {
    const id = String(produtoId || "").trim();
    if (!id) return;
    setStatusChatProdutoVenda((prev) => ({
      ...prev,
      [id]: {
        mensagem,
        tipo,
      },
    }));
  };

  const iniciarChatProdutoVenda = async (produto = {}) => {
    const produtoId = String(produto?.id || "").trim();
    const blocoPermiteChat = bloco?.duvidasChatHabilitado !== false &&
      String(bloco?.duvidasChatVisibilidade || "usuarios_logados").toLowerCase() !== "desativado";
    const produtoPermiteChat = produto?.duvidasChatHabilitado !== false &&
      String(produto?.duvidasChatVisibilidade || "usuarios_logados").toLowerCase() !== "desativado";

    if (!blocoPermiteChat || !produtoPermiteChat) {
      definirStatusChatProdutoVenda(produtoId, "Duvidas por chat indisponiveis para este produto.", "erro");
      return;
    }

    if (!currentUidAutenticado) {
      definirStatusChatProdutoVenda(produtoId, "Faca login para tirar duvidas sobre este produto.", "erro");
      irParaLoginComRetorno();
      return;
    }

    if (typeof abrirChatProdutoVenda !== "function") {
      definirStatusChatProdutoVenda(produtoId, "Chat indisponivel neste momento.", "erro");
      return;
    }

    definirStatusChatProdutoVenda(produtoId, "Abrindo conversa...", "enviando");
    try {
      const resultado = await abrirChatProdutoVenda({
        bloco,
        produto,
      });
      if (resultado?.ok === false) {
        definirStatusChatProdutoVenda(
          produtoId,
          resultado?.message || "Nao foi possivel abrir a conversa.",
          "erro"
        );
      }
    } catch (error) {
      definirStatusChatProdutoVenda(
        produtoId,
        error?.message || "Nao foi possivel abrir a conversa.",
        "erro"
      );
    }
  };

  const enviarPedidoVenda = async (produto = {}) => {
    const produtoId = String(produto?.id || "").trim();
    const draft = getDraftPedidoVenda(produto);
    const exigeMedidas = produto.sobMedida || produto.porEncomenda;
    const medidasFaltantes = CAMPOS_MEDIDAS_OBRIGATORIAS_VENDA
      .filter(([campo]) => !String(draft.medidas?.[campo] || "").trim())
      .map(([, label]) => label);

    if (!currentUidAutenticado) {
      definirStatusPedidoVenda(produtoId, "Faca login para solicitar este produto.", "erro");
      return;
    }

    if (produto.tipoProduto === "roupa" && !produto.sobMedida && produto.tamanhos?.length && !draft.tamanhoSelecionado) {
      definirStatusPedidoVenda(produtoId, "Selecione um tamanho.", "erro");
      return;
    }

    if (exigeMedidas && medidasFaltantes.length) {
      definirStatusPedidoVenda(
        produtoId,
        `Informe as medidas obrigatorias: ${medidasFaltantes.join(", ")}.`,
        "erro"
      );
      return;
    }

    const locais = Array.isArray(produto?.locaisRecebimento) ? produto.locaisRecebimento : [];
    const localSelecionado =
      locais.find((local) => String(local?.id || "").trim() === String(draft.localId || "").trim()) ||
      locais[0] ||
      {};
    const entregaDomicilio = produto?.entregaDomicilio || {};
    const recebimentoTipo = draft.recebimentoTipo ||
      (localSelecionado?.id ? "retirada" : entregaDomicilio.habilitada ? "entrega" : "combinar");

    if (recebimentoTipo === "entrega" && !String(draft.enderecoEntrega || "").trim()) {
      definirStatusPedidoVenda(produtoId, "Informe o endereco de entrega.", "erro");
      return;
    }

    definirStatusPedidoVenda(produtoId, "Enviando pedido...", "enviando");

    try {
      await criarPedidoVenda({
        ownerUserId: ownerUserId || bloco?.ownerUserId || bloco?.criadoPor || "",
        espacoId,
        blocoId: bloco.id,
        produto,
        clienteUid: currentUidAutenticado,
        clienteNome: authUserAtual?.displayName || "",
        clienteEmail: authUserAtual?.email || "",
        tamanhoSelecionado: draft.tamanhoSelecionado,
        medidas: draft.medidas,
        recebimento:
          recebimentoTipo === "entrega"
            ? {
                tipo: "entrega",
                endereco: draft.enderecoEntrega,
                taxaCentavos: entregaDomicilio?.taxaCentavos,
              }
            : localSelecionado?.id
              ? {
                tipo: "retirada",
                localId: localSelecionado?.id,
                localNome: localSelecionado?.nome,
                endereco: localSelecionado?.endereco,
                horarios: localSelecionado?.horarios,
              }
              : {
                tipo: "combinar",
              },
        observacoes: draft.observacoes,
      });

      setDraftsPedidoVenda((prev) => {
        const next = { ...prev };
        delete next[produtoId];
        return next;
      });
      definirStatusPedidoVenda(
        produtoId,
        "Pedido enviado. O vendedor vera sua solicitacao no gerenciador.",
        "sucesso"
      );
    } catch (error) {
      definirStatusPedidoVenda(
        produtoId,
        error?.message || "Nao foi possivel enviar o pedido.",
        "erro"
      );
    }
  };

  const renderVendaProduto = (produto = {}) => {
    const produtoId = String(produto?.id || "").trim();
    const draft = getDraftPedidoVenda(produto);
    const precoProduto = formatarPrecoVenda(produto.precoCentavos, produto.moeda);
    const locais = Array.isArray(produto.locaisRecebimento) ? produto.locaisRecebimento : [];
    const entregaDomicilio = produto.entregaDomicilio || {};
    const podeEscolherTamanho =
      produto.tipoProduto === "roupa" && !produto.sobMedida && Array.isArray(produto.tamanhos) && produto.tamanhos.length;
    const exigeMedidas = produto.sobMedida || produto.porEncomenda;
    const statusAtual = statusPedidoVenda[produtoId] || null;
    const statusChatAtual = statusChatProdutoVenda[produtoId] || null;
    const pedidoEmEnvio = statusAtual?.tipo === "enviando";
    const chatEmAbertura = statusChatAtual?.tipo === "enviando";
    const statusColor =
      statusAtual?.tipo === "erro"
        ? "#ff9db0"
        : statusAtual?.tipo === "sucesso"
          ? "#9dffb4"
          : "inherit";
    const statusChatColor =
      statusChatAtual?.tipo === "erro"
        ? "#ff9db0"
        : statusChatAtual?.tipo === "sucesso"
          ? "#9dffb4"
          : "inherit";
    const blocoPermiteChat = bloco?.duvidasChatHabilitado !== false &&
      String(bloco?.duvidasChatVisibilidade || "usuarios_logados").toLowerCase() !== "desativado";
    const produtoPermiteChat = produto?.duvidasChatHabilitado !== false &&
      String(produto?.duvidasChatVisibilidade || "usuarios_logados").toLowerCase() !== "desativado";
    const podeMostrarChatProduto = blocoPermiteChat && produtoPermiteChat;

    return (
      <article
        key={produtoId}
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(96px, 140px) minmax(0, 1fr)",
          alignItems: "start",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 8,
          padding: 12,
          background: "rgba(0,0,0,0.16)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {produto.imagemUrl && isRenderableUrl(produto.imagemUrl) ? (
            <button
              type="button"
              className="image-zoom-trigger"
              onClick={() =>
                abrirModalImagem({
                  url: produto.imagemUrl,
                  titulo: produto.nome,
                  alt: "Imagem ampliada do produto",
                })
              }
              style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
              title="Clique para ampliar"
            >
              <img
                src={produto.imagemUrl}
                alt={produto.nome}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 6,
                  display: "block",
                }}
              />
            </button>
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.1)",
                fontWeight: 700,
              }}
            >
              {produto.nome.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 18 }}>{produto.nome}</h4>
            {precoProduto ? <strong>{precoProduto}</strong> : null}
            {produto.categoria ? <p style={{ margin: "4px 0 0", opacity: 0.76 }}>{produto.categoria}</p> : null}
            {produto.descricao ? <p style={{ margin: "8px 0 0" }}>{produto.descricao}</p> : null}
            {produto.observacoesVenda ? <p style={{ margin: "8px 0 0", opacity: 0.82 }}>{produto.observacoesVenda}</p> : null}
          </div>

          {podeEscolherTamanho ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span>Tamanho</span>
              <select
                value={draft.tamanhoSelecionado}
                onChange={(event) =>
                  atualizarDraftPedidoVenda(produtoId, { tamanhoSelecionado: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {produto.tamanhos.map((tamanho) => (
                  <option key={`${produtoId}-${tamanho}`} value={tamanho}>
                    {tamanho}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {exigeMedidas ? (
            <div style={{ display: "grid", gap: 8 }}>
              <span>Medidas</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                {CAMPOS_MEDIDAS_OBRIGATORIAS_VENDA.map(([campo, label]) => (
                  <label key={`${produtoId}-${campo}`} style={{ display: "grid", gap: 4 }}>
                    <span>{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="cm"
                      value={draft.medidas?.[campo] || ""}
                      onChange={(event) => atualizarMedidaPedidoVenda(produtoId, campo, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Observacoes das medidas</span>
                <textarea
                  rows={2}
                  value={draft.medidas?.observacoes || ""}
                  onChange={(event) =>
                    atualizarMedidaPedidoVenda(produtoId, "observacoes", event.target.value)
                  }
                />
              </label>
            </div>
          ) : null}

          {locais.length || entregaDomicilio.habilitada ? (
            <fieldset style={{ display: "grid", gap: 8, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 6 }}>
              <legend>Recebimento</legend>
              {locais.length ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Local</span>
                  <select
                    value={draft.recebimentoTipo === "entrega" ? "entrega" : draft.localId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "entrega") {
                        atualizarDraftPedidoVenda(produtoId, { recebimentoTipo: "entrega" });
                        return;
                      }
                      atualizarDraftPedidoVenda(produtoId, {
                        recebimentoTipo: "retirada",
                        localId: value,
                      });
                    }}
                  >
                    {locais.map((local) => (
                      <option key={`${produtoId}-${local.id}`} value={local.id}>
                        {local.nome || local.endereco || "Retirada"}
                      </option>
                    ))}
                    {entregaDomicilio.habilitada ? (
                      <option value="entrega">
                        {`Entrega em casa${formatarPrecoVenda(entregaDomicilio.taxaCentavos, produto.moeda) ? ` - ${formatarPrecoVenda(entregaDomicilio.taxaCentavos, produto.moeda)}` : ""}`}
                      </option>
                    ) : null}
                  </select>
                </label>
              ) : entregaDomicilio.habilitada ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    checked
                    readOnly
                  />
                  <span>
                    {`Entrega em casa${formatarPrecoVenda(entregaDomicilio.taxaCentavos, produto.moeda) ? ` - ${formatarPrecoVenda(entregaDomicilio.taxaCentavos, produto.moeda)}` : ""}`}
                  </span>
                </label>
              ) : null}

              {draft.recebimentoTipo !== "entrega" && locais.length ? (
                <div style={{ display: "grid", gap: 2, opacity: 0.82 }}>
                  {(() => {
                    const localAtual =
                      locais.find((local) => String(local?.id || "") === String(draft.localId || "")) ||
                      locais[0] ||
                      {};
                    return (
                      <>
                        {localAtual.endereco ? <span>{localAtual.endereco}</span> : null}
                        {localAtual.horarios ? <span>{localAtual.horarios}</span> : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {draft.recebimentoTipo === "entrega" || (!locais.length && entregaDomicilio.habilitada) ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Endereco de entrega</span>
                  <textarea
                    rows={2}
                    value={draft.enderecoEntrega}
                    onChange={(event) =>
                      atualizarDraftPedidoVenda(produtoId, { enderecoEntrega: event.target.value, recebimentoTipo: "entrega" })
                    }
                  />
                </label>
              ) : null}

              {entregaDomicilio.observacoes ? (
                <p style={{ margin: 0, opacity: 0.78 }}>{entregaDomicilio.observacoes}</p>
              ) : null}
            </fieldset>
          ) : (
            <p style={{ margin: 0, opacity: 0.78 }}>Recebimento a combinar com o vendedor.</p>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            <span>Observacoes do pedido</span>
            <textarea
              rows={2}
              value={draft.observacoes}
              onChange={(event) =>
                atualizarDraftPedidoVenda(produtoId, { observacoes: event.target.value })
              }
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => enviarPedidoVenda(produto)} disabled={pedidoEmEnvio}>
              {pedidoEmEnvio ? "Enviando..." : currentUidAutenticado ? "Solicitar produto" : "Entrar para solicitar"}
            </button>
            {podeMostrarChatProduto ? (
              <button
                type="button"
                onClick={() => iniciarChatProdutoVenda(produto)}
                disabled={chatEmAbertura}
              >
                {chatEmAbertura ? "Abrindo..." : currentUidAutenticado ? "Tirar duvida" : "Entrar para tirar duvida"}
              </button>
            ) : null}
            {statusAtual?.mensagem ? (
              <span
                role={statusAtual.tipo === "erro" ? "alert" : "status"}
                aria-live="polite"
                style={{ fontSize: 13, opacity: 0.9, color: statusColor }}
              >
                {statusAtual.mensagem}
              </span>
            ) : null}
            {statusChatAtual?.mensagem ? (
              <span
                role={statusChatAtual.tipo === "erro" ? "alert" : "status"}
                aria-live="polite"
                style={{ fontSize: 13, opacity: 0.9, color: statusChatColor }}
              >
                {statusChatAtual.mensagem}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const renderCard = () => {
    if (!cardAtivo) return null;
    const cardKey = `${bloco.id}:${cardAtivo.id || indiceCardAtivo}`;
    const imagemCardResolvida = imagensCardsPorBloco?.[bloco.id]?.[cardAtivo.id] || "";
    const imagemCardFinal = isRenderableUrl(cardAtivo.imagem)
      ? cardAtivo.imagem
      : imagemCardResolvida || "/logoNeon.png";
    const addOnsCardAtivo = normalizarAddOnIds(cardAtivo.addOnIds)
      .map((addOnId) => addOnsDisponiveisProjetoPorId[addOnId])
      .filter(Boolean);
    const rotaCardAtivo = montarRotaCardDoBloco(bloco, cardAtivo);
    const estadoArrasteAtual = cardArrastePorBloco?.[bloco.id] || {};
    const deslocamentoArraste = Number(estadoArrasteAtual.deltaX) || 0;
    const arrasteAtivo = Boolean(estadoArrasteAtual.dragging);

    return (
      <>
        <div
          className="cards-bloco-viewer"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 367,
            minHeight: 445,
            margin: "0 auto 18px",
            padding: "0 46px",
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          {cardsDoBloco.length > 1 ? (
            <button
              type="button"
              className="cards-bloco-nav cards-bloco-nav--prev"
              onClick={() => selecionarCardDoBloco(bloco.id, indiceCardAtivo - 1)}
              disabled={indiceCardAtivo <= 0}
              aria-label="Mostrar card anterior"
            >
              {"<<"}
            </button>
          ) : null}
          <div
            className="cards-bloco-stage"
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              touchAction: "pan-y",
              userSelect: "none",
              cursor: cardsDoBloco.length > 1 ? (arrasteAtivo ? "grabbing" : "grab") : "default",
            }}
            onPointerDown={(event) => {
              if (cardsDoBloco.length <= 1) return;
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.currentTarget.setPointerCapture?.(event.pointerId);
              iniciarArrasteCardDoBloco(bloco.id, event.clientX);
            }}
            onPointerMove={(event) => {
              if (cardsDoBloco.length <= 1) return;
              atualizarArrasteCardDoBloco(bloco.id, event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              finalizarArrasteCardDoBloco(bloco.id, indiceCardAtivo, cardsDoBloco.length);
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              finalizarArrasteCardDoBloco(bloco.id, indiceCardAtivo, cardsDoBloco.length);
            }}
          >
            <div
              key={cardKey}
              className="cards-bloco-card-shell"
              style={{
                transform: `translateX(${deslocamentoArraste}px)`,
                transition: arrasteAtivo ? "none" : "transform 220ms ease",
                willChange: "transform",
              }}
            >
              <Card
                id={cardAtivo.id || `${bloco.id}-card-${indiceCardAtivo}`}
                ownerUserId={currentUid}
                espacoId={espacoId}
                blocoId={bloco.id}
                addOnIds={normalizarAddOnIds(cardAtivo.addOnIds)}
                addOnSubthemes={normalizarAddOnSubthemes(cardAtivo.addOnSubthemes, cardAtivo.addOnIds)}
                usaAddOnsGerenciador={cardAtivo?.usaAddOnsGerenciador === true}
                addOns={addOnsCardAtivo}
                aly137={cardAtivo.aly137}
                onAddOnClick={abrirFichaAddOn}
                onCardFragmentClick={abrirFichaCardFragmento}
                cyberpinkSubtheme={normalizeCyberpinkSubtheme(bloco?.subtema)}
                nome={cardAtivo.nome || `Card ${indiceCardAtivo + 1}`}
                descricaoExtra={cardAtivo.descricaoExtra || ""}
                nomeDescricao={cardAtivo.nome || ""}
                descricao={cardAtivo.descricaoPrevia || cardAtivo.descricao || ""}
                atributoPersonalizado={cardAtivo.atributoPersonalizado}
                linkExterno={cardAtivo.linkExterno || ""}
                imagem={imagemCardFinal}
                idNome={`${bloco.id}-card-${indiceCardAtivo}`}
                cardDescricaoDiv="cardDescricaoDiv"
                cardNome="cardNome"
                cardContainerDesktop="cardContainerDesktop"
                cardCabecalho="cardCabecalho"
                cardImagem="cardImagem"
                cardDescricao="cardDescricao"
                imgCard="imgCard"
                onImagemClick={(imagemUrl) =>
                  abrirModalImagem({
                    url: imagemUrl,
                    titulo: cardAtivo.nome || tituloBloco || nomeBlocoSingularCapitalizado,
                    alt: "Imagem ampliada do card",
                  })
                }
              />
            </div>
          </div>
          <div className="cards-bloco-actions" aria-label="Acoes do card">
            <button
              type="button"
              className="cards-bloco-action-button"
              onClick={() => {
                if (rotaCardAtivo) {
                  navigate(rotaCardAtivo);
                }
              }}
              disabled={!rotaCardAtivo}
              title="Ver card ampliado"
              aria-label="Ver card ampliado"
            >
              <CardActionIcon type="eye" />
            </button>

            {podeGerenciar ? (
              <button
                type="button"
                className="cards-bloco-action-button"
                onClick={() => abrirEditorCardDoBloco(bloco, cardAtivo)}
                title="Editar card"
                aria-label="Editar card"
              >
                <CardActionIcon type="gear" />
              </button>
            ) : null}

            {podeVerAuditoriaConteudo ? (
              <button
                type="button"
                className="cards-bloco-action-button"
                onClick={() => {
                  abrirAuditoriaEntidade({
                    entityType: "card",
                    entityId: cardAtivo.id || `${bloco.id}-card-${indiceCardAtivo}`,
                  });
                }}
                title="Ver auditoria do card"
                aria-label="Ver auditoria do card"
              >
                <CardActionIcon type="audit" />
              </button>
            ) : null}

            {podeVerAuditoriaRastreaveis ? (
              <button
                type="button"
                className="cards-bloco-action-button"
                onClick={() =>
                  abrirPreviewImpressaoCard({
                    bloco,
                    card: cardAtivo,
                    imagem: imagemCardFinal,
                    addOns: addOnsCardAtivo,
                    rota: rotaCardAtivo,
                  })
                }
                title="Historico de Card Rastreaveis"
                aria-label="Historico de Card Rastreaveis"
              >
                <CardActionIcon type="print" />
              </button>
            ) : null}
          </div>
          {cardsDoBloco.length > 1 ? (
            <button
              type="button"
              className="cards-bloco-nav cards-bloco-nav--next"
              onClick={() => selecionarCardDoBloco(bloco.id, indiceCardAtivo + 1)}
              disabled={indiceCardAtivo >= cardsDoBloco.length - 1}
              aria-label="Mostrar proximo card"
            >
              {">>"}
            </button>
          ) : null}
        </div>
        {cardsDoBloco.length > 1 ? (
          <div className="cards-bloco-count">
            <span className="cards-bloco-count-text">{`Card ${indiceCardAtivo + 1} de ${cardsDoBloco.length}`}</span>
          </div>
        ) : null}
        {cardsDoBloco.length > 1 ? (
          <div className="cards-bloco-thumbs">
            {cardsDoBloco.map((card, cardIndex) => {
              const imagemCardResolvida = imagensCardsPorBloco?.[bloco.id]?.[card.id] || "";
              const imagemCardFinal = isRenderableUrl(card.imagem)
                ? card.imagem
                : imagemCardResolvida || "/logoNeon.png";
              const ativo = cardIndex === indiceCardAtivo;
              return (
                <div
                  key={`${bloco.id}-thumb-${card.id || cardIndex}`}
                  className={`cards-bloco-thumb-slot${ativo ? " is-active" : ""}`}
                >
                  <button
                    type="button"
                    className={`cards-bloco-thumb${ativo ? " is-active" : ""}`}
                    onClick={() => selecionarCardDoBloco(bloco.id, cardIndex)}
                    title={card.nome || `Card ${cardIndex + 1}`}
                  >
                    <span className="cards-bloco-thumb-inner">
                      <span className="cards-bloco-thumb-header">
                        <span className="cards-bloco-thumb-title">{card.nome || `Card ${cardIndex + 1}`}</span>
                      </span>
                      <span className="cards-bloco-thumb-media">
                        <img src={imagemCardFinal} alt="" className="cards-bloco-thumb-image" />
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <Container
      key={bloco.id}
      titulo={tituloBloco}
      iconUrl={iconeBloco}
      variante="home"
      style={
        !podeGerenciar && blocoIndex === 0
          ? { marginTop: tituloBloco || iconeBloco ? 96 : 64 }
          : undefined
      }
      className={`bloco-imagem${!podeGerenciar && blocoIndex === 0 ? " bloco-imagem--first-without-creator" : ""}`}
    >
      {!!imagemBlocoParaExibir.length && (
        <div
          style={{
            filter: bloqueado ? "blur(10px)" : "none",
            opacity: bloqueado ? 0.7 : 1,
            transition: "filter 150ms ease",
          }}
        >
          {imagemBlocoParaExibir.map((url, i) =>
            bloqueado ? (
              <img key={`${bloco.id}-${i}`} src={url} alt="" style={{ maxWidth: "200px", margin: "4px" }} />
            ) : (
              <button
                key={`${bloco.id}-${i}`}
                type="button"
                className="image-zoom-trigger"
                onClick={() =>
                  abrirModalImagem({
                    url,
                    titulo: tituloBloco || `${nomeBlocoSingularCapitalizado} ${i + 1}`,
                    alt: "Imagem ampliada do bloco",
                  })
                }
                style={{ border: "none", background: "transparent", padding: 0, margin: "4px", cursor: "zoom-in" }}
                title="Clique para ampliar"
              >
                <img src={url} alt="" style={{ maxWidth: "200px", display: "block" }} />
              </button>
            )
          )}
        </div>
      )}

      {blocoEhTexto && !bloqueado && (
        <article
          className={`bloco-texto bloco-texto--${String(bloco?.textoModo || "simples").trim() || "simples"}`}
          style={{ display: "grid", gap: 14, width: "100%", textAlign: "left" }}
        >
          {isRenderableUrl(String(bloco?.imagemCapaUrl || "").trim()) ? (
            <button
              type="button"
              className="image-zoom-trigger bloco-texto__capa-trigger"
              onClick={() =>
                abrirModalImagem({
                  url: String(bloco.imagemCapaUrl).trim(),
                  titulo: tituloBloco || "Imagem de capa",
                  alt: "Imagem de capa ampliada",
                })
              }
              style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
              title="Clique para ampliar"
            >
              <img
                src={String(bloco.imagemCapaUrl).trim()}
                alt=""
                className="bloco-texto__capa"
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 8,
                  display: "block",
                }}
              />
            </button>
          ) : null}

          {bloco?.textoSubtitulo ? (
            <p className="bloco-texto__subtitulo" style={{ margin: 0, opacity: 0.82 }}>
              {bloco.textoSubtitulo}
            </p>
          ) : null}

          {textoCriptografado && !textoDescriptografado ? (
            <div
              className="bloco-texto__crypto"
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 8,
                background: "rgba(0,0,0,0.16)",
              }}
            >
              {bloco?.textoResumoPublico ? (
                <p style={{ margin: 0 }}>{bloco.textoResumoPublico}</p>
              ) : null}
              <strong>Conteudo criptografado</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="password"
                  value={textoChaveLeitura}
                  onChange={(event) => setTextoChaveLeitura(event.target.value)}
                  placeholder="Chave de leitura"
                  autoComplete="current-password"
                />
                <button type="button" onClick={descriptografarTexto}>
                  Descriptografar
                </button>
              </div>
              {textoStatusCripto ? (
                <span style={{ fontSize: 13, opacity: 0.82 }}>{textoStatusCripto}</span>
              ) : null}
            </div>
          ) : textoParagrafos.length ? (
            <div className="bloco-texto__corpo" style={{ display: "grid", gap: 10 }}>
              {textoParagrafos.map((paragrafo, index) => (
                <p key={`${bloco.id}-texto-${index}`} style={{ margin: 0, lineHeight: 1.65 }}>
                  {paragrafo.split(/\n/).map((linha, linhaIndex) => (
                    <span key={`${bloco.id}-texto-${index}-${linhaIndex}`}>
                      {linhaIndex > 0 ? <br /> : null}
                      {linha}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          ) : null}

          {!!textoImagens.length && (
            <div
              className="bloco-texto__imagens"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
              }}
            >
              {textoImagens.map((imagem, index) => (
                <button
                  key={`${bloco.id}-texto-imagem-${index}`}
                  type="button"
                  className="image-zoom-trigger"
                  onClick={() =>
                    abrirModalImagem({
                      url: imagem.url,
                      titulo: imagem.nome || tituloBloco || "Imagem do texto",
                      alt: "Imagem do texto ampliada",
                    })
                  }
                  style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
                  title="Clique para ampliar"
                >
                  <img
                    src={imagem.url}
                    alt={imagem.nome || ""}
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 6,
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </article>
      )}

      {blocoEhLive && (
        <div style={{ marginBottom: 10 }}>
          {!!liveBannerUrl &&
            (bloqueado ? (
              <img
                src={liveBannerUrl}
                alt="Anuncio da live"
                style={{
                  width: "min(100%, 520px)",
                  maxHeight: 240,
                  objectFit: "cover",
                  borderRadius: 8,
                  filter: "blur(10px)",
                  opacity: 0.75,
                }}
              />
            ) : (
              <button
                type="button"
                className="image-zoom-trigger"
                onClick={() =>
                  abrirModalImagem({
                    url: liveBannerUrl,
                    titulo: tituloBloco || "Anuncio da live",
                    alt: "Anuncio da live ampliado",
                  })
                }
                style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
                title="Clique para ampliar"
              >
                <img
                  src={liveBannerUrl}
                  alt="Anuncio da live"
                  style={{
                    width: "min(100%, 520px)",
                    maxHeight: 240,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              </button>
            ))}
          <p style={{ margin: "8px 0 4px" }}>
            <strong>Inicio:</strong> {formatarDataHoraLive(liveInicioMs)}
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Fim:</strong> {formatarDataHoraLive(liveFimMs)}
          </p>
          {!bloqueado ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {liveEmAndamento ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void abrirLiveBloco(bloco);
                  }}
                >
                  Entrar na live
                </button>
              ) : liveAgendada ? (
                <span>Live agendada.</span>
              ) : liveEncerrada ? (
                <span>Live encerrada.</span>
              ) : (
                <span>Live indisponivel no momento.</span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {blocoEhCards && !bloqueado && !!cardsDoBloco.length && <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>{renderCard()}</div>}

      {blocoEhAddOns && !bloqueado && (
        <div className="addons-bloco-subblocos" aria-label="Add-ons do bloco">
          {addOnsPorSubBloco.length ? (
            addOnsPorSubBloco.map((subBloco) => (
              <section key={`${bloco.id}-${subBloco.id}`} className="addons-bloco-subbloco">
                {subBloco.titulo ? <h4 className="addons-bloco-subbloco-title">{subBloco.titulo}</h4> : null}
                <EdgeHorizontalScrollArea className="addons-bloco-carousel" role="region" aria-label={`Carrossel de add-ons: ${subBloco.titulo || "Subbloco"}`}>
                  <div className="addons-bloco-shelf">
                    <div className="addons-bloco-track">
                    {subBloco.addOns.map((addOn) => {
                      const addOnId = String(addOn?.addonId || addOn?.id || "").trim();
                      const addOnUrl = String(addOn?.url_img || "").trim();
                      const subthemeKey = normalizarSubtemaAddOnOpcional(addOn?.subtema);
                      const podeColorir = Boolean(subthemeKey) && isSvgAssetUrl(addOnUrl);
                      const iconColor = getCyberpinkSubthemeIconColor(subthemeKey);
                      const label = String(addOn?.nome || "Add-on").trim() || "Add-on";
                      const addOnResumoAly137 = addOn?.aly137Resumo || aly137ResumoAddOnsPorId[addOnId] || null;
                      return (
                        <button
                          type="button"
                          key={`${bloco.id}-${subBloco.id}-addon-${addOnId}`}
                          className={`addons-bloco-item${addOn?.destaque ? " addons-bloco-item--destaque" : ""}`}
                          title={addOnResumoAly137 ? `${label} / ${addOnResumoAly137.xpTotal || 0} XP` : addOn?.descricao || label}
                          onClick={() => abrirFichaAddOn(addOn)}
                        >
                          <svg className="addons-bloco-chip-corner addons-bloco-chip-corner--tl" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M10 0 L0 10" /></svg>
                          <svg className="addons-bloco-chip-corner addons-bloco-chip-corner--tr" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M0 0 L10 10" /></svg>
                          <svg className="addons-bloco-chip-corner addons-bloco-chip-corner--bl" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M0 0 L10 10" /></svg>
                          <svg className="addons-bloco-chip-corner addons-bloco-chip-corner--br" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M10 0 L0 10" /></svg>
                          <span className="addons-bloco-chip-pins addons-bloco-chip-pins--top" aria-hidden="true" />
                          <span className="addons-bloco-chip-pins addons-bloco-chip-pins--bottom" aria-hidden="true" />
                          <span className="addons-bloco-icon">
                            {addOnUrl ? (
                              <img
                                src={addOnUrl}
                                alt={label}
                                className={podeColorir ? "addons-bloco-icon-img is-tinted" : "addons-bloco-icon-img"}
                                style={podeColorir ? { filter: `${getCyberpinkSubthemeIconFilter(subthemeKey)} drop-shadow(0 0 2px ${iconColor}) drop-shadow(0 0 6px ${iconColor})` } : undefined}
                              />
                            ) : (
                              <span className="addons-bloco-icon-fallback">{label.slice(0, 2).toUpperCase()}</span>
                            )}
                          </span>
                          <span className="addons-bloco-name">{label}</span>
                          {addOnResumoAly137 ? (
                            <span className="addons-bloco-xp">
                              <span>{`${addOnResumoAly137.xpTotal || 0} XP`}</span>
                              <em aria-hidden="true">
                                <span style={{ width: `${Math.min(100, addOnResumoAly137.percentual || 0)}%` }} />
                              </em>
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </EdgeHorizontalScrollArea>
              </section>
            ))
          ) : (
            <p style={{ margin: 0, opacity: 0.76 }}>Nenhum add-on configurado neste bloco.</p>
          )}
        </div>
      )}

      {blocoEhVenda && !bloqueado && (
        <div style={{ display: "grid", gap: 12, width: "100%" }}>
          {produtosVendaNormalizados.length ? (
            produtosVendaNormalizados.map(renderVendaProduto)
          ) : (
            <p style={{ margin: 0, opacity: 0.76 }}>Nenhum produto ativo configurado neste bloco.</p>
          )}
        </div>
      )}

      {!!precoCompradorFormatado && (
        <p style={{ margin: "6px 0 8px" }}>
          Valor: <strong>{precoCompradorFormatado}</strong>
        </p>
      )}

      {bloqueado && !imagemBlocoParaExibir.length && (
        <div style={{ width: 200, height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #2f2f2f, #5c5c5c)", color: "#f0f0f0", borderRadius: 6, filter: "blur(1px)" }}>
          Preview protegido
        </div>
      )}

      {bloqueado && (
        <div style={{ marginTop: 8 }}>
          <p>{`Conteudo restrito do ${nomeBlocoSingular}.`}</p>
          {renderCtaRestricao(tipoRestricao, bloco)}
        </div>
      )}

      {!bloqueado && !blocoEhLive && sessaoChatBloco?.contactId ? (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => abrirChatSessaoBloco(bloco.id)}>Abrir chat da sessao</button>
        </div>
      ) : null}

      {podeGerenciar && !blocoEhCards && !blocoEhLive && !blocoEhAddOns && !blocoEhVenda && !blocoEhTexto && (
        <EditorBloco
          bloco={bloco}
          imagensEditor={imagensEditor}
          onSalvar={(updates) => atualizarBloco(bloco.id, updates)}
          onExcluir={() => excluirBloco(bloco.id)}
          salvando={blocoEmAtualizacaoId === bloco.id}
          excluindo={blocoEmExclusaoId === bloco.id}
        />
      )}

      {podeGerenciar && (blocoEhCards || blocoEhLive || blocoEhAddOns || blocoEhVenda || blocoEhTexto) && (
        <div className="bloco-acoes">
          <button type="button" onClick={() => abrirEditorBlocoCards(bloco)}>
            Editar bloco
          </button>
        </div>
      )}
    </Container>
  );
}
