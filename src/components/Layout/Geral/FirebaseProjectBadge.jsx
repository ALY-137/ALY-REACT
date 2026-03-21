import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  activeFirebaseStorageBucket,
} from "../../Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";

function FirebaseProjectBadge({ visible = null }) {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "unknown-host";
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const podeExibir =
    visible === null ? configSistema?.exibirBadgeProjetoFirebase !== false : Boolean(visible);

  if (!podeExibir) {
    return null;
  }

  return (
    <div className="firebaseProjectBadge" title="Projeto Firebase ativo">
      <strong>FB:</strong> {activeFirebaseProjectKey} ({activeFirebaseProjectId}) @{" "}
      {hostname}
      <br />
      <strong>Storage:</strong> {activeFirebaseStorageBucket || "default"}
    </div>
  );
}

export default FirebaseProjectBadge;
