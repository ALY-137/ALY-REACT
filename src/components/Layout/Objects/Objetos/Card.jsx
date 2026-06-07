import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../../Banco/init-firebase";
import { getDoc, getDocs } from "firebase/firestore";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../../Banco/projectDataRefs";
import {
  CYBERPINK_SUBTHEME_STORAGE_KEY,
  getCyberpinkSubthemeIconFilter,
  getCyberpinkSubthemeIconColor,
  normalizeCyberpinkSubtheme,
} from "../../Temas/cyberpink/subthemes";
import {
  ALY137_ATRIBUTOS,
  calcularNivelCardAly137,
  criarMapaAtributosAly137,
  normalizarCardAly137,
} from "../../Sistema/aly137Utils";

async function getFirstExistingDoc(refs = []) {
  for (const refItem of refs) {
    const snapshot = await getDoc(refItem).catch(() => null);
    if (snapshot?.exists?.()) return snapshot;
  }
  return null;
}

function normalizarAddOnIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizarAddOnSubthemes(value, validIds = []) {
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

    const bruto = String(subtheme || "")
      .trim()
      .toLowerCase();
    if (!bruto || bruto === "space" || bruto === "padrao" || bruto === "default") {
      return acc;
    }

    acc[addOnIdNormalizado] = normalizeCyberpinkSubtheme(bruto);
    return acc;
  }, {});
}

function isSvgAssetUrl(value = "") {
  const normalizado = String(value || "").trim().toLowerCase();
  return normalizado.endsWith(".svg") || normalizado.includes(".svg?") || normalizado.startsWith("data:image/svg+xml");
}

