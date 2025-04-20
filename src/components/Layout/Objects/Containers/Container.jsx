import React, { useState, useEffect } from 'react';
import EstiloContainerBot from "./EstiloContainerBot";
import EstiloContainerTop from "./EstiloContainerTop";
import Card from '../Objetos/Card';
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

      {cards.map((card) => (
        <Card key={card.id} {...card}     
        id_user={id_user}
        id_skin={id_skin}
        id_container={id_container}/>
      ))}


      <EstiloContainerBot />
    </div>
  );
}

export default Container;
