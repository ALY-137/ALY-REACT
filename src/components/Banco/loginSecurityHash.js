const HASH_ALGORITHM = "SHA-256";
const HASH_VERSION = "email-password-v1";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return normalizeText(value).toLowerCase();
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value = "") {
  const input = normalizeText(value);
  if (!input) return "";

  const cryptoSubtle = globalThis?.crypto?.subtle;
  if (!cryptoSubtle || typeof TextEncoder === "undefined") {
    return "";
  }

  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await cryptoSubtle.digest(HASH_ALGORITHM, encoded);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export async function buildEmailPasswordLoginSecurityHash({
  uid = "",
  email = "",
  projectKey = "",
} = {}) {
  const uidNormalizado = normalizeText(uid);
  const emailNormalizado = normalizeEmail(email);
  const projectKeyNormalizado = normalizeText(projectKey).toLowerCase();

  if (!uidNormalizado || !emailNormalizado) {
    return null;
  }

  const scope = projectKeyNormalizado || "default";
  const emailHash = await sha256Hex(`email:${scope}:${emailNormalizado}`);
  const loginFingerprintHash = await sha256Hex(
    `email-password:${scope}:${uidNormalizado}:${emailNormalizado}`
  );

  if (!emailHash || !loginFingerprintHash) {
    return null;
  }

  return {
    hashAlgorithm: HASH_ALGORITHM,
    hashVersion: HASH_VERSION,
    emailHash,
    loginFingerprintHash,
    passwordManagedBy: "firebase_auth",
    passwordStoredInApp: false,
  };
}
