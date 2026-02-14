import { getAuth } from "firebase/auth";
import { db } from '../../Banco/init-firebase';
import { collection, query, where, getDocs } from "firebase/firestore";

export const buscarSkinLogada = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.warn('Usuário não autenticado.');
    return null;
  }

  const skinUsername = localStorage.getItem('skinLogadoUser');

  if (!skinUsername) {
    console.warn('Skin não definida.');
    return null;
  }

  try {
    const skinsCol = collection(db, 'users', user.uid, 'skins');
    const q = query(skinsCol, where('username', '==', skinUsername));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn('Skin logada não encontrada.');
      return null;
    }

    const docSnap = snapshot.docs[0];

    localStorage.setItem('skinLogadaId', docSnap.id);

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } catch (error) {
    console.error('Erro ao buscar skin logada:', error);
    return null;
  }
};
