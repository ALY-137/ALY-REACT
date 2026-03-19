import { getProjectCollectionCandidates, getProjectDocCandidates } from "../../../Banco/projectDataRefs";

export const getFirstRef = (refs = []) => (Array.isArray(refs) && refs.length ? refs[0] : null);

export const getContatoDocRefs = (db, contactId) =>
  getProjectDocCandidates(db, "contatos", contactId);

export const getConversaDocRefs = (db, contactId, conversationId) =>
  getProjectDocCandidates(db, "contatos", contactId, "conversas", conversationId);

export const getChatCollectionRefs = (db, contactId, conversationId) =>
  getProjectCollectionCandidates(db, "contatos", contactId, "conversas", conversationId, "chat");

export const getLiveRtcSessionCollectionRefs = (db, contactId, conversationId) =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc"
  );

export const getLiveRtcSessionDocRefs = (db, contactId, conversationId, viewerUid) =>
  getProjectDocCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc",
    viewerUid
  );

export const getLiveRtcCandidatesCollectionRefs = (
  db,
  contactId,
  conversationId,
  viewerUid,
  side = "viewerCandidates"
) =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc",
    viewerUid,
    side
  );

