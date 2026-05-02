export const ALY137_ATRIBUTOS = [
  { key: "autonomia", label: "Autonomia" },
  { key: "tecnica", label: "Tecnica" },
  { key: "criatividade", label: "Criatividade" },
  { key: "impacto", label: "Impacto" },
];

export const ALY137_XP_BASE_EVIDENCIA = 5;

export const ALY137_PESOS_EVIDENCIA = {
  pequeno: { key: "pequeno", label: "Pequeno", multiplicador: 1 },
  medio: { key: "medio", label: "Medio", multiplicador: 3 },
  grande: { key: "grande", label: "Grande", multiplicador: 7 },
};

export const ALY137_ADDON_XP_MAX = 300;

const ALY137_CARD_NIVEIS = [
  { nivel: 3, label: "Nivel 3", min: 701, max: null, next: null },
  { nivel: 2, label: "Nivel 2", min: 301, max: 700, next: 701 },
  { nivel: 1, label: "Nivel 1", min: 100, max: 300, next: 301 },
  { nivel: 0, label: "Em formacao", min: 0, max: 100, next: 100 },
];

const normalizarTexto = (value = "") => String(value || "").trim();

const normalizarNumero = (value = 0) => {
  const numero = Number(value);
  return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
};

const normalizarIdLista = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizarTexto(item)).filter(Boolean)));
};

const normalizarAddOnsXpAly137 = (value = {}) => {
  const origem = value && typeof value === "object" ? value : {};
  return Object.entries(origem).reduce((acc, [addOnId, resumo]) => {
    const id = normalizarTexto(addOnId);
    if (!id) return acc;
    const xpBruto = normalizarNumero(
      typeof resumo === "number" ? resumo : (resumo?.xpBruto ?? resumo?.xpTotal)
    );
    acc[id] = {
      xpTotal: Math.min(ALY137_ADDON_XP_MAX, xpBruto),
      xpBruto,
      percentual: Math.min(100, Math.round((xpBruto / ALY137_ADDON_XP_MAX) * 100)),
    };
    return acc;
  }, {});
};

export function normalizarPesoEvidenciaAly137(value = "pequeno") {
  const normalizado = normalizarTexto(value).toLowerCase();
  return ALY137_PESOS_EVIDENCIA[normalizado] ? normalizado : "pequeno";
}

export function calcularXpPorPesoAly137(value = "pequeno") {
  const peso = normalizarPesoEvidenciaAly137(value);
  return ALY137_XP_BASE_EVIDENCIA * ALY137_PESOS_EVIDENCIA[peso].multiplicador;
}

export function calcularXpEvidenciaAly137(evidencia = {}) {
  const xpManual = Number(
    evidencia?.xpManual ??
      evidencia?.xpOverride ??
      (evidencia?.tipo === "conclusao_nivel" ? evidencia?.xpTotal : undefined)
  );
  if (Number.isFinite(xpManual) && xpManual > 0) {
    return Math.round(xpManual);
  }

  const atributosPesos = normalizarAtributosPesosAly137(evidencia?.atributosPesos);
  const atributosSelecionados = normalizarAtributosSelecionadosAly137(
    evidencia?.atributosSelecionados || evidencia?.atributosAfetados
  );
  if (atributosSelecionados.length) {
    return atributosSelecionados.reduce(
      (total, atributoKey) =>
        total + calcularXpPorPesoAly137(atributosPesos[atributoKey] || evidencia?.peso),
      0
    );
  }

  const atributos = criarMapaAtributosAly137(evidencia?.atributos);
  const valoresAtributos = Object.values(atributos).filter((valor) => valor > 0);
  if (valoresAtributos.length) {
    return valoresAtributos.reduce((total, valor) => total + valor, 0);
  }

  return calcularXpPorPesoAly137(evidencia?.peso);
}

export function normalizarAtributoPrincipalAly137(value = "") {
  const normalizado = normalizarTexto(value).toLowerCase();
  return ALY137_ATRIBUTOS.some((atributo) => atributo.key === normalizado) ? normalizado : "";
}

export function normalizarAtributosSelecionadosAly137(value = []) {
  const validos = new Set(ALY137_ATRIBUTOS.map((atributo) => atributo.key));
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizarTexto(item).toLowerCase())
        .filter((item) => validos.has(item))
    )
  );
}

