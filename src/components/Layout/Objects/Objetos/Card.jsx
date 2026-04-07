import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../../Banco/init-firebase";
import { getDoc, getDocs } from "firebase/firestore";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../../Banco/projectDataRefs";

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

function Card({
  id,
  id_user,
  id_skin,
  id_container,
  ownerUserId,
  espacoId,
  blocoId,
  addOnIds,
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
}) {
  const cardRef = useRef(null);
  const [addOns, setAddOns] = useState([]);
  const addOnIdsNormalizados = useMemo(() => normalizarAddOnIds(addOnIds), [addOnIds]);
  const addOnsPropNormalizados = useMemo(
    () => (Array.isArray(addOnsProp) ? addOnsProp.filter(Boolean) : []),
    [addOnsProp]
  );

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
    if (usaAddOnsGerenciador) {
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

          const addOnDoc = await getFirstExistingDoc(
            getProjectDocCandidates(db, "add_ons", id_add)
          );
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

  return (
    <div id={idNome} ref={cardRef} className={cardContainerDesktop}>
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
          <div className="checkBoxHab">
            {addOns.map((addon) => (
              <img
                key={addon.id}
                src={addon.url_img}
                alt="Habilidade"
                className="iconeAddOn"
              />
            ))}
          </div>

          {nomeDescricao && <p className="txtTituloPri"> [ {nomeDescricao} ] </p>}
          {descricao && <p className="txtDescricao"> {descricao}</p>}
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
  );
}

export default Card;
