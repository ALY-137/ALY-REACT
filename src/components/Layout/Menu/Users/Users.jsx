import React, { useState, useEffect } from 'react';

import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../Banco/init-firebase.js';
import { getPrimaryProjectCollection } from '../../../Banco/projectDataRefs.js';

import './users.css';

function Users() {
  const [usuarios, setUsuarios] = useState([]);
  console.log("Users!");

  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const q = query(
          getPrimaryProjectCollection(db, 'users'),
          orderBy('data', 'desc')
        );

        const usersSnapshot = await getDocs(q);

        const listaUsuarios = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setUsuarios(listaUsuarios);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };

    carregarUsuarios();
  }, []);

  return (
    <div className="contentPageUsers">
      {usuarios.length > 0 ? (
        usuarios.map((usuario) => (
          <div key={usuario.id}>
            <img
              src={usuario.picGoogle}
              alt={`Foto de ${usuario.nomeGoogle}`}
            />
            <p>{usuario.nomeGoogle}</p>
            {usuario.data && (
              <p>
                Data de Cadastro:{' '}
                {usuario.data.toDate().toLocaleDateString()}
              </p>
            )}
          </div>
        ))
      ) : (
        <p>Nenhum usuário encontrado.</p>
      )}
    </div>
  );
}

export default Users;
