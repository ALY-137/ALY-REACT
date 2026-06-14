import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { activeFirebaseProjectKey, db, storage } from "../../Banco/init-firebase";
import {
  encryptTextBlockContent,
  shouldEncryptTextBlockForVisibility,
} from "../../Banco/textBlockCrypto";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";
import { getProjectDataNamespaceStamp } from "../../Banco/projectDataNamespace";
import {
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import { obterStatusMercadoPago, obterStatusPixManual } from "../Pagamentos/mercadoPagoApi";
import { normalizarTemaRegistrado } from "../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
  obterRotulosBloco,
  obterRotulosEspaco,
} from "../Sistema/configSistema";
import {
  listarAddOnsDoUsuarioProjeto,
  listarIconCollectionsNoGerenciador,
} from "../Sistema/gerenciadorProjetosApi";
import {
  criarSnapshotProdutoVenda,
  formatarPrecoVenda,
  listarProdutosVenda,
} from "../Vendas/vendasApi";
import { registrarAuditLog } from "../Sistema/auditLogsApi";
import {
  filtrarColecoesIconesPermitidas,
  parseIconSelectionValue,
} from "../Sistema/iconCollectionsUtils";
import {
  CYBERPINK_SUBTHEMES,
  normalizeCyberpinkSubtheme,
} from "../Temas/cyberpink/subthemes";

async function gerarPreviewDesfocado(file) {
  try {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    const ctx = canvas.getContext("2d");
    ctx.filter = "blur(30px)";
    ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    if (typeof imageBitmap.close === "function") {
      imageBitmap.close();
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.75)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview desfocado.");
    }

    return new File([blob], `preview-${Date.now()}.webp`, {
      type: "image/webp",
    });
  } catch (err) {
    // Fallback seguro: nunca reutiliza arquivo original como preview.
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 48, 48);
      gradient.addColorStop(0, "#2a2a2a");
      gradient.addColorStop(1, "#5a5a5a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 48, 48);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, 20, 48, 8);
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.7)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview seguro.");
    }

    return new File([blob], `preview-seguro-${Date.now()}.webp`, {
      type: "image/webp",
    });
  }
}

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const parseDateTimeLocalToMs = (valor = "") => {
  const bruto = String(valor || "").trim();
  if (!bruto) return null;
  const parsedMs = Date.parse(bruto);
  return Number.isFinite(parsedMs) ? parsedMs : null;
};

const normalizarMetodosPagamentoBloco = (bloco = {}, fallback = {}) => {
  const metodos = bloco?.metodosPagamento || bloco?.metodosPagamentoPermitidos || {};
  return {
    mercadoPago:
      typeof metodos?.mercadoPago === "boolean"
        ? metodos.mercadoPago
        : Boolean(fallback?.mercadoPago),
    pixManual:
      typeof metodos?.pixManual === "boolean"
        ? metodos.pixManual
        : Boolean(fallback?.pixManual),
  };
};

const criarCardVazio = () => ({
  nome: "",
  descricaoExtra: "",
  descricao: "",
  imagem: "",
  imagemPath: "",
  imagemArquivo: null,
  imagemPreviewUrl: "",
  linkExterno: "",
});

const normalizarCardsDoBloco = (cards = []) => {
  const baseId = Date.now();
  return cards
    .map((card, index) => ({
      id: String(card?.id || `card_${baseId}_${index}`),
      ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : index,
      nome: String(card?.nome || "").trim(),
      descricaoExtra: String(card?.descricaoExtra || "").trim(),
      descricao: String(card?.descricao || "").trim(),
      imagem: String(card?.imagem || "").trim(),
      imagemPath: String(card?.imagemPath || "").trim(),
      imagemArquivo: card?.imagemArquivo instanceof File ? card.imagemArquivo : null,
      imagemPreviewUrl: String(card?.imagemPreviewUrl || "").trim(),
      linkExterno: String(card?.linkExterno || "").trim(),
    }))
    .filter(
      (card) =>
        card.nome ||
        card.descricaoExtra ||
        card.descricao ||
        card.imagem ||
        card.imagemPath ||
        card.imagemArquivo ||
        card.linkExterno
    );
};

const normalizarAddOnIds = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
};

const normalizarSubtemaAddOnOpcional = (value = "") => {
  const bruto = String(value || "").trim();
  return bruto ? normalizeCyberpinkSubtheme(bruto) : "";
};

const TEXTO_MODOS_BLOCO = [
  { value: "simples", label: "Texto simples" },
  { value: "artigo", label: "Artigo" },
  { value: "post", label: "Blog/Post" },
  { value: "aviso", label: "Aviso" },
];

const criarSubObjetoAddOn = (addOn = {}, ordem = 0, subtema = "") => {
  const addOnId = String(addOn?.id || "").trim();
  return {
    id: `addonRef_${addOnId || ordem}`,
    tipo: "addonRef",
    refId: addOnId,
    addonId: addOnId,
    ordem,
    visivel: true,
    destaque: false,
    nomeSnapshot: String(addOn?.nome || "").trim(),
    imagemSnapshot: String(addOn?.url_img || "").trim(),
    descricaoSnapshot: String(addOn?.descricao || "").trim(),
    subtema: normalizarSubtemaAddOnOpcional(subtema),
  };
};

const criarSubBlocoAddOnsVazio = (ordem = 0) => ({
  id: `subbloco_${Date.now()}_${ordem}`,
  titulo: ordem === 0 ? "Add-ons" : `Subbloco ${ordem + 1}`,
  ordem,
  addOnIds: [],
  addOnSubthemes: {},
});

const normalizarSubBlocosAddOnsCriador = (value) => {
  const base = Array.isArray(value) && value.length ? value : [criarSubBlocoAddOnsVazio(0)];
  return base.map((subBloco, index) => {
    const addOnIds = normalizarAddOnIds(subBloco?.addOnIds);
    const validIds = new Set(addOnIds);
    const addOnSubthemes =
      subBloco?.addOnSubthemes && typeof subBloco.addOnSubthemes === "object"
        ? Object.entries(subBloco.addOnSubthemes).reduce((acc, [addOnId, subtema]) => {
            const addOnIdNormalizado = String(addOnId || "").trim();
            if (!validIds.has(addOnIdNormalizado)) return acc;
            const subtemaNormalizado = normalizarSubtemaAddOnOpcional(subtema);
            if (subtemaNormalizado) acc[addOnIdNormalizado] = subtemaNormalizado;
            return acc;
          }, {})
        : {};

    return {
      id: String(subBloco?.id || `subbloco_${Date.now()}_${index}`).trim(),
      titulo: String(subBloco?.titulo || `Subbloco ${index + 1}`).trim(),
      ordem: index,
      addOnIds,
      addOnSubthemes,
    };
  });
};

const contarAddOnsEmSubBlocos = (subBlocos = []) =>
  normalizarSubBlocosAddOnsCriador(subBlocos).reduce(
    (total, subBloco) => total + normalizarAddOnIds(subBloco.addOnIds).length,
    0
  );

