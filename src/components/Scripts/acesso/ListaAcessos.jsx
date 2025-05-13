import React, { useEffect, useState } from 'react';
import firebase from "firebase/app";
import 'firebase/firestore';
import { db } from '../../Banco/init-firebase'; // Importa o banco de dados Firestore

function ListaAcessos() {
  const [acessos, setAcessos] = useState([]);

  const fetchAcessos = async () => {
    try {
      const snapshot = await db.collection('acessos')
        .orderBy('data', 'desc') // Ordena pela data mais recente
        .get();
      const acessosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAcessos(acessosData);
    } catch (error) {
      console.error("Erro ao buscar acessos:", error);
    }
  };

  useEffect(() => {
    fetchAcessos(); // Agora a busca será feita quando o componente carregar
  }, []);

  return (
    <div>
      <h1>Lista de Acessos</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>IP</th>
            <th>País</th>
            <th>Região</th>
            <th>Org</th>
            <th>Data</th>
            <th>Visto</th>
          </tr>
        </thead>
        <tbody>
          {acessos.map(acesso => (
            <tr key={acesso.id}>
              <td>{acesso.id}</td>
              <td>{acesso.valorEmail || '—'}</td>
              <td>{acesso.ip}</td>
              <td>{acesso.country_name}</td>
              <td>{acesso.region}</td>
              <td>{acesso.org}</td>
              <td>
                {acesso.data?.seconds
                  ? new Date(acesso.data.seconds * 1000).toLocaleString()
                  : '—'}
              </td>
              <td>{acesso.visto ? 'Sim' : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaAcessos;
