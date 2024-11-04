import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';

import './users.css';

function Users() {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const usersCollection = firebase.firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

        const listaUsuarios = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          picGoogle: doc.data().picGoogle,
          nomeGoogle: doc.data().nomeGoogle,
          data: doc.data().data,
        }));

        setUsuarios(listaUsuarios);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };

    carregarUsuarios();
  }, []);

  return (

      <div className='contentPageUsers'>
        {usuarios.length > 0 ? (
          usuarios.map((usuario) => (
            <div key={usuario.id}>
              <img src={usuario.picGoogle} alt={`Foto de ${usuario.nomeGoogle}`} />
              <p>{usuario.nomeGoogle}</p>
              <p>Data de Cadastro: {usuario.data.toDate().toLocaleDateString()}</p>
            </div>
          ))
        ) : (
          <p>Nenhum usuário encontrado.</p>
        )}
      </div>

  );
}

export default Users;
