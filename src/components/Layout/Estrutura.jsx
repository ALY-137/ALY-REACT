import Navbar from "./Navbar/Navbar";
import { Outlet, ScrollRestoration } from 'react-router-dom';
import Menu from "./Menu/Menu";

import { seforAdm } from "../Scripts/verificações/verificaAdm";

function Estrutura() {
  function openMenu() {
    document.getElementById('Menu').classList.remove('oculta');
    document.getElementById('Menu').classList.add('openMenu');

    // Retorna para o estado normal de rolamento do conteúdo da página.
    document.getElementById('fundo').classList.add('scroll-lock');
    document.getElementById('cardProfile').classList.add('scroll-lock');
    document.getElementById('conteudo').classList.add('scroll-lock');
  }

  return (
    <div id="fundo">
      <Menu />
      <div id="cardProfile">
        <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
        <div id="MatrixDesign"></div>
        <div id="MatrixDev"></div>
        <div id="MatrixHome"></div>
        {seforAdm() && (
          <div id='menuId' className='menuIcon' onClick={openMenu}> ㆔ </div>
        )}
      </div>
      <div id="conteudo">
        <Navbar />
        
        <Outlet />
      </div>
    </div>
  );
}

export default Estrutura;
