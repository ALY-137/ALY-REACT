import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDoc } from "firebase/firestore";

import { db } from "../../Banco/init-firebase";
import { getProjectDocCandidates } from "../../Banco/projectDataRefs";
import {
  findSkinByUsernameAcrossProject,
  getOwnerUidFromSkinDoc,
} from "../Skins/skinLookup";

const SkinsEspaco = () => {
  const { skinsUsername, espacoId } = useParams();
  const [espaco, setEspaco] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const fetchEspaco = async () => {
      try {
        const skinDoc = await findSkinByUsernameAcrossProject(db, skinsUsername, {
          authenticated: false,
          allowPrivateWhenAuthenticated: false,
          includeLegacy: true,
        });

        if (!skinDoc) {
          setErro("Skin nao encontrada");
          return;
        }

        const skinId = skinDoc.id;
        const userId = getOwnerUidFromSkinDoc(skinDoc);
        if (!userId) {
          setErro("Owner da skin nao encontrado");
          return;
        }

        let espacoSnap = null;
        for (const espacoRef of getProjectDocCandidates(db, "users", userId, "espacos", espacoId)) {
          const snapAtual = await getDoc(espacoRef).catch(() => null);
          if (snapAtual?.exists?.()) {
            espacoSnap = snapAtual;
            break;
          }
        }

        if (!espacoSnap?.exists?.()) {
          setErro("Espaco nao encontrado");
          return;
        }

        const espacoData = espacoSnap.data();
        const relacionadas = Array.isArray(espacoData.skins_relacionadas)
          ? espacoData.skins_relacionadas
          : [];

        if (!relacionadas.includes(skinId)) {
          setErro("Este espaco nao pertence a esta skin");
          return;
        }

        setEspaco(espacoData);
      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar espaco");
      }
    };

    fetchEspaco();
  }, [skinsUsername, espacoId]);

  if (erro) return <p>{erro}</p>;
  if (!espaco) return <p>Carregando...</p>;

  return (
    <div>
      <h1>{espaco.nome}</h1>
      {espaco.conteudo && <div dangerouslySetInnerHTML={{ __html: espaco.conteudo }} />}
    </div>
  );
};

export default SkinsEspaco;