export function normalizarAtributosPesosAly137(value = {}) {
  const origem = value && typeof value === "object" ? value : {};
  return ALY137_ATRIBUTOS.reduce((acc, atributo) => {
    const peso = normalizarPesoEvidenciaAly137(origem[atributo.key]);
    if (origem[atributo.key]) {
      acc[atributo.key] = peso;
    }
    return acc;
  }, {});
}

export function criarMapaAtributosAly137(value = {}) {
  const origem = value && typeof value === "object" ? value : {};
  return ALY137_ATRIBUTOS.reduce((acc, atributo) => {
    acc[atributo.key] = normalizarNumero(origem[atributo.key]);
    return acc;
  }, {});
}

export function normalizarEvidenciaAly137(evidencia = {}, index = 0, validAddOnIds = []) {
  const validSet = new Set(normalizarIdLista(validAddOnIds));
  const peso = normalizarPesoEvidenciaAly137(evidencia?.peso);
  const tipo = normalizarTexto(evidencia?.tipo || evidencia?.type);
  const xpManual = Number(evidencia?.xpManual ?? evidencia?.xpOverride);
  const atributoPrincipal = normalizarAtributoPrincipalAly137(
    evidencia?.atributoPrincipal || evidencia?.atributo || evidencia?.tipoAtributo
  );
  const atributosBase = criarMapaAtributosAly137(evidencia?.atributos);
  const atributosPesosBase = normalizarAtributosPesosAly137(evidencia?.atributosPesos);
  const atributosSelecionadosExplicitos = normalizarAtributosSelecionadosAly137(
    evidencia?.atributosSelecionados || evidencia?.atributosAfetados
  );
  const atributosComValor = ALY137_ATRIBUTOS
    .filter((atributo) => atributosBase[atributo.key] > 0)
    .map((atributo) => atributo.key);
  const atributosSelecionados = atributosSelecionadosExplicitos.length
    ? atributosSelecionadosExplicitos
    : atributoPrincipal
      ? [atributoPrincipal]
      : atributosComValor;
  const atributosPesos = atributosSelecionados.reduce((acc, atributoKey) => {
    acc[atributoKey] = atributosPesosBase[atributoKey] || peso;
    return acc;
  }, {});
  const xpTotal = calcularXpEvidenciaAly137({
    ...evidencia,
    peso,
    atributosSelecionados,
    atributosPesos,
  });
  const atributosOrigem =
    atributosSelecionadosExplicitos.length || atributoPrincipal
      ? criarMapaAtributosAly137()
      : atributosBase;
  const atributos = {
    ...atributosOrigem,
    ...atributosSelecionados.reduce((acc, atributoKey) => {
      acc[atributoKey] = atributosBase[atributoKey] || calcularXpPorPesoAly137(atributosPesos[atributoKey]);
      return acc;
    }, {}),
  };
  const addOnIds = normalizarIdLista(
    evidencia?.addOnIds || evidencia?.addons || evidencia?.addOnsIds
  ).filter((id) => !validSet.size || validSet.has(id));

  return {
    id: normalizarTexto(evidencia?.id) || `evidencia_${Date.now()}_${index}`,
    titulo: normalizarTexto(evidencia?.titulo || evidencia?.nome) || `Evidencia ${index + 1}`,
    descricao: normalizarTexto(evidencia?.descricao),
    tipo,
    peso,
    xpTotal,
    ...(Number.isFinite(xpManual) && xpManual > 0 ? { xpManual: Math.round(xpManual) } : {}),
    xpCalculadoAutomaticamente: evidencia?.xpCalculadoAutomaticamente === true,
    conclusaoEtapa: normalizarTexto(evidencia?.conclusaoEtapa),
    nivelAlvo: normalizarNumero(evidencia?.nivelAlvo),
    xpAlvo: normalizarNumero(evidencia?.xpAlvo),
    xpAntesConclusao: normalizarNumero(evidencia?.xpAntesConclusao),
    atributoPrincipal,
    atributosSelecionados,
    atributosPesos,
    atributos,
    addOnIds,
    criadoEm: evidencia?.criadoEm || null,
    atualizadoEm: evidencia?.atualizadoEm || null,
  };
}

