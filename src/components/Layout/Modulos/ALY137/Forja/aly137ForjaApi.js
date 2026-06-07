import { serverTimestamp, setDoc } from "firebase/firestore";
import {
  calcularResumoAddOnsAly137DeCards,
  criarPayloadCardAly137,
} from "../../../Sistema/aly137Utils";
import { registrarAuditLog } from "../../../Sistema/auditLogsApi";
import { salvarResumoAly137AddOnsUsuarioProjeto } from "../../../Sistema/gerenciadorProjetosApi";

export async function criarCardForjadoAly137({
  podeGerenciar = false,
  blocosDestino = [],
  modal = {},
  cardsSelecionados = [],
  addOnIdsDiretos = [],
  addOnIdsEfetivos = [],
  addOnsDisponiveis = [],
  aly137Habilitado = false,
  blocos = [],
  normalizarCardsDoBloco,
  gerarIdCard,
  getBlocoCardDocRef,
  persistirCardsDoBloco,
  espacoId = "",
  ownerUserId = "",
  currentUidAutenticado = "",
  projectId = "",
  user = null,
} = {}) {
  if (!podeGerenciar) {
    throw new Error("Sem permissao para criar card.");
  }
  if (typeof normalizarCardsDoBloco !== "function") {
    throw new Error("Normalizador de cards indisponivel para a Forja.");
  }
  if (typeof gerarIdCard !== "function") {
    throw new Error("Gerador de ID indisponivel para a Forja.");
  }
  if (typeof getBlocoCardDocRef !== "function") {
    throw new Error("Referencia de card indisponivel para a Forja.");
  }
  if (typeof persistirCardsDoBloco !== "function") {
    throw new Error("Persistencia de cards indisponivel para a Forja.");
  }

  const bloco = (Array.isArray(blocosDestino) ? blocosDestino : []).find(
    (item) => String(item?.id || "") === String(modal?.blocoDestinoId || "")
  );
  if (!bloco?.id) {
    throw new Error("Selecione um bloco de destino.");
  }
  if (!cardsSelecionados.length && !addOnIdsDiretos.length) {
    throw new Error("Arraste ao menos um card ou chip para a forja.");
  }

  const cardId = gerarIdCard();
  const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
  const addOnIds = Array.isArray(addOnIdsEfetivos) ? addOnIdsEfetivos : [];
  const aly137Payload = criarPayloadCardAly137({
    evidencias: [],
    cardsOrigem: cardsSelecionados,
    validAddOnIds: addOnIds,
  });
  const primeiroCard = cardsSelecionados[0] || {};
  const descricaoForja = String(modal?.descricao || "").trim();
  const payload = {
    id: cardId,
    ordem: cardsDoBloco.length,
    nome: String(modal?.nome || "").trim() || "Card forjado",
    descricaoExtra: "FORJA",
    descricaoPrevia: descricaoForja,
    descricaoCompleta: descricaoForja,
    descricao: descricaoForja,
    imagem: String(primeiroCard?.imagem || "").trim() || "/logoNeon.png",
    imagemPath: "",
    linkExterno: "",
    addOnIds,
    addOnSubthemes: {},
    usaAddOnsGerenciador: true,
    aly137: aly137Payload,
  };

  const cardRef = getBlocoCardDocRef(bloco, cardId);
  if (!cardRef) throw new Error("Nao foi possivel localizar a referencia do card.");

  await setDoc(cardRef, {
    ...payload,
    blocoId: bloco.id,
    espacoId,
    ownerUserId,
    criadoEm: serverTimestamp(),
  });

  const cardsPersistidos = await persistirCardsDoBloco(bloco, [...cardsDoBloco, payload]);

  if (aly137Habilitado && ownerUserId) {
    const blocosParaResumoAly137 = (Array.isArray(blocos) ? blocos : []).map((item) =>
      String(item?.id || "") === String(bloco.id)
        ? { ...item, cards: cardsPersistidos }
        : item
    );
    const cardsParaResumoAly137 = blocosParaResumoAly137.flatMap((item) => {
      const blocoResumoId = String(item?.id || "").trim();
      const blocoResumoTitulo = String(item?.titulo || item?.nome || blocoResumoId || "Bloco").trim();
      return normalizarCardsDoBloco(item?.cards).map((cardResumo) => ({
        ...cardResumo,
        blocoId: blocoResumoId,
        blocoTitulo: blocoResumoTitulo,
      }));
    });
    const resumosAddOnsAly137 = calcularResumoAddOnsAly137DeCards({
      cards: cardsParaResumoAly137,
      addOns: addOnsDisponiveis,
    });
    await salvarResumoAly137AddOnsUsuarioProjeto({
      ownerUserId,
      resumos: resumosAddOnsAly137,
      atualizadoPorUid: currentUidAutenticado,
    }).catch((err) => {
      console.warn("Falha ao sincronizar XP dos add-ons apos forja:", err?.message || err);
    });
  }

  await registrarAuditLog({
    action: "criou_card_forjado_inventario",
    entityType: "card",
    entityId: cardId,
    entityPath: `espacos/${espacoId}/blocos/${bloco.id}/cards/${cardId}`,
    projectId: String(projectId || "").trim() || null,
    ownerUserId,
    user,
    metadata: {
      nome: payload.nome,
      blocoId: bloco.id,
      totalCardsOrigem: cardsSelecionados.length,
      totalAddOnsDiretos: addOnIdsDiretos.length,
      xpTotal: aly137Payload?.xpTotal || 0,
    },
  });

  return {
    bloco,
    cardId,
    payload,
    aly137Payload,
    cardsPersistidos,
  };
}
