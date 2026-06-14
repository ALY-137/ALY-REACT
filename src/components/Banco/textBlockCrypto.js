const TEXT_BLOCK_CRYPTO_VERSION = "text-block-v1";
const TEXT_BLOCK_ALGORITHM = "AES-GCM";
const TEXT_BLOCK_KDF = "PBKDF2-SHA-256";
const TEXT_BLOCK_ITERATIONS = 120000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (base64 = "") => {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getSubtleCrypto = () => {
  const subtle = globalThis?.crypto?.subtle;
  if (!subtle || typeof TextEncoder === "undefined" || typeof TextDecoder === "undefined") {
    throw new Error("Criptografia indisponivel neste navegador.");
  }
  return subtle;
};

async function deriveTextBlockKey(secret = "", saltBytes) {
  const secretNormalizado = String(secret || "");
  if (!secretNormalizado) {
    throw new Error("Informe a chave de criptografia do texto.");
  }

  const subtle = getSubtleCrypto();
  const baseKey = await subtle.importKey(
    "raw",
    encoder.encode(secretNormalizado),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: TEXT_BLOCK_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: TEXT_BLOCK_ALGORITHM,
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptTextBlockContent(plainText = "", secret = "") {
  const cryptoApi = globalThis?.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Gerador criptografico indisponivel neste navegador.");
  }

  const saltBytes = cryptoApi.getRandomValues(new Uint8Array(16));
  const ivBytes = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveTextBlockKey(secret, saltBytes);
  const subtle = getSubtleCrypto();
  const encryptedBuffer = await subtle.encrypt(
    {
      name: TEXT_BLOCK_ALGORITHM,
      iv: ivBytes,
    },
    key,
    encoder.encode(String(plainText || ""))
  );

  return {
    version: TEXT_BLOCK_CRYPTO_VERSION,
    algorithm: TEXT_BLOCK_ALGORITHM,
    kdf: TEXT_BLOCK_KDF,
    iterations: TEXT_BLOCK_ITERATIONS,
    salt: bytesToBase64(saltBytes),
    iv: bytesToBase64(ivBytes),
    data: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function decryptTextBlockContent(encryptedPayload = {}, secret = "") {
  const saltBytes = base64ToBytes(encryptedPayload?.salt);
  const ivBytes = base64ToBytes(encryptedPayload?.iv);
  const encryptedBytes = base64ToBytes(encryptedPayload?.data);
  const key = await deriveTextBlockKey(secret, saltBytes);
  const subtle = getSubtleCrypto();
  const decryptedBuffer = await subtle.decrypt(
    {
      name: TEXT_BLOCK_ALGORITHM,
      iv: ivBytes,
    },
    key,
    encryptedBytes
  );

  return decoder.decode(decryptedBuffer);
}

export function isEncryptedTextBlockPayload(value = null) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.version === TEXT_BLOCK_CRYPTO_VERSION &&
      value.algorithm === TEXT_BLOCK_ALGORITHM &&
      value.salt &&
      value.iv &&
      value.data
  );
}

export function shouldEncryptTextBlockForVisibility(visibilidade = "") {
  const valor = String(visibilidade || "publico").trim().toLowerCase();
  return [
    "publico_restritivo",
    "privado",
    "exclusivo_assinante",
    "exclusivo_comprador",
    "comprado",
  ].includes(valor);
}
