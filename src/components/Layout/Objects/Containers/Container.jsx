import React, { useState, useEffect } from 'react';
import EstiloContainerBot from "./EstiloContainerBot";
import EstiloContainerTop from "./EstiloContainerTop";
import Card from '../Objetos/Card';
import Contato from './Home/Contato';
import { db } from '../../../Banco/init-firebase';
import './containers.css';
import BoasVindas from './Home/BoasVindas';

// Importações específicas do Firebase v9
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

function Container({ titulo, iconUrl, id_container, id_skin, id_user }) {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        // Referência para a coleção cardRefs
        const cardRefsCol = collection(
          db,
          "users",
          id_user,
          "skins",
          id_skin,
          "containers",
          id_container,
          "cardRefs"
        );

        const cardRefsSnapshot = await getDocs(cardRefsCol);

        const cardIds = cardRefsSnapshot.docs.map(doc => doc.data().id_card);
        console.log('Card IDs:', cardIds);

        const cardsData = [];
        for (const cardId of cardIds) {
          const cardDocRef = doc(
            db,
            "users",
            id_user,
            "skins",
            id_skin,
            "cards",
            cardId
          );
          const cardDoc = await getDoc(cardDocRef);

          if (cardDoc.exists()) {
            cardsData.push({ id: cardDoc.id, ...cardDoc.data() });
          }
        }

        console.log('Dados dos Cards:', cardsData);
        setCards(cardsData);

      } catch (error) {
        console.error('Erro ao buscar os cards:', error);
      }
    };

    fetchCards();
  }, [id_user, id_skin, id_container]);

  return (
    <div className="containers">
      <EstiloContainerTop tituloHome={titulo} icon={iconUrl} />

      {id_container === "SKY1GNMkI7muVq3vmHNw" && <BoasVindas />}

      {/* Renderiza os Cards apenas se o id_container for diferente do que ativa o formulário */}
      {id_container !== "nZCPH3y6bkPSnJPSPaSZ" &&
        cards.map((card) => (
          <Card
            key={`${card.id}_${id_container}`}
            id_user={id_user}
            id_skin={id_skin}
            id_container={id_container}
            {...card}
          />
        ))
      }

      {/* Exibe o formulário Contato se o id_container for específico */}
      {id_container === "nZCPH3y6bkPSnJPSPaSZ" && <Contato />}

      <EstiloContainerBot />
    </div>
  );
}

export default Container;
