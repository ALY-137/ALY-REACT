import { activeFirebaseProjectKey } from "./init-firebase";
import {
  decryptTextBlockContent,
  encryptTextBlockContent,
  isEncryptedTextBlockPayload,
} from "./textBlockCrypto";

const CHAT_CRYPTO_VERSION = "chat-message-v1";

const normalizeText = (value = "") => String(value || "").trim();

const getProjectContextKey = () => {
  if (typeof window === "undefined") return "";
  try {
    return normalizeText(window.localStorage.getItem("systemProjectContextKey"));
  } catch {
    return "";
  }
};

const buildChatSecret = ({ contactId = "", conversationId = "" } = {}) =>
  [
    CHAT_CRYPTO_VERSION,
    normalizeText(activeFirebaseProjectKey),
    getProjectContextKey(),
    normalizeText(contactId),
    normalizeText(conversationId),
  ].join(":");

export async function encryptChatMessageText(message = "", context = {}) {
  const encrypted = await encryptTextBlockContent(message, buildChatSecret(context));
  return {
    ...encrypted,
    chatVersion: CHAT_CRYPTO_VERSION,
  };
}

export async function decryptChatMessageText(payload = {}, context = {}) {
  if (!isEncryptedTextBlockPayload(payload)) return "";
  return decryptTextBlockContent(payload, buildChatSecret(context));
}

export function shouldDecryptChatMessage(data = {}) {
  return Boolean(data?.mensagemCriptografada && isEncryptedTextBlockPayload(data?.mensagemCriptografia));
}

export function getEncryptedChatPreview(data = {}) {
  return normalizeText(data?.mensagemPreview) || "Mensagem criptografada";
}
