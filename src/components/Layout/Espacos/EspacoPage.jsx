import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import CriadorBloco from "../Blocos/CriadorBloco";
import EditorBloco from "../Blocos/EditorBloco";
import LoginButton from "../Geral/LoginButton";
import Card from "../Objects/Objetos/Card";
import Container from "../Objects/Containers/Container";
import { auth, db, storage } from "../../Banco/init-firebase";
import {
  excluirArquivoNoBucketCompartilhado,
  obterUrlArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../Storage/sharedBucketApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
  obterRotulosBloco,
  obterRotulosEspaco,
  obterRotulosSkin,
} from "../Sistema/configSistema";
import { solicitarSolicitacaoPixManualBloco } from "../Pagamentos/mercadoPagoApi";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import { getEspacoCompleto } from "./firebaseEspacos";

const isRenderableUrl = (valor) =>
  typeof valor === "string" &&
  (
    valor.startsWith("https://") ||
    valor.startsWith("http://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:image/")
  );

const normalizarListaImagens = (valor) => {
  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }
  if (typeof valor === "string" && valor) {
    return [valor];
  }
  return [];
};

const normalizarCardsDoBloco = (valor) => {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((card, index) => ({
      id: String(card?.id || `card_${index}`),
      ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : index,
      nome: String(card?.nome || "").trim(),
      descricao: String(card?.descricao || "").trim(),
      imagem: String(card?.imagem || "").trim(),
      imagemPath: String(card?.imagemPath || "").trim(),
      linkExterno: String(card?.linkExterno || "").trim(),
    }))
    .filter(
      (card) =>
        card.nome || card.descricao || card.imagem || card.imagemPath || card.linkExterno
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
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

const gerarNomeArquivoSeguro = (nome = "imagem") => {
  const nomeLimpo = String(nome || "imagem")
    .trim()
    .replace(/[^\w.\-]/g, "_");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nomeLimpo || "imagem"}`;
};

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const extrairPrimeiraUrl = (texto = "") => {
  const bruto = String(texto || "").trim();
  if (!bruto) return "";

  const semAspas = bruto.replace(/^['"]|['"]$/g, "").trim();
  if (/^https?:\/\//i.test(semAspas)) return semAspas;

  const hrefMatch = bruto.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch?.[1]) {
    const href = String(hrefMatch[1]).trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const importMatch = bruto.match(/url\(([^)]+)\)/i);
  if (importMatch?.[1]) {
    const href = String(importMatch[1]).replace(/^['"]|['"]$/g, "").trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const geral = bruto.match(/https?:\/\/[^\s"'<>]+/i);
  return geral?.[0] ? String(geral[0]).trim() : "";
};

const formatarFamilyGoogleCss2 = (value = "") =>
  encodeURI(String(value || "").trim().replace(/\s+/g, "+"));

const normalizarUrlGoogleFonts = (url = "") => {
  const href = extrairPrimeiraUrl(url);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    const host = String(parsed.hostname || "").toLowerCase();

    if (host.includes("fonts.googleapis.com")) {
      return parsed.toString();
    }

    if (host.includes("fonts.google.com") && parsed.pathname.startsWith("/share")) {
      const familias = parsed.searchParams
        .getAll("selection.family")
        .flatMap((value) => String(value || "").split("|"))
        .map((value) => value.trim())
        .filter(Boolean);

      if (!familias.length) return "";

      const queryFamilias = familias
        .map((family) => `family=${formatarFamilyGoogleCss2(family)}`)
        .join("&");
      return `https://fonts.googleapis.com/css2?${queryFamilias}&display=swap`;
    }
  } catch {
    return "";
  }

  return "";
};