function svgTextoParaDataUrl(svgTexto = "") {
  const texto = String(svgTexto || "").trim();
  if (!texto) return "";
  if (texto.startsWith("data:image/svg+xml")) return texto;
  if (!texto.includes("<svg")) return texto;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(texto)}`;
}

function CardFragmentIcon({ style = undefined }) {
  return (
    <svg
      className="iconeAddOn iconeAddOn--card-fragment"
      style={style}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 5.5h13l5 5V26.5H7V5.5Z" />
      <path d="M20 5.5V11h5" />
      <path d="M11 15h10M11 19h8M11 23h6" />
    </svg>
  );
}

function Card({
  id,
  id_user,
  id_skin,
  id_container,
  ownerUserId,
  espacoId,
  blocoId,
  addOnIds,
  addOnSubthemes = {},
  addOns: addOnsProp = [],
  usaAddOnsGerenciador = false,
  atividade,
  criador,
  nomeDescricao,
  descricaoExtra,
  data,
  descricao,
  imagem,
  cardDescricaoDiv,
  cardNome,
  nome,
  cardContainerDesktop,
  cardCabecalho,
  cardImagem,
  cardDescricao,
  idNome,
  linkExterno,
  imgCard,
  onImagemClick,
  aly137,
  onAddOnClick,
  onCardFragmentClick,
  cyberpinkSubtheme = "",
  previewSemFundoAddOn = false,
}) {
  const cardRef = useRef(null);
  const [addOns, setAddOns] = useState([]);
  const cardContainerClassName = useMemo(() => {
    const classes = String(cardContainerDesktop || "")
      .split(/\s+/)
      .map((classe) => classe.trim())
      .filter(Boolean)
      .filter((classe) => !/^cardContainerDesktop(?:Home|Dev|Design)$/.test(classe));

    return Array.from(new Set(["cardContainerDesktop", ...classes])).join(" ");
  }, [cardContainerDesktop]);
  const addOnIdsNormalizados = useMemo(() => normalizarAddOnIds(addOnIds), [addOnIds]);
  const addOnSubthemesNormalizados = useMemo(
    () => normalizarAddOnSubthemes(addOnSubthemes, addOnIdsNormalizados),
    [addOnSubthemes, addOnIdsNormalizados]
  );
  const addOnsPropNormalizados = useMemo(
    () => (Array.isArray(addOnsProp) ? addOnsProp.filter(Boolean) : []),
    [addOnsProp]
  );
  const aly137Normalizado = useMemo(() => normalizarCardAly137(aly137, addOnIdsNormalizados), [
    aly137,
    addOnIdsNormalizados,
  ]);
  const cardsOrigemAly137 = useMemo(
    () => (Array.isArray(aly137Normalizado?.cardsOrigem) ? aly137Normalizado.cardsOrigem : []),
    [aly137Normalizado]
  );
  const [subtemasCardsOrigem, setSubtemasCardsOrigem] = useState({});
  const cyberpinkSubthemeFallback = useMemo(() => {
    const salvo =
      typeof window !== "undefined"
        ? window.localStorage?.getItem(CYBERPINK_SUBTHEME_STORAGE_KEY)
        : "";
    return normalizeCyberpinkSubtheme(cyberpinkSubtheme || salvo || "");
  }, [cyberpinkSubtheme]);
  const addOnIdsHerdadosPorCards = useMemo(() => {
    const ids = cardsOrigemAly137.flatMap((card) => [
      ...(Array.isArray(card?.addOnIds) ? card.addOnIds : []),
      ...Object.keys(card?.addOnsXp || {}),
    ]);
    return new Set(normalizarAddOnIds(ids));
  }, [cardsOrigemAly137]);
  const addOnsVisiveisNoCard = useMemo(() => {
    if (!addOnIdsHerdadosPorCards.size) return addOns;
    return addOns.filter((addon) => {
      const addOnId = String(addon?.id || "").trim();
      return addOnId && !addOnIdsHerdadosPorCards.has(addOnId);
    });
  }, [addOns, addOnIdsHerdadosPorCards]);
  const aly137Stats = useMemo(() => {
    if (!aly137Normalizado?.ativo) return [];
    const progresso = aly137Normalizado.progressoNivel || calcularNivelCardAly137(aly137Normalizado.xpTotal);
    const atributos = criarMapaAtributosAly137(aly137Normalizado.atributos);
    return [
      {
        key: "xpTotal",
        label: "XP total",
        value: `${aly137Normalizado.xpTotal || 0} XP`,
        percent: progresso.percentual || 0,
      },
      ...ALY137_ATRIBUTOS.map((atributo) => {
        const xp = atributos[atributo.key] || 0;
        return {
          key: atributo.key,
          label: atributo.label,
          value: `${xp} XP`,
          percent: Math.min(100, Math.round(xp)),
        };
      }),
    ];
  }, [aly137Normalizado]);
  const addOnPreviewCleanStyle = previewSemFundoAddOn
    ? {
        background: "transparent",
        border: 0,
        boxShadow: "none",
        clipPath: "none",
        padding: 0,
        width: "auto",
        height: "auto",
        minWidth: 0,
        minHeight: 0,
      }
    : undefined;

  useEffect(() => {
    const isCyberpink = document.body?.classList?.contains("theme-cyberpink");

    function resizeCard() {
      const largura = isCyberpink ? 275 : window.innerWidth >= 350 ? 350 - 75 : window.innerWidth - 82;
      const altura = isCyberpink ? 445 : largura * 1.618;

      if (cardRef.current) {
        cardRef.current.style.width = `${largura}px`;
        cardRef.current.style.height = `${altura}px`;
      }
    }

    resizeCard();
    if (isCyberpink) return undefined;

    window.addEventListener("resize", resizeCard);
    return () => window.removeEventListener("resize", resizeCard);
  }, []);

  useEffect(() => {
    if (usaAddOnsGerenciador || addOnsPropNormalizados.length) {
      setAddOns(addOnsPropNormalizados);
      return undefined;
    }

    const fetchAddOns = async () => {
      try {
        let addOnsRefsCols = [];

        if (ownerUserId && espacoId && blocoId && id) {
          // Estrutura nova: users/{owner}/espacos/{espaco}/blocos/{bloco}/cards/{card}
          addOnsRefsCols = getProjectCollectionCandidates(
            db,
            "users",
            ownerUserId,
            "espacos",
            espacoId,
            "blocos",
            blocoId,
            "cards",
            id,
            "addOnsRefs"
          );
        } else if (id_user && id_skin && id_container && id) {
          // Fallback legado
          addOnsRefsCols = getProjectCollectionCandidates(
            db,
            "users",
            id_user,
            "skins",
            id_skin,
            "cards",
            id,
            "addOnsRefs"
          );
        }

        if (!Array.isArray(addOnsRefsCols) || !addOnsRefsCols.length) {
          setAddOns([]);
          return;
        }

        const addOnsRefsData = [];
        for (const addOnsRefsCol of addOnsRefsCols) {
          const addOnsSnapshot = await getDocs(addOnsRefsCol);
          addOnsRefsData.push(...addOnsSnapshot.docs.map((docRef) => docRef.data() || {}));
        }

        const promises = addOnsRefsData.map(async (docData) => {
          const id_add = String(docData?.id_add || "").trim();
          if (!id_add) return null;

          const ownerAddOnUserId = String(ownerUserId || id_user || "").trim();
          const refs = ownerAddOnUserId
            ? [
                ...getProjectDocCandidates(db, "users", ownerAddOnUserId, "add_ons", id_add),
                ...getProjectDocCandidates(db, "add_ons", id_add),
              ]
            : getProjectDocCandidates(db, "add_ons", id_add);
          const addOnDoc = await getFirstExistingDoc(refs);
          return addOnDoc?.exists?.() ? { id: addOnDoc.id, ...addOnDoc.data() } : null;
        });

        const resolvedAddOns = await Promise.all(promises);
        const dedupe = new Map();
        resolvedAddOns.filter(Boolean).forEach((addOn) => {
          dedupe.set(addOn.id, addOn);
        });
        setAddOns([...dedupe.values()]);
      } catch (error) {
        console.error("Erro ao buscar add-ons:", error);
      }
    };

    if (
      (ownerUserId && espacoId && blocoId && id) ||
      (id_user && id_skin && id_container && id)
    ) {
      void fetchAddOns();
    }
  }, [
    usaAddOnsGerenciador,
    addOnIdsNormalizados,
    addOnsPropNormalizados,
    ownerUserId,
    espacoId,
    blocoId,
    id_user,
    id_skin,
    id_container,
    id,
  ]);

  useEffect(() => {
    let cancelado = false;
    const ownerId = String(ownerUserId || id_user || "").trim();
    const espacosParaBuscar = Array.from(
      new Set(
        cardsOrigemAly137
          .filter((cardOrigem) => !String(cardOrigem?.espacoSubtema || cardOrigem?.subtema || "").trim())
          .map((cardOrigem) => String(cardOrigem?.espacoId || "").trim())
          .filter(Boolean)
      )
    );

    if (!ownerId || !espacosParaBuscar.length) {
      setSubtemasCardsOrigem({});
      return undefined;
    }

    async function carregarSubtemasOrigem() {
      const proximos = {};
      for (const espacoOrigemId of espacosParaBuscar) {
        const refs = getProjectDocCandidates(db, "users", ownerId, "espacos", espacoOrigemId);
        const snapshot = await getFirstExistingDoc(refs);
        const dados = snapshot?.exists?.() ? snapshot.data() || {} : {};
        const subtema = String(dados?.subtema || "").trim();
        if (subtema) {
          proximos[espacoOrigemId] = normalizeCyberpinkSubtheme(subtema);
        }
      }
      if (!cancelado) {
        setSubtemasCardsOrigem(proximos);
      }
    }

    void carregarSubtemasOrigem();

    return () => {
      cancelado = true;
    };
  }, [cardsOrigemAly137, ownerUserId, id_user]);

  return (
    <div id={idNome} ref={cardRef} className={cardContainerClassName}>
      <span className="cyberpink-card-top-rail" aria-hidden="true" />
      <div className={cardCabecalho}>
        <div className="cardTituloPanel">
          <p className={cardNome}>
            <span className="cardNomeTicker">
              [ ] {nome}
              {descricaoExtra ? (
                <span className="cardNomeTickerExtra"> [ {descricaoExtra} ]</span>
              ) : null}
            </span>
          </p>
        </div>
      </div>
      <div className={cardImagem}>
        <img
          className={imgCard}
          src={imagem}
          alt="imagem"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
        </div>
        <div className={cardDescricao}>
          <div className={cardDescricaoDiv}>
            <div className="cardDescricaoDiv__scroll">
              <div className="checkBoxHab">
                {cardsOrigemAly137.map((cardOrigem, index) => {
                  const cardOrigemId = String(cardOrigem?.id || cardOrigem?.cardId || index).trim();
                  const label = String(cardOrigem?.nome || "Card relacionado").trim();
                  const titulo = `${label} / ${cardOrigem?.xpTotal || 0} XP`;
                  const espacoOrigemId = String(cardOrigem?.espacoId || "").trim();
                  const subthemeCardOrigem = normalizeCyberpinkSubtheme(
                    cardOrigem?.espacoSubtema ||
                      cardOrigem?.subtema ||
                      subtemasCardsOrigem[espacoOrigemId] ||
                      cyberpinkSubthemeFallback
                  );
                  const iconColor = getCyberpinkSubthemeIconColor(subthemeCardOrigem);
                  const iconeSvgCustomizado = svgTextoParaDataUrl(
                    cardOrigem?.iconeSvg || cardOrigem?.iconeAddOnSvg || cardOrigem?.cardFragmentIconSvg || ""
                  );
                  return (
                    <button
                      key={`card-fragment-${cardOrigemId}-${index}`}
                      type="button"
                      className={`iconeAddOnWrap iconeAddOnWrap--card-fragment${
                        previewSemFundoAddOn ? " iconeAddOnWrap--preview-sem-fundo" : ""
                      }`}
                      style={addOnPreviewCleanStyle}
                      title={titulo}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (typeof onCardFragmentClick === "function") {
                          onCardFragmentClick(cardOrigem);
                        }
                      }}
                    >
                      {iconeSvgCustomizado ? (
                        <img
                          src={iconeSvgCustomizado}
                          alt={label}
                          className="iconeAddOn iconeAddOn--card-fragment-custom"
                        />
                      ) : (
                        <CardFragmentIcon
                          style={{
                            color: iconColor,
                            filter: `drop-shadow(0 0 2px ${iconColor}) drop-shadow(0 0 5px ${iconColor})`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
                {addOnsVisiveisNoCard.map((addon) => (
                  (() => {
                    const addOnId = String(addon?.id || "").trim();
                    const addOnUrl = String(addon?.url_img || "").trim();
                    const subthemeKey = addOnSubthemesNormalizados[addOnId] || "";
                    const podeColorir = Boolean(subthemeKey) && isSvgAssetUrl(addOnUrl);
                    const label = String(addon?.nome || "Add-on").trim() || "Add-on";
                    const iconColor = getCyberpinkSubthemeIconColor(subthemeKey);
                    const addOnXp = aly137Normalizado?.addOnsXp?.[addOnId] || null;
                    const iconNode = podeColorir ? (
                      <img
                        src={addOnUrl}
                        alt={label}
                        title={label}
                        className="iconeAddOn iconeAddOn--tinted"
                        style={{
                          filter: `${getCyberpinkSubthemeIconFilter(
                            subthemeKey
                          )} drop-shadow(0 0 2px ${iconColor}) drop-shadow(0 0 5px ${iconColor})`,
                        }}
                      />
                    ) : (
                      <img
                        src={addOnUrl}
                        alt={label}
                        title={label}
                        className="iconeAddOn"
                      />
                    );

                    return (
                      <button
                        key={addOnId}
                        type="button"
                        className={`iconeAddOnWrap${previewSemFundoAddOn ? " iconeAddOnWrap--preview-sem-fundo" : ""}`}
                        style={addOnPreviewCleanStyle}
                        title={addOnXp ? `${label} / ${addOnXp.xpTotal || 0} XP` : label}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (typeof onAddOnClick === "function") {
                            onAddOnClick({
                              ...addon,
                              subtema: subthemeKey,
                              subtemaRelacaoCard: subthemeKey,
                              subtemaConfiguradoNoCard: subthemeKey,
                              cardRelacaoAddOnId: addOnId,
                            });
                          }
                        }}
                      >
                        {iconNode}
                      </button>
                    );
                  })()
                ))}
              </div>

              {nomeDescricao && <p className="txtTituloPri"> [ {nomeDescricao} ] </p>}
              {descricao && <p className="txtDescricao"> {descricao}</p>}
              {aly137Stats.length ? (
                <div className="cardAly137Stats" aria-label="XP e atributos do card">
                  <div className="cardAly137Stats__header">
                    <span>{aly137Normalizado.nivelLabel || "Em formacao"}</span>
                    <strong>{`${aly137Normalizado.xpTotal || 0} XP`}</strong>
                  </div>
                  {aly137Stats.map((stat) => (
                    <div className="cardAly137Stat" key={stat.key}>
                      <span className="cardAly137Stat__label">{stat.label}</span>
                      <span className="cardAly137Stat__value">{stat.value}</span>
                      <span className="cardAly137Stat__bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(0, Math.min(100, stat.percent))}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {atividade && criador && <p className="txtTitulo"> [ {atividade} ] por {criador}.</p>}
              {data && <p className="txtTitulo"> [ PERIODO ] {data}.</p>}
              {linkExterno && (
                <p className="txtTitulo">
                  <a href={linkExterno} className="txtTituloLink" target="_blank" rel="noopener noreferrer">
                    [ LINK ]
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}

export default Card;
