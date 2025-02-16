import React from 'react';


const Pagina = ({ pagina }) => {
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

export default Pagina;