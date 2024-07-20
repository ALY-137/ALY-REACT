import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { nomeCompleto } from '../../../../App.jsx';
import './formularios.css';

function ListaFormularios({ setBackText, setAtualTxt, handleExpandForm }) {
  const [formularios, setFormularios] = useState([]);

  useEffect(() => {
    const carregarFormularios = async () => {
      try {
        const usersCollection = firebase.firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

        const listaFormularios = [];

        for (const userDoc of usersSnapshot.docs) {
          const formulariosCollection = userDoc.ref.collection('formularios');
          const formulariosSnapshot = await formulariosCollection.orderBy('data', 'desc').get();

          formulariosSnapshot.docs.forEach((formDoc) => {
            listaFormularios.push({
              usuarioId: userDoc.id,
              formId: formDoc.id,
              nomeCompletoGoogle: userDoc.data().nomeCompletoGoogle,
              assunto: formDoc.data().assunto,
              data: formDoc.data().data.toDate(),
              mensagem: formDoc.data().mensagem,
            });
          });
        }

        setFormularios(listaFormularios);
      } catch (error) {
        console.error('Erro ao carregar formulários:', error);
      }
    };

    carregarFormularios();
  }, []);

  return (
    <ul>
      <div className='pageContentForms'>
        {formularios.map((formulario) => (
          <div className='boxItemForm' key={`${formulario.usuarioId}-${formulario.formId}`}>
            <p>{formulario.nomeCompletoGoogle}</p>
            <p><strong>ID:</strong> {formulario.usuarioId}</p>
            <p><strong>Assunto:</strong> {formulario.assunto}</p>
            <p><strong>Data de envio:</strong> {formulario.data.toLocaleDateString('pt-BR')}</p>
            <div className='iconOpenForm' onClick={() => handleExpandForm(formulario)}>
              <p><strong> 🗨 CHAT </strong></p>
            </div>
          </div>
        ))}
      </div>
    </ul>
  );
}

export default ListaFormularios;
