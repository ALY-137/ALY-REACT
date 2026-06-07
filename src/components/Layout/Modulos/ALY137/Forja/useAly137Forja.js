import { useCallback, useMemo, useState } from "react";
import { calcularResumoAly137 } from "../../../Sistema/aly137Utils";

export const criarEstadoAly137Forja = (overrides = {}) => ({
  aberto: false,
  blocoDestinoId: "",
  nome: "",
  descricao: "",
  busca: "",
  cardKeys: [],
  cardAddOnIds: {},
  addOnIds: [],
  arrastando: null,
  criando: false,
  erro: "",
  returnTo: "",
  ...overrides,
});

const normalizarAddOnIds = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean))
  );
};

const normalizarTextoBusca = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const obterAddOnIdsDisponiveisCardOrigem = (card = {}) =>
  normalizarAddOnIds([
    ...(Array.isArray(card?.addOnIdsDisponiveis) ? card.addOnIdsDisponiveis : []),
    ...(Array.isArray(card?.addOnIds) ? card.addOnIds : []),
    ...Object.keys(card?.addOnsXp || {}),
  ]);

const filtrarAddOnsXpCardOrigem = (addOnsXp = {}, addOnIds = []) => {
  const ids = new Set(normalizarAddOnIds(addOnIds));
  if (!ids.size || !addOnsXp || typeof addOnsXp !== "object") return {};
  return Object.fromEntries(Object.entries(addOnsXp).filter(([addOnId]) => ids.has(addOnId)));
};