export function normalizarCardsOrigemAly137(cardsOrigem = []) {
  if (!Array.isArray(cardsOrigem)) return [];
  return cardsOrigem
    .map((card, index) => {
      const xpTotal = normalizarNumero(card?.xpTotal || card?.aly137?.xpTotal);
      const atributos = criarMapaAtributosAly137(card?.atributos || card?.aly137?.atributos);
      const addOnsXpDisponiveis = normalizarAddOnsXpAly137(card?.addOnsXp || card?.aly137?.addOnsXp);
      const addOnIdsDisponiveis = normalizarIdLista([
        ...normalizarIdLista(card?.addOnIds || card?.addOnsIds || card?.addons),
        ...Object.keys(addOnsXpDisponiveis),
      ]);
      const possuiConfigRelacionados =
        card &&
        typeof card === "object" &&
        (
          Object.prototype.hasOwnProperty.call(card, "addOnIdsRelacionados") ||
          Object.prototype.hasOwnProperty.call(card, "relatedAddOnIds") ||
          Object.prototype.hasOwnProperty.call(card, "addOnsRelacionados")
        );
      const addOnIdsRelacionadosBruto = normalizarIdLista(
        card?.addOnIdsRelacionados || card?.relatedAddOnIds || card?.addOnsRelacionados || []
      );
      const addOnIds = possuiConfigRelacionados
        ? addOnIdsRelacionadosBruto.filter((addOnId) => addOnIdsDisponiveis.includes(addOnId))
        : addOnIdsDisponiveis;
      const addOnsXp = Object.fromEntries(
        Object.entries(addOnsXpDisponiveis).filter(([addOnId]) => addOnIds.includes(addOnId))
      );
      return {
        id: normalizarTexto(card?.id || card?.cardId) || `card_origem_${index}`,
        cardId: normalizarTexto(card?.cardId || card?.id),
        espacoId: normalizarTexto(card?.espacoId),
        espacoNome: normalizarTexto(card?.espacoNome),
        espacoSubtema: normalizarTexto(card?.espacoSubtema || card?.subtema),
        blocoId: normalizarTexto(card?.blocoId),
        blocoTitulo: normalizarTexto(card?.blocoTitulo),
        nome: normalizarTexto(card?.nome) || "Card de origem",
        descricao: normalizarTexto(card?.descricao),
        imagem: normalizarTexto(card?.imagem),
        xpTotal,
        nivel: normalizarNumero(card?.nivel || card?.aly137?.nivel),
        atributos,
        addOnIds,
        addOnIdsRelacionados: addOnIds,
        addOnIdsDisponiveis,
        addOnsXp,
      };
    })
    .filter((card) => card.cardId || card.id || card.nome || card.xpTotal);
}

export function calcularNivelCardAly137(xpTotal = 0) {
  const xp = normalizarNumero(xpTotal);
  const regra = ALY137_CARD_NIVEIS.find((nivel) => xp >= nivel.min) || ALY137_CARD_NIVEIS[3];
  const xpAlvoNivel = regra.max || regra.next || null;
  const xpAtualNoNivel = Math.max(0, xp - regra.min);
  const xpNecessarioProximoNivel = xpAlvoNivel ? Math.max(1, xpAlvoNivel - regra.min) : 0;
  const percentual = xpAlvoNivel
    ? Math.min(100, Math.round((xpAtualNoNivel / xpNecessarioProximoNivel) * 100))
    : 100;

  return {
    nivel: regra.nivel,
    label: regra.label,
    xpTotal: xp,
    xpMinNivel: regra.min,
    xpMaxNivel: regra.max,
    xpProximoNivel: xpAlvoNivel,
    xpEntradaProximoNivel: regra.next,
    xpAtualNoNivel,
    xpNecessarioProximoNivel,
    percentual,
  };
}

