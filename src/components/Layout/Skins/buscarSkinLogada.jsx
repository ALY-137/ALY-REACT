import { db } from '../../Banco/init-firebase';

export const buscarSkinLogada = async () => {
  const idGoogleCap = localStorage.getItem('idGoogleCap');
  const skinUsername = localStorage.getItem('skinLogadoUser');

  if (!idGoogleCap || !skinUsername) {
    console.warn('Usuário ou skin não logado.');
    return null;
  }

  try {
    const skinsRef = db.collection('users').doc(idGoogleCap).collection('skins');
    const snapshot = await skinsRef.where('username', '==', skinUsername).get();

    if (snapshot.empty) {
      console.warn('Skin logada não encontrada.');
      return null;
    }

    const doc = snapshot.docs[0];
    const skinData = doc.data();

    // Armazena o ID do documento em localStorage (ou use como quiser)
    localStorage.setItem('skinLogadaId', doc.id);

    return { id: doc.id, ...skinData };
  } catch (error) {
    console.error('Erro ao buscar skin logada:', error);
    return null;
  }
};
