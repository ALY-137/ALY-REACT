import { addDoc, arrayUnion, serverTimestamp, setDoc } from "firebase/firestore";
import {
  getChatCollectionRefs,
  getContatoDocRefs,
  getConversaDocRefs,
  getFirstRef,
} from "./liveRefs";

export async function garantirContatoConversaLive({
  db,
  currentUidAutenticado = "",
  contactId = "",
  conversationId = "principal",
  tituloLive = "Live",
  blocoId = "",
  ownerUserId = "",
  espacoId = "",
}) {
  const idContato = String(contactId || "").trim();
  const idConversa = String(conversationId || "principal").trim() || "principal";
  const titulo = String(tituloLive || "Live").trim() || "Live";
  const idBloco = String(blocoId || "").trim();

  if (!currentUidAutenticado || !idContato) return;

  const ownerUidContato = String(ownerUserId || "").trim();
  const participantUids = [String(currentUidAutenticado || "").trim(), ownerUidContato].filter(Boolean);

  for (const contatoRef of getContatoDocRefs(db, idContato)) {
    const payloadContato = {
      idContato,
      tipo: "live",
      ownerUserId: ownerUidContato || "",
      espacoId: espacoId || "",
      blocoId: idBloco,
      assunto: titulo,
      ultimaConversaData: serverTimestamp(),
    };
    if (participantUids.length) {
      payloadContato.participantUids = arrayUnion(...participantUids);
    }
    await setDoc(contatoRef, payloadContato, { merge: true });
  }

  for (const conversaRef of getConversaDocRefs(db, idContato, idConversa)) {
    await setDoc(
      conversaRef,
      {
        idContato,
        idConversa,
        assunto: titulo,
        data: serverTimestamp(),
        dataUltimaMensagem: serverTimestamp(),
        ultimaMensagem: "Live iniciada",
      },
      { merge: true }
    );
  }
}

export async function enviarMensagemContatoLive({
  db,
  contactId = "",
  conversationId = "principal",
  mensagem = "",
  tituloLive = "Live",
  userUid = "",
  userRemetente = "",
  ownerUserId = "",
}) {
  const idContato = String(contactId || "").trim();
  const idConversa = String(conversationId || "principal").trim() || "principal";
  const texto = String(mensagem || "").trim();
  if (!idContato || !texto || !userUid) return;

  const chatCollectionRef = getFirstRef(getChatCollectionRefs(db, idContato, idConversa));
  if (!chatCollectionRef) {
    throw new Error("Chat da live indisponivel.");
  }

  await addDoc(chatCollectionRef, {
    mensagem: texto,
    data: serverTimestamp(),
    userRemetente: userRemetente || userUid,
    userUid,
    idConversa: idConversa,
  });

  for (const conversaRef of getConversaDocRefs(db, idContato, idConversa)) {
    await setDoc(
      conversaRef,
      {
        idContato,
        idConversa,
        assunto: String(tituloLive || "Live").trim() || "Live",
        dataUltimaMensagem: serverTimestamp(),
        ultimaMensagem: texto,
      },
      { merge: true }
    );
  }

  for (const contatoRef of getContatoDocRefs(db, idContato)) {
    const participantUids = [String(userUid || "").trim(), String(ownerUserId || "").trim()].filter(Boolean);
    const payloadContato = {
      idContato,
      ultimaConversaData: serverTimestamp(),
    };
    if (participantUids.length) {
      payloadContato.participantUids = arrayUnion(...participantUids);
    }
    await setDoc(contatoRef, payloadContato, { merge: true });
  }
}

