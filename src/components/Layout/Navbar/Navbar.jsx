import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../Banco/init-firebase.js';
import { useRoutesContext } from '../../../context/RoutesContext.js';
import Containers from '../Objects/Containers/Containers.jsx';

const Navbar = () => {
  const [pages, setPages] = useState([]);
  const skinLocal = localStorage.getItem('skinLocal');
  const navigate = useNavigate();
  const { setRoutes } = useRoutesContext();

  
  const fetchPages = async () => {
    try {
      if (!skinLocal) {
        throw new Error("skinLocal está vazio");
      }

      const skinsSnapshot = await db.collectionGroup('skins')
        .where('username', '==', skinLocal)
        .get();

      let pagesList = [];
      for (const skinDoc of skinsSnapshot.docs) {
        const pagesSnapshot = await skinDoc.ref.collection('paginas').get();
        for (const pageDoc of pagesSnapshot.docs) {
          const containersSnapshot = await pageDoc.ref.collection('containers').get();
          const containersList = containersSnapshot.docs.map((doc) => ({
            titulo: doc.data().titulo,
            iconUrl: doc.data().iconUrl,
          }));

          pagesList.push({
            nome: pageDoc.data().nome,
            subTheme: pageDoc.data().subTheme,
            className: pageDoc.data().className,
            containers: containersList,
            is_main: pageDoc.data().is_main 
          });
        }
      }

      return pagesList;
    } catch (error) {
      console.error('Erro ao buscar páginas:', error);
      return [];
    }
  };

  const getMainPage = (pages) => {
    return pages.find((page) => page.is_main === true);
  };

  useEffect(() => {
    if (skinLocal) {
      const fetchPagesData = async () => {
        const pagesData = await fetchPages();
        setPages(pagesData);

        // Adiciona dinamicamente as rotas com base nas páginas e containers
        const routes = pagesData.map((page) => ({
          path: page.nome,
          element: (
            <div>
              {page.containers.map((containers, index) => (
                <Containers key={index} titulo={containers.titulo} iconUrl={containers.iconUrl} />
              ))}
            </div>
          ),
        }));

        // Adiciona dinamicamente as rotas ao roteador
        setRoutes(routes);
      };

      fetchPagesData();
    }
  }, [skinLocal]);

  useEffect(() => {
    if (pages.length > 0) {
      const mainPage = getMainPage(pages);
      if (mainPage) {
        navigate(`/${skinLocal}/${mainPage.nome}`);
      }
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
            <p id={`txtAbaHome`} className="numBrilhaHome">{page.nome}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Navbar;