export function calcularResumoAly137({
  evidencias = [],
  cardsOrigem = [],
  validAddOnIds = [],
} = {}) {
  const evidenciasNormalizadas = Array.isArray(evidencias)
    ? evidencias.map((item, index) => normalizarEvidenciaAly137(item, index, validAddOnIds))
    : [];
  const cardsOrigemNormalizados = normalizarCardsOrigemAly137(cardsOrigem);
  const atributos = criarMapaAtributosAly137();
  const addOnsXpBruto = {};
  const validAddOnSet = new Set(normalizarIdLista(validAddOnIds));

  const xpEvidencias = evidenciasNormalizadas.reduce((total, evidencia) => {
    ALY137_ATRIBUTOS.forEach((atributo) => {
      atributos[atributo.key] += normalizarNumero(evidencia.atributos?.[atributo.key]);
    });

    evidencia.addOnIds.forEach((addOnId) => {
      addOnsXpBruto[addOnId] = (addOnsXpBruto[addOnId] || 0) + evidencia.xpTotal;
    });

    return total + evidencia.xpTotal;
  }, 0);

  const xpCardsOrigem = cardsOrigemNormalizados.reduce((total, card) => {
    ALY137_ATRIBUTOS.forEach((atributo) => {
      atributos[atributo.key] += normalizarNumero(card.atributos?.[atributo.key]);
    });
    normalizarIdLista([
      ...(Array.isArray(card.addOnIds) ? card.addOnIds : []),
      ...Object.keys(card.addOnsXp || {}),
    ]).forEach((addOnId) => {
      if (validAddOnSet.size && !validAddOnSet.has(addOnId)) return;
      const resumoAddOn = card.addOnsXp?.[addOnId] || {};
      const xpAddOn = normalizarNumero(resumoAddOn.xpBruto ?? resumoAddOn.xpTotal ?? 0);
      addOnsXpBruto[addOnId] = (addOnsXpBruto[addOnId] || 0) + xpAddOn;
    });
    return total + normalizarNumero(card.xpTotal);
  }, 0);

  const xpTotal = xpEvidencias + xpCardsOrigem;
  const nivel = calcularNivelCardAly137(xpTotal);
  const addOnsXp = Object.entries(addOnsXpBruto).reduce((acc, [addOnId, xp]) => {
    acc[addOnId] = {
      xpTotal: Math.min(ALY137_ADDON_XP_MAX, normalizarNumero(xp)),
      xpBruto: normalizarNumero(xp),
      percentual: Math.min(100, Math.round((normalizarNumero(xp) / ALY137_ADDON_XP_MAX) * 100)),
    };
    return acc;
  }, {});

  return {
    ativo: Boolean(xpTotal || evidenciasNormalizadas.length || cardsOrigemNormalizados.length),
    xpTotal,
    xpEvidencias,
    xpCardsOrigem,
    nivel: nivel.nivel,
    nivelLabel: nivel.label,
    progressoNivel: nivel,
    atributos,
    evidencias: evidenciasNormalizadas,
    addOnsXp,
    cardsOrigem: cardsOrigemNormalizados,
  };
}

export function normalizarCardAly137(value = null, validAddOnIds = []) {
  if (!value || typeof value !== "object") {
    return {
      ativo: false,
      xpTotal: 0,
      xpEvidencias: 0,
      xpCardsOrigem: 0,
      nivel: 0,
      nivelLabel: "Em formacao",
      progressoNivel: calcularNivelCardAly137(0),
      atributos: criarMapaAtributosAly137(),
      evidencias: [],
      addOnsXp: {},
      cardsOrigem: [],
      atualizadoEm: null,
      regras: null,
    };
  }

  const resumo = calcularResumoAly137({
    evidencias: value.evidencias,
    cardsOrigem: value.cardsOrigem || value?.forja?.cardsOrigem,
    validAddOnIds,
  });

  return {
    ...resumo,
    ativo: Boolean(value.ativo || resumo.ativo),
    atualizadoEm: value.atualizadoEm || null,
    regras: value.regras || null,
  };
}

export function criarPayloadCardAly137({
  evidencias = [],
  cardsOrigem = [],
  validAddOnIds = [],
  ativo = true,
} = {}) {
  const resumo = calcularResumoAly137({ evidencias, cardsOrigem, validAddOnIds });
  return {
    ...resumo,
    ativo: Boolean(ativo && resumo.ativo),
    atualizadoEm: new Date().toISOString(),
    regras: {
      versao: "aly137-forja-v1",
      xpBaseEvidencia: ALY137_XP_BASE_EVIDENCIA,
      pesos: Object.fromEntries(
        Object.entries(ALY137_PESOS_EVIDENCIA).map(([key, value]) => [key, value.multiplicador])
      ),
      curvaCard: {
        nivel1: 100,
        nivel2: 300,
        nivel3: 700,
      },
      addonNivelUnicoMax: ALY137_ADDON_XP_MAX,
    },
  };
}

