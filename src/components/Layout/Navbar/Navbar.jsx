import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';


const Navbar = ({ pages = [] }) => {
  const skinLocal = localStorage.getItem("skinLocal");
  const navigate = useNavigate();

  useEffect(() => {
    if (!pages.length) return;

    const mainPage = pages.find(p => p.is_main);

    if (mainPage) {
      navigate(`/${skinLocal}/${mainPage.nome}`, { replace: true });
    }
  }, [pages]);

  return (
    <div id="cabecalho">
      <div id="abas">
        {pages.map((page, index) => (
          <Link
            key={index}
            className="optionsAbasFocoHome"
            to={`/${skinLocal}/${page.nome}`}
          >
            <p className="numBrilhaHome">{page.nome}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};
export default Navbar;