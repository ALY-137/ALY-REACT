import firebase from "firebase/app";
import 'firebase/firestore';


export const verificarESalvarskins = async (userId, username, theme) => {
  try {
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(userId);
    const skinssRef = userRef.collection('skins');

    // Verificação global se o username já existe
    const snapshot = await db.collectionGroup('skins').where('username', '==', username).get();

    if (!snapshot.empty) {
      console.log('O nome de usuário da skins já existe.');
      return true;
    }

    // Verificação se já existe alguma skins para o usuário
    const allskinssSnapshot = await skinssRef.get();

    // Gerar um ID único para a skins
    const id_skins = skinssRef.doc().id;

    // Definir se a skins é principal
    const is_main = allskinssSnapshot.empty ? true : false;

    // Adicionar a nova skins
    await skinssRef.doc(id_skins).set({
      id_skins: id_skins,
      username: username,
      theme: theme,
      is_main: is_main,
      data: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Adicionar a página principal (home)
    const paginasRef = skinssRef.doc(id_skins).collection('paginas');
    await paginasRef.doc('home').set({
      id_pagina: 'home',
      nome: 'Home',
      conteudo: 'Conteúdo da página principal',
      data: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log('skins e página principal adicionadas com sucesso!');
    return false;
  } catch (error) {
    console.error('Erro ao verificar e salvar skins:', error);
    return false;
  }
};
