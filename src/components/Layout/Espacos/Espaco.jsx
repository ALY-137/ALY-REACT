import React from 'react';


const Espaco = ({ espaco }) => {
  if (!espaco) {
    return <p>Carregando...</p>;
  }

  return (
    <div>
      <h1>{espaco.nome}</h1>
      <div dangerouslySetInnerHTML={{ __html: espaco.conteudo }} />
      
    </div>
  );
};

export default Espaco;