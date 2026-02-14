// bootstrapUser.js
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

import { db } from "../../../Banco/init-firebase";

export const bootstrapUser = async (user) => {
  if (!user?.uid) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  // ─────────────────────────────
  // 🆕 USER NOVO
  // ─────────────────────────────
  if (!userSnap.exists()) {
    // cria user
    await setDoc(userRef, {
      idGoogle: user.uid,
      nomeGoogle: user.displayName?.split(" ")[0] || "",
      nomeCompletoGoogle: user.displayName || "",
      emailGoogle: user.email || "",
      picGoogle: user.photoURL || "",
      isAdmin: false,
      createdAt: serverTimestamp(),
    });

    // registra login
    await addDoc(collection(userRef, "logins"), {
      data: serverTimestamp(),
    });


    return { isNew: true };
  }

  // ─────────────────────────────
  // 👤 USER EXISTENTE → LOGIN
  // ─────────────────────────────
  await addDoc(collection(userRef, "logins"), {
    data: serverTimestamp(),
  });

  return { isNew: false };
};