export default function CriadorBloco({
  espacoAtual,
  skinIdAtual,
  onCreate,
  podeCriarOverride = null,
}) {
  const { user, loading } = useAuth();
  const [statusPagamentoRefreshNonce, setStatusPagamentoRefreshNonce] = useState(0);
  const [files, setFiles] = useState([]);
  const [tipoConteudo, setTipoConteudo] = useState("imagem");
  const [tituloBloco, setTituloBloco] = useState("");
  const [iconeBloco, setIconeBloco] = useState("");
  const [textoModo, setTextoModo] = useState("simples");
  const [textoSubtitulo, setTextoSubtitulo] = useState("");
  const [textoCorpo, setTextoCorpo] = useState("");
  const [textoResumoPublico, setTextoResumoPublico] = useState("");
  const [textoChaveCripto, setTextoChaveCripto] = useState("");
  const [textoImagemCapaUrl, setTextoImagemCapaUrl] = useState("");
  const [textoImagemCapaArquivo, setTextoImagemCapaArquivo] = useState(null);
  const [textoImagemCapaPreviewUrl, setTextoImagemCapaPreviewUrl] = useState("");
  const [textoImagensArquivos, setTextoImagensArquivos] = useState([]);
  const [cards, setCards] = useState([criarCardVazio()]);
  const [liveUrl, setLiveUrl] = useState("");
  const [liveInicioEm, setLiveInicioEm] = useState("");
  const [liveFimEm, setLiveFimEm] = useState("");
  const [liveBannerUrl, setLiveBannerUrl] = useState("");
  const [liveBannerArquivo, setLiveBannerArquivo] = useState(null);
  const [liveBannerPreviewUrl, setLiveBannerPreviewUrl] = useState("");
  const [permitirMercadoPagoLive, setPermitirMercadoPagoLive] = useState(true);
  const [permitirPixManualLive, setPermitirPixManualLive] = useState(true);
  const [metodosPagamentoLiveCustomizados, setMetodosPagamentoLiveCustomizados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [visibilidade, setVisibilidade] = useState("publico");
  const [valorCompra, setValorCompra] = useState("");
  const [mpConectado, setMpConectado] = useState(false);
  const [pixManualConectado, setPixManualConectado] = useState(false);
  const [pixManualQrsDisponiveis, setPixManualQrsDisponiveis] = useState([]);
  const [blocoCardsHabilitado, setBlocoCardsHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.blocoCardsHabilitado
  );
  const [addOnsHabilitados, setAddOnsHabilitados] = useState(
    DEFAULT_SISTEMA_CONFIG.addOnsHabilitados
  );
  const [blocoAddOnsHabilitado, setBlocoAddOnsHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.blocoAddOnsHabilitado
  );
  const [livesHabilitadas, setLivesHabilitadas] = useState(
    DEFAULT_SISTEMA_CONFIG.livesHabilitadas
  );
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [configSistemaAtual, setConfigSistemaAtual] = useState(DEFAULT_SISTEMA_CONFIG);
  const [iconCollectionsDisponiveis, setIconCollectionsDisponiveis] = useState([]);
  const [addOnsDisponiveisGerenciador, setAddOnsDisponiveisGerenciador] = useState([]);
  const [erroAddOnsGerenciador, setErroAddOnsGerenciador] = useState("");
  const [buscaAddOnBloco, setBuscaAddOnBloco] = useState("");
  const [subBlocosAddOns, setSubBlocosAddOns] = useState(() => [
    criarSubBlocoAddOnsVazio(0),
  ]);
  const [produtosVendaDisponiveis, setProdutosVendaDisponiveis] = useState([]);
  const [produtoIdsVenda, setProdutoIdsVenda] = useState([]);
  const [buscaProdutoVenda, setBuscaProdutoVenda] = useState("");
  const [erroProdutosVenda, setErroProdutosVenda] = useState("");
  const [duvidasVendaBlocoHabilitadas, setDuvidasVendaBlocoHabilitadas] = useState(true);
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeBlocoSingular, setNomeBlocoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular
  );
  const [nomeBlocoPlural, setNomeBlocoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural
  );
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco || null;
  const ownerUserId = espacoAtual?.ownerUserId || null;
  const activeSkinId = skinIdAtual || localStorage.getItem("skinIdAtual");
  const isOwner = !!user?.uid && espacoAtual?.ownerUserId === user.uid;
  const isCoCriador =
    !!user?.uid &&
    Array.isArray(espacoAtual?.coCriadoresUids) &&
    espacoAtual.coCriadoresUids.includes(user.uid);
  const podeCriarPadrao = isOwner || isCoCriador;
  const podeCriar =
    typeof podeCriarOverride === "boolean" ? podeCriarOverride : podeCriarPadrao;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onMercadoPagoStatusChanged = () => {
      setStatusPagamentoRefreshNonce((valorAtual) => valorAtual + 1);
    };

    const onStorage = (event) => {
      if (String(event?.key || "") === "aly:mercado-pago-status-changed") {
        onMercadoPagoStatusChanged();
      }
    };

    window.addEventListener("aly:mercado-pago-status-changed", onMercadoPagoStatusChanged);
    window.addEventListener("focus", onMercadoPagoStatusChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("aly:mercado-pago-status-changed", onMercadoPagoStatusChanged);
      window.removeEventListener("focus", onMercadoPagoStatusChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregarStatusMercadoPago() {
      if (loading || !user || !espacoAtual || !podeCriar) {
        if (!cancelado) {
          setMpConectado(false);
          setPixManualConectado(false);
          setPixManualQrsDisponiveis([]);
          setBlocoCardsHabilitado(DEFAULT_SISTEMA_CONFIG.blocoCardsHabilitado);
          setAddOnsHabilitados(DEFAULT_SISTEMA_CONFIG.addOnsHabilitados);
          setBlocoAddOnsHabilitado(DEFAULT_SISTEMA_CONFIG.blocoAddOnsHabilitado);
          setLivesHabilitadas(DEFAULT_SISTEMA_CONFIG.livesHabilitadas);
          setPixManualSistemaHabilitado(DEFAULT_SISTEMA_CONFIG.pixManualHabilitado);
          setNomeEspacoSingular(DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
          setNomeBlocoSingular(DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
          setNomeBlocoPlural(DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
        }
        return;
      }

      let moduloMercadoPagoAtivo = DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado;
      let moduloPixManualAtivo = DEFAULT_SISTEMA_CONFIG.pixManualHabilitado;
      let cardsBlocoHabilitado = DEFAULT_SISTEMA_CONFIG.blocoCardsHabilitado;
      let addOnsProjetoHabilitados = DEFAULT_SISTEMA_CONFIG.addOnsHabilitados;
      let blocoAddOnsProjetoHabilitado = DEFAULT_SISTEMA_CONFIG.blocoAddOnsHabilitado;
      let livesDoProjetoHabilitadas = DEFAULT_SISTEMA_CONFIG.livesHabilitadas;
      let nomeEspacoSingularAtual = DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular;
      let nomeBlocoSingularAtual = DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular;
      let nomeBlocoPluralAtual = DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural;
      try {
        const configSistema = await obterConfigSistema();
        if (!cancelado) {
          setConfigSistemaAtual(configSistema || DEFAULT_SISTEMA_CONFIG);
        }
        moduloMercadoPagoAtivo = configSistema?.mercadoPagoHabilitado !== false;
        moduloPixManualAtivo = configSistema?.pixManualHabilitado !== false;
        cardsBlocoHabilitado = configSistema?.blocoCardsHabilitado === true;
        addOnsProjetoHabilitados = configSistema?.addOnsHabilitados === true;
        blocoAddOnsProjetoHabilitado = configSistema?.blocoAddOnsHabilitado === true;
        livesDoProjetoHabilitadas = configSistema?.livesHabilitadas === true;
        const rotulosEspaco = obterRotulosEspaco(configSistema);
        const rotulosBloco = obterRotulosBloco(configSistema);
        nomeEspacoSingularAtual =
          rotulosEspaco?.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular;
        nomeBlocoSingularAtual =
          rotulosBloco?.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular;
        nomeBlocoPluralAtual = rotulosBloco?.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural;
      } catch {
        // Mantem fallback local.
        if (!cancelado) {
          setConfigSistemaAtual(DEFAULT_SISTEMA_CONFIG);
        }
      }

      if (!cancelado) {
        setMercadoPagoSistemaHabilitado(moduloMercadoPagoAtivo);
        setPixManualSistemaHabilitado(moduloPixManualAtivo);
        setBlocoCardsHabilitado(cardsBlocoHabilitado);
        setAddOnsHabilitados(addOnsProjetoHabilitados);
        setBlocoAddOnsHabilitado(blocoAddOnsProjetoHabilitado);
        setLivesHabilitadas(livesDoProjetoHabilitadas);
        setNomeEspacoSingular(nomeEspacoSingularAtual);
        setNomeBlocoSingular(nomeBlocoSingularAtual);
        setNomeBlocoPlural(nomeBlocoPluralAtual);
      }

      if (moduloMercadoPagoAtivo) {
        try {
          const status = await obterStatusMercadoPago();
          if (!cancelado) {
            setMpConectado(Boolean(status?.conectado));
          }
        } catch (err) {
          if (!cancelado) {
            setMpConectado(false);
          }
        }
      } else if (!cancelado) {
        setMpConectado(false);
      }

      if (moduloPixManualAtivo) {
        try {
          const statusPix = await obterStatusPixManual();
          if (!cancelado) {
            const pixManualDisponivel = Boolean(
              statusPix?.chavePix || statusPix?.conectado
            );
            setPixManualConectado(pixManualDisponivel);
            setPixManualQrsDisponiveis(Array.isArray(statusPix?.qrs) ? statusPix.qrs : []);
          }
        } catch {
          if (!cancelado) {
            setPixManualConectado(false);
            setPixManualQrsDisponiveis([]);
          }
        }
      } else if (!cancelado) {
        setPixManualConectado(false);
        setPixManualQrsDisponiveis([]);
      }
    }

    carregarStatusMercadoPago();
    return () => {
      cancelado = true;
    };
  }, [loading, user?.uid, espacoId, podeCriar, statusPagamentoRefreshNonce]);

  useEffect(() => {
    let cancelado = false;

    async function carregarColecoesIcones() {
      try {
        const colecoes = await listarIconCollectionsNoGerenciador();
        if (!cancelado) {
          setIconCollectionsDisponiveis(Array.isArray(colecoes) ? colecoes : []);
        }
      } catch {
        if (!cancelado) {
          setIconCollectionsDisponiveis([]);
        }
      }
    }

    carregarColecoesIcones();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregarAddOns() {
      if (!ownerUserId || !addOnsHabilitados) {
        setAddOnsDisponiveisGerenciador([]);
        setErroAddOnsGerenciador("");
        return;
      }

      try {
        const lista = await listarAddOnsDoUsuarioProjeto({
          ownerUserId,
          onlyActive: true,
        });
        if (!cancelado) {
          setAddOnsDisponiveisGerenciador(Array.isArray(lista) ? lista : []);
          setErroAddOnsGerenciador("");
        }
      } catch (error) {
        if (!cancelado) {
          setAddOnsDisponiveisGerenciador([]);
          setErroAddOnsGerenciador(error?.message || "Falha ao carregar add-ons.");
        }
      }
    }

    carregarAddOns();
    return () => {
      cancelado = true;
    };
  }, [addOnsHabilitados, ownerUserId]);

  useEffect(() => {
    let cancelado = false;

    async function carregarProdutosVenda() {
      if (!ownerUserId) {
        setProdutosVendaDisponiveis([]);
        setProdutoIdsVenda([]);
        setErroProdutosVenda("");
        return;
      }

      try {
        const lista = await listarProdutosVenda({
          ownerUserId,
          onlyActive: true,
        });
        if (!cancelado) {
          setProdutosVendaDisponiveis(Array.isArray(lista) ? lista : []);
          setErroProdutosVenda("");
        }
      } catch (error) {
        if (!cancelado) {
          setProdutosVendaDisponiveis([]);
          setErroProdutosVenda(error?.message || "Falha ao carregar produtos.");
        }
      }
    }

    carregarProdutosVenda();
    return () => {
      cancelado = true;
    };
  }, [ownerUserId]);

  const metodoPagamentoCompradorDisponivel =
    mpConectado ||
    (pixManualSistemaHabilitado && pixManualConectado);
  const mercadoPagoDisponivelParaLive = Boolean(mercadoPagoSistemaHabilitado && mpConectado);
  const pixManualDisponivelParaLive = Boolean(
    pixManualSistemaHabilitado && pixManualConectado
  );

  useEffect(() => {
    const visibilidadeExclusiva =
      visibilidade === "exclusivo_assinante" || visibilidade === "exclusivo_comprador";

    if (!metodoPagamentoCompradorDisponivel && visibilidadeExclusiva) {
      setVisibilidade("publico");
      setValorCompra("");
    }
  }, [metodoPagamentoCompradorDisponivel, visibilidade]);

  useEffect(() => {
    if (!blocoCardsHabilitado && tipoConteudo === "cards") {
      setTipoConteudo("imagem");
      setCards([criarCardVazio()]);
    }
  }, [blocoCardsHabilitado, tipoConteudo]);

  useEffect(() => {
    if (!livesHabilitadas && tipoConteudo === "live") {
      setTipoConteudo("imagem");
    }
  }, [livesHabilitadas, tipoConteudo]);

  useEffect(() => {
    if ((!addOnsHabilitados || !blocoAddOnsHabilitado) && tipoConteudo === "addons") {
      setTipoConteudo("imagem");
      setSubBlocosAddOns([criarSubBlocoAddOnsVazio(0)]);
    }
  }, [addOnsHabilitados, blocoAddOnsHabilitado, tipoConteudo]);

  useEffect(() => {
    if (tipoConteudo !== "live") {
      setMetodosPagamentoLiveCustomizados(false);
      return;
    }

    if (metodosPagamentoLiveCustomizados) return;

    const metodosPadrao = normalizarMetodosPagamentoBloco(
      {},
      {
        mercadoPago: mercadoPagoDisponivelParaLive,
        pixManual: pixManualDisponivelParaLive,
      }
    );
    setPermitirMercadoPagoLive(metodosPadrao.mercadoPago);
    setPermitirPixManualLive(metodosPadrao.pixManual);
  }, [
    tipoConteudo,
    mercadoPagoDisponivelParaLive,
    pixManualDisponivelParaLive,
    metodosPagamentoLiveCustomizados,
  ]);

  const isExclusivoComprador = visibilidade === "exclusivo_comprador";
  const pixManualValoresDisponiveis = Array.isArray(pixManualQrsDisponiveis)
    ? [...pixManualQrsDisponiveis]
        .map((item) => ({
          valorCentavos: Number(item?.valorCentavos) || 0,
          titulo: String(item?.titulo || "").trim(),
        }))
        .filter((item) => item.valorCentavos > 0)
        .sort((a, b) => a.valorCentavos - b.valorCentavos)
    : [];
  const usarValoresPixManual =
    isExclusivoComprador &&
    pixManualSistemaHabilitado &&
    pixManualConectado &&
    pixManualValoresDisponiveis.length > 0;
  const blocoEhCards = tipoConteudo === "cards" && blocoCardsHabilitado;
  const blocoEhLive = tipoConteudo === "live" && livesHabilitadas;
  const blocoEhAddOns =
    tipoConteudo === "addons" && addOnsHabilitados && blocoAddOnsHabilitado;
  const blocoEhVenda = tipoConteudo === "venda";
  const blocoEhTexto = tipoConteudo === "texto";
  const textoDeveCriptografar = blocoEhTexto && shouldEncryptTextBlockForVisibility(visibilidade);
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);
  const iconCollectionsFiltradas = useMemo(
    () => filtrarColecoesIconesPermitidas(iconCollectionsDisponiveis, configSistemaAtual),
    [configSistemaAtual, iconCollectionsDisponiveis]
  );
  const projetoPossuiColecoesIcones = iconCollectionsFiltradas.length > 0;
  const addOnsDisponiveisProjeto = useMemo(() => {
    if (!addOnsHabilitados) return [];
    return addOnsDisponiveisGerenciador;
  }, [addOnsDisponiveisGerenciador, addOnsHabilitados]);
  const addOnsDisponiveisProjetoPorId = useMemo(
    () =>
      addOnsDisponiveisProjeto.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [addOnsDisponiveisProjeto]
  );
  const addOnsBlocoFiltrados = useMemo(() => {
    const buscaNormalizada = String(buscaAddOnBloco || "").trim().toLowerCase();
    return addOnsDisponiveisProjeto.filter((item) => {
      if (!buscaNormalizada) return true;
      return (
        String(item?.nome || "").toLowerCase().includes(buscaNormalizada) ||
        String(item?.descricao || "").toLowerCase().includes(buscaNormalizada)
      );
    });
  }, [addOnsDisponiveisProjeto, buscaAddOnBloco]);
  const produtosVendaFiltrados = useMemo(() => {
    const buscaNormalizada = String(buscaProdutoVenda || "").trim().toLowerCase();
    return produtosVendaDisponiveis.filter((produto) => {
      if (!buscaNormalizada) return true;
      return (
        String(produto?.nome || "").toLowerCase().includes(buscaNormalizada) ||
        String(produto?.descricao || "").toLowerCase().includes(buscaNormalizada) ||
        String(produto?.categoria || "").toLowerCase().includes(buscaNormalizada)
      );
    });
  }, [produtosVendaDisponiveis, buscaProdutoVenda]);
  const produtosVendaSelecionados = useMemo(() => {
    const ids = new Set(produtoIdsVenda.map((item) => String(item || "").trim()));
    return produtosVendaDisponiveis.filter((produto) => ids.has(String(produto.id)));
  }, [produtoIdsVenda, produtosVendaDisponiveis]);

  const parseValorCompraEmCentavos = (valorTexto) => {
    const normalizado = String(valorTexto || "").replace(",", ".").trim();
    if (!normalizado) return null;
    const valorNumerico = Number(normalizado);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    return Math.round(valorNumerico * 100);
  };

  const formatarPreco = (precoCentavos, moeda = "BRL") => {
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
  };

  useEffect(() => {
    if (!usarValoresPixManual) return;
    const valoresPermitidos = new Set(
      pixManualValoresDisponiveis.map((item) => String(item.valorCentavos))
    );
    if (valoresPermitidos.has(String(valorCompra || ""))) return;
    setValorCompra(String(pixManualValoresDisponiveis[0]?.valorCentavos || ""));
  }, [usarValoresPixManual, pixManualValoresDisponiveis, valorCompra]);

  if (loading || !user || !espacoAtual) return null;
  if (!podeCriar) return null;

  const criarNomeArquivoSeguro = (nome = "imagem") => {
    const nomeLimpo = String(nome || "imagem")
      .trim()
      .replace(/[^\w.\-]/g, "_");
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nomeLimpo || "imagem"}`;
  };

  const limparCardParaPersistencia = (card) => ({
    id: card.id,
    ordem: card.ordem,
    nome: card.nome,
    descricaoExtra: card.descricaoExtra,
    descricao: card.descricao,
    imagem: card.imagem,
    imagemPath: card.imagemPath || "",
    linkExterno: card.linkExterno,
  });

  const ehObjetoPlano = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const limparUndefinedFirestore = (value) => {
    if (typeof value === "undefined") return undefined;
    if (Array.isArray(value)) {
      return value
        .map((item) => limparUndefinedFirestore(item))
        .filter((item) => typeof item !== "undefined");
    }
    if (!ehObjetoPlano(value)) return value;

    return Object.entries(value).reduce((acc, [key, item]) => {
      const itemLimpo = limparUndefinedFirestore(item);
      if (typeof itemLimpo !== "undefined") {
        acc[key] = itemLimpo;
      }
      return acc;
    }, {});
  };

  const registrarAuditoriaCriacaoBloco = async (
    blocoPayload = {},
    { cardsCriados = [] } = {}
  ) => {
    const blocoId = String(blocoPayload?.id || "").trim();
    if (!blocoId) return;

    const criadoEmIso = new Date().toISOString();
    await registrarAuditLog({
      action: "criou_bloco",
      entityType: "bloco",
      entityId: blocoId,
      ownerUserId,
      espacoId,
      espacoNome: String(espacoAtual?.nome || "").trim(),
      blocoId,
      source: "criador_bloco",
      snapshotDepois: {
        ...blocoPayload,
        criadoEm: criadoEmIso,
      },
      metadata: {
        tipo: String(blocoPayload?.tipo || "").trim(),
        totalCardsCriados: Array.isArray(cardsCriados) ? cardsCriados.length : 0,
      },
    });

    await Promise.all(
      (Array.isArray(cardsCriados) ? cardsCriados : [])
        .map((card) => ({
          ...card,
          id: String(card?.id || "").trim(),
        }))
        .filter((card) => card.id)
        .map((card) =>
          registrarAuditLog({
            action: "criou_card",
            entityType: "card",
            entityId: card.id,
            ownerUserId,
            espacoId,
            espacoNome: String(espacoAtual?.nome || "").trim(),
            blocoId,
            cardId: card.id,
            source: "criador_bloco",
            snapshotDepois: {
              ...card,
              blocoId,
              espacoId,
              ownerUserId,
              criadoEm: criadoEmIso,
            },
          })
        )
    );
  };

  const subirArquivoStorage = async (path, arquivo) => {
    if (usandoBucketCompartilhadoCrossProject()) {
      return uploadArquivoNoBucketCompartilhado({ user, path, file: arquivo });
    }

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, arquivo);

    let url = "";
    try {
      url = await getDownloadURL(storageRef);
    } catch {
      url = "";
    }

    return { path, url };
  };

  const garantirBasePersistenteOnePage = async () => {
    if (!user?.uid || !ownerUserId || !espacoId) return;
    if (user.uid !== ownerUserId) return;

    if (typeof user.getIdToken === "function") {
      try {
        await user.getIdToken();
      } catch {
        // Continua tentativa de persistencia; Firestore ainda pode aceitar com token em cache.
      }
    }

    const userRef = getPrimaryProjectDoc(db, "users", ownerUserId);
    const namespaceStamp = getProjectDataNamespaceStamp(activeFirebaseProjectKey);
    await setDoc(
      userRef,
      {
        uid: ownerUserId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const skinDocId =
      espacoAtual?.skinOwner ||
      activeSkinId ||
      localStorage.getItem("skinIdAtual") ||
      null;

    if (skinDocId) {
      await setDoc(
        getPrimaryProjectDoc(db, "users", ownerUserId, "skins", skinDocId),
        {
          ...namespaceStamp,
          id_skin: skinDocId,
          ownerUserId,
          username:
            localStorage.getItem("skinLogadoUser") ||
            localStorage.getItem("targetUsername") ||
            "",
          theme: normalizarTemaRegistrado(
            localStorage.getItem("selectedTheme") || "CYBERPINK"
          ),
          visibilidade: "publico",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await setDoc(
      getPrimaryProjectDoc(db, "users", ownerUserId, "espacos", espacoId),
      {
        ...namespaceStamp,
        id_espaco: espacoId,
        nome: espacoAtual?.nome || "home",
        ownerUserId,
        skinOwner: skinDocId || null,
        coCriadoresUids: Array.isArray(espacoAtual?.coCriadoresUids)
          ? espacoAtual.coCriadoresUids
          : [],
        visibilidade: espacoAtual?.visibilidade || "publico",
        isHome: Boolean(espacoAtual?.isHome),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  async function criarBloco() {
    if (!podeCriar) {
      alert("Voce nao tem permissao para criar blocos neste projeto.");
      return;
    }

    if (!espacoId) return alert(`${nomeEspacoSingularCapitalizado} sem id valido.`);
    if (!ownerUserId) return alert(`${nomeEspacoSingularCapitalizado} sem ownerUserId valido.`);
    if (tipoConteudo === "addons" && !blocoEhAddOns) {
      return alert("Habilite a base de add-ons e os blocos de add-ons no projeto.");
    }
    if (
      !blocoEhCards &&
      !blocoEhLive &&
      !blocoEhAddOns &&
      !blocoEhVenda &&
      !blocoEhTexto &&
      !files.length
    ) {
      return alert("Selecione ao menos uma imagem");
    }
    if (blocoEhAddOns && !contarAddOnsEmSubBlocos(subBlocosAddOns)) {
      return alert("Selecione ao menos um add-on para o bloco.");
    }
    if (blocoEhVenda && !produtosVendaSelecionados.length) {
      return alert("Selecione ao menos um produto para o bloco de venda.");
    }
    if (blocoEhTexto && !String(textoCorpo || "").trim()) {
      return alert("Escreva o conteudo do bloco de texto.");
    }
    if (textoDeveCriptografar && !String(textoChaveCripto || "").trim()) {
      return alert("Informe uma chave para salvar este texto privado com criptografia.");
    }

    const liveInicioMs = blocoEhLive ? parseDateTimeLocalToMs(liveInicioEm) : null;
    const liveFimMs = blocoEhLive ? parseDateTimeLocalToMs(liveFimEm) : null;

    if (blocoEhLive) {
      if (!String(liveUrl || "").trim()) {
        alert("Informe a URL da live.");
        return;
      }
      if (!liveInicioMs || !liveFimMs) {
        alert("Informe data e hora de inicio e fim da live.");
        return;
      }
      if (liveFimMs <= liveInicioMs) {
        alert("A data/hora de fim deve ser maior que a data/hora de inicio.");
        return;
      }
      if (
        visibilidade === "exclusivo_comprador" &&
        !permitirMercadoPagoLive &&
        !permitirPixManualLive
      ) {
        alert("Selecione ao menos um metodo de pagamento para a live.");
        return;
      }
    }

    const precoCentavos = isExclusivoComprador
      ? usarValoresPixManual
        ? Number(valorCompra) || null
        : parseValorCompraEmCentavos(valorCompra)
      : null;

    if (isExclusivoComprador && !precoCentavos) {
      alert(`Informe um valor valido para ${nomeBlocoSingular} exclusivo de comprador.`);
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const tituloBlocoFinal = String(tituloBloco || "").trim();
      const iconPayload = parseIconSelectionValue(iconeBloco, iconCollectionsFiltradas);
      const iconeBlocoFinal = String(iconPayload.iconUrl || "").trim();

      await garantirBasePersistenteOnePage();

      const blocoRef = doc(
        getPrimaryProjectCollection(db, "users", ownerUserId, "espacos", espacoId, "blocos")
      );
      const blocoId = blocoRef.id;
      const namespaceStamp = getProjectDataNamespaceStamp(activeFirebaseProjectKey);

      if (blocoEhLive) {
        let liveBannerUrlFinal = String(liveBannerUrl || "").trim();
        let liveBannerPathFinal = "";

        if (liveBannerArquivo) {
          const nomeArquivo = criarNomeArquivoSeguro(
            liveBannerArquivo.name || "live-banner.jpg"
          );
          const bannerPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/live/banner/${nomeArquivo}`;
          const uploadBanner = await subirArquivoStorage(bannerPath, liveBannerArquivo);
          liveBannerPathFinal = bannerPath;
          if (uploadBanner?.url) {
            liveBannerUrlFinal = uploadBanner.url;
          }
        }

        const blocoPayload = {
          ...namespaceStamp,
          id: blocoId,
          tipo: "live",
          titulo: tituloBlocoFinal,
          icone: iconeBlocoFinal,
          iconUrl: iconeBlocoFinal,
          iconCollectionId: iconPayload.iconCollectionId,
          iconId: iconPayload.iconId,
          iconLabel: iconPayload.iconLabel,
          liveUrl: String(liveUrl || "").trim(),
          liveInicioEmMs: liveInicioMs,
          liveFimEmMs: liveFimMs,
          liveInicioEmIso: new Date(liveInicioMs).toISOString(),
          liveFimEmIso: new Date(liveFimMs).toISOString(),
          liveBannerUrl: liveBannerUrlFinal,
          liveBannerPath: liveBannerPathFinal,
          imagensPreview: [],
          imagensPreviewPaths: [],
          imagensOriginaisPaths: [],
          imagensOriginaisPublicas: [],
          imagens: [],
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          ordem: Date.now(),
          espacoId,
          ownerUserId,
          skinOwner: espacoAtual.skinOwner || activeSkinId || null,
          visibilidade,
          precoCentavos: precoCentavos || null,
          moeda: precoCentavos ? "BRL" : null,
          metodosPagamento:
            visibilidade === "exclusivo_comprador"
              ? {
                  mercadoPago: Boolean(permitirMercadoPagoLive),
                  pixManual: Boolean(permitirPixManualLive),
                }
              : {
                  mercadoPago: true,
                  pixManual: true,
                },
        };

        const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
        await setDoc(blocoRef, blocoPayloadFirestore);
        await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore);

        if (onCreate) {
          onCreate({
            ...blocoPayloadFirestore,
            criadoEm: new Date().toISOString(),
          });
        }

        setValorCompra("");
        setLiveUrl("");
        setLiveInicioEm("");
        setLiveFimEm("");
        setLiveBannerUrl("");
        setLiveBannerArquivo(null);
        setLiveBannerPreviewUrl("");
        setTituloBloco("");
        setIconeBloco("");
        setPermitirMercadoPagoLive(mercadoPagoDisponivelParaLive);
        setPermitirPixManualLive(pixManualDisponivelParaLive);
        setMetodosPagamentoLiveCustomizados(false);
        alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);
        return;
      }

      if (blocoEhAddOns) {
        let ordemGlobal = 0;
        const subBlocos = normalizarSubBlocosAddOnsCriador(subBlocosAddOns)
          .map((subBloco, subBlocoIndex) => {
            const subObjetos = normalizarAddOnIds(subBloco.addOnIds)
              .map((addOnId) => {
                const subObjeto = criarSubObjetoAddOn(
                  addOnsDisponiveisProjetoPorId[addOnId] || { id: addOnId },
                  ordemGlobal,
                  subBloco.addOnSubthemes?.[addOnId]
                );
                ordemGlobal += 1;
                return {
                  ...subObjeto,
                  subBlocoId: subBloco.id,
                  subBlocoTitulo: subBloco.titulo,
                };
              })
              .filter((item) => item.addonId);

            return {
              id: subBloco.id,
              tipo: "addons",
              titulo: subBloco.titulo || `Subbloco ${subBlocoIndex + 1}`,
              ordem: subBlocoIndex,
              layout: "grid",
              subObjetos,
            };
          })
          .filter((subBloco) => subBloco.subObjetos.length);
        const subObjetos = subBlocos.flatMap((subBloco) => subBloco.subObjetos);

        if (!subObjetos.length) {
          alert("Selecione ao menos um add-on valido para o bloco.");
          return;
        }

        const blocoPayload = {
          ...namespaceStamp,
          id: blocoId,
          tipo: "addons",
          titulo: tituloBlocoFinal,
          icone: iconeBlocoFinal,
          iconUrl: iconeBlocoFinal,
          iconCollectionId: iconPayload.iconCollectionId,
          iconId: iconPayload.iconId,
          iconLabel: iconPayload.iconLabel,
          estruturaAddOns: "subblocos_v1",
          subBlocos,
          subObjetos,
          configAddOns: {
            layout: "subblocos",
            itemLayout: "grid",
            mostrarNome: true,
            abrirFichaAoClicar: false,
          },
          imagensPreview: [],
          imagensPreviewPaths: [],
          imagensOriginaisPaths: [],
          imagensOriginaisPublicas: [],
          imagens: [],
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          ordem: Date.now(),
          espacoId,
          ownerUserId,
          skinOwner: espacoAtual.skinOwner || activeSkinId || null,
          visibilidade,
          precoCentavos: precoCentavos || null,
          moeda: precoCentavos ? "BRL" : null,
        };

        const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
        await setDoc(blocoRef, blocoPayloadFirestore);
        await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore);

        if (onCreate) {
          onCreate({
            ...blocoPayloadFirestore,
            criadoEm: new Date().toISOString(),
          });
        }

        setSubBlocosAddOns([criarSubBlocoAddOnsVazio(0)]);
        setBuscaAddOnBloco("");
        setTituloBloco("");
        setIconeBloco("");
        setValorCompra("");
        alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);
        return;
      }

      if (blocoEhVenda) {
        const produtosVenda = produtosVendaSelecionados.map(criarSnapshotProdutoVenda);
        const blocoPayload = {
          ...namespaceStamp,
          id: blocoId,
          tipo: "venda",
          titulo: tituloBlocoFinal,
          icone: iconeBlocoFinal,
          iconUrl: iconeBlocoFinal,
          iconCollectionId: iconPayload.iconCollectionId,
          iconId: iconPayload.iconId,
          iconLabel: iconPayload.iconLabel,
          produtoIds: produtosVenda.map((produto) => produto.id).filter(Boolean),
          produtosVenda,
          duvidasChatHabilitado: duvidasVendaBlocoHabilitadas,
          duvidasChatVisibilidade: duvidasVendaBlocoHabilitadas ? "usuarios_logados" : "desativado",
          imagensPreview: [],
          imagensPreviewPaths: [],
          imagensOriginaisPaths: [],
          imagensOriginaisPublicas: [],
          imagens: [],
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          ordem: Date.now(),
          espacoId,
          ownerUserId,
          skinOwner: espacoAtual.skinOwner || activeSkinId || null,
          visibilidade,
          precoCentavos: null,
          moeda: null,
        };

        const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
        await setDoc(blocoRef, blocoPayloadFirestore);
        await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore);

        if (onCreate) {
          onCreate({
            ...blocoPayloadFirestore,
            criadoEm: new Date().toISOString(),
          });
        }

        setProdutoIdsVenda([]);
        setBuscaProdutoVenda("");
        setDuvidasVendaBlocoHabilitadas(true);
        setTituloBloco("");
        setIconeBloco("");
        setValorCompra("");
        alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);
        return;
      }

      if (blocoEhTexto) {
        let imagemCapaUrlFinal = String(textoImagemCapaUrl || "").trim();
        let imagemCapaPathFinal = "";

        if (textoImagemCapaArquivo) {
          const nomeArquivo = criarNomeArquivoSeguro(
            textoImagemCapaArquivo.name || "texto-capa.jpg"
          );
          const capaPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/texto/capa/${nomeArquivo}`;
          const uploadCapa = await subirArquivoStorage(capaPath, textoImagemCapaArquivo);
          imagemCapaPathFinal = capaPath;
          if (uploadCapa?.url) {
            imagemCapaUrlFinal = uploadCapa.url;
          }
        }

        const textoImagens = [];
        for (const arquivo of textoImagensArquivos) {
          const nomeArquivo = criarNomeArquivoSeguro(arquivo?.name || "texto-imagem.jpg");
          const imagemPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/texto/imagens/${nomeArquivo}`;
          const uploadImagem = await subirArquivoStorage(imagemPath, arquivo);
          textoImagens.push({
            url: String(uploadImagem?.url || "").trim(),
            path: imagemPath,
            nome: String(arquivo?.name || "").trim(),
          });
        }

        const corpoTextoFinal = String(textoCorpo || "").trim();
        const textoCriptografia = textoDeveCriptografar
          ? await encryptTextBlockContent(corpoTextoFinal, textoChaveCripto)
          : null;
        const textoResumoFinal = String(textoResumoPublico || "").trim();

        const blocoPayload = {
          ...namespaceStamp,
          id: blocoId,
          tipo: "texto",
          titulo: tituloBlocoFinal,
          icone: iconeBlocoFinal,
          iconUrl: iconeBlocoFinal,
          iconCollectionId: iconPayload.iconCollectionId,
          iconId: iconPayload.iconId,
          iconLabel: iconPayload.iconLabel,
          textoModo,
          textoSubtitulo: String(textoSubtitulo || "").trim(),
          textoResumoPublico: textoResumoFinal,
          textoConteudoCriptografado: Boolean(textoDeveCriptografar),
          textoCriptografia,
          textoCorpo: textoDeveCriptografar ? "" : corpoTextoFinal,
          conteudo: textoDeveCriptografar ? textoResumoFinal : corpoTextoFinal,
          imagemCapaUrl: imagemCapaUrlFinal,
          imagemCapaPath: imagemCapaPathFinal,
          textoImagens: textoImagens.filter((item) => item.url || item.path),
          imagensPreview: [],
          imagensPreviewPaths: [],
          imagensOriginaisPaths: [],
          imagensOriginaisPublicas: [],
          imagens: imagemCapaUrlFinal ? [imagemCapaUrlFinal] : [],
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          ordem: Date.now(),
          espacoId,
          ownerUserId,
          skinOwner: espacoAtual.skinOwner || activeSkinId || null,
          visibilidade,
          precoCentavos: precoCentavos || null,
          moeda: precoCentavos ? "BRL" : null,
        };

        const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
        await setDoc(blocoRef, blocoPayloadFirestore);
        await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore);

        if (onCreate) {
          onCreate({
            ...blocoPayloadFirestore,
            criadoEm: new Date().toISOString(),
          });
        }

        setTextoModo("simples");
        setTextoSubtitulo("");
        setTextoCorpo("");
        setTextoResumoPublico("");
        setTextoChaveCripto("");
        setTextoImagemCapaUrl("");
        setTextoImagemCapaArquivo(null);
        setTextoImagemCapaPreviewUrl("");
        setTextoImagensArquivos([]);
        setTituloBloco("");
        setIconeBloco("");
        setValorCompra("");
        alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);
        return;
      }

      if (blocoEhCards) {
        const cardsNormalizados = normalizarCardsDoBloco(cards);

        if (!cardsNormalizados.length) {
          alert("Adicione ao menos um card com algum conteudo.");
          return;
        }

        const cardsPersistidos = [];
        for (const card of cardsNormalizados) {
          let imagem = card.imagem;
          let imagemPath = card.imagemPath || "";

          if (card.imagemArquivo) {
            const nomeArquivo = criarNomeArquivoSeguro(card.imagemArquivo.name || `${card.id}.jpg`);
            const path = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/cards/${card.id}/${nomeArquivo}`;
            const upload = await subirArquivoStorage(path, card.imagemArquivo);
            imagemPath = path;
            if (upload?.url) {
              imagem = upload.url;
            }
          }

          cardsPersistidos.push(
            limparCardParaPersistencia({
              ...card,
              imagem,
              imagemPath,
            })
          );
        }

        const blocoPayload = {
          ...namespaceStamp,
          id: blocoId,
          tipo: "cards",
          titulo: tituloBlocoFinal,
          icone: iconeBlocoFinal,
          iconUrl: iconeBlocoFinal,
          iconCollectionId: iconPayload.iconCollectionId,
          iconId: iconPayload.iconId,
          iconLabel: iconPayload.iconLabel,
          cards: cardsPersistidos,
          imagensPreview: [],
          imagensPreviewPaths: [],
          imagensOriginaisPaths: [],
          imagensOriginaisPublicas: [],
          imagens: [],
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
          ordem: Date.now(),
          espacoId,
          ownerUserId,
          skinOwner: espacoAtual.skinOwner || activeSkinId || null,
          visibilidade,
          precoCentavos: precoCentavos || null,
          moeda: precoCentavos ? "BRL" : null,
        };

        const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
        await setDoc(blocoRef, blocoPayloadFirestore);
        await Promise.all(
          cardsPersistidos.map((card) =>
            setDoc(
              doc(collection(blocoRef, "cards"), card.id),
              limparUndefinedFirestore({
                ...namespaceStamp,
                id: card.id,
                ordem: card.ordem,
                nome: card.nome,
                descricaoExtra: card.descricaoExtra,
                descricao: card.descricao,
                imagem: card.imagem,
                imagemPath: card.imagemPath || "",
                linkExterno: card.linkExterno,
                blocoId,
                espacoId,
                ownerUserId,
                criadoEm: serverTimestamp(),
              })
            )
          )
        );
        await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore, {
          cardsCriados: cardsPersistidos,
        });

        if (onCreate) {
          onCreate({
            ...blocoPayloadFirestore,
            criadoEm: new Date().toISOString(),
          });
        }

        setFiles([]);
        setCards([criarCardVazio()]);
        setTituloBloco("");
        setIconeBloco("");
        setValorCompra("");
        alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);
        return;
      }

      // 1) Upload das imagens
      const previewUrlsPersistidas = [];
      const previewUrlsParaUI = [];
      const previewPaths = [];
      const originaisPaths = [];
      const originaisPublicasPersistidas = [];
      const originaisPublicasParaUI = [];

      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;
        const originalPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/original/${fileName}`;
        const previewPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/preview/${fileName}`;

        if (usandoBucketCompartilhadoCrossProject()) {
          const originalUpload = await uploadArquivoNoBucketCompartilhado({
            user,
            path: originalPath,
            file,
          });

          if (visibilidade === "publico" && originalUpload?.url) {
            originaisPublicasPersistidas.push(originalUpload.url);
            originaisPublicasParaUI.push(originalUpload.url);
          } else {
            const previewFile = await gerarPreviewDesfocado(file);
            const previewUpload = await uploadArquivoNoBucketCompartilhado({
              user,
              path: previewPath,
              file: previewFile,
            });
            if (previewUpload?.url) {
              previewUrlsPersistidas.push(previewUpload.url);
              previewUrlsParaUI.push(previewUpload.url);
            }
            previewPaths.push(previewPath);
          }

          originaisPaths.push(originalPath);
          continue;
        }

        const originalRef = ref(
          storage,
          originalPath
        );
        const previewRef = ref(storage, previewPath);

        await uploadBytes(originalRef, file);
        if (visibilidade === "publico") {
          try {
            const originalUrlPublica = await getDownloadURL(originalRef);
            originaisPublicasPersistidas.push(originalUrlPublica);
            originaisPublicasParaUI.push(originalUrlPublica);
          } catch (originalUrlErr) {
            console.warn(
              "Falha ao obter URL publica do original:",
              originalUrlErr?.code,
              originalUrlErr?.message
            );
          }
        } else {
          const previewFile = await gerarPreviewDesfocado(file);
          await uploadBytes(previewRef, previewFile);

          previewPaths.push(previewPath);
          try {
            const previewUrl = await getDownloadURL(previewRef);
            previewUrlsPersistidas.push(previewUrl);
            previewUrlsParaUI.push(previewUrl);
          } catch (previewUrlErr) {
            if (previewUrlErr?.code !== "storage/unauthorized") {
              throw previewUrlErr;
            }
            // Mantem preview imediato no cliente mesmo sem URL remoto.
            previewUrlsParaUI.push(URL.createObjectURL(previewFile));
          }
        }
        originaisPaths.push(originalPath);

      }

      // 2) Criar bloco no Firestore
      const blocoPayload = {
        ...namespaceStamp,
        id: blocoId,
        tipo: "imagem",
        titulo: tituloBlocoFinal,
        icone: iconeBlocoFinal,
        iconUrl: iconeBlocoFinal,
        iconCollectionId: iconPayload.iconCollectionId,
        iconId: iconPayload.iconId,
        iconLabel: iconPayload.iconLabel,
        imagensPreview: previewUrlsPersistidas,
        imagensPreviewPaths: previewPaths,
        imagensOriginaisPaths: originaisPaths,
        imagensOriginaisPublicas: originaisPublicasPersistidas,
        imagens:
          visibilidade === "publico"
            ? originaisPublicasPersistidas
            : previewUrlsPersistidas, // compatibilidade legado
        criadoPor: user.uid,
        criadoEm: serverTimestamp(),
        ordem: Date.now(),
        espacoId,
        ownerUserId,
        skinOwner: espacoAtual.skinOwner || activeSkinId || null,
        visibilidade,
        precoCentavos: precoCentavos || null,
        moeda: precoCentavos ? "BRL" : null,
      };

      const blocoPayloadFirestore = limparUndefinedFirestore(blocoPayload);
      await setDoc(blocoRef, blocoPayloadFirestore);
      await registrarAuditoriaCriacaoBloco(blocoPayloadFirestore);

      if (onCreate) {
        onCreate({
          ...blocoPayloadFirestore,
          criadoEm: new Date().toISOString(),
          imagensPreview: previewUrlsParaUI,
          imagensOriginaisPublicas: originaisPublicasParaUI,
          imagens:
            visibilidade === "publico"
              ? originaisPublicasParaUI
              : previewUrlsParaUI,
        });
      }

      setFiles([]);
      setTituloBloco("");
      setIconeBloco("");
      setValorCompra("");
      alert(`${nomeBlocoSingularCapitalizado} criado com sucesso!`);

    } catch (err) {
      console.error("Erro ao criar bloco:", err);
      setErro(`${err?.code || "erro"}: ${err?.message || `Falha ao criar ${nomeBlocoSingular}`}`);
      alert(`Erro ao criar ${nomeBlocoSingular}. Veja o console para detalhes.`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bloco-creator">
      <h3>
        {`Criar ${nomeBlocoSingular} de ${
          blocoEhCards
            ? "cards"
            : blocoEhLive
              ? "live"
              : blocoEhAddOns
                ? "add-ons"
                : blocoEhVenda
                  ? "venda"
                  : blocoEhTexto
                    ? "texto"
                    : "imagens"
        }`}
      </h3>

      <input
        type="text"
        placeholder="Titulo do bloco (opcional)"
        value={tituloBloco}
        onChange={(e) => setTituloBloco(e.target.value)}
      />

      {projetoPossuiColecoesIcones ? (
        <select value={iconeBloco} onChange={(e) => setIconeBloco(e.target.value)}>
          <option value="">Sem icone</option>
          {iconCollectionsFiltradas.map((colecao) => (
            <optgroup key={colecao.id} label={colecao.nome}>
              {(colecao.icons || []).map((icon) => (
                <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                  {icon.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
          Nenhuma colecao de icones permitida para este projeto/tema.
        </p>
      )}

      <select value={tipoConteudo} onChange={(e) => setTipoConteudo(e.target.value)}>
        <option value="imagem">Imagens</option>
        <option value="texto">Texto</option>
        {blocoCardsHabilitado && <option value="cards">Cards</option>}
        {addOnsHabilitados && blocoAddOnsHabilitado && <option value="addons">Add-ons</option>}
        <option value="venda">Venda</option>
        {livesHabilitadas && <option value="live">Live</option>}
      </select>

      {blocoEhTexto ? (
        <div className="bloco-texto-editor" style={{ width: "100%", display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Formato do texto</span>
            <select value={textoModo} onChange={(event) => setTextoModo(event.target.value)}>
              {TEXTO_MODOS_BLOCO.map((modo) => (
                <option key={modo.value} value={modo.value}>
                  {modo.label}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            placeholder="Subtitulo ou chamada (opcional)"
            value={textoSubtitulo}
            onChange={(event) => setTextoSubtitulo(event.target.value)}
          />

          <textarea
            rows={8}
            placeholder="Escreva o texto, artigo, aviso ou post..."
            value={textoCorpo}
            onChange={(event) => setTextoCorpo(event.target.value)}
            style={{ resize: "vertical" }}
          />

          {textoDeveCriptografar ? (
            <>
              <strong style={{ fontSize: 13 }}>Criptografia automatica para texto privado</strong>
              <input
                type="password"
                placeholder="Chave local de leitura"
                value={textoChaveCripto}
                onChange={(event) => setTextoChaveCripto(event.target.value)}
                autoComplete="new-password"
              />
              <textarea
                rows={2}
                placeholder="Resumo publico opcional para aparecer antes da descriptografia"
                value={textoResumoPublico}
                onChange={(event) => setTextoResumoPublico(event.target.value)}
                style={{ resize: "vertical" }}
              />
              <p style={{ margin: 0, fontSize: 12, opacity: 0.74 }}>
                Este texto sera criptografado porque a visibilidade selecionada nao e publica. A chave nao sera salva.
              </p>
            </>
          ) : null}

          <input
            type="text"
            placeholder="URL da imagem de capa (opcional)"
            value={textoImagemCapaUrl}
            onChange={(event) => {
              setTextoImagemCapaUrl(event.target.value);
              setTextoImagemCapaArquivo(null);
              setTextoImagemCapaPreviewUrl("");
            }}
          />

          <label style={{ display: "grid", gap: 6 }}>
            <span>Imagem de capa do dispositivo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const arquivo = event.target.files?.[0] || null;
                setTextoImagemCapaArquivo(arquivo);
                setTextoImagemCapaPreviewUrl(arquivo ? URL.createObjectURL(arquivo) : "");
                if (arquivo) setTextoImagemCapaUrl("");
                event.target.value = "";
              }}
            />
          </label>

          {(textoImagemCapaPreviewUrl || textoImagemCapaUrl) && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <img
                src={textoImagemCapaPreviewUrl || textoImagemCapaUrl}
                alt=""
                style={{ width: 128, height: 80, objectFit: "cover", borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() => {
                  setTextoImagemCapaUrl("");
                  setTextoImagemCapaArquivo(null);
                  setTextoImagemCapaPreviewUrl("");
                }}
                style={{ color: "red" }}
              >
                Remover capa
              </button>
            </div>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            <span>Imagens complementares</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => {
                const arquivos = Array.from(event.target.files || []);
                if (arquivos.length) {
                  setTextoImagensArquivos((prev) => [...prev, ...arquivos]);
                }
                event.target.value = "";
              }}
            />
          </label>

          {!!textoImagensArquivos.length && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {textoImagensArquivos.map((arquivo, index) => (
                <button
                  key={`${arquivo.name}-${arquivo.lastModified}-${index}`}
                  type="button"
                  onClick={() =>
                    setTextoImagensArquivos((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  style={{ color: "red" }}
                >
                  Remover: {arquivo.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : blocoEhCards ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.map((card, index) => (
            <div
              key={`novo-card-${index}`}
              style={{ border: "1px solid #ccc", borderRadius: 6, padding: 10 }}
            >
              <input
                type="text"
                placeholder="Titulo do card"
                value={card.nome}
                onChange={(event) =>
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, nome: event.target.value } : item
                    )
                  )
                }
              />
              <input
                type="text"
                placeholder="Descricao extra do titulo"
                value={card.descricaoExtra}
                onChange={(event) =>
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, descricaoExtra: event.target.value }
                        : item
                    )
                  )
                }
              />
              <input
                type="text"
                placeholder="Descricao do card"
                value={card.descricao}
                onChange={(event) =>
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, descricao: event.target.value }
                        : item
                    )
                  )
                }
              />
              <input
                type="text"
                placeholder="URL da imagem do card (opcional)"
                value={card.imagem}
                onChange={(event) =>
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            imagem: event.target.value,
                            imagemPath: "",
                            imagemArquivo: null,
                            imagemPreviewUrl: "",
                          }
                        : item
                    )
                  )
                }
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const arquivo = event.target.files?.[0] || null;
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            imagemArquivo: arquivo,
                            imagemPreviewUrl: arquivo ? URL.createObjectURL(arquivo) : "",
                            imagemPath: "",
                            imagem: arquivo ? "" : item.imagem,
                          }
                        : item
                    )
                  );
                  event.target.value = "";
                }}
              />
              {(card.imagemPreviewUrl || card.imagem) && (
                <div style={{ marginTop: 6 }}>
                  <img
                    src={card.imagemPreviewUrl || card.imagem}
                    alt=""
                    style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 4 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCards((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                imagem: "",
                                imagemPath: "",
                                imagemArquivo: null,
                                imagemPreviewUrl: "",
                              }
                            : item
                        )
                      )
                    }
                    style={{ color: "red", marginLeft: 8 }}
                  >
                    Remover imagem
                  </button>
                </div>
              )}
              <input
                type="text"
                placeholder="Link externo do card (opcional)"
                value={card.linkExterno}
                onChange={(event) =>
                  setCards((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, linkExterno: event.target.value }
                        : item
                    )
                  )
                }
              />
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setCards((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                  }
                  style={{ color: "red" }}
                >
                  Remover card
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={() => setCards((prev) => [...prev, criarCardVazio()])}>
            Adicionar card
          </button>
        </div>
      ) : blocoEhAddOns ? (
        <div className="bloco-addons-editor" style={{ width: "100%", display: "grid", gap: 10 }}>
          <input
            type="search"
            placeholder="Pesquisar add-on"
            value={buscaAddOnBloco}
            onChange={(event) => setBuscaAddOnBloco(event.target.value)}
          />

          <div className="bloco-addons-editor__subblocos" style={{ display: "grid", gap: 12 }}>
            {normalizarSubBlocosAddOnsCriador(subBlocosAddOns).map((subBloco, subBlocoIndex) => {
              const addOnIdsSubBloco = normalizarAddOnIds(subBloco.addOnIds);

              return (
                <section
                  key={subBloco.id}
                  className="bloco-addons-editor__subbloco"
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={subBloco.titulo}
                      placeholder={`Nome do subbloco ${subBlocoIndex + 1}`}
                      onChange={(event) => {
                        const titulo = event.target.value;
                        setSubBlocosAddOns((prev) =>
                          normalizarSubBlocosAddOnsCriador(prev).map((item, index) =>
                            index === subBlocoIndex ? { ...item, titulo } : item
                          )
                        );
                      }}
                    />
                    {normalizarSubBlocosAddOnsCriador(subBlocosAddOns).length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSubBlocosAddOns((prev) =>
                            normalizarSubBlocosAddOnsCriador(prev).filter(
                              (_, index) => index !== subBlocoIndex
                            )
                          )
                        }
                        style={{ color: "#ff5aa5" }}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>

                  <div
                    className="bloco-addons-editor__list"
                    style={{
                      display: "grid",
                      gap: 8,
                      maxHeight: 260,
                      overflowY: "auto",
                      padding: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {erroAddOnsGerenciador ? (
                      <p style={{ margin: 0, color: "#ff9db0" }}>{erroAddOnsGerenciador}</p>
                    ) : !addOnsDisponiveisProjeto.length ? (
                      <p style={{ margin: 0, opacity: 0.76 }}>
                        Nenhum add-on criado para este usuario/projeto.
                      </p>
                    ) : !addOnsBlocoFiltrados.length ? (
                      <p style={{ margin: 0, opacity: 0.76 }}>
                        Nenhum add-on encontrado para este filtro.
                      </p>
                    ) : (
                      addOnsBlocoFiltrados.map((item) => {
                        const addOnId = String(item?.id || "").trim();
                        const marcado = addOnIdsSubBloco.includes(addOnId);
                        const subtemaSelecionado =
                          normalizarSubtemaAddOnOpcional(
                            subBloco.addOnSubthemes?.[addOnId]
                          ) || "";

                        return (
                          <label
                            key={`${subBloco.id}-${addOnId}`}
                            className="bloco-addons-editor__item"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "20px 38px minmax(0, 1fr)",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => {
                                setSubBlocosAddOns((prev) =>
                                  normalizarSubBlocosAddOnsCriador(prev).map((itemSubBloco, index) => {
                                    if (index !== subBlocoIndex) return itemSubBloco;
                                    const atuais = normalizarAddOnIds(itemSubBloco.addOnIds);
                                    const addOnSubthemes = { ...itemSubBloco.addOnSubthemes };
                                    const proximosIds = atuais.includes(addOnId)
                                      ? atuais.filter((id) => id !== addOnId)
                                      : [...atuais, addOnId];
                                    if (atuais.includes(addOnId)) delete addOnSubthemes[addOnId];
                                    return {
                                      ...itemSubBloco,
                                      addOnIds: proximosIds,
                                      addOnSubthemes,
                                    };
                                  })
                                );
                              }}
                            />
                            <span
                              style={{
                                width: 38,
                                height: 38,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                background: "rgba(255,255,255,0.04)",
                              }}
                            >
                              {item?.url_img ? (
                                <img
                                  src={item.url_img}
                                  alt={item.nome || "Add-on"}
                                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                />
                              ) : null}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <strong>{item.nome}</strong>
                              {item?.descricao ? (
                                <span style={{ display: "block", fontSize: 12, opacity: 0.74 }}>
                                  {item.descricao}
                                </span>
                              ) : null}
                              {marcado ? (
                                <span style={{ display: "grid", gap: 4, marginTop: 8 }}>
                                  <span style={{ fontSize: 11, opacity: 0.72 }}>
                                    Subtema do add-on neste subbloco
                                  </span>
                                  <select
                                    value={subtemaSelecionado}
                                    onChange={(event) => {
                                      const proximoValor = normalizarSubtemaAddOnOpcional(
                                        event.target.value
                                      );
                                      setSubBlocosAddOns((prev) =>
                                        normalizarSubBlocosAddOnsCriador(prev).map(
                                          (itemSubBloco, index) => {
                                            if (index !== subBlocoIndex) return itemSubBloco;
                                            const addOnSubthemes = {
                                              ...itemSubBloco.addOnSubthemes,
                                            };
                                            if (!proximoValor) {
                                              delete addOnSubthemes[addOnId];
                                            } else {
                                              addOnSubthemes[addOnId] = proximoValor;
                                            }
                                            return {
                                              ...itemSubBloco,
                                              addOnSubthemes,
                                            };
                                          }
                                        )
                                      );
                                    }}
                                  >
                                    <option value="">Padrao do espaco</option>
                                    {CYBERPINK_SUBTHEMES.map((subtema) => (
                                      <option key={subtema.value} value={subtema.value}>
                                        {`Subtema: ${subtema.label}`}
                                      </option>
                                    ))}
                                  </select>
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
                    {`${addOnIdsSubBloco.length} add-on(s) neste subbloco.`}
                  </span>
                </section>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              setSubBlocosAddOns((prev) => {
                const atuais = normalizarSubBlocosAddOnsCriador(prev);
                return [...atuais, criarSubBlocoAddOnsVazio(atuais.length)];
              })
            }
          >
            Adicionar subbloco
          </button>

          <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
            {`${contarAddOnsEmSubBlocos(subBlocosAddOns)} subobjeto(s) de add-on selecionado(s).`}
          </span>
        </div>
      ) : blocoEhVenda ? (
        <div className="bloco-venda-editor" style={{ width: "100%", display: "grid", gap: 10 }}>
          <input
            type="search"
            placeholder="Pesquisar produto cadastrado"
            value={buscaProdutoVenda}
            onChange={(event) => setBuscaProdutoVenda(event.target.value)}
          />

          {erroProdutosVenda ? (
            <p style={{ margin: 0, color: "#ff9db0" }}>{erroProdutosVenda}</p>
          ) : !produtosVendaDisponiveis.length ? (
            <p style={{ margin: 0, opacity: 0.76 }}>
              Cadastre produtos na gaveta VENDAS antes de criar este bloco.
            </p>
          ) : !produtosVendaFiltrados.length ? (
            <p style={{ margin: 0, opacity: 0.76 }}>Nenhum produto encontrado.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {produtosVendaFiltrados.map((produto) => {
                const produtoId = String(produto.id || "").trim();
                const marcado = produtoIdsVenda.includes(produtoId);
                return (
                  <label
                    key={produtoId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "20px 58px minmax(0, 1fr)",
                      gap: 10,
                      alignItems: "center",
                      padding: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setProdutoIdsVenda((prev) =>
                          prev.includes(produtoId)
                            ? prev.filter((item) => item !== produtoId)
                            : [...prev, produtoId]
                        )
                      }
                    />
                    <span
                      style={{
                        width: 58,
                        height: 58,
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {produto.imagemUrl ? (
                        <img
                          src={produto.imagemUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong>{produto.nome}</strong>
                      <span style={{ display: "block", fontSize: 12, opacity: 0.74 }}>
                        {[
                          produto.tipoProduto === "roupa" ? "Roupa" : "Produto",
                          produto.sobMedida ? "sob medida" : "",
                          produto.porEncomenda ? "por encomenda" : "",
                          produto.precoCentavos
                            ? formatarPrecoVenda(produto.precoCentavos, produto.moeda)
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <span style={{ fontSize: 12 }}>
            {`${produtosVendaSelecionados.length} produto(s) selecionado(s).`}
          </span>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={duvidasVendaBlocoHabilitadas}
              onChange={(event) => setDuvidasVendaBlocoHabilitadas(event.target.checked)}
            />
            Permitir duvidas por chat neste bloco
          </label>
        </div>
      ) : blocoEhLive ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text"
            placeholder="URL da live (YouTube, Vimeo, Twitch, etc.)"
            value={liveUrl}
            onChange={(event) => setLiveUrl(event.target.value)}
          />

          <label htmlFor="liveInicioEm">Inicio da live</label>
          <input
            id="liveInicioEm"
            type="datetime-local"
            value={liveInicioEm}
            onChange={(event) => setLiveInicioEm(event.target.value)}
          />

          <label htmlFor="liveFimEm">Fim da live</label>
          <input
            id="liveFimEm"
            type="datetime-local"
            value={liveFimEm}
            onChange={(event) => setLiveFimEm(event.target.value)}
          />

          <input
            type="text"
            placeholder="URL da imagem de anuncio (opcional)"
            value={liveBannerUrl}
            onChange={(event) => setLiveBannerUrl(event.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const arquivo = event.target.files?.[0] || null;
              setLiveBannerArquivo(arquivo);
              setLiveBannerPreviewUrl(arquivo ? URL.createObjectURL(arquivo) : "");
              if (arquivo) {
                setLiveBannerUrl("");
              }
              event.target.value = "";
            }}
          />

          {(liveBannerPreviewUrl || liveBannerUrl) && (
            <div style={{ marginTop: 4 }}>
              <img
                src={liveBannerPreviewUrl || liveBannerUrl}
                alt="Preview do anuncio da live"
                style={{ width: "min(100%, 260px)", maxHeight: 150, objectFit: "cover", borderRadius: 6 }}
              />
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setLiveBannerArquivo(null);
                    setLiveBannerPreviewUrl("");
                    setLiveBannerUrl("");
                  }}
                  style={{ color: "red" }}
                >
                  Remover imagem de anuncio
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles([...e.target.files])}
        />
      )}

      <select
        value={visibilidade}
        onChange={(e) => setVisibilidade(e.target.value)}
      >
        <option value="publico">Publico</option>
        <option value="publico_restritivo">Publico restritivo</option>
        <option value="privado">Privado (autenticado)</option>
        {metodoPagamentoCompradorDisponivel && (
          <>
            <option value="exclusivo_assinante">Exclusivo assinante</option>
            <option value="exclusivo_comprador">Exclusivo comprador</option>
          </>
        )}
      </select>

      {!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          Metodos de pagamento desativados em PROPRIEDADES DO SISTEMA.
        </p>
      ) : !metodoPagamentoCompradorDisponivel && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          {`Conecte o Mercado Pago ou configure PIX manual para habilitar visibilidade exclusiva para assinantes/compradores de ${nomeBlocoPlural}.`}
        </p>
      )}

      {isExclusivoComprador && (
        <>
          {blocoEhLive ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <strong>Metodos permitidos nesta live</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={permitirMercadoPagoLive}
                  disabled={!mercadoPagoDisponivelParaLive}
                  onChange={(e) => {
                    setMetodosPagamentoLiveCustomizados(true);
                    setPermitirMercadoPagoLive(e.target.checked);
                  }}
                />
                <span>
                  Mercado Pago
                  {!mercadoPagoDisponivelParaLive ? " (indisponivel)" : ""}
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={permitirPixManualLive}
                  disabled={!pixManualDisponivelParaLive}
                  onChange={(e) => {
                    setMetodosPagamentoLiveCustomizados(true);
                    setPermitirPixManualLive(e.target.checked);
                  }}
                />
                <span>
                  PIX manual
                  {!pixManualDisponivelParaLive ? " (indisponivel)" : ""}
                </span>
              </label>
            </div>
          ) : null}
          {usarValoresPixManual ? (
            <select value={valorCompra} onChange={(e) => setValorCompra(e.target.value)}>
              {pixManualValoresDisponiveis.map((item) => (
                <option key={item.valorCentavos} value={item.valorCentavos}>
                  {item.titulo
                    ? `${item.titulo} - ${formatarPreco(item.valorCentavos)}`
                    : formatarPreco(item.valorCentavos)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Valor (R$)"
              value={valorCompra}
              onChange={(e) => setValorCompra(e.target.value)}
            />
          )}
          {pixManualSistemaHabilitado &&
          pixManualConectado &&
          !pixManualValoresDisponiveis.length ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
              Configure ao menos um QR por valor no PIX manual para compra automatica por valor.
            </p>
          ) : null}
        </>
      )}

      <button onClick={criarBloco} disabled={enviando}>
        {enviando ? "Enviando..." : `Criar ${nomeBlocoSingular}`}
      </button>

      {!!erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}
