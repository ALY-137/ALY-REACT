import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  activeFirebaseStorageBucket,
} from "../../Banco/init-firebase";
import { resolveProjectDataNamespaceKey } from "../../Banco/projectDataNamespace";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
  obterOwnerUidConfigurado,
} from "../Sistema/configSistema";

function FirebaseProjectBadge({ visible = null }) {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "unknown-host";
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const projectSystemKey =
    String(configSistema?.projectSystemKey || "")
      .trim()
      .toLowerCase() ||
    (typeof window !== "undefined"
      ? String(window.localStorage.getItem("systemProjectContextKey") || "")
          .trim()
          .toLowerCase()
      : "");
  const namespaceKey = resolveProjectDataNamespaceKey(activeFirebaseProjectKey);
  const ownerUid =
    String(obterOwnerUidConfigurado(configSistema) || "")
      .trim()
      .toLowerCase() ||
    (typeof window !== "undefined"
      ? String(window.localStorage.getItem("systemOwnerUid") || "")
          .trim()
          .toLowerCase()
      : "");
  const ownerUidPath = ownerUid || "{ownerUserId}";
  const espacosBasePath = namespaceKey
    ? `projetos/${namespaceKey}/users/${ownerUidPath}/espacos`
    : `users/${ownerUidPath}/espacos`;
  const podeExibir =
    visible === null ? configSistema?.exibirBadgeProjetoFirebase !== false : Boolean(visible);

  if (!podeExibir) {
    return null;
  }

  return (
    <div className="firebaseProjectBadge" title="Projeto Firebase ativo">
      <div>
        <strong>FB:</strong> {activeFirebaseProjectKey || "-"} ({activeFirebaseProjectId || "-"}) @{" "}
        {hostname}
      </div>
      <div>
        <strong>System:</strong> {projectSystemKey || "-"}
      </div>
      <div>
        <strong>Namespace:</strong> {namespaceKey || "raiz"}
      </div>
      <div className="firebaseProjectBadge__path">
        <strong>Base espacos:</strong> {espacosBasePath}
      </div>
      <div className="firebaseProjectBadge__path">
        <strong>Storage:</strong> {activeFirebaseStorageBucket || "default"}
      </div>
    </div>
  );
}

export default FirebaseProjectBadge;
