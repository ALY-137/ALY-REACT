import { db } from '../../Banco/init-firebase';
import { collection, query, where, getDocs } from "firebase/firestore";

export const buscarSkinLogada = async () => {
  const idGoogleCap = localStorage.getItem('idGoogleCap');
  const skinUsername = localStorage.getItem('skinLogadoUser');

  if (!idGoogleCap || !skinUsername) {
    console.warn('Usuário ou skin não logado.');
    return null;
  }

  try {
    // Referência da coleção de skins do usuário
    const skinsCol = collection(db, 'users', idGoogleCap, 'skins');

    // Cria a query filtrando pelo username da skin logada
    const q = query(skinsCol, where('username', '==', skinUsername));

    // Executa a query
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn('Skin logada não encontrada.');
      return null;
    }

    const docSnap = snapshot.docs[0];
    const skinData = docSnap.data();

    // Armazena o ID do documento em localStorage
    localStorage.setItem('skinLogadaId', docSnap.id);

    return { id: docSnap.id, ...skinData };
  } catch (error) {
    console.error('Erro ao buscar skin logada:', error);
    return null;
  }
};
