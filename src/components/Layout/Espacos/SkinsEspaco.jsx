import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import firebase from "firebase/app";
import "firebase/firestore";

const SkinsEspaco = () => {
  const { skinsUsername, espacoId } = useParams();
  const [espaco, setEspaco] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const fetchEspaco = async () => {
      const db = firebase.firestore();

      try {
        // 1️⃣ achar skin pelo username
        const skinSnap = await db
          .collectionGroup("skins")
          .where("username", "==", skinsUsername)
          .limit(1)
          .get();

        if (skinSnap.empty) {
          setErro("Skin não encontrada");
          return;
        }

        const skinDoc = skinSnap.docs[0];
        const skinId = skinDoc.id;
        const userId = skinDoc.ref.parent.parent.id;

        // 2️⃣ buscar espaço DENTRO da skin
        const espacoSnap = await db
          .collection("users")
          .doc(userId)
          .collection("skins")
          .doc(skinId)
          .collection("espacos")
          .doc(espacoId)
          .get();

        if (!espacoSnap.exists) {
          setErro("Espaço não encontrado");
          return;
        }

        setEspaco(espacoSnap.data());

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
