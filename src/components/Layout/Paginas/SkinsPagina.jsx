import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';


const SkinsPagina = () => {
  const { skinsUsername, paginaId } = useParams();
  const [pagina, setPagina] = useState(null);

  useEffect(() => {
    const fetchPagina = async () => {
      const db = firebase.firestore();
      const snapshot = await db.collectionGroup('paginas')
        .where('id_pagina', '==', paginaId)
        .get();

      if (!snapshot.empty) {
        const paginaData = snapshot.docs[0].data();
        setPagina(paginaData);
      }
    };

    fetchPagina();
  }, [skinsUsername, paginaId]);

  if (!pagina) {
    return <p>Carregando...</p>;
  }

  return (
    <div>
      <h1>{pagina.nome}</h1>
      <div dangerouslySetInnerHTML={{ __html: pagina.conteudo }} />

    </div>
  );
};

export default SkinsPagina;
