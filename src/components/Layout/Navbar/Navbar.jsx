import { Link } from "react-router-dom";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

const Navbar = ({ pages = [] }) => {
  const targetUsername = localStorage.getItem("targetUsername");
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const onePagePublicaAtiva = isOnePageComEntradaPublica(configSistema);
  const activePage = decodeURIComponent(window.location.pathname.split("/").pop() || "").toLowerCase();

  const menu = pages.map((p) => ({
    ...p,
    tipo: p.isHome ? "home" : "add",
    rota: onePagePublicaAtiva ? `/${p.nome}` : `/${targetUsername}/${p.nome}`,
  }));

  if ((!onePagePublicaAtiva && !targetUsername) || !menu.length) return null;

  return (
    <div className="menu-navbar">
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
            <span className="navbar-tab__content">
              {String(item.iconUrl || "").trim() ? (
                <img
                  className="navbar-tab__icon"
                  src={String(item.iconUrl || "").trim()}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              <p>{item.nome}</p>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Navbar;
