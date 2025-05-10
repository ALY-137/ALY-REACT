import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../Banco/init-firebase.js';
import { useRoutesContext } from '../../../context/RoutesContext.js';
import Container from '../Objects/Containers/Container.jsx';

const Navbar = () => {
  const [pages, setPages] = useState([]);
  const skinLocal = localStorage.getItem('skinLocal') || 'defaultSkin'; // Usa o skinLocal salvo no localStorage
  const navigate = useNavigate();
  const { setRoutes } = useRoutesContext();
  

  const fetchPages = async () => {
  try {
    const skinsSnapshot = await db.collectionGroup('skins')
      .where('username', '==', skinLocal)
      .get();

    let pagesList = [];
    let skinId = null;
    let userId = null;

    for (const skinDoc of skinsSnapshot.docs) {
      skinId = skinDoc.id;
      userId = skinDoc.ref.path.split('/')[1]; // 'users/{userId}/skins/{skinId}'

      const pagesSnapshot = await skinDoc.ref.collection('paginas').get();

      for (const pageDoc of pagesSnapshot.docs) {
        const pageData = pageDoc.data();

        const containerRefsSnapshot = await pageDoc.ref.collection('containerRefs').get();
        const containerRefIds = containerRefsSnapshot.docs.map((doc) => doc.data().containerRefId);

        let containersList = [];
        if (containerRefIds.length > 0) {
          const containersSnapshot = await skinDoc.ref.collection('containers')
            .where('id_container', 'in', containerRefIds)
            .get();

          containersList = containersSnapshot.docs.map((doc) => ({
            titulo: doc.data().titulo,
            iconUrl: doc.data().iconUrl,
            id_container: doc.data().id_container,
          }));
        }

        pagesList.push({
          nome: pageData.nome,
          is_main: pageData.is_main,
          containers: containersList,
        });
      }
    }

    return { pagesList, skinId, userId };
  } catch (error) {
    console.error('Erro ao buscar páginas:', error);
    return { pagesList: [], skinId: null, userId: null };
  }
};


 useEffect(() => {
  if (skinLocal) {
    const fetchPagesData = async () => {
      const { pagesList, skinId, userId } = await fetchPages();

      if (!userId || !skinId) {
        console.error("Erro: IDs não foram carregados corretamente.");
        return;
      }

      localStorage.setItem('skinLocalId', skinId);
      localStorage.setItem('userLocalId', userId);

      setPages(pagesList);

      const routes = pagesList.map((page) => ({
        path: page.nome,
        element: (
          <div>
            {page.containers.map((container, index) => (
              <Container
                key={index}
                titulo={container.titulo}
                iconUrl={container.iconUrl}
                id_container={container.id_container}
                id_skin={skinId}
                id_user={userId}
              />
            ))}
          </div>
        ),
      }));

      setRoutes(routes);
    };

    //  Chamada da função adicionada aqui
    fetchPagesData();
  }
}, [skinLocal]);

    

const fetchPagesData = async () => {
  const { pagesList, skinId, userId } = await fetchPages();

  if (!userId || !skinId) {
    console.error("Erro: IDs não foram carregados corretamente.");
    return;
  }

  // Opcional: salvar localmente para futuras execuções
  localStorage.setItem('skinLocalId', skinId);
  localStorage.setItem('userLocalId', userId);

  setPages(pagesList);

  const routes = pagesList.map((page) => ({
    path: page.nome,
    element: (
      <div>
        {page.containers.map((container, index) => (
          <Container
            key={index}
            titulo={container.titulo}
            iconUrl={container.iconUrl}
            id_container={container.id_container}
            id_skin={skinId}
            id_user={userId}
          />
        ))}
      </div>
    ),
  }));

  setRoutes(routes);
};


  useEffect(() => {
    if (pages.length > 0) {
      const mainPage = pages.find((page) => page.is_main === true);
      if (mainPage) {
        navigate(`/${skinLocal}/${mainPage.nome}`);
      }
    }
  }, [pages]);

  return (
    <div id="cabecalho">
      {/* Navbar */}
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
