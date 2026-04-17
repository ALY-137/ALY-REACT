import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";

import Card from "../Objects/Objetos/Card";
import { auth, db, storage } from "../../Banco/init-firebase";
import {
  getLegacyProjectCollection,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
  obterOwnerUidConfigurado,
} from "../Sistema/configSistema";
import { listarAddOnsDoUsuarioProjeto } from "../Sistema/gerenciadorProjetosApi";
import {
  obterUrlArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import { normalizeCyberpinkSubtheme } from "../Temas/cyberpink/subthemes";

const isRenderableUrl = (valor) =>
  typeof valor === "string" &&
  (
    valor.startsWith("https://") ||
    valor.startsWith("http://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:image/")
  );

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
    descricao: String(card?.descricao || "").trim(),
    imagem: String(card?.imagem || "").trim(),
    imagemPath: String(card?.imagemPath || "").trim(),
    linkExterno: String(card?.linkExterno || "").trim(),
    addOnIds,
    addOnSubthemes: normalizarAddOnSubthemes(
      card?.addOnSubthemes || card?.addOnThemes,
      addOnIds
    ),
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
            card.descricao ||
            card.imagem ||
            card.imagemPath ||
            card.linkExterno ||
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

  const voltarParaEspacoPublicado = () => {
    if (rotaEspacoPublicado) {
      navigate(rotaEspacoPublicado);
      return;
    }
    navigate(-1);
  };

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
        const blocoSnapshot = await getFirstExistingDoc([
          ...getBlocoDocRefs(ownerUserId, espacoId, blocoId),
          doc(db, "blocos", blocoId),
        ]);
        const blocoData = blocoSnapshot?.exists?.()
          ? { id: blocoSnapshot.id, ...blocoSnapshot.data() }
          : null;

        const cardSnapshot = await getFirstExistingDoc([
          ...getBlocoCardDocRefs(ownerUserId, espacoId, blocoId, cardId),
          doc(collection(db, "blocos", blocoId, "cards"), cardId),
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

        if (!cardData) {
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
            nome={estado.card.nome || "Card"}
            descricaoExtra={estado.card.descricaoExtra || ""}
            nomeDescricao={estado.card.nome || ""}
            descricao={estado.card.descricao || ""}
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
      </div>
    </main>
  );
}
