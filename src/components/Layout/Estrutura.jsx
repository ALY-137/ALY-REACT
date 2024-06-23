import Navbar from "./Navbar/Navbar";
import { Outlet, ScrollRestoration } from 'react-router-dom';
import Menu from "./Menu/Menu";

import { seforAdm } from "../Scripts/verificações/verificaAdm";

function Estrutura() {

  return (
    <div id="fundo">
      <Menu />
      <div id="cardProfile">
        <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
        <div id="MatrixDesign"></div>
        <div id="MatrixDev"></div>
        <div id="MatrixHome"></div>
        
      </div>
      <div id="conteudo">
        <Navbar />
        
        <Outlet />
      </div>
      
      </div>
  );
}

export default Estrutura;