import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getFirestore,
  collectionGroup,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { app } from "../../Banco/init-firebase";

const SkinsEspaco = () => {
  const { skinsUsername, espacoId } = useParams();
  const [espaco, setEspaco] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const fetchEspaco = async () => {
      const db = getFirestore(app);

      try {
        // 1️⃣ encontrar skin pelo username
        const skinQuery = query(
          collectionGroup(db, "skins"),
          where("username", "==", skinsUsername),
          limit(1)
        );

        const skinSnap = await getDocs(skinQuery);

        if (skinSnap.empty) {
          setErro("Skin não encontrada");
          return;
        }

        const skinDoc = skinSnap.docs[0];
        const skinId = skinDoc.id;
        const userId = skinDoc.ref.parent.parent.id;

        // 2️⃣ buscar espaço no USER
        const espacoRef = doc(db, "users", userId, "espacos", espacoId);
        const espacoSnap = await getDoc(espacoRef);

        if (!espacoSnap.exists()) {
          setErro("Espaço não encontrado");
          return;
        }

        const espacoData = espacoSnap.data();

        // 3️⃣ validar se o espaço pertence à skin
        const relacionadas = Array.isArray(espacoData.skins_relacionadas)
          ? espacoData.skins_relacionadas
          : [];

        if (!relacionadas.includes(skinId)) {
          setErro("Este espaço não pertence a esta skin");
          return;
        }

        setEspaco(espacoData);

      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar espaço");
      }
    };

    fetchEspaco();
  }, [skinsUsername, espacoId]);

  if (erro) return <p>{erro}</p>;
  if (!espaco) return <p>Carregando...</p>;

  return (
    <div>
      <h1>{espaco.nome}</h1>

      {espaco.conteudo && (
        <div dangerouslySetInnerHTML={{ __html: espaco.conteudo }} />
      )}
    </div>
  );
};

export default SkinsEspaco;