export function calcularResumoAddOnsAly137DeCards({
  cards = [],
  addOns = [],
  blocoId = "",
  blocoTitulo = "",
} = {}) {
  const addOnBase = new Map(
    (Array.isArray(addOns) ? addOns : [])
      .map((addOn) => [normalizarTexto(addOn?.id), addOn])
      .filter(([id]) => Boolean(id))
  );
  const resumos = new Map();

  const garantirResumo = (addOnId = "") => {
    const id = normalizarTexto(addOnId);
    if (!id) return null;
    if (!resumos.has(id)) {
      const addOn = addOnBase.get(id) || {};
      resumos.set(id, {
        addOnId: id,
        nome: normalizarTexto(addOn?.nome) || "Add-on",
        tipo: normalizarTexto(addOn?.tipo || addOn?.categoria || addOn?.grupo || "geral") || "geral",
        xpBruto: 0,
        xpTotal: 0,
        percentual: 0,
        atributos: criarMapaAtributosAly137(),
        cardsRelacionados: [],
        evidenciasRelacionadas: [],
        atualizadoEm: new Date().toISOString(),
      });
    }
    return resumos.get(id);
  };

  addOnBase.forEach((_addOn, addOnId) => {
    garantirResumo(addOnId);
  });

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    const cardId = normalizarTexto(card?.id || card?.cardId);
    const cardNome = normalizarTexto(card?.nome) || "Card";
    const cardBlocoId = normalizarTexto(card?.blocoId) || normalizarTexto(blocoId);
    const cardBlocoTitulo = normalizarTexto(card?.blocoTitulo) || normalizarTexto(blocoTitulo);
    const addOnIdsCard = normalizarIdLista(card?.addOnIds || card?.addOnsIds || card?.addons);
    const aly137 = normalizarCardAly137(card?.aly137, addOnIdsCard);

    aly137.evidencias.forEach((evidencia) => {
      evidencia.addOnIds.forEach((addOnId) => {
        const resumo = garantirResumo(addOnId);
        if (!resumo) return;
        resumo.xpBruto += normalizarNumero(evidencia.xpTotal);
        ALY137_ATRIBUTOS.forEach((atributo) => {
          resumo.atributos[atributo.key] += normalizarNumero(evidencia.atributos?.[atributo.key]);
        });
        if (cardId && !resumo.cardsRelacionados.some((item) => item.cardId === cardId && item.blocoId === cardBlocoId)) {
          resumo.cardsRelacionados.push({
            cardId,
            blocoId: cardBlocoId,
            blocoTitulo: cardBlocoTitulo,
            nome: cardNome,
            xpTotal: aly137.xpTotal,
            nivel: aly137.nivel,
          });
        }
        resumo.evidenciasRelacionadas.push({
          evidenciaId: evidencia.id,
          titulo: evidencia.titulo,
          xpTotal: evidencia.xpTotal,
          atributos: evidencia.atributos,
          atributosPesos: evidencia.atributosPesos,
          cardId,
          cardNome,
          blocoId: cardBlocoId,
          blocoTitulo: cardBlocoTitulo,
        });
      });
    });
  });

  return Object.fromEntries(
    Array.from(resumos.entries()).map(([addOnId, resumo]) => [
      addOnId,
      {
        ...resumo,
        xpTotal: Math.min(ALY137_ADDON_XP_MAX, normalizarNumero(resumo.xpBruto)),
        percentual: Math.min(
          100,
          Math.round((normalizarNumero(resumo.xpBruto) / ALY137_ADDON_XP_MAX) * 100)
        ),
      },
    ])
  );
}

export function criarEvidenciaAly137Padrao(validAddOnIds = []) {
  return normalizarEvidenciaAly137(
    {
      id: `evidencia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      titulo: "Nova evidencia",
      peso: "pequeno",
      atributoPrincipal: "",
      atributosSelecionados: [],
      addOnIds: normalizarIdLista(validAddOnIds),
    },
    0,
    validAddOnIds
  );
}
