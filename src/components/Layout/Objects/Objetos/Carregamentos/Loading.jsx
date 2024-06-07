import React from 'react';
import './loading.css';

const Loading = () => {
  return (
    <div >
      <div className='loading' >
        <p>Carregando...</p>
        {/* Você pode adicionar elementos de animação aqui, como uma imagem ou SVG animado */}
      </div>
    </div>
  );
};

export default Loading;