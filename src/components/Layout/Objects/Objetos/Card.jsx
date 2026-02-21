import React, { useEffect, useRef, useState } from "react";
import { db } from "../../../Banco/init-firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

function Card({
  id,
  id_user,
  id_skin,
  id_container,
  ownerUserId,
  espacoId,
  blocoId,
  atividade,
  criador,
  nomeDescricao,
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
}) {
  const cardRef = useRef(null);
  const [addOns, setAddOns] = useState([]);

  useEffect(() => {
    function resizeCard() {
      const larSreen = window.innerWidth;
      const largura = larSreen >= 350 ? 350 - 75 : larSreen - 82;
      const altura = largura * 1.618;

      if (cardRef.current) {
        cardRef.current.style.width = `${largura}px`;
        cardRef.current.style.height = `${altura}px`;
      }
    }

    resizeCard();
    window.addEventListener("resize", resizeCard);
    return () => window.removeEventListener("resize", resizeCard);
  }, []);

  useEffect(() => {
    const fetchAddOns = async () => {
      try {
        let addOnsRefsCol = null;

        if (ownerUserId && espacoId && blocoId && id) {
          // Estrutura nova: users/{owner}/espacos/{espaco}/blocos/{bloco}/cards/{card}
          addOnsRefsCol = collection(
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
          addOnsRefsCol = collection(
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

        if (!addOnsRefsCol) {
          setAddOns([]);
          return;
        }

        const addOnsSnapshot = await getDocs(addOnsRefsCol);

        const promises = addOnsSnapshot.docs.map(async (docRef) => {
          const id_add = docRef.data().id_add;
          const addOnDocRef = doc(db, "add_ons", id_add);
          const addOnDoc = await getDoc(addOnDocRef);
          return addOnDoc.exists() ? { id: addOnDoc.id, ...addOnDoc.data() } : null;
        });

        const resolvedAddOns = await Promise.all(promises);
        setAddOns(resolvedAddOns.filter(Boolean));
      } catch (error) {
        console.error("Erro ao buscar add-ons:", error);
      }
    };

    if (
      (ownerUserId && espacoId && blocoId && id) ||
      (id_user && id_skin && id_container && id)
    ) {
      fetchAddOns();
    }
  }, [ownerUserId, espacoId, blocoId, id_user, id_skin, id_container, id]);

  return (
    <div id={idNome} ref={cardRef} className={cardContainerDesktop}>
      <div className={cardCabecalho}>
        <p className={cardNome}> [ ] {nome}</p>
      </div>
      <div className={cardImagem}>
        <img className={imgCard} src={imagem} alt="imagem" />
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