const carregarGoogleFontsNoDocumento = (urls = []) => {
  if (typeof document === "undefined") return;

  const lista = Array.isArray(urls) ? urls : [];
  for (const url of lista) {
    const href = normalizarUrlGoogleFonts(url);
    if (!/^https?:\/\/fonts\.googleapis\.com\//i.test(href)) continue;

    const existente = document.querySelector(
      `link[data-google-font-project="true"][href="${href}"]`
    );
    if (existente) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-google-font-project", "true");
    document.head.appendChild(link);
  }
};

const montarFontFamilyCss = (fontFamily = "") => {
  const nome = String(fontFamily || "").trim();
  if (!nome) return "";
  if (nome.includes(",")) return nome;
  return `'${nome}', sans-serif`;
};

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
  } catch {
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

export default function EspacoPage() {
  const navigate = useNavigate();
  const { espacoNome } = useParams();
  const {
    espacos,
    skinIdAtual,
    user,
    onePagePublicaAtiva: onePagePublicaAtivaContexto = false,
  } = useOutletContext();
  const configSistemaCacheLocal = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const [blocos, setBlocos] = useState([]);
  const [erroBlocos, setErroBlocos] = useState("");
  const [isAssinante, setIsAssinante] = useState(false);
  const [assinaturaCheckPronto, setAssinaturaCheckPronto] = useState(false);
  const [compradorPorBloco, setCompradorPorBloco] = useState({});
  const [sessaoChatPorBloco, setSessaoChatPorBloco] = useState({});
  const [originaisPorBloco, setOriginaisPorBloco] = useState({});
  const [previewsPorBloco, setPreviewsPorBloco] = useState({});
  const [imagensCardsPorBloco, setImagensCardsPorBloco] = useState({});
  const [reloadNonce, setReloadNonce] = useState(0);
  const [blocoEmAtualizacaoId, setBlocoEmAtualizacaoId] = useState(null);
  const [blocoEmExclusaoId, setBlocoEmExclusaoId] = useState(null);
  const [erroAcaoBloco, setErroAcaoBloco] = useState("");
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [espacoDetalheAtual, setEspacoDetalheAtual] = useState(null);
  const [onePagePublicaAtiva, setOnePagePublicaAtiva] = useState(
    isOnePageComEntradaPublica(configSistemaCacheLocal)
  );
  const [adminUidProjeto, setAdminUidProjeto] = useState(
    String(configSistemaCacheLocal?.adminUid || localStorage.getItem("systemAdminUid") || "").trim()
  );
  const [adminEmailProjeto, setAdminEmailProjeto] = useState(
    String(
      configSistemaCacheLocal?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
    )
      .trim()
      .toLowerCase()
  );
  const [nomeSkinSingular, setNomeSkinSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeSkinSingular
  );
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeEspacoPlural, setNomeEspacoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
  );
  const [nomeBlocoSingular, setNomeBlocoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular
  );
  const [nomeBlocoPlural, setNomeBlocoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural
  );
  const [mensagemEspacoLoginRestrito, setMensagemEspacoLoginRestrito] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
  );
  const [
    mensagemEspacoLoginRestritoFontFamily,
    setMensagemEspacoLoginRestritoFontFamily,
  ] = useState(DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily);
  const [mensagemEspacoAssinanteRestrito, setMensagemEspacoAssinanteRestrito] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
  );
  const [
    mensagemEspacoAssinanteRestritoFontFamily,
    setMensagemEspacoAssinanteRestritoFontFamily,
  ] = useState(DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily);
  const [googleFontsUrlsProjeto, setGoogleFontsUrlsProjeto] = useState(
    Array.isArray(DEFAULT_SISTEMA_CONFIG.googleFontsUrls)
      ? DEFAULT_SISTEMA_CONFIG.googleFontsUrls
      : []
  );
  const [exibirBotaoLoginMensagemRestricao, setExibirBotaoLoginMensagemRestricao] = useState(
    DEFAULT_SISTEMA_CONFIG.exibirBotaoLoginMensagemRestricao
  );
  const [mensagemRestricaoAvatarUrl, setMensagemRestricaoAvatarUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
  );
  const blockedOriginalPathsRef = useRef(new Set());
  const blockedPreviewPathsRef = useRef(new Set());
  const backfilledPublicUrlsRef = useRef(new Set());
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);
  const loginLoadingMode = String(configSistemaCacheLocal?.loginLoadingMode || "")
    .trim()
    .toLowerCase();
  const loginLoadingSpriteUrl = String(configSistemaCacheLocal?.loginLoadingSpriteUrl || "").trim();
  const exibirLoaderSprite = loginLoadingMode === "sprite_sheet" && Boolean(loginLoadingSpriteUrl);
  const carregamentoAcessoEspacoJSX = exibirLoaderSprite ? (
    <div className="sprite-loader-layer sprite-loader-layer-inline" aria-live="polite">
      <div
        className="loader-cherry"
        aria-hidden="true"
        style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
      />
    </div>
  ) : (
    <div className="system-loading-indicator" aria-live="polite">
      <div className="system-loading-dot" aria-hidden="true" />
    </div>
  );

  if (!espacos) return null;

  const persistedUid = localStorage.getItem("userId");
  const authUserAtual = user || auth.currentUser || null;
  const authUid = auth.currentUser?.uid || null;
  const currentUid = user?.uid || authUid || persistedUid || null;
  const espacoAtual = espacos.find((e) => e.nome === espacoNome);
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco;
  const onePagePublicaAtivaEfetiva = Boolean(onePagePublicaAtivaContexto || onePagePublicaAtiva);
  const emailUsuarioAtual = String(authUserAtual?.email || "")
    .trim()
    .toLowerCase();
  const adminUidProjetoEfetivo = String(
    adminUidProjeto || localStorage.getItem("systemAdminUid") || ""
  ).trim();
  const adminEmailProjetoEfetivo = String(
    adminEmailProjeto || localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const adminProjetoConfigurado = Boolean(
    adminUidProjetoEfetivo || adminEmailProjetoEfetivo
  );
  const espacoAtualEfetivo =
    espacoDetalheAtual &&
    String(espacoDetalheAtual.id || espacoDetalheAtual.id_espaco) === String(espacoId || "")
      ? { ...espacoAtual, ...espacoDetalheAtual }
      : espacoAtual;
  const usuarioEhAdminProjeto = Boolean(
    currentUid &&
      (
        (adminUidProjetoEfetivo && currentUid === adminUidProjetoEfetivo) ||
        (adminEmailProjetoEfetivo && emailUsuarioAtual === adminEmailProjetoEfetivo) ||
        (!adminProjetoConfigurado && authUserAtual && seforAdm(authUserAtual))
      )
  );
  const ownerUserId =
    espacoAtualEfetivo?.ownerUserId ||
    espacos?.[0]?.ownerUserId ||
    (
      onePagePublicaAtivaEfetiva
        ? adminUidProjetoEfetivo || (usuarioEhAdminProjeto ? currentUid : null)
        : null
    );
  const isOwner = !!currentUid && ownerUserId === currentUid;
  const isCoCriador =
    !!currentUid &&
    Array.isArray(espacoAtualEfetivo?.coCriadoresUids) &&
    espacoAtualEfetivo.coCriadoresUids.includes(currentUid);
  const podeGerenciarPadrao = isOwner || isCoCriador;
  const podeGerenciar = onePagePublicaAtivaEfetiva
    ? usuarioEhAdminProjeto
    : (podeGerenciarPadrao || usuarioEhAdminProjeto);
  const visibilidadeEspaco = espacoAtualEfetivo?.visibilidade || "publico";
  const visitanteOnePagePublico =
    onePagePublicaAtivaEfetiva && !currentUid && !podeGerenciar;

  useEffect(() => {
    let ativo = true;

    async function carregarEspacoCompletoAtual() {
      if (!espacoId || !ownerUserId) {
        if (ativo) setEspacoDetalheAtual(null);
        return;
      }

      try {
        const detalhe = await getEspacoCompleto(ownerUserId, espacoId);
        if (ativo) {
          setEspacoDetalheAtual(detalhe);
        }
      } catch (err) {
        if (!ativo) return;
        if (err?.code === "permission-denied") {
          setEspacoDetalheAtual(null);
          return;
        }
        console.error("Erro ao carregar detalhes do espaco:", err);
        setEspacoDetalheAtual(null);
      }
    }

    carregarEspacoCompletoAtual();
    return () => {
      ativo = false;
    };
  }, [espacoId, ownerUserId, reloadNonce]);

  const idsAssinantePossiveis = useMemo(
    () => [currentUid, skinIdAtual].filter(Boolean),
    [currentUid, skinIdAtual]
  );

  const podeVerEspaco = (() => {
    if (podeGerenciar) return true;
    if (!visibilidadeEspaco || visibilidadeEspaco === "publico") return true;
    if (visibilidadeEspaco === "publico_restritivo" || visibilidadeEspaco === "privado") {
      return !!currentUid;
    }
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return isAssinante;
    }
    return true;
  })();

  const espacoExigeChecagemAssinatura =
    visibilidadeEspaco === "exclusivo_assinante" && !podeGerenciar;
  const acessoEspacoResolvido = !espacoExigeChecagemAssinatura || assinaturaCheckPronto;

  const podeVerBloco = (bloco) => {
    if (podeGerenciar) return true;

    const vis = bloco?.visibilidade || "publico";
    if (vis === "publico") return true;
    if (vis === "publico_restritivo" || vis === "privado") return !!currentUid;
    if (vis === "exclusivo_assinante") return isAssinante;
    if (vis === "exclusivo_comprador" || vis === "comprado") {
      return !!compradorPorBloco[bloco.id];
    }
    return true;
  };

  const tipoRestricaoBloco = (bloco) => {
    const vis = bloco?.visibilidade || "publico";
    if (vis === "exclusivo_assinante") return "assinante";
    if (vis === "exclusivo_comprador" || vis === "comprado") return "comprador";
    return "login";
  };

  const resolverUrlArquivo = async (path) => {
    if (usandoBucketCompartilhadoCrossProject) {
      return obterUrlArquivoNoBucketCompartilhado({ user, path });
    }
    return getDownloadURL(ref(storage, path));
  };

  const subirArquivoStorage = async (path, arquivo) => {
    if (usandoBucketCompartilhadoCrossProject) {
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

  const excluirArquivoStorage = async (path) => {
    if (usandoBucketCompartilhadoCrossProject) {
      await excluirArquivoNoBucketCompartilhado({ user, path });
      return;
    }
    await deleteObject(ref(storage, path));
  };

  useEffect(() => {
    let ativo = true;

    async function carregarConfigSistema() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setMercadoPagoSistemaHabilitado(config?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(config?.pixManualHabilitado !== false);
        setOnePagePublicaAtiva(
          isOnePageComEntradaPublica(config)
        );
        setAdminUidProjeto(String(config?.adminUid || "").trim());
        setAdminEmailProjeto(String(config?.adminEmail || "").trim().toLowerCase());
        const rotulosSkin = obterRotulosSkin(config);
        const rotulosEspaco = obterRotulosEspaco(config);
        const rotulosBloco = obterRotulosBloco(config);
        setNomeSkinSingular(rotulosSkin.singular || DEFAULT_SISTEMA_CONFIG.nomeSkinSingular);
        setNomeEspacoSingular(
          rotulosEspaco.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
        );
        setNomeEspacoPlural(rotulosEspaco.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setNomeBlocoSingular(rotulosBloco.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(rotulosBloco.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
        setMensagemEspacoLoginRestrito(
          String(
            config?.mensagemEspacoLoginRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
          )
        );
        setMensagemEspacoLoginRestritoFontFamily(
          String(
            config?.mensagemEspacoLoginRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily
          )
        );
        setMensagemEspacoAssinanteRestrito(
          String(
            config?.mensagemEspacoAssinanteRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
          )
        );
        setMensagemEspacoAssinanteRestritoFontFamily(
          String(
            config?.mensagemEspacoAssinanteRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily
          )
        );
        setGoogleFontsUrlsProjeto(Array.isArray(config?.googleFontsUrls) ? config.googleFontsUrls : []);
        setExibirBotaoLoginMensagemRestricao(
          config?.exibirBotaoLoginMensagemRestricao !== false
        );
        setMensagemRestricaoAvatarUrl(
          String(
            config?.mensagemRestricaoAvatarUrl ||
              DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
          )
        );
      } catch {
        if (!ativo) return;
        const configFallback = obterConfigSistemaCacheLocal() || configSistemaCacheLocal;
        setMercadoPagoSistemaHabilitado(configFallback?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(configFallback?.pixManualHabilitado !== false);
        setOnePagePublicaAtiva(
          isOnePageComEntradaPublica(configFallback)
        );
        setAdminUidProjeto(
          String(
            configFallback?.adminUid || localStorage.getItem("systemAdminUid") || ""
          ).trim()
        );
        setAdminEmailProjeto(
          String(
            configFallback?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
          )
            .trim()
            .toLowerCase()
        );
        const rotulosSkin = obterRotulosSkin(configFallback);
        const rotulosEspaco = obterRotulosEspaco(configFallback);
        const rotulosBloco = obterRotulosBloco(configFallback);
        setNomeSkinSingular(rotulosSkin.singular || DEFAULT_SISTEMA_CONFIG.nomeSkinSingular);
        setNomeEspacoSingular(
          rotulosEspaco.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
        );
        setNomeEspacoPlural(rotulosEspaco.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setNomeBlocoSingular(rotulosBloco.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(rotulosBloco.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
        setMensagemEspacoLoginRestrito(
          String(
            configFallback?.mensagemEspacoLoginRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
          )
        );
        setMensagemEspacoLoginRestritoFontFamily(
          String(
            configFallback?.mensagemEspacoLoginRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily
          )
        );
        setMensagemEspacoAssinanteRestrito(
          String(
            configFallback?.mensagemEspacoAssinanteRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
          )
        );
        setMensagemEspacoAssinanteRestritoFontFamily(
          String(
            configFallback?.mensagemEspacoAssinanteRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily
          )
        );
        setGoogleFontsUrlsProjeto(
          Array.isArray(configFallback?.googleFontsUrls) ? configFallback.googleFontsUrls : []
        );
        setExibirBotaoLoginMensagemRestricao(
          configFallback?.exibirBotaoLoginMensagemRestricao !== false
        );
        setMensagemRestricaoAvatarUrl(
          String(
            configFallback?.mensagemRestricaoAvatarUrl ||
              DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
          )
        );
      }
    }

    carregarConfigSistema();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    carregarGoogleFontsNoDocumento(googleFontsUrlsProjeto);
  }, [googleFontsUrlsProjeto]);

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    async function checarAssinaturaEspaco() {
      if (!idsAssinantePossiveis.length) {
        setIsAssinante(false);
        setAssinaturaCheckPronto(true);
        return;
      }

      setAssinaturaCheckPronto(false);
      try {
        let found = false;
        for (const assinanteId of idsAssinantePossiveis) {
          try {
            const assinaturaRef = doc(
              db,
              "users",
              ownerUserId,
              "espacos",
              espacoId,
              "assinantes",
              assinanteId
            );
            const assinaturaSnap = await getDoc(assinaturaRef);
            if (assinaturaSnap.exists()) {
              found = true;
              break;
            }
          } catch (err) {
            if (err?.code !== "permission-denied") throw err;
          }
        }
        setIsAssinante(found);
      } catch (err) {
        console.error("Erro ao checar assinatura do espaco:", err);
        setIsAssinante(false);
      } finally {
        setAssinaturaCheckPronto(true);
      }
    }

    checarAssinaturaEspaco();
  }, [espacoId, ownerUserId, idsAssinantePossiveis]);

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    if (espacoExigeChecagemAssinatura && !assinaturaCheckPronto) {
      return;
    }

    if (!podeVerEspaco) {
      setBlocos([]);
      setOriginaisPorBloco({});
      setPreviewsPorBloco({});
      setImagensCardsPorBloco({});
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
      setErroBlocos("");
      return;
    }

    async function carregarBlocos() {
      try {
        setErroBlocos("");
        const blocosRef = collection(
          db,
          "users",
          ownerUserId,
          "espacos",
          espacoId,
          "blocos"
        );

        const docs = [];

        if (visitanteOnePagePublico) {
          const queriesPublicas = [
            query(blocosRef, where("visibilidade", "==", "publico")),
            query(blocosRef, where("visibilidade", "==", null)),
          ];

          const results = await Promise.allSettled(
            queriesPublicas.map((qRef) => getDocs(qRef))
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              docs.push(
                ...result.value.docs.map((d) => ({ __legacy: false, docSnap: d }))
              );
            } else if (
              result.reason?.code &&
              result.reason.code !== "permission-denied" &&
              result.reason.code !== "failed-precondition"
            ) {
              throw result.reason;
            }
          }

          if (!docs.length) {
            try {
              const snap = await getDocs(blocosRef);
              docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
            } catch (allErr) {
              if (
                allErr?.code !== "permission-denied" &&
                allErr?.code !== "failed-precondition"
              ) {
                throw allErr;
              }
            }
          }
        } else {
          try {
            const snap = await getDocs(blocosRef);
            docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
          } catch (allErr) {
            if (allErr?.code !== "permission-denied") throw allErr;

            const queries = [
              query(blocosRef, where("visibilidade", "==", "publico")),
              query(blocosRef, where("visibilidade", "==", "publico_restritivo")),
              query(blocosRef, where("visibilidade", "==", "privado")),
              query(blocosRef, where("visibilidade", "==", "exclusivo_assinante")),
              query(blocosRef, where("visibilidade", "==", "exclusivo_comprador")),
              query(blocosRef, where("visibilidade", "==", "comprado")),
              query(blocosRef, where("visibilidade", "==", null)),
            ];

            const results = await Promise.allSettled(
              queries.map((qRef) => getDocs(qRef))
            );

            for (const result of results) {
              if (result.status === "fulfilled") {
                docs.push(
                  ...result.value.docs.map((d) => ({ __legacy: false, docSnap: d }))
                );
              } else if (
                result.reason?.code &&
                result.reason.code !== "permission-denied" &&
                result.reason.code !== "failed-precondition"
              ) {
                throw result.reason;
              }
            }
          }
        }

        if (!docs.length) {
          const legacyQuery = query(
            collection(db, "blocos"),
            where("espacoId", "==", espacoId)
          );
          try {
            const legacySnap = await getDocs(legacyQuery);
            docs.push(
              ...legacySnap.docs.map((d) => ({ __legacy: true, docSnap: d }))
            );
          } catch (legacyErr) {
            if (legacyErr?.code !== "permission-denied") throw legacyErr;
          }
        }

        const dedupe = new Map();
        for (const item of docs) {
          const d = item.docSnap;
          const blocoData = d.data();
          dedupe.set(d.id, {
            id: d.id,
            __legacy: item.__legacy,
            ...blocoData,
            cards: normalizarCardsDoBloco(blocoData?.cards),
          });
        }

        const lista = [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        setBlocos(lista);
      } catch (err) {
        console.error("Erro ao carregar blocos:", err);
        setErroBlocos(err?.message || "Erro ao carregar blocos");
      }
    }

    carregarBlocos();
  }, [
    espacoId,
    ownerUserId,
    podeVerEspaco,
    espacoExigeChecagemAssinatura,
    assinaturaCheckPronto,
    reloadNonce,
  ]);

  useEffect(() => {
    if (!ownerUserId || !espacoId || !podeVerEspaco || !blocos.length) return;

    const blocosCardsSemLista = blocos.filter(
      (bloco) =>
        bloco?.tipo === "cards" &&
        (!Array.isArray(bloco.cards) || !bloco.cards.length)
    );

    if (!blocosCardsSemLista.length) return;

    let cancelado = false;

    async function carregarCardsSubcolecao() {
      const cardsPorBloco = {};

      for (const bloco of blocosCardsSemLista) {
        try {
          const cardsRef = bloco?.__legacy
            ? collection(db, "blocos", bloco.id, "cards")
            : collection(
                db,
                "users",
                ownerUserId,
                "espacos",
                espacoId,
                "blocos",
                bloco.id,
                "cards"
              );
          const cardsSnap = await getDocs(cardsRef);
          const cards = normalizarCardsDoBloco(
            cardsSnap.docs.map((cardDoc) => ({
              id: cardDoc.id,
              ...cardDoc.data(),
            }))
          );
          if (cards.length) {
            cardsPorBloco[bloco.id] = cards;
          }
        } catch (err) {
          if (err?.code !== "permission-denied") {
            console.error("Erro ao carregar cards do bloco:", bloco.id, err);
          }
        }
      }

      if (cancelado || !Object.keys(cardsPorBloco).length) return;

      setBlocos((prev) =>
        prev.map((bloco) =>
          cardsPorBloco[bloco.id]
            ? { ...bloco, cards: cardsPorBloco[bloco.id] }
            : bloco
        )
      );
    }

    carregarCardsSubcolecao();

    return () => {
      cancelado = true;
    };
  }, [blocos, ownerUserId, espacoId, podeVerEspaco]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setImagensCardsPorBloco({});
      return;
    }

    const cardsComPath = [];
    for (const bloco of blocos) {
      if (bloco?.tipo !== "cards") continue;
      const cards = normalizarCardsDoBloco(bloco?.cards);
      for (const card of cards) {
        if (!card.imagemPath) continue;
        if (isRenderableUrl(card.imagem)) continue;
        cardsComPath.push({ blocoId: bloco.id, cardId: card.id, path: card.imagemPath });
      }
    }

    if (!cardsComPath.length) return;

    let cancelado = false;

    async function resolverImagensCards() {
      const mapa = {};
      for (const item of cardsComPath) {
        try {
          const url = await resolverUrlArquivo(item.path);
          if (!url) continue;
          if (!mapa[item.blocoId]) mapa[item.blocoId] = {};
          mapa[item.blocoId][item.cardId] = url;
        } catch (err) {
          if (err?.code !== "storage/object-not-found" && err?.code !== "storage/unauthorized") {
            console.warn("Erro ao resolver imagem do card:", item.path, err?.code, err?.message);
          }
        }
      }

      if (cancelado || !Object.keys(mapa).length) return;

      setImagensCardsPorBloco((prev) => {
        const next = { ...prev };
        for (const blocoId of Object.keys(mapa)) {
          next[blocoId] = {
            ...(next[blocoId] || {}),
            ...mapa[blocoId],
          };
        }
        return next;
      });
    }

    resolverImagensCards();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeVerEspaco, currentUid]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setCompradorPorBloco({});
      return;
    }

    async function checarCompras() {
      if (!idsAssinantePossiveis.length) {
        setCompradorPorBloco({});
        return;
      }

      const mapa = {};

      for (const bloco of blocos) {
        const vis = bloco?.visibilidade || "publico";
        const exigeCompra = vis === "exclusivo_comprador" || vis === "comprado";
        if (!exigeCompra) continue;

        let found = false;
        for (const compradorId of idsAssinantePossiveis) {
          try {
            const compradorRef = bloco.__legacy
              ? doc(db, "blocos", bloco.id, "compradores", compradorId)
              : doc(
                  db,
                  "users",
                  ownerUserId,
                  "espacos",
                  espacoId,
                  "blocos",
                  bloco.id,
                  "compradores",
                  compradorId
                );

            const compradorSnap = await getDoc(compradorRef);
            if (compradorSnap.exists()) {
              found = true;
              break;
            }
          } catch (err) {
            if (err?.code !== "permission-denied") throw err;
          }
        }
        mapa[bloco.id] = found;
      }

      setCompradorPorBloco(mapa);
    }

    checarCompras().catch((err) => {
      console.error("Erro ao checar compras dos blocos:", err);
      setCompradorPorBloco({});
    });
  }, [blocos, idsAssinantePossiveis, ownerUserId, espacoId, podeVerEspaco]);

  useEffect(() => {
    if (!currentUid || !ownerUserId || !espacoId || !podeVerEspaco) {
      setSessaoChatPorBloco({});
      return;
    }

    let cancelado = false;

    async function carregarSessoesChatComprador() {
      try {
        const pedidosSnap = await getDocs(
          query(
            collection(db, "users", ownerUserId, "pedidos"),
            where("compradorUid", "==", currentUid)
          )
        );

        if (cancelado) return;

        const mapa = {};
        for (const pedidoDoc of pedidosSnap.docs) {
          const pedido = pedidoDoc.data() || {};
          const status = String(pedido?.status || "pedido_solicitado").trim().toLowerCase();
          if (status !== "pagamento_confirmado") continue;
          if (String(pedido?.espacoId || "").trim() !== String(espacoId || "").trim()) continue;

          const blocoId = String(pedido?.blocoId || "").trim();
          const contactId = String(pedido?.sessionContactId || "").trim();
          const conversationId = String(pedido?.sessionConversationId || "principal").trim();
          if (!blocoId || !contactId) continue;

          mapa[blocoId] = {
            contactId,
            conversationId: conversationId || "principal",
          };
        }

        setSessaoChatPorBloco(mapa);
      } catch (err) {
        if (!cancelado) {
          setSessaoChatPorBloco({});
        }
        if (err?.code !== "permission-denied") {
          console.error("Erro ao carregar chat de sessao por bloco:", err);
        }
      }
    }

    carregarSessoesChatComprador();

    return () => {
      cancelado = true;
    };
  }, [currentUid, ownerUserId, espacoId, podeVerEspaco, reloadNonce]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setOriginaisPorBloco((prev) => (Object.keys(prev).length ? {} : prev));
      blockedOriginalPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarOriginaisAutorizadas() {
      const mapa = {};

      for (const bloco of blocos) {
        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (!currentUid && visibilidadeBloco === "publico") {
          // Visitante deslogado usa URLs publicas tokenizadas do documento.
          continue;
        }
        if (!podeVerBloco(bloco)) continue;

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) continue;

        const urls = [];
        for (const path of paths) {
          if (blockedOriginalPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await resolverUrlArquivo(path);
            urls.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedOriginalPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver imagem original do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        if (urls.length) {
          mapa[bloco.id] = urls;
        }
      }

      if (!cancelado) {
        setOriginaisPorBloco(mapa);
      }
    }

    carregarOriginaisAutorizadas();

    return () => {
      cancelado = true;
    };
  }, [
    blocos,
    podeVerEspaco,
    currentUid,
    podeGerenciar,
    authUid,
    isAssinante,
    compradorPorBloco,
  ]);

  useEffect(() => {
    if (!podeGerenciar || !authUid || !ownerUserId || !espacoId || !blocos.length) {
      return;
    }

    let cancelado = false;

    async function backfillUrlsPublicasOriginais() {
      for (const bloco of blocos) {
        if (cancelado) return;

        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (visibilidadeBloco !== "publico") continue;
        if (backfilledPublicUrlsRef.current.has(bloco.id)) continue;

        const existentes = normalizarListaImagens(bloco.imagensOriginaisPublicas)
          .filter(isRenderableUrl);
        if (existentes.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const urlsPublicas = [];
        for (const path of paths) {
          try {
            const url = await resolverUrlArquivo(path);
            urlsPublicas.push(url);
          } catch {
            // Mantem silencioso; novo ciclo pode resolver apos refresh/login.
          }
        }

        if (!urlsPublicas.length) continue;

        const blocoRef = bloco.__legacy
          ? doc(db, "blocos", bloco.id)
          : doc(db, "users", ownerUserId, "espacos", espacoId, "blocos", bloco.id);

        try {
          await updateDoc(blocoRef, {
            imagensOriginaisPublicas: urlsPublicas,
            imagens: urlsPublicas,
          });

          backfilledPublicUrlsRef.current.add(bloco.id);
          if (cancelado) return;

          setBlocos((prev) =>
            prev.map((item) =>
              item.id === bloco.id
                ? {
                    ...item,
                    imagensOriginaisPublicas: urlsPublicas,
                    imagens: urlsPublicas,
                  }
                : item
            )
          );
        } catch (err) {
          if (err?.code !== "permission-denied") {
            console.warn("Falha no backfill de URLs publicas:", bloco.id, err?.message);
          }
        }
      }
    }

    backfillUrlsPublicasOriginais();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeGerenciar, authUid, ownerUserId, espacoId]);

  useEffect(() => {
    // Se o contexto de acesso mudou (ex.: login do criador), limpa caches de bloqueio.
    blockedOriginalPathsRef.current.clear();
    blockedPreviewPathsRef.current.clear();
  }, [currentUid, podeGerenciar, espacoId]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setPreviewsPorBloco({});
      blockedPreviewPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarPreviewsPermitidas() {
      const mapa = {};

      for (const bloco of blocos) {
        const fromDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
        const fromPaths = normalizarListaImagens(bloco.imagensPreviewPaths)
          .filter((path) => typeof path === "string" && path.includes("/preview/"));

        const resolved = [];
        for (const path of fromPaths) {
          if (blockedPreviewPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await getDownloadURL(ref(storage, path));
            resolved.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedPreviewPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver preview do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        const unicas = [...new Set([...fromDoc, ...resolved])];
        if (unicas.length) {
          mapa[bloco.id] = unicas;
        }
      }

      if (!cancelado) {
        setPreviewsPorBloco(mapa);
      }
    }

    carregarPreviewsPermitidas();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeVerEspaco, currentUid]);

  if (!espacoAtual) {
    return <p>{`${nomeEspacoSingularCapitalizado} nao encontrado`}</p>;
  }

  const resolverTemplateMensagemEspaco = (template, fallback) => {
    const base = String(template || fallback || "").trim();
    if (!base) return "Conteudo restrito.";
    return base.replaceAll("{nomeEspacoSingular}", nomeEspacoSingular);
  };

  const mensagemRestricaoEspaco = (() => {
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return resolverTemplateMensagemEspaco(
        mensagemEspacoAssinanteRestrito,
        DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
      );
    }
    if (visibilidadeEspaco === "privado" || visibilidadeEspaco === "publico_restritivo") {
      return resolverTemplateMensagemEspaco(
        mensagemEspacoLoginRestrito,
        DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
      );
    }
    return "Conteudo restrito.";
  })();
  const fonteMensagemRestricaoEspaco = (() => {
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return String(mensagemEspacoAssinanteRestritoFontFamily || "").trim();
    }
    if (visibilidadeEspaco === "privado" || visibilidadeEspaco === "publico_restritivo") {
      return String(mensagemEspacoLoginRestritoFontFamily || "").trim();
    }
    return "";
  })();
  const estiloMensagemRestricaoEspaco = fonteMensagemRestricaoEspaco
    ? { fontFamily: montarFontFamilyCss(fonteMensagemRestricaoEspaco) }
    : undefined;
  const tipoRestricaoEspaco =
    visibilidadeEspaco === "exclusivo_assinante" ? "assinante" : "login";
  const mostrarCtaRestricaoEspaco =
    tipoRestricaoEspaco !== "login" || exibirBotaoLoginMensagemRestricao !== false;
  const avatarMensagemRestricao = String(mensagemRestricaoAvatarUrl || "").trim();
  const conteudoEspaco = String(espacoAtualEfetivo?.conteudo || "").trim();

  const irParaAssinatura = () => {
    const skinLogadoUser = localStorage.getItem("skinLogadoUser");
    const menuBase = onePagePublicaAtivaEfetiva
      ? (isOwner ? "/menu/admin" : `/menu/${skinLogadoUser || ""}`)
      : `/menu/${skinLogadoUser}`;
    if (!skinLogadoUser && !isOwner) {
      alert(`Selecione uma ${nomeSkinSingular} para assinar ${nomeEspacoPlural}.`);
      return;
    }
    navigate(`${menuBase}/espacos`);
  };

  const irParaCompra = async (bloco = null) => {
    if (!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado) {
      alert("Pagamentos desativados neste projeto.");
      return;
    }

    const skinLogadoUser = localStorage.getItem("skinLogadoUser");
    const menuBase = onePagePublicaAtivaEfetiva
      ? (isOwner ? "/menu/admin" : `/menu/${skinLogadoUser || ""}`)
      : `/menu/${skinLogadoUser}`;
    if (!currentUid) {
      alert("Voce precisa estar autenticado para solicitar desbloqueio.");
      return;
    }
    if (!skinLogadoUser && !isOwner && !onePagePublicaAtivaEfetiva) {
      alert(`Selecione uma ${nomeSkinSingular} para comprar ${nomeBlocoPlural}.`);
      return;
    }
    if (bloco?.id) {
      if (!pixManualSistemaHabilitado && mercadoPagoSistemaHabilitado) {
        const returnTo = `${window.location.pathname}${window.location.search || ""}`;
        const params = new URLSearchParams({
          comprarBloco: bloco.id,
          espacoId: espacoId || "",
          ownerUserId: ownerUserId || "",
          returnTo,
        });
        navigate(`${menuBase}?${params.toString()}`);
        return;
      }

      try {
        const solicitacao = await solicitarSolicitacaoPixManualBloco({
          ownerUserId: ownerUserId || "",
          espacoId: espacoId || "",
          blocoId: bloco.id,
        });
        if (solicitacao?.alreadyPurchased) {
          alert(solicitacao?.message || `${nomeBlocoSingularCapitalizado} ja desbloqueado.`);
          navigate(menuBase);
          return;
        }
        const ownerQuery = ownerUserId
          ? `?ownerUserId=${encodeURIComponent(String(ownerUserId))}`
          : "";
        navigate(`${menuBase}/solicitacoes${ownerQuery}`);
      } catch (err) {
        alert(err?.message || "Nao foi possivel solicitar desbloqueio.");
      }
      return;
    }
    navigate(menuBase);
  };

  const renderCtaRestricao = (tipoRestricao, bloco = null) => {
    if (!currentUid) {
      return <LoginButton />;
    }
    if (tipoRestricao === "assinante") {
      return <button onClick={irParaAssinatura}>Assinar para desbloquear</button>;
    }
    if (tipoRestricao === "comprador") {
      if (!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado) {
        return <p>Pagamento indisponivel neste projeto.</p>;
      }
      const precoFormatado = formatarPreco(bloco?.precoCentavos, bloco?.moeda || "BRL");
      return (
        <button onClick={() => irParaCompra(bloco)}>
          {precoFormatado ? `Desbloquear por ${precoFormatado}` : "Desbloquear conteudo"}
        </button>
      );
    }
    return null;
  };

  const abrirChatSessaoBloco = (blocoId) => {
    const sessaoChat = sessaoChatPorBloco[blocoId];
    const contactId = String(sessaoChat?.contactId || "").trim();
    const conversationId = String(sessaoChat?.conversationId || "principal").trim();
    if (!contactId) return;

    const skinLogadoUser = localStorage.getItem("skinLogadoUser");
    if (!isOwner && !skinLogadoUser) {
      alert(`Selecione uma ${nomeSkinSingular} para acessar o chat.`);
      return;
    }

    const menuBase = onePagePublicaAtivaEfetiva
      ? (isOwner ? "/menu/admin" : `/menu/${skinLogadoUser || ""}`)
      : `/menu/${skinLogadoUser}`;

    navigate(
      `${menuBase}/contatos/${encodeURIComponent(contactId)}/chat/${encodeURIComponent(
        conversationId || "principal"
      )}`
    );
  };

  const adicionarBloco = (bloco) => {
    setBlocos((prev) => {
      const dedupe = new Map(prev.map((item) => [item.id, item]));
      dedupe.set(bloco.id, bloco);
      return [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });

    // Reconsulta após breve janela para pegar dados consolidados (rules/indexações).
    window.setTimeout(() => {
      setReloadNonce((n) => n + 1);
    }, 1200);
  };

  const getBlocoDocRef = (bloco) =>
    bloco.__legacy
      ? doc(db, "blocos", bloco.id)
      : doc(db, "users", ownerUserId, "espacos", espacoId, "blocos", bloco.id);

  const atualizarBloco = async (blocoId, updates = {}) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o administrador pode editar ${nomeBlocoPlural}.`);
      return false;
    }

    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return false;
    if (!ownerUserId || !espacoId) {
      setErroAcaoBloco(`Nao foi possivel atualizar: ${nomeEspacoSingular} invalido.`);
      return false;
    }

    setErroAcaoBloco("");
    setBlocoEmAtualizacaoId(blocoId);

    try {
      const removerIndices = Array.isArray(updates.removerIndices)
        ? [...new Set(updates.removerIndices.filter((item) => Number.isInteger(item) && item >= 0))]
        : [];
      const removerSet = new Set(removerIndices);
      const novasImagens = Array.isArray(updates.novasImagens)
        ? updates.novasImagens.filter(Boolean)
        : [];

      const visibilidadeFinal = updates.visibilidade || bloco.visibilidade || "publico";
      const isPublicoFinal = visibilidadeFinal === "publico";
      const precoCentavos = Object.prototype.hasOwnProperty.call(updates, "precoCentavos")
        ? updates.precoCentavos
        : bloco.precoCentavos || null;
      const moedaFinal = precoCentavos ? (updates.moeda || bloco.moeda || "BRL") : null;

      const pathsOriginaisAntigos = normalizarListaImagens(bloco.imagensOriginaisPaths);
      const pathsPreviewsAntigos = normalizarListaImagens(bloco.imagensPreviewPaths);
      const urlsPublicasAntigas = normalizarListaImagens(bloco.imagensOriginaisPublicas).filter(isRenderableUrl);
      const urlsPreviewsAntigas = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
      const legadoAntigo = normalizarListaImagens(bloco.imagens).filter(isRenderableUrl);

      const referenciasAntigas = Math.max(
        pathsOriginaisAntigos.length,
        pathsPreviewsAntigos.length,
        urlsPublicasAntigas.length,
        urlsPreviewsAntigas.length,
        legadoAntigo.length
      );

      const pathsOriginaisMantidos = [];
      const pathsPreviewsMantidos = [];
      const urlsPublicasMantidas = [];
      const urlsPreviewsMantidas = [];
      const pathsParaExcluir = [];

      for (let index = 0; index < referenciasAntigas; index += 1) {
        const originalPath = pathsOriginaisAntigos[index];
        const previewPath = pathsPreviewsAntigos[index];

        if (removerSet.has(index)) {
          if (originalPath) pathsParaExcluir.push(originalPath);
          if (previewPath) pathsParaExcluir.push(previewPath);
          continue;
        }

        if (originalPath) pathsOriginaisMantidos.push(originalPath);
        if (previewPath) pathsPreviewsMantidos.push(previewPath);
        if (urlsPublicasAntigas[index]) urlsPublicasMantidas.push(urlsPublicasAntigas[index]);
        if (urlsPreviewsAntigas[index]) urlsPreviewsMantidas.push(urlsPreviewsAntigas[index]);
      }

      const novosOriginaisPaths = [];
      const novosPreviewPaths = [];
      const novasPublicasUrls = [];
      const novasPreviewUrls = [];

      for (const arquivo of novasImagens) {
        const nomeArquivo = gerarNomeArquivoSeguro(arquivo?.name || "imagem");
        const originalPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/original/${nomeArquivo}`;
        const originalUpload = await subirArquivoStorage(originalPath, arquivo);
        novosOriginaisPaths.push(originalPath);

        if (isPublicoFinal) {
          if (isRenderableUrl(originalUpload?.url)) {
            novasPublicasUrls.push(originalUpload.url);
          } else {
            try {
              const urlPublica = await resolverUrlArquivo(originalPath);
              if (isRenderableUrl(urlPublica)) {
                novasPublicasUrls.push(urlPublica);
              }
            } catch (err) {
              console.warn("Falha ao obter URL publica do original:", err?.code, err?.message);
            }
          }
          continue;
        }

        const previewFile = await gerarPreviewDesfocado(arquivo);
        const previewPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/preview/${nomeArquivo}`;
        const previewUpload = await subirArquivoStorage(previewPath, previewFile);
        novosPreviewPaths.push(previewPath);

        if (isRenderableUrl(previewUpload?.url)) {
          novasPreviewUrls.push(previewUpload.url);
        } else {
          try {
            const previewUrl = await resolverUrlArquivo(previewPath);
            if (isRenderableUrl(previewUrl)) {
              novasPreviewUrls.push(previewUrl);
            }
          } catch (err) {
            console.warn("Falha ao obter URL de preview:", err?.code, err?.message);
          }
        }
      }

      const imagensOriginaisPaths = [...pathsOriginaisMantidos, ...novosOriginaisPaths];
      if (!imagensOriginaisPaths.length) {
        throw new Error(`O ${nomeBlocoSingular} precisa ter ao menos uma imagem.`);
      }

      let imagensPreviewPaths = [];
      let imagensOriginaisPublicas = [];
      let imagensPreview = [];
      let imagens = [];

      if (isPublicoFinal) {
        // Ao tornar publico, remove previews remotos antigos para evitar lixo no bucket.
        pathsParaExcluir.push(...pathsPreviewsMantidos);

        const urlsPublicas = [];
        for (const path of imagensOriginaisPaths) {
          try {
            const url = await resolverUrlArquivo(path);
            urlsPublicas.push(url);
          } catch (err) {
            console.warn("Falha ao resolver URL publica do original:", path, err?.code);
          }
        }

        imagensOriginaisPublicas = urlsPublicas.length
          ? urlsPublicas
          : [...urlsPublicasMantidas, ...novasPublicasUrls].filter(isRenderableUrl);
        imagensPreviewPaths = [];
        imagensPreview = [];
        imagens = imagensOriginaisPublicas;
      } else {
        imagensPreviewPaths = [...pathsPreviewsMantidos, ...novosPreviewPaths];
        imagensPreview = [...urlsPreviewsMantidas, ...novasPreviewUrls].filter(isRenderableUrl);
        imagensOriginaisPublicas = [];
        imagens = imagensPreview;
      }

      const payload = {
        visibilidade: visibilidadeFinal,
        precoCentavos: precoCentavos || null,
        moeda: moedaFinal,
        imagensOriginaisPaths,
        imagensPreviewPaths,
        imagensOriginaisPublicas,
        imagensPreview,
        imagens,
      };

      await updateDoc(getBlocoDocRef(bloco), payload);

      const pathsExclusaoUnicos = [...new Set(pathsParaExcluir)].filter(
        (path) => typeof path === "string" && path.includes("/")
      );
      for (const path of pathsExclusaoUnicos) {
        try {
          await excluirArquivoStorage(path);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir imagem removida:", path, err?.message);
          }
        }
      }

      setBlocos((prev) =>
        prev.map((item) => (item.id === blocoId ? { ...item, ...payload } : item))
      );
      setOriginaisPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setPreviewsPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      backfilledPublicUrlsRef.current.delete(blocoId);
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
      setReloadNonce((n) => n + 1);
      return true;
    } catch (err) {
      console.error("Erro ao atualizar bloco:", err);
      setErroAcaoBloco(err?.message || `Falha ao atualizar ${nomeBlocoSingular}.`);
      return false;
    } finally {
      setBlocoEmAtualizacaoId(null);
    }
  };

  const excluirBloco = async (blocoId) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o administrador pode excluir ${nomeBlocoPlural}.`);
      return;
    }

    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return;

    const confirmou = window.confirm(`Excluir este ${nomeBlocoSingular}?`);
    if (!confirmou) return;

    setErroAcaoBloco("");
    setBlocoEmExclusaoId(blocoId);

    try {
      const pathsOriginais = normalizarListaImagens(bloco.imagensOriginaisPaths);
      const pathsPreviews = normalizarListaImagens(bloco.imagensPreviewPaths);
      const allPaths = [...new Set([...pathsOriginais, ...pathsPreviews])]
        .filter((path) => typeof path === "string" && path.includes("/"));

      for (const path of allPaths) {
        try {
          await excluirArquivoStorage(path);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir arquivo do bloco:", path, err?.message);
          }
        }
      }

      if (bloco?.tipo === "cards") {
        const cardsRef = bloco.__legacy
          ? collection(db, "blocos", bloco.id, "cards")
          : collection(
              db,
              "users",
              ownerUserId,
              "espacos",
              espacoId,
              "blocos",
              bloco.id,
              "cards"
            );
        const cardsSnap = await getDocs(cardsRef);
        for (const cardDoc of cardsSnap.docs) {
          await deleteDoc(cardDoc.ref);
        }
      }

      await deleteDoc(getBlocoDocRef(bloco));

      setBlocos((prev) => prev.filter((item) => item.id !== blocoId));
      setOriginaisPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setPreviewsPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setCompradorPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      backfilledPublicUrlsRef.current.delete(blocoId);
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
    } catch (err) {
      console.error("Erro ao excluir bloco:", err);
      setErroAcaoBloco(err?.message || `Falha ao excluir ${nomeBlocoSingular}.`);
    } finally {
      setBlocoEmExclusaoId(null);
    }
  };

  return (
    <div>
      {podeGerenciar && (
        <CriadorBloco
          onCreate={adicionarBloco}
          espacoAtual={espacoAtual}
          skinIdAtual={skinIdAtual}
          podeCriarOverride={podeGerenciar}
        />
      )}

      {!!erroBlocos && <p style={{ color: "red" }}>{erroBlocos}</p>}
      {!!erroAcaoBloco && <p style={{ color: "red" }}>{erroAcaoBloco}</p>}

      {!acessoEspacoResolvido && carregamentoAcessoEspacoJSX}

      {acessoEspacoResolvido && !podeVerEspaco && (
        <div className="espaco-restricao-wrapper">
          {avatarMensagemRestricao ? (
            <img
              src={avatarMensagemRestricao}
              alt="Avatar da mensagem"
              className="espaco-restricao-avatar"
            />
          ) : null}

          <div className="espaco-restricao-balao">
            {avatarMensagemRestricao ? (
              <span aria-hidden="true" className="espaco-restricao-balao-ponteiro" />
            ) : null}

            <p className="espaco-restricao-texto" style={estiloMensagemRestricaoEspaco}>
              {mensagemRestricaoEspaco}
            </p>
            {mostrarCtaRestricaoEspaco ? renderCtaRestricao(tipoRestricaoEspaco) : null}
          </div>
        </div>
      )}

      {acessoEspacoResolvido && podeVerEspaco && !!conteudoEspaco && (
        <div
          className="espaco-conteudo-html"
          style={{ marginBottom: 20 }}
          dangerouslySetInnerHTML={{ __html: conteudoEspaco }}
        />
      )}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        blocos.map((bloco) => {
          const blocoEhCards = bloco?.tipo === "cards";
          const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
          const tituloBloco = String(bloco?.titulo || bloco?.nome || "").trim();
          const iconeBloco = String(bloco?.icone || bloco?.iconUrl || "").trim();
          const visivel = podeVerBloco(bloco);
          const bloqueado = !visivel;
          const tipoRestricao = tipoRestricaoBloco(bloco);
          const sessaoChatBloco = sessaoChatPorBloco[bloco.id] || null;
          const precoCompradorFormatado =
            tipoRestricao === "comprador" && currentUid
              ? formatarPreco(bloco?.precoCentavos, bloco?.moeda || "BRL")
              : null;

          const previewsDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
          const previewsResolvidas = Array.isArray(previewsPorBloco[bloco.id])
            ? previewsPorBloco[bloco.id]
            : [];
          const previews = [...new Set([...previewsDoc, ...previewsResolvidas])];
          const originalsAutorizadas = Array.isArray(originaisPorBloco[bloco.id])
            ? originaisPorBloco[bloco.id]
            : [];
          const originaisPublicas = normalizarListaImagens(bloco.imagensOriginaisPublicas)
            .filter(isRenderableUrl);
          const fallbackLegado = normalizarListaImagens(bloco.imagens);
          const imagensBloqueadas = previews;
          const pathsOriginaisEditor = normalizarListaImagens(bloco.imagensOriginaisPaths);
          const pathsPreviewEditor = normalizarListaImagens(bloco.imagensPreviewPaths);
          const totalImagensEditor = Math.max(
            pathsOriginaisEditor.length,
            pathsPreviewEditor.length,
            originalsAutorizadas.length,
            originaisPublicas.length,
            previews.length,
            fallbackLegado.length
          );
          const imagensEditor = Array.from({ length: totalImagensEditor }, (_, index) => ({
            index,
            originalPath: pathsOriginaisEditor[index] || null,
            previewPath: pathsPreviewEditor[index] || null,
            displayUrl:
              originalsAutorizadas[index] ||
              originaisPublicas[index] ||
              previews[index] ||
              fallbackLegado[index] ||
              null,
          })).filter((item) => item.originalPath || item.previewPath || item.displayUrl);

          const imagensParaExibir = blocoEhCards
            ? []
            : bloqueado
            ? imagensBloqueadas
            : originalsAutorizadas.length
              ? originalsAutorizadas
              : originaisPublicas.length
                ? originaisPublicas
              : previews.length
                ? previews
                : fallbackLegado;

          return (
            <Container
              key={bloco.id}
              titulo={tituloBloco}
              iconUrl={iconeBloco}
              variante="home"
              className="bloco-imagem"
            >
              {!!imagensParaExibir.length && (
                <div
                  style={{
                    filter: bloqueado ? "blur(10px)" : "none",
                    opacity: bloqueado ? 0.7 : 1,
                    transition: "filter 150ms ease",
                  }}
                >
                  {imagensParaExibir.map((url, i) => (
                    <img
                      key={`${bloco.id}-${i}`}
                      src={url}
                      alt=""
                      style={{ maxWidth: "200px", margin: "4px" }}
                    />
                  ))}
                </div>
              )}

              {blocoEhCards && !bloqueado && !!cardsDoBloco.length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {cardsDoBloco.map((card, cardIndex) => {
                    const imagemCardResolvida =
                      imagensCardsPorBloco?.[bloco.id]?.[card.id] || "";
                    const imagemCardFinal = isRenderableUrl(card.imagem)
                      ? card.imagem
                      : imagemCardResolvida || "/logoNeon.png";
                    return (
                    <Card
                      key={`${bloco.id}-card-${card.id || cardIndex}`}
                      id={card.id || `${bloco.id}-card-${cardIndex}`}
                      ownerUserId={ownerUserId}
                      espacoId={espacoId}
                      blocoId={bloco.id}
                      nome={card.nome || `Card ${cardIndex + 1}`}
                      nomeDescricao={card.nome || ""}
                      descricao={card.descricao || ""}
                      linkExterno={card.linkExterno || ""}
                      imagem={imagemCardFinal}
                      idNome={`${bloco.id}-card-${cardIndex}`}
                      cardDescricaoDiv="cardDescricaoDivHome"
                      cardNome="cardNomeHome"
                      cardContainerDesktop="cardContainerDesktopHome"
                      cardCabecalho="cardCabecalhoHome"
                      cardImagem="cardImagemHome"
                      cardDescricao="cardDescricaoHome"
                      imgCard="imgCardHome"
                    />
                    );
                  })}
                </div>
              )}

              {!!precoCompradorFormatado && (
                <p style={{ margin: "6px 0 8px" }}>
                  Valor: <strong>{precoCompradorFormatado}</strong>
                </p>
              )}

              {bloqueado && !imagensParaExibir.length && (
                <div
                  style={{
                    width: 200,
                    height: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #2f2f2f, #5c5c5c)",
                    color: "#f0f0f0",
                    borderRadius: 6,
                    filter: "blur(1px)",
                  }}
                >
                  Preview protegido
                </div>
              )}

              {bloqueado && (
                <div style={{ marginTop: 8 }}>
                  <p>{`Conteudo restrito do ${nomeBlocoSingular}.`}</p>
                  {renderCtaRestricao(tipoRestricao, bloco)}
                </div>
              )}

              {!bloqueado && sessaoChatBloco?.contactId ? (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => abrirChatSessaoBloco(bloco.id)}>
                    Abrir chat da sessao
                  </button>
                </div>
              ) : null}

              {podeGerenciar && !blocoEhCards && (
                <EditorBloco
                  bloco={bloco}
                  imagensEditor={imagensEditor}
                  onSalvar={(updates) => atualizarBloco(bloco.id, updates)}
                  onExcluir={() => excluirBloco(bloco.id)}
                  salvando={blocoEmAtualizacaoId === bloco.id}
                  excluindo={blocoEmExclusaoId === bloco.id}
                />
              )}

              {podeGerenciar && blocoEhCards && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => excluirBloco(bloco.id)}
                    disabled={blocoEmExclusaoId === bloco.id}
                    style={{ color: "red" }}
                  >
                    {blocoEmExclusaoId === bloco.id
                      ? `Excluindo ${nomeBlocoSingularCapitalizado}...`
                      : `Excluir ${nomeBlocoSingularCapitalizado}`}
                  </button>
                </div>
              )}
            </Container>
          );
        })}
    </div>
  );
}
