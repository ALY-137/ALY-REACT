import { activeFirebaseProjectId } from "../../Banco/init-firebase";

const normalize = (value) => String(value || "").trim();

const SHARED_BUCKET_OWNER_PROJECT_ID = "teste-aa015";

const SHARED_BUCKET_FUNCTIONS_BASE_URL =
  "https://us-central1-teste-aa015.cloudfunctions.net";

export const usandoBucketCompartilhadoCrossProject = Boolean(
  SHARED_BUCKET_OWNER_PROJECT_ID &&
    activeFirebaseProjectId &&
    SHARED_BUCKET_OWNER_PROJECT_ID !== activeFirebaseProjectId
);

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

async function postSharedBucket(endpoint, user, payload) {
  if (!user?.getIdToken) {
    throw new Error("Usuario autenticado obrigatorio para operar bucket compartilhado.");
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${SHARED_BUCKET_FUNCTIONS_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload || {}),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const err = new Error(body?.error || `Falha em ${endpoint}.`);
    err.code = body?.code || `http-${response.status}`;
    throw err;
  }

  return body;
}

export async function uploadArquivoNoBucketCompartilhado({ user, path, file }) {
  const dataUrl = await fileToDataUrl(file);
  const contentType = normalize(file?.type) || "application/octet-stream";

  const response = await postSharedBucket("uploadArquivoBucketCompartilhado", user, {
    path,
    contentType,
    base64: dataUrl,
  });

  return {
    path: response?.path || path,
    url: response?.url || "",
  };
}

export async function obterUrlArquivoNoBucketCompartilhado({ user, path }) {
  const response = await postSharedBucket("obterUrlArquivoBucketCompartilhado", user, {
    path,
  });

  return response?.url || "";
}

export async function excluirArquivoNoBucketCompartilhado({ user, path }) {
  await postSharedBucket("excluirArquivoBucketCompartilhado", user, {
    path,
  });
}
