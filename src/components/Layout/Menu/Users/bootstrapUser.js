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
  if (typeof user.getIdToken === "function") {
    try {
      await user.getIdToken();
    } catch {
      // Mantem tentativa de bootstrap mesmo com falha transitória de token.
    }
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  // ─────────────────────────────
  // 🆕 USER NOVO
  // ─────────────────────────────
  if (!userSnap.exists()) {
    // cria user
    await setDoc(
      userRef,
      {
        uid: user.uid,
        idGoogle: user.uid,
        nomeGoogle: user.displayName?.split(" ")[0] || "",
        nomeCompletoGoogle: user.displayName || "",
        emailGoogle: user.email || "",
        picGoogle: user.photoURL || "",
        isAdmin: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // registra login
    await addDoc(collection(userRef, "logins"), {
      data: serverTimestamp(),
    });


    return { isNew: true };
  }

  // ─────────────────────────────
  // 👤 USER EXISTENTE → LOGIN
  // ─────────────────────────────
  await setDoc(
    userRef,
    {
      uid: user.uid,
      nomeGoogle: user.displayName?.split(" ")[0] || "",
      nomeCompletoGoogle: user.displayName || "",
      emailGoogle: user.email || "",
      picGoogle: user.photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(collection(userRef, "logins"), {
    data: serverTimestamp(),
  });

  return { isNew: false };
};
