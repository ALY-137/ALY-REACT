
import { useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = ({ pages = [] }) => {
  const navigate = useNavigate();
  const targetUsername = localStorage.getItem("targetUsername");
  const redirected = useRef(false);
  const activePage = window.location.pathname.split("/").pop(); // última parte da URL


  // Menu formatado
  const menu = pages.map(p => ({
    ...p,
    tipo: p.isHome ? "home" : "add",
    rota: `/${targetUsername}/${p.nome}`
  }));

  // Redirecionamento automático
  useEffect(() => {
    if (redirected.current) return;
    if (!targetUsername || !menu.length) return;

    const homeItem = menu.find(i => i.tipo === "home");
    if (homeItem) {
      redirected.current = true;
      navigate(homeItem.rota, { replace: true });
    }
  }, [menu, targetUsername, navigate]);

  if (!targetUsername || !menu.length) return null;

  return (
   
      <div id="abas">
        {menu.map((item, index) => (
          <Link
            key={item.id_espaco || item.id || `${item.nome}-${index}`}
           className={item.nome === activePage ? "optionsAbasFoco" : "optionsAbas"}

            to={item.rota}
          >
            <p>{item.nome}</p>
          </Link>
        ))}
      </div>

  );
};


export default Navbar;



