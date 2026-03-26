import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";
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
        card.descricao ||
        card.imagem ||
        card.imagemPath ||
        card.imagemArquivo ||
        card.linkExterno
    );
};

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
  const [livesHabilitadas, setLivesHabilitadas] = useState(
    DEFAULT_SISTEMA_CONFIG.livesHabilitadas
  );
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
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
      let livesDoProjetoHabilitadas = DEFAULT_SISTEMA_CONFIG.livesHabilitadas;
      let nomeEspacoSingularAtual = DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular;
      let nomeBlocoSingularAtual = DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular;
      let nomeBlocoPluralAtual = DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural;
      try {
        const configSistema = await obterConfigSistema();
        moduloMercadoPagoAtivo = configSistema?.mercadoPagoHabilitado !== false;
        moduloPixManualAtivo = configSistema?.pixManualHabilitado !== false;
        cardsBlocoHabilitado = configSistema?.blocoCardsHabilitado === true;
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
      }

      if (!cancelado) {
        setMercadoPagoSistemaHabilitado(moduloMercadoPagoAtivo);
        setPixManualSistemaHabilitado(moduloPixManualAtivo);
        setBlocoCardsHabilitado(cardsBlocoHabilitado);
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
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);

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
    descricao: card.descricao,
    imagem: card.imagem,
    imagemPath: card.imagemPath || "",
    linkExterno: card.linkExterno,
  });

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
    if (!blocoEhCards && !blocoEhLive && !files.length) {
      return alert("Selecione ao menos uma imagem");
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
      await garantirBasePersistenteOnePage();

      const blocoRef = doc(
        getPrimaryProjectCollection(db, "users", ownerUserId, "espacos", espacoId, "blocos")
      );
      const blocoId = blocoRef.id;

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
          id: blocoId,
          tipo: "live",
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

        await setDoc(blocoRef, blocoPayload);

        if (onCreate) {
          onCreate({
            criadoEm: new Date().toISOString(),
            ...blocoPayload,
          });
        }

        setValorCompra("");
        setLiveUrl("");
        setLiveInicioEm("");
        setLiveFimEm("");
        setLiveBannerUrl("");
        setLiveBannerArquivo(null);
        setLiveBannerPreviewUrl("");
        setPermitirMercadoPagoLive(mercadoPagoDisponivelParaLive);
        setPermitirPixManualLive(pixManualDisponivelParaLive);
        setMetodosPagamentoLiveCustomizados(false);
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
          id: blocoId,
          tipo: "cards",
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

        await setDoc(blocoRef, blocoPayload);
        await Promise.all(
          cardsPersistidos.map((card) =>
            setDoc(doc(collection(blocoRef, "cards"), card.id), {
              id: card.id,
              ordem: card.ordem,
              nome: card.nome,
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
        );

        if (onCreate) {
          onCreate({
            criadoEm: new Date().toISOString(),
            ...blocoPayload,
          });
        }

        setFiles([]);
        setCards([criarCardVazio()]);
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
        id: blocoId,
        tipo: "imagem",
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

      await setDoc(blocoRef, blocoPayload);

      if (onCreate) {
        onCreate({
          criadoEm: new Date().toISOString(),
          ...blocoPayload,
          imagensPreview: previewUrlsParaUI,
          imagensOriginaisPublicas: originaisPublicasParaUI,
          imagens:
            visibilidade === "publico"
              ? originaisPublicasParaUI
              : previewUrlsParaUI,
        });
      }

      setFiles([]);
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
          blocoEhCards ? "cards" : blocoEhLive ? "live" : "imagens"
        }`}
      </h3>

      <select value={tipoConteudo} onChange={(e) => setTipoConteudo(e.target.value)}>
        <option value="imagem">Imagens</option>
        {blocoCardsHabilitado && <option value="cards">Cards</option>}
        {livesHabilitadas && <option value="live">Live</option>}
      </select>

      {blocoEhCards ? (
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
