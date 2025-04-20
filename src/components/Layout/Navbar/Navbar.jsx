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
      if (!skinLocal) {
        throw new Error("skinLocal está vazio");
      }

      // UTILIZANDO VARIAVEL LOCAL DO USERNAME DA SKIN BUSCO A SKIN ATUAL.
      // FOI USADO COLLECTION GROUP PARA BUSCAR O UERNAME EM TODAS A COLEÇÕES COM O NOME SKINS NO BANCO DE DADOS.
      
      const skinsSnapshot = await db.collectionGroup('skins')
        .where('username', '==', skinLocal)
        .get();


      let pagesList = [];


      // AQUI OBTEMOS O DOCUMENTO DE SKINS 
      for (const skinDoc of skinsSnapshot.docs) {
        const pagesSnapshot = await skinDoc.ref.collection('paginas').get();

     
        // JÁ SELECIONADO A SKIN ATUAL CAPTURA SEU IP E ATRIBUI A UMA VARIAVEL LOCAL.
        localStorage.setItem('skinLocalId', skinDoc.id);


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

      


      
      return pagesList;
    } catch (error) {
      console.error('Erro ao buscar páginas:', error);
      return [];
    }
  };

  useEffect(() => {
    if (skinLocal) {
      
      // CHAMA A VARIAVEL LOCAL PARA PASSAR COMO PROP PARA CARREGAR OS CONTAINERS.
      const skinLocalId = localStorage.getItem('skinLocalId');
      const userLocalId = localStorage.getItem('userLocalId');
      if (!userLocalId) {
        console.error('ID do usuário não encontrado no localStorage!');
      } else {
        console.log('ID do usuário recuperado:', userLocalId);
      }
    

      const fetchPagesData = async () => {
        const pagesData = await fetchPages();
        setPages(pagesData);

  
    
        const routes = pagesData.map((page) => ({
          path: page.nome,
          element: (
            <div>
              {page.containers.map((container, index) => (
                <Container key={index} titulo={container.titulo} iconUrl={container.iconUrl} id_container={container.id_container} id_skin={skinLocalId} id_user={userLocalId} />
              ))}
            </div>
          ),
        }));

        setRoutes(routes);
      };

      fetchPagesData();
    }
  }, [skinLocal]);

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
