import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../Banco/init-firebase.js';
import { useRoutesContext } from '../../../context/RoutesContext.js';
import Container from '../Objects/Containers/Container.jsx';

const Navbar = () => {
  const [pages, setPages] = useState([]);
  const skinLocal = localStorage.getItem('skinLocal') || 'defaultSkin';
  const navigate = useNavigate();
  const { setRoutes } = useRoutesContext();

  // ────────────────────────────────────────────────
  // Buscar páginas corretamente (users/{userId}/paginas)
  // ────────────────────────────────────────────────
  const fetchPages = async () => {
    try {
      // 1. Buscar a skin pelo username usando collectionGroup
      const skinSnapshot = await db
        .collectionGroup("skins")
        .where("username", "==", skinLocal)
        .get();

      if (skinSnapshot.empty) {
        console.error("Nenhuma skin encontrada com o username:", skinLocal);
        return { pagesList: [], skinId: null, userId: null };
      }

      // Documento da skin
      const skinDoc = skinSnapshot.docs[0];
      const skinId = skinDoc.id;

      // Subir até users/{userId}
      const userRef = skinDoc.ref.parent.parent;
      const userId = userRef.id;

      // 2. Buscar páginas em users/{userId}/paginas
      const paginasSnapshot = await userRef
  .collection("paginas")
  .where("skins_relacionadas", "array-contains", skinId)
  .get();


      let pagesList = [];

      for (const pageDoc of paginasSnapshot.docs) {
        const pageData = pageDoc.data();

        // 3. ContainerRefs dentro da página
        const containerRefsSnapshot = await pageDoc.ref
          .collection("containerRefs")
          .get();

        const containerRefIds = containerRefsSnapshot.docs.map(
          doc => doc.data().containerRefId
        );

        let containersList = [];

        // 4. Buscar containers em users/{userId}/containers
        if (containerRefIds.length > 0) {
          const containersSnapshot = await userRef
            .collection("containers")
            .where("id_container", "in", containerRefIds)
            .get();

          containersList = containersSnapshot.docs
            .map((doc) => ({
              titulo: doc.data().titulo,
              iconUrl: doc.data().iconUrl,
              id_container: doc.data().id_container,
              order: doc.data().order ?? 0,
            }))
            .sort((a, b) => a.order - b.order);
        }

        pagesList.push({
          nome: pageData.nome,
          is_main: pageData.is_main,
          orderBy: pageData.orderBy || "default",
          containers: containersList,
        });
      }

      return { pagesList, skinId, userId };

    } catch (error) {
      console.error("Erro ao buscar páginas:", error);
      return { pagesList: [], skinId: null, userId: null };
    }
  };

  // ────────────────────────────────────────────────
  // Carregar páginas + rotas internas
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (skinLocal) {
      const fetchPagesData = async () => {
        const { pagesList, skinId, userId } = await fetchPages();

        if (!userId || !skinId) {
          console.error("Erro: userId ou skinId não encontrados.");
          return;
        }

        localStorage.setItem("skinLocalId", skinId);
        localStorage.setItem("userLocalId", userId);

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

      fetchPagesData();
    }
  }, [skinLocal]);

  // ────────────────────────────────────────────────
  // Ir automaticamente para a página principal
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (pages.length > 0) {
      const mainPage = pages.find((p) => p.is_main);
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
            <p className="numBrilhaHome">{page.nome}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Navbar;
