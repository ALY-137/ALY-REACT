import Navbar from "./Navbar/Navbar";
import { Outlet, ScrollRestoration } from 'react-router-dom';
import Menu from "./Menu/Menu";


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
        <Navbar />
      <div id="conteudo">
      
        
        <Outlet />
      </div>
      
      </div>
  );
}

export default Estrutura;