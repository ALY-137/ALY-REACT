import React, { useEffect, useRef, useState } from 'react';
import './objetos.css';
import { db } from '../../../Banco/init-firebase'; // ajuste se o path for diferente

function Card({
  id,
  id_user,
  id_skin,
  id_container,

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
  imgCard
}) {
  const cardRef = useRef(null);
  const [addOns, setAddOns] = useState([]);

  useEffect(() => {
    function resizeCard() {
      const larSreen = window.innerWidth;
      let largura = larSreen >= 350 ? 350 - 75 : larSreen - 82;
      const altura = largura * 1.618;

      if (cardRef.current) {
        cardRef.current.style.width = `${largura}px`;
        cardRef.current.style.height = `${altura}px`;
      }
    }

    resizeCard();
    window.addEventListener('resize', resizeCard);
    return () => window.removeEventListener('resize', resizeCard);
  }, []);

  useEffect(() => {
    const fetchAddOns = async () => {
      try {
        const addOnsSnapshot = await db
          .collection('users')
          .doc(id_user)
          .collection('skins')
          .doc(id_skin)
          .collection('cards')
          .doc(id)
          .collection('addOnsRefs')
          .get();

        const promises = addOnsSnapshot.docs.map(async (docRef) => {
          const id_add = docRef.data().id_add;
          const addOnDoc = await db.collection('add_ons').doc(id_add).get();
          if (addOnDoc.exists) {
            return { id: addOnDoc.id, ...addOnDoc.data() };
          }
          return null;
        });

        const resolvedAddOns = await Promise.all(promises);
        setAddOns(resolvedAddOns.filter((a) => a !== null));
      } catch (error) {
        console.error('Erro ao buscar add-ons:', error);
      }
    };

    if (id_user && id_skin && id && id_container) {
      fetchAddOns();
    }
  }, [id_user, id_skin, id_container, id]);

  return (
    <div id={idNome} ref={cardRef} className={cardContainerDesktop}>
      <div className={cardCabecalho}>
        <p className={cardNome}> ▣  {nome}</p>
      </div>
      <div className={cardImagem}>
        <img className={imgCard} src={imagem} alt="imagem" />
      </div>
      <div className={cardDescricao}>
        <div className={cardDescricaoDiv}>

          {/* Nova seção de ícones dos add-ons */}
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

          {nomeDescricao && <p className='txtTituloPri'> [ {nomeDescricao} ] </p>}
          {descricao && <p className='txtDescricao'> {descricao}</p>}
          {atividade && criador && <p className='txtTitulo'>  [ {atividade} ] por {criador}.</p>}
          {data && <p className='txtTitulo'>  [ PERÍODO ] {data}.</p>}
          {linkExterno && (
            <p className='txtTitulo'>
              <a href={linkExterno} target="_blank" rel="noopener noreferrer">[ LINK ]</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Card;