export default function useAly137Forja({
  cardsDisponiveis = [],
  addOnsDisponiveis = [],
  addOnsPorId = {},
  blocosDestino = [],
  resolverTipoAddOn = null,
  onReturn = null,
} = {}) {
  const [modal, setModal] = useState(() => criarEstadoAly137Forja());

  const cardsSelecionados = useMemo(() => {
    const selecionados = new Set(
      Array.isArray(modal?.cardKeys)
        ? modal.cardKeys.map((item) => String(item || "").trim()).filter(Boolean)
        : []
    );
    const mapaRelacionados =
      modal?.cardAddOnIds && typeof modal.cardAddOnIds === "object"
        ? modal.cardAddOnIds
        : {};

    return (Array.isArray(cardsDisponiveis) ? cardsDisponiveis : [])
      .filter((card) => selecionados.has(card.key))
      .map((card) => {
        const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigem(card);
        const temConfig = Object.prototype.hasOwnProperty.call(mapaRelacionados, card.key);
        const addOnIdsRelacionados = temConfig
          ? normalizarAddOnIds(mapaRelacionados[card.key]).filter((addOnId) =>
              addOnIdsDisponiveis.includes(addOnId)
            )
          : addOnIdsDisponiveis;
        return {
          ...card,
          addOnIdsDisponiveis,
          addOnIdsRelacionados,
          addOnIds: addOnIdsRelacionados,
          addOnsXp: filtrarAddOnsXpCardOrigem(card?.addOnsXp, addOnIdsRelacionados),
        };
      });
  }, [cardsDisponiveis, modal?.cardAddOnIds, modal?.cardKeys]);

  const addOnIdsHerdados = useMemo(
    () =>
      normalizarAddOnIds(
        cardsSelecionados.flatMap((card) => [
          ...(Array.isArray(card?.addOnIdsRelacionados) ? card.addOnIdsRelacionados : []),
          ...Object.keys(card?.addOnsXp || {}),
        ])
      ),
    [cardsSelecionados]
  );

  const addOnIdsDiretos = useMemo(
    () => normalizarAddOnIds(modal?.addOnIds),
    [modal?.addOnIds]
  );

  const addOnIdsEfetivos = useMemo(
    () => normalizarAddOnIds([...addOnIdsDiretos, ...addOnIdsHerdados]),
    [addOnIdsDiretos, addOnIdsHerdados]
  );

  const addOnsDiretos = useMemo(
    () => addOnIdsDiretos.map((addOnId) => addOnsPorId[addOnId]).filter(Boolean),
    [addOnIdsDiretos, addOnsPorId]
  );

  const resumo = useMemo(
    () =>
      calcularResumoAly137({
        evidencias: [],
        cardsOrigem: cardsSelecionados,
        validAddOnIds: addOnIdsEfetivos,
      }),
    [addOnIdsEfetivos, cardsSelecionados]
  );

  const cardsInventarioFiltrados = useMemo(() => {
    const busca = normalizarTextoBusca(modal?.busca);
    const origem = Array.isArray(cardsDisponiveis) ? cardsDisponiveis : [];
    if (!busca) return origem;
    return origem.filter((card) =>
      [card?.nome, card?.descricao, card?.espacoNome, card?.blocoTitulo, "card"]
        .map(normalizarTextoBusca)
        .some((texto) => texto.includes(busca))
    );
  }, [cardsDisponiveis, modal?.busca]);

  const addOnsInventarioFiltrados = useMemo(() => {
    const busca = normalizarTextoBusca(modal?.busca);
    const origem = Array.isArray(addOnsDisponiveis) ? addOnsDisponiveis : [];
    if (!busca) return origem;
    return origem.filter((addOn) =>
      [
        addOn?.nome,
        addOn?.descricao,
        typeof resolverTipoAddOn === "function" ? resolverTipoAddOn(addOn) : "",
        "chip",
        "add-on",
      ]
        .map(normalizarTextoBusca)
        .some((texto) => texto.includes(busca))
    );
  }, [addOnsDisponiveis, modal?.busca, resolverTipoAddOn]);

  const adicionarCard = useCallback((cardKey = "") => {
    const keyNormalizada = String(cardKey || "").trim();
    if (!keyNormalizada) return;
    const cardOrigem = (Array.isArray(cardsDisponiveis) ? cardsDisponiveis : []).find(
      (item) => item.key === keyNormalizada
    );
    const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigem(cardOrigem);

    setModal((prev) => {
      const atuais = Array.isArray(prev?.cardKeys)
        ? prev.cardKeys.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (atuais.includes(keyNormalizada)) return prev;
      return {
        ...prev,
        cardKeys: [...atuais, keyNormalizada],
        cardAddOnIds: {
          ...(prev?.cardAddOnIds && typeof prev.cardAddOnIds === "object" ? prev.cardAddOnIds : {}),
          [keyNormalizada]: addOnIdsDisponiveis,
        },
      };
    });
  }, [cardsDisponiveis]);

  const removerCard = useCallback((cardKey = "") => {
    const keyNormalizada = String(cardKey || "").trim();
    if (!keyNormalizada) return;
    setModal((prev) => {
      const atuais = Array.isArray(prev?.cardKeys)
        ? prev.cardKeys.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const { [keyNormalizada]: _removido, ...cardAddOnIds } =
        prev?.cardAddOnIds && typeof prev.cardAddOnIds === "object" ? prev.cardAddOnIds : {};
      return {
        ...prev,
        cardKeys: atuais.filter((item) => item !== keyNormalizada),
        cardAddOnIds,
      };
    });
  }, []);

  const alternarAddOnCard = useCallback((cardKey = "", addOnId = "") => {
    const keyNormalizada = String(cardKey || "").trim();
    const addOnNormalizado = String(addOnId || "").trim();
    if (!keyNormalizada || !addOnNormalizado) return;
    const cardOrigem = (Array.isArray(cardsDisponiveis) ? cardsDisponiveis : []).find(
      (item) => item.key === keyNormalizada
    );
    const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigem(cardOrigem);
    if (!addOnIdsDisponiveis.includes(addOnNormalizado)) return;

    setModal((prev) => {
      const mapaAtual = prev?.cardAddOnIds && typeof prev.cardAddOnIds === "object" ? prev.cardAddOnIds : {};
      const atuais = Object.prototype.hasOwnProperty.call(mapaAtual, keyNormalizada)
        ? normalizarAddOnIds(mapaAtual[keyNormalizada])
        : addOnIdsDisponiveis;
      const proximos = atuais.includes(addOnNormalizado)
        ? atuais.filter((item) => item !== addOnNormalizado)
        : [...atuais, addOnNormalizado];
      return {
        ...prev,
        cardAddOnIds: {
          ...mapaAtual,
          [keyNormalizada]: proximos.filter((item) => addOnIdsDisponiveis.includes(item)),
        },
      };
    });
  }, [cardsDisponiveis]);

  const alternarAddOnDireto = useCallback((addOnId = "") => {
    const addOnNormalizado = String(addOnId || "").trim();
    if (!addOnNormalizado) return;
    setModal((prev) => {
      const atuais = normalizarAddOnIds(prev?.addOnIds);
      return {
        ...prev,
        addOnIds: atuais.includes(addOnNormalizado)
          ? atuais.filter((item) => item !== addOnNormalizado)
          : [...atuais, addOnNormalizado],
      };
    });
  }, []);

  const abrir = useCallback((opcoes = {}) => {
    const blocoDestino = (Array.isArray(blocosDestino) ? blocosDestino : [])[0] || null;
    setModal(
      criarEstadoAly137Forja({
        aberto: true,
        blocoDestinoId: String(blocoDestino?.id || "").trim(),
        nome: "Card forjado",
        descricao: "Card criado pela Forja.",
        returnTo: String(opcoes?.returnTo || "").trim(),
        erro: blocoDestino ? "" : "Crie um bloco do tipo cards antes de forjar.",
      })
    );
  }, [blocosDestino]);

  const resetar = useCallback(() => {
    setModal(criarEstadoAly137Forja());
  }, []);

  const fechar = useCallback(() => {
    const returnTo = String(modal?.returnTo || "").trim();
    resetar();
    if (returnTo && typeof onReturn === "function") {
      onReturn(returnTo);
    }
  }, [modal?.returnTo, onReturn, resetar]);

  const iniciarArraste = useCallback((event, material = {}) => {
    const tipo = String(material?.tipo || "").trim();
    const id = String(material?.id || "").trim();
    if (!tipo || !id) return;
    const payload = JSON.stringify({ tipo, id });
    event.dataTransfer?.setData("application/json", payload);
    event.dataTransfer?.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "copy";
    setModal((prev) => ({ ...prev, arrastando: { tipo, id } }));
  }, []);

  const finalizarArraste = useCallback(() => {
    setModal((prev) => ({ ...prev, arrastando: null }));
  }, []);

  const soltarMaterial = useCallback((event) => {
    event.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(
        event.dataTransfer?.getData("application/json") ||
          event.dataTransfer?.getData("text/plain") ||
          "{}"
      );
    } catch {
      payload = modal?.arrastando || null;
    }
    const tipo = String(payload?.tipo || "").trim();
    const id = String(payload?.id || "").trim();
    if (tipo === "card") {
      adicionarCard(id);
    }
    if (tipo === "addon") {
      alternarAddOnDireto(id);
    }
    finalizarArraste();
  }, [adicionarCard, alternarAddOnDireto, finalizarArraste, modal?.arrastando]);

  const setErro = useCallback((erro = "") => {
    setModal((prev) => ({ ...prev, erro: String(erro || "") }));
  }, []);

  const setCriando = useCallback((criando = false, erro = "") => {
    setModal((prev) => ({ ...prev, criando: Boolean(criando), erro: String(erro || "") }));
  }, []);

  return {
    modal,
    setModal,
    cardsSelecionados,
    addOnIdsHerdados,
    addOnIdsDiretos,
    addOnIdsEfetivos,
    addOnsDiretos,
    resumo,
    cardsInventarioFiltrados,
    addOnsInventarioFiltrados,
    adicionarCard,
    removerCard,
    alternarAddOnCard,
    alternarAddOnDireto,
    abrir,
    fechar,
    resetar,
    iniciarArraste,
    finalizarArraste,
    soltarMaterial,
    setErro,
    setCriando,
  };
}
