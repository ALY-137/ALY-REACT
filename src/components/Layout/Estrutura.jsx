import { useState, useEffect } from 'react';
import Menu from "./Menu/Menu"; // Componente do menu
import Navbar from "./Navbar/Navbar"; // Navbar das páginas
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

function Estrutura({ onRender }) {
  const [menuOpen, setMenuOpen] = useState(false); // Estado do menu
  const location = useLocation();
  const navigate = useNavigate();

  // Recupera o idGoogle do localStorage ao montar o componente
  const idGoogle = localStorage.getItem('idGoogle');

  console.log(idGoogle);

  // Alterna o estado do menu
  const toggleMenu = () => {
    setMenuOpen(prevState => !prevState); // Corrige o toggle para mudar o estado corretamente
    if (!menuOpen) {
      navigate(`/menu/${idGoogle}`); // Navega para o menu ao abrir.
    }
  };

  // Abre o menu automaticamente ao acessar a rota.
  useEffect(() => {
    if (location.pathname === `/menu/${idGoogle}`) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false); // Fecha o menu se a rota não for do menu.
    }
  }, [location, idGoogle]);

  // Executa o callback onRender quando o componente for montado
  useEffect(() => {
    if (onRender) {
      onRender(); // Notifica que o componente foi renderizado
    }
  }, [onRender]); // Dependência do onRender

  return (
    <div id="fundo">
      {/* Renderiza a barra de menu apenas se idGoogle tiver um valor */}
      {idGoogle && (
        <div id="navbar-menu" className="menu-navbar" style={{ textAlign: 'center' }}>
          {/* Ícone de abrir menu centralizado */}
          <p onClick={toggleMenu} style={{ cursor: 'pointer' }}>㆔</p>
        </div>
      )}

      {/* Renderiza o Menu se estiver aberto */}
      {menuOpen ? (
        <Menu menuOpen={menuOpen} setMenuOpen={setMenuOpen}/>
      ) : (
        <>
          {/* Card Profile fica invisível se o menu estiver aberto */}
          <div id="cardProfile" style={{ visibility: 'visible' }}>
            <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem" />
            <div id="MatrixDesign"></div>
            <div id="MatrixDev"></div>
            <div id="MatrixHome"></div>
          </div>

          {/* Navbar de Páginas */}
          <Navbar />

          {/* Conteúdo renderizado via Outlet */}
          <div id="conteudo">
            <Outlet />
          </div>
        </>
      )}
    </div>
  );
}

export default Estrutura;
