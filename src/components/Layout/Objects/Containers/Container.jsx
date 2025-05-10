import React, { useState, useEffect } from 'react';
import EstiloContainerBot from "./EstiloContainerBot";
import EstiloContainerTop from "./EstiloContainerTop";
import Card from '../Objetos/Card';
import Contato from './Home/Contato';
import { db } from '../../../Banco/init-firebase';
import './containers.css';

function Container({ titulo, iconUrl, id_container, id_skin, id_user }) {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const cardRefsSnapshot = await db.collection('users')
          .doc(id_user)
          .collection('skins')
          .doc(id_skin)
          .collection('containers')
          .doc(id_container)
          .collection('cardRefs')
          .get();

        const cardIds = cardRefsSnapshot.docs.map(doc => doc.data().id_card);

        console.log('Card IDs:', cardIds);

        const cardsData = [];
        for (const cardId of cardIds) {
          const cardDoc = await db.collection('users')
            .doc(id_user)
            .collection('skins')
            .doc(id_skin)
            .collection('cards')
            .doc(cardId)
            .get();

          if (cardDoc.exists) {
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
