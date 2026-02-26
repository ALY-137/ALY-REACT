import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

const Navbar = ({ pages = [] }) => {
  const navigate = useNavigate();
  const targetUsername = localStorage.getItem("targetUsername");
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const onePagePublicaAtiva =
    configSistema?.tipoExperiencia === "onepage" &&
    configSistema?.modoAcessoProjeto === "publico_sem_login";
  const redirected = useRef(false);
  const activePage = decodeURIComponent(window.location.pathname.split("/").pop() || "").toLowerCase();

  const menu = pages.map((p) => ({
    ...p,
    tipo: p.isHome ? "home" : "add",
    rota: onePagePublicaAtiva ? `/${p.nome}` : `/${targetUsername}/${p.nome}`,
  }));

  useEffect(() => {
    if (redirected.current) return;
    if ((!onePagePublicaAtiva && !targetUsername) || !menu.length) return;

    const homeItem = menu.find((i) => i.tipo === "home");
    if (homeItem) {
      redirected.current = true;
      navigate(homeItem.rota, { replace: true });
    }
  }, [menu, targetUsername, navigate, onePagePublicaAtiva]);

  if ((!onePagePublicaAtiva && !targetUsername) || !menu.length) return null;

  return (
    <div id="abas" className="navbar-tabs">
      {menu.map((item, index) => (
        <Link
          key={item.id_espaco || item.id || `${item.nome}-${index}`}
          className={
            String(item.nome || "").toLowerCase() === activePage
              ? "navbar-tab navbar-tab--active optionsAbasFoco"
              : "navbar-tab optionsAbas"
          }
          to={item.rota}
        >
          <p>{item.nome}</p>
        </Link>
      ))}
    </div>
  );
};

export default Navbar;
