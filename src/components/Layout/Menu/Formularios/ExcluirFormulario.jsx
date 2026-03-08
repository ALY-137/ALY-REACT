import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../../Banco/init-firebase";
import { getPrimaryProjectDoc } from "../../../Banco/projectDataRefs";

const ExcluirFormulario = async (formToDelete) => {
  try {
    const usuarioId = String(formToDelete?.usuarioId || "").trim();
    const formId = String(formToDelete?.formId || "").trim();
    if (!usuarioId || !formId) return;

    const userDocRef = getPrimaryProjectDoc(db, "users", usuarioId);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return;

    const formDocRef = doc(collection(userDoc.ref, "formularios"), formId);
    const formDoc = await getDoc(formDocRef);
    if (!formDoc.exists()) return;

    const respostasSnapshot = await getDocs(collection(formDoc.ref, "respostas"));
    await Promise.all(respostasSnapshot.docs.map((respostaDoc) => deleteDoc(respostaDoc.ref)));
    await deleteDoc(formDoc.ref);
  } catch (error) {
    console.error("Erro ao excluir formulario:", error);
    throw error;
  }
};

export default ExcluirFormulario;
