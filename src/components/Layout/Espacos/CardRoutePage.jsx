import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";

import Card from "../Objects/Objetos/Card";
import { activeFirebaseProjectKey, auth, db, storage } from "../../Banco/init-firebase";
import {
  getLegacyProjectCollection,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { isProjectDataNamespaced } from "../../Banco/projectDataNamespace";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
  obterOwnerUidConfigurado,
} from "../Sistema/configSistema";
import {
  aplicarSeoPublico,
  limparTextoSeo,
  obterUrlAbsoluta,
} from "../Sistema/seoUtils";
import { listarAddOnsDoUsuarioProjeto } from "../Sistema/gerenciadorProjetosApi";
import {
  obterUrlArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import { normalizeCyberpinkSubtheme } from "../Temas/cyberpink/subthemes";
import QRCodeImage from "../../Funcionalidades/QRCode/QRCodeImage";
import { normalizarCardAly137 } from "../Sistema/aly137Utils";

const isRenderableUrl = (valor) =>
  typeof valor === "string" &&
  (
    valor.startsWith("https://") ||
    valor.startsWith("http://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:image/")
  );

const namespaceAtivoProjeto = () => isProjectDataNamespaced(activeFirebaseProjectKey);

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

const normalizarAddOnSubthemes = (value, validIds = []) => {
  if (!value || typeof value !== "object") return {};

  const validIdSet = new Set(
    Array.isArray(validIds)
      ? validIds.map((item) => String(item || "").trim()).filter(Boolean)
      : []
  );

  return Object.entries(value).reduce((acc, [addOnId, subtheme]) => {
    const addOnIdNormalizado = String(addOnId || "").trim();
    if (!addOnIdNormalizado) return acc;
    if (validIdSet.size && !validIdSet.has(addOnIdNormalizado)) return acc;

    const bruto = String(subtheme || "").trim().toLowerCase();
    if (!bruto || bruto === "space" || bruto === "default" || bruto === "padrao") {
      return acc;
    }

    acc[addOnIdNormalizado] = normalizeCyberpinkSubtheme(bruto);
    return acc;
  }, {});
};

const obterDescricaoPreviaCard = (card = {}) =>
  String(card?.descricaoPrevia || card?.descricao || "").trim();

const obterDescricaoCompletaCard = (card = {}) =>
  String(card?.descricaoCompleta || obterDescricaoPreviaCard(card)).trim();

const normalizarAtributoPersonalizadoCard = (valor = {}) => {
  const fonte = valor && typeof valor === "object" ? valor : {};
  const rotulo = String(
    fonte?.rotulo ||
      fonte?.textoExibido ||
      fonte?.textoMostrado ||
      fonte?.label ||
      fonte?.titulo ||
      ""
  ).trim();
  const nome = String(
    fonte?.nome ||
      fonte?.nomeAtributo ||
      fonte?.atributo ||
      fonte?.chave ||
      fonte?.key ||
      fonte?.name ||
      ""
  ).trim();
  const valorAtributo = String(
    fonte?.valor ||
      fonte?.value ||
      fonte?.texto ||
      fonte?.conteudo ||
      ""
  ).trim();

  if (!rotulo && !nome && !valorAtributo) return null;
  return {
    rotulo,
    nome,
    valor: valorAtributo,
  };
};

const normalizarCard = (card = {}, index = 0) => {
  const addOnIds = normalizarAddOnIds(card?.addOnIds || card?.addOnsIds || card?.addons);
  const possuiCampoAddOns =
    Array.isArray(card?.addOnIds) ||
    Array.isArray(card?.addOnsIds) ||
    Array.isArray(card?.addons) ||
    (card?.addOnSubthemes && typeof card.addOnSubthemes === "object");

  return {
    id: String(card?.id || `card_${index}`).trim(),
    ordem: Number.isFinite(Number(card?.ordem)) ? Number(card.ordem) : index,
    nome: String(card?.nome || "").trim(),
    descricaoExtra: String(card?.descricaoExtra || "").trim(),
    descricaoPrevia: obterDescricaoPreviaCard(card),
    descricaoCompleta: obterDescricaoCompletaCard(card),
    descricao: obterDescricaoPreviaCard(card),
    imagem: String(card?.imagem || "").trim(),
    imagemPath: String(card?.imagemPath || "").trim(),
    linkExterno: String(card?.linkExterno || "").trim(),
    atributoPersonalizado: normalizarAtributoPersonalizadoCard(
      card?.atributoPersonalizado ||
        card?.atributoCustomizado ||
        card?.customAttribute
    ),
    addOnIds,
    addOnSubthemes: normalizarAddOnSubthemes(
      card?.addOnSubthemes || card?.addOnThemes,
      addOnIds
    ),
    aly137: normalizarCardAly137(card?.aly137, addOnIds),
    usaAddOnsGerenciador: possuiCampoAddOns,
  };
};

const normalizarCardsDoBloco = (valor) =>
  Array.isArray(valor)
    ? valor
        .map((card, index) => normalizarCard(card, index))
        .filter(
          (card) =>
            card.nome ||
            card.descricaoExtra ||
            card.descricaoPrevia ||
            card.descricaoCompleta ||
            card.descricao ||
            card.imagem ||
            card.imagemPath ||
            card.linkExterno ||
            card.atributoPersonalizado ||
            card.addOnIds.length
        )
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    : [];

const getFirstExistingDoc = async (refs = []) => {
  for (const refItem of refs) {
    const snapshot = await getDoc(refItem).catch(() => null);
    if (snapshot?.exists?.()) return snapshot;
  }
  return null;
};

const getBlocoDocRefs = (ownerUserId, espacoId, blocoId) =>
  getProjectDocCandidates(db, "users", ownerUserId, "espacos", espacoId, "blocos", blocoId);

const getBlocoCardDocRefs = (ownerUserId, espacoId, blocoId, cardId) =>
  getProjectDocCandidates(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "cards",
    cardId
  );

async function resolverUrlArquivo(path, user) {
  if (usandoBucketCompartilhadoCrossProject()) {
    return obterUrlArquivoNoBucketCompartilhado({ user, path });
  }
  return getDownloadURL(ref(storage, path));
}

export default function CardRoutePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { skinsUsername, espacoNome, blocoId, cardId } = useParams();
  const {
    espacos = [],
    user,
    oneOwnerPublicaAtiva: oneOwnerPublicaAtivaContexto = false,
  } = useOutletContext() || {};
  const [estado, setEstado] = useState({
    loading: true,
    erro: "",
    bloco: null,
    card: null,
    imagem: "",
    addOns: [],
  });

  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const espacoAtual = useMemo(
    () =>
      (Array.isArray(espacos) ? espacos : []).find(
        (item) =>
          String(item?.nome || "").trim() === String(espacoNome || "").trim() ||
          String(item?.id || item?.id_espaco || "").trim() === String(espacoNome || "").trim()
      ) || null,
    [espacoNome, espacos]
  );

  const ownerUserId = String(
    espacoAtual?.ownerUserId ||
      obterOwnerUidConfigurado(configSistema) ||
      auth.currentUser?.uid ||
      ""
  ).trim();
  const espacoId = String(espacoAtual?.id || espacoAtual?.id_espaco || espacoNome || "").trim();
  const rotaEspacoPublicado = useMemo(() => {
    const espacoSegment = encodeURIComponent(String(espacoNome || "").trim());
    const skinSegment = encodeURIComponent(String(skinsUsername || "").trim());
    if (!espacoSegment) return "";
    if (oneOwnerPublicaAtivaContexto || !skinSegment) return `/${espacoSegment}`;
    return `/${skinSegment}/${espacoSegment}`;
  }, [espacoNome, oneOwnerPublicaAtivaContexto, skinsUsername]);
  const urlCardAtual = useMemo(() => {
    const pathAtual = `${location.pathname || ""}${location.search || ""}`;
    try {
      return new URL(pathAtual, window.location.origin).href;
    } catch {
      return pathAtual;
    }
  }, [location.pathname, location.search]);

  const voltarParaEspacoPublicado = () => {
    if (rotaEspacoPublicado) {
      navigate(rotaEspacoPublicado);
      return;
    }
    navigate(-1);
  };

  useEffect(() => {
    const bodyOverflowAnterior = document.body.style.overflow;
    const htmlOverflowAnterior = document.documentElement.style.overflow;
    const bodyOverscrollAnterior = document.body.style.overscrollBehavior;
    const htmlOverscrollAnterior = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = bodyOverflowAnterior;
      document.documentElement.style.overflow = htmlOverflowAnterior;
      document.body.style.overscrollBehavior = bodyOverscrollAnterior;
      document.documentElement.style.overscrollBehavior = htmlOverscrollAnterior;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregarCard() {
      if (!blocoId || !cardId) {
        setEstado((prev) => ({
          ...prev,
          loading: false,
          erro: "Rota de card incompleta.",
        }));
        return;
      }

      if (!ownerUserId || !espacoId) {
        setEstado((prev) => ({
          ...prev,
          loading: false,
          erro: "Nao foi possivel identificar o projeto deste card.",
        }));
        return;
      }

      try {
        const usarFallbackGlobal = !namespaceAtivoProjeto();
        const blocoSnapshot = await getFirstExistingDoc([
          ...getBlocoDocRefs(ownerUserId, espacoId, blocoId),
          ...(usarFallbackGlobal ? [doc(db, "blocos", blocoId)] : []),
        ]);
        const blocoData = blocoSnapshot?.exists?.()
          ? { id: blocoSnapshot.id, ...blocoSnapshot.data() }
          : null;

        const cardSnapshot = await getFirstExistingDoc([
          ...getBlocoCardDocRefs(ownerUserId, espacoId, blocoId, cardId),
          ...(usarFallbackGlobal ? [doc(collection(db, "blocos", blocoId, "cards"), cardId)] : []),
        ]);

        let cardData = cardSnapshot?.exists?.()
          ? normalizarCard({ id: cardSnapshot.id, ...cardSnapshot.data() })
          : null;

        if (!cardData && blocoData) {
          const cardsDoBloco = normalizarCardsDoBloco(blocoData.cards);
          cardData =
            cardsDoBloco.find((item) => String(item.id) === String(cardId)) ||
            cardsDoBloco[Number(cardId)] ||
            null;
        }

        if (!cardData && usarFallbackGlobal) {
          const legacyCardsSnap = await getDocs(
            getLegacyProjectCollection(db, "users", ownerUserId, "espacos", espacoId, "blocos", blocoId, "cards")
          ).catch(() => null);
          const legacyCards = normalizarCardsDoBloco(
            legacyCardsSnap?.docs?.map((item) => ({ id: item.id, ...item.data() })) || []
          );
          cardData =
            legacyCards.find((item) => String(item.id) === String(cardId)) ||
            legacyCards[Number(cardId)] ||
            null;
        }

        if (!cardData) {
          throw new Error("Card nao encontrado.");
        }

        let imagemFinal = isRenderableUrl(cardData.imagem) ? cardData.imagem : "";
        if (!imagemFinal && cardData.imagemPath) {
          imagemFinal = await resolverUrlArquivo(cardData.imagemPath, user).catch(() => "");
        }
        if (!imagemFinal) imagemFinal = "/logoNeon.png";

        let addOns = [];
        if (cardData.addOnIds.length && ownerUserId) {
          const addOnsDisponiveis = await listarAddOnsDoUsuarioProjeto({
            ownerUserId,
            onlyActive: true,
          }).catch(() => []);
          const porId = new Map(addOnsDisponiveis.map((item) => [String(item.id), item]));
          addOns = cardData.addOnIds.map((id) => porId.get(String(id))).filter(Boolean);
        }

        if (cancelado) return;
        setEstado({
          loading: false,
          erro: "",
          bloco: blocoData,
          card: cardData,
          imagem: imagemFinal,
          addOns,
        });
      } catch (error) {
        if (cancelado) return;
        setEstado({
          loading: false,
          erro: error?.message || "Falha ao carregar card.",
          bloco: null,
          card: null,
          imagem: "",
          addOns: [],
        });
      }
    }

    carregarCard();

    return () => {
      cancelado = true;
    };
  }, [blocoId, cardId, espacoId, ownerUserId, user]);

  useEffect(() => {
    if (estado.loading) return;

    const tituloSistema = limparTextoSeo(
      configSistema?.tituloSistema || DEFAULT_SISTEMA_CONFIG.tituloSistema,
      80
    );
    const cardNome = limparTextoSeo(estado.card?.nome || "Card", 90);
    const blocoNome = limparTextoSeo(
      estado.bloco?.titulo || estado.bloco?.nome || "",
      80
    );
    const tituloSeo = estado.card
      ? `${cardNome} | ${tituloSistema}`
      : `Card indisponivel | ${tituloSistema}`;
    const descricaoSeo = limparTextoSeo(
      [
        estado.card?.descricaoExtra,
        estado.card?.descricaoCompleta,
        estado.card?.descricaoPrevia,
        estado.card?.descricao,
        blocoNome,
        configSistema?.seoDescricaoPublica,
      ].join(" "),
      300
    );
    const canonicalUrl =
      typeof window !== "undefined"
        ? new URL(location.pathname || "/", window.location.origin).href
        : location.pathname || "/";
    const visibilidadeEspaco = String(espacoAtual?.visibilidade || "publico").toLowerCase();
    const visibilidadeBloco = String(estado.bloco?.visibilidade || "publico").toLowerCase();
    const indexable =
      Boolean(estado.card) &&
      configSistema?.seoBuscaGoogleLiberada === true &&
      configSistema?.seoIndexacaoPublica === true &&
      (!visibilidadeEspaco || visibilidadeEspaco === "publico") &&
      (!visibilidadeBloco || visibilidadeBloco === "publico");

    aplicarSeoPublico({
      title: tituloSeo,
      description: descricaoSeo || configSistema?.seoDescricaoPublica || tituloSistema,
      image: estado.imagem || configSistema?.seoImagemUrl || configSistema?.logoLoginUrl,
      url: canonicalUrl,
      siteName: tituloSistema,
      type: "article",
      indexable,
      jsonLd: estado.card
        ? {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: cardNome,
            description: descricaoSeo || tituloSistema,
            image: estado.imagem ? obterUrlAbsoluta(estado.imagem) : undefined,
            url: obterUrlAbsoluta(canonicalUrl),
            inLanguage: "pt-BR",
            isPartOf: {
              "@type": "WebSite",
              name: tituloSistema,
              url:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "",
            },
          }
        : null,
    });
  }, [
    configSistema,
    espacoAtual?.visibilidade,
    estado.bloco,
    estado.card,
    estado.erro,
    estado.imagem,
    estado.loading,
    location.pathname,
  ]);

  if (estado.loading) {
    return (
      <main className="card-route-page" aria-live="polite">
        <p className="card-route-page__status">Carregando card...</p>
      </main>
    );
  }

  if (estado.erro || !estado.card) {
    return (
      <main className="card-route-page" aria-live="polite">
        <div className="card-route-page__error">
          <strong>Card indisponivel</strong>
          <p>{estado.erro || "Nao foi possivel abrir este card."}</p>
          <button type="button" onClick={voltarParaEspacoPublicado}>
            Voltar para o espaco
          </button>
        </div>
      </main>
    );
  }

  const descricaoCompletaCard = String(
    estado.card.descricaoCompleta ||
      estado.card.descricaoPrevia ||
      estado.card.descricao ||
      ""
  ).trim();
  const descricaoCompletaParagrafos = descricaoCompletaCard
    .split(/\n{2,}/)
    .map((texto) => texto.trim())
    .filter(Boolean);
  const atributoPersonalizadoCard = normalizarAtributoPersonalizadoCard(
    estado.card?.atributoPersonalizado
  );

  return (
    <main
      className="card-route-page"
      data-skins-username={skinsUsername || ""}
      data-public-oneowner={oneOwnerPublicaAtivaContexto ? "true" : "false"}
    >
      <div className="card-route-page__viewer">
        <button
          type="button"
          className="card-route-page__back"
          onClick={voltarParaEspacoPublicado}
          aria-label="Voltar para o espaco"
          title="Voltar para o espaco"
        >
          <svg
            className="card-route-page__back-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M10.6 5 4 11.6l6.6 6.6 1.4-1.4-4.2-4.2H20v-2H7.8L12 6.4 10.6 5Z" />
          </svg>
        </button>
        <div className="card-route-page__stage">
          <Card
            id={estado.card.id}
            ownerUserId={ownerUserId}
            espacoId={espacoId}
            blocoId={blocoId}
            addOnIds={estado.card.addOnIds}
            addOnSubthemes={estado.card.addOnSubthemes}
            usaAddOnsGerenciador={estado.card.usaAddOnsGerenciador}
            addOns={estado.addOns}
            aly137={estado.card.aly137}
            cyberpinkSubtheme={normalizeCyberpinkSubtheme(espacoAtual?.subtema)}
            nome={estado.card.nome || "Card"}
            descricaoExtra={estado.card.descricaoExtra || ""}
            nomeDescricao={estado.card.nome || ""}
            descricao={descricaoCompletaCard}
            atributoPersonalizado={atributoPersonalizadoCard}
            linkExterno={estado.card.linkExterno || ""}
            imagem={estado.imagem}
            idNome={`card-route-${blocoId}-${estado.card.id}`}
            cardDescricaoDiv="cardDescricaoDiv"
            cardNome="cardNome"
            cardContainerDesktop="cardContainerDesktop"
            cardCabecalho="cardCabecalho"
            cardImagem="cardImagem"
            cardDescricao="cardDescricao"
            imgCard="imgCard"
          />
        </div>
        <aside className="card-route-page__details" aria-label="Detalhes do card">
          <span className="card-route-page__details-kicker">Card ampliado</span>
          <h1>{estado.card.nome || "Card"}</h1>
          {estado.card.descricaoExtra ? <p>{estado.card.descricaoExtra}</p> : null}
          {atributoPersonalizadoCard ? (
            <p className="card-route-page__custom-attribute">
              {atributoPersonalizadoCard.rotulo || atributoPersonalizadoCard.nome ? (
                <strong>{atributoPersonalizadoCard.rotulo || atributoPersonalizadoCard.nome}</strong>
              ) : null}
              {atributoPersonalizadoCard.valor ? (
                <span>{atributoPersonalizadoCard.valor}</span>
              ) : null}
            </p>
          ) : null}
          {descricaoCompletaParagrafos.length ? (
            <section className="card-route-page__full-description">
              {descricaoCompletaParagrafos.map((paragrafo, index) => (
                <p key={`${estado.card.id || "card"}-descricao-${index}`}>
                  {paragrafo}
                </p>
              ))}
            </section>
          ) : null}
          <dl>
            <div>
              <dt>Bloco</dt>
              <dd>{estado.bloco?.titulo || estado.bloco?.nome || blocoId}</dd>
            </div>
            <div>
              <dt>Add-ons</dt>
              <dd>{estado.addOns.length}</dd>
            </div>
          </dl>
          {estado.addOns.length ? (
            <div className="card-route-page__addons">
              {estado.addOns.map((addOn) => (
                <span key={addOn.id} className="card-route-page__addon">
                  {addOn.url_img ? <img src={addOn.url_img} alt="" /> : null}
                  <span>{addOn.nome || "Add-on"}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="card-route-page__empty">Nenhum add-on vinculado.</span>
          )}
          {estado.card.linkExterno ? (
            <a
              className="card-route-page__external"
              href={estado.card.linkExterno}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir link externo
            </a>
          ) : null}
          {urlCardAtual ? (
            <div className="card-route-page__qr">
              <QRCodeImage
                value={urlCardAtual}
                size={72}
                alt="QR code da visualizacao unica do card"
                color="var(--cyberpink-subtheme-card-surface-shadow)"
                bgColor="var(--cyberpink-subtheme-text)"
              />
              <span>QR da rota unica</span>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
