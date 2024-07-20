import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import ExcluirFormulario from './ExcluirFormulario'; // Importa o componente de exclusão
import './formularios.css';

function ListaFormularios({ setBackText, setAtualTxt, handleExpandForm }) {
  const [formularios, setFormularios] = useState([]);
  const [formToDelete, setFormToDelete] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = (formulario) => {
    setFormToDelete(formulario);
    setConfirmDelete(true);
  };

  const confirmDeleteForm = async () => {
    if (formToDelete) {
      try {
        await ExcluirFormulario(formToDelete); // Chama a função de exclusão
        setFormularios((prevFormularios) =>
          prevFormularios.filter(
            (formulario) => !(formulario.usuarioId === formToDelete.usuarioId && formulario.formId === formToDelete.formId)
          )
        );
        setConfirmDelete(false);
        setFormToDelete(null);
      } catch (error) {
        console.error('Erro ao excluir formulário:', error);
      }
    }
  };

  return (
    <div>
      {confirmDelete && formToDelete && (
        <div className='excluirForm'>
          <p>Tem certeza que deseja excluir este formulário?</p>
          <div className='buttonsExcluir'>
            <button onClick={confirmDeleteForm}>Sim</button>
            <button onClick={() => { setConfirmDelete(false); setFormToDelete(null); }}>Não</button>
          </div>
        </div>
      )}

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
              <div className='iconOpenForm' onClick={() => handleDelete(formulario)}>
                <p><strong> 🗑 EXCLUIR </strong></p>
              </div>
            </div>
          ))}
        </div>
      </ul>
    </div>
  );
}

export default ListaFormularios;
