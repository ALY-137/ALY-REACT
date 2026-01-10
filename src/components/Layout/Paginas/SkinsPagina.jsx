import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';

const SkinsPagina = () => {
  const { skinsUsername, paginaId } = useParams();
  const [pagina, setPagina] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const fetchPagina = async () => {
      const db = firebase.firestore();

      try {
        // 1️⃣ descobrir user e skin pelo USERNAME da skin
        const usersSnap = await db.collection("users").get();

        let userId = null;
        let skinId = null;

        for (const userDoc of usersSnap.docs) {
          const skinsSnap = await userDoc.ref
            .collection("skins")
            .where("username", "==", skinsUsername)
            .get();

          if (!skinsSnap.empty) {
            userId = userDoc.id;
            skinId = skinsSnap.docs[0].id; // <-- ID real da SKIN
            break;
          }
        }

        if (!userId || !skinId) {
          setErro("Skin não encontrada");
          return;
        }

        // 2️⃣ buscar página dentro desse usuário
        const pageSnap = await db
          .collection("users")
          .doc(userId)
          .collection("paginas")
          .doc(paginaId)
          .get();

        if (!pageSnap.exists) {
          setErro("Página não encontrada");
          return;
        }

        const pageData = pageSnap.data();

        // 3️⃣ validar relacionamento da página com a SKIN
        if (
          !Array.isArray(pageData.skins_relacionadas) ||
          !pageData.skins_relacionadas.includes(skinId)
        ) {
          setErro("Página não relacionada a esta skin");
          return;
        }

        // 4️⃣ OK — página pertence à skin aberta
        setPagina(pageData);

      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar página");
      }
    };

    fetchPagina();
  }, [skinsUsername, paginaId]);

  if (erro) return <p>{erro}</p>;
  if (!pagina) return <p>Carregando...</p>;

  return (
    <div>
      <h1>{pagina.nome}</h1>

      {pagina.conteudo && (
        <div
          dangerouslySetInnerHTML={{ __html: pagina.conteudo }}
        />
      )}
    </div>
  );
};

export default SkinsPagina;
