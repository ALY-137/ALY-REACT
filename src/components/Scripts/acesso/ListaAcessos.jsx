import React, { useEffect, useState } from 'react';
import { db } from '../../Banco/init-firebase'; // banco já configurado
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import './acessos.css'; // Importa o CSS para estilização

function ListaAcessos() {
  const [acessos, setAcessos] = useState([]);

  useEffect(() => {
    // Criar query para ordenar por data desc
    const acessosQuery = query(
      collection(db, 'acessos'),
      orderBy('data', 'desc')
    );

    // Inscrever no snapshot em tempo real
    const unsubscribe = onSnapshot(
      acessosQuery,
      (snapshot) => {
        const acessosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAcessos(acessosData);
      },
      (error) => {
        console.error("Erro ao buscar acessos em tempo real:", error);
      }
    );

    // Cleanup do listener ao desmontar o componente
    return () => unsubscribe();
  }, []);

  return (
    <div className='conteudoLista'>
      <h1>Lista de Acessos</h1>
      <table>
        <thead>
          <tr className='cabecalho'>
            <th>Data</th>
            <th>País</th>
            <th>Cidade</th>
            <th>Bairro</th>
            <th>Logradouro</th>
            <th>Email</th>
            <th>IP</th>
            <th>Visto</th>
            <th>Região</th>
            <th>Org</th>
          </tr>
        </thead>
        <tbody>
          {acessos.map(acesso => (
            <tr key={acesso.id} className='linha'>
              <td>
                {acesso.data?.seconds
                  ? new Date(acesso.data.seconds * 1000).toLocaleString()
                  : '—'}
              </td>
              <td>{acesso.country || '—'}</td>
              <td>{acesso.city || '—'}</td>
              <td>{acesso.bairro || '—'}</td>
              <td>{acesso.logradouro || '—'}</td>
              <td>{acesso.valorEmail || '—'}</td>
              <td>{acesso.ip || '—'}</td>
              <td>{acesso.visto ? 'Sim' : 'Não'}</td>
              <td>{acesso.region || '—'}</td>
              <td>{acesso.org || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaAcessos;
