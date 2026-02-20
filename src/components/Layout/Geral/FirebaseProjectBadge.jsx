import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  activeFirebaseStorageBucket,
} from "../../Banco/init-firebase";

function FirebaseProjectBadge() {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "unknown-host";

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
