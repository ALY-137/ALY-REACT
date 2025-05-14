import React, { useEffect, useState } from 'react';
import { db } from '../../Banco/init-firebase'; // Importa o banco de dados Firestore
import './acessos.css'; // Importa o CSS para estilização

function ListaAcessos() {
  const [acessos, setAcessos] = useState([]);

  useEffect(() => {
    const unsubscribe = db.collection('acessos')
      .orderBy('data', 'desc') // Ordena pela data mais recente
      .onSnapshot(snapshot => {
        const acessosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAcessos(acessosData);
      }, error => {
        console.error("Erro ao buscar acessos em tempo real:", error);
      });

    // Cleanup do listener ao desmontar o componente
    return () => unsubscribe();
  }, []);

  return (
    <div className='conteudoLista'>
      <h1>Lista de Acessos</h1>
      <table>
        <thead >
          <tr className='cabecalho'>
            <th>Data</th>
            <th>País</th>
            <th>Email</th>
            <th>IP</th>

    {/* <th>ID</th>   */}

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
              <td>{acesso.country_name}</td>
              <td>{acesso.valorEmail || '—'}</td>
              <td>{acesso.ip}</td>
            {/*  <td>{acesso.id}</td>   */}
              <td>{acesso.visto ? 'Sim' : 'Não'}</td>              
              <td>{acesso.region}</td>
              <td>{acesso.org}</td>          
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaAcessos;
