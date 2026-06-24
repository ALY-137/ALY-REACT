import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "../../Banco/init-firebase";
import {
  obterConsentimentoLgpdAtual,
  registrarConsentimentoLgpd,
  resolveLgpdPolicySnapshot,
} from "../Sistema/lgpdConsentApi";
import TermosPrivacidadeModal from "./TermosPrivacidadeModal";
import "./lgpd-consent-gate.css";

function LgpdConsentGate({ user, configSistema = {}, onAccepted }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [modalDocumentos, setModalDocumentos] = useState({
    aberto: false,
    aba: "termos",
  });
  const policy = useMemo(
    () => resolveLgpdPolicySnapshot(configSistema),
    [
      configSistema?.projectSystemKey,
      configSistema?.termosUsoUrl,
      configSistema?.termosUsoVersao,
      configSistema?.politicaPrivacidadeUrl,
      configSistema?.politicaPrivacidadeVersao,
    ]
  );

  useEffect(() => {
    let active = true;

    const loadConsent = async () => {
      if (!user?.uid) return;
      setLoading(true);
      setError("");
      try {
        const result = await obterConsentimentoLgpdAtual({ user, configSistema });
        if (!active) return;
        if (result.current || !result.required) {
          setAccepted(true);
          if (typeof onAccepted === "function") onAccepted();
          return;
        }
        setAccepted(false);
      } catch (err) {
        if (!active) return;
        console.warn("Falha ao consultar aceite LGPD:", err);
        setError("Nao foi possivel validar o aceite de privacidade. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadConsent();

    return () => {
      active = false;
    };
  }, [configSistema, onAccepted, user]);

  const handleAccept = async () => {
    if (!user?.uid || saving || !accepted) return;
    setSaving(true);
    setError("");
    try {
      await registrarConsentimentoLgpd({
        user,
        configSistema,
        origem: "gate_login",
        accepted: true,
      });
      if (typeof onAccepted === "function") onAccepted();
    } catch (err) {
      console.warn("Falha ao registrar aceite LGPD:", {
        code: err?.code,
        message: err?.message,
      });
      const permissionDenied = String(err?.code || "").includes("permission-denied");
      setError(
        permissionDenied
          ? "Nao foi possivel salvar o aceite por permissao do Firebase. Verifique se as regras LGPD foram publicadas."
          : "Nao foi possivel salvar o aceite agora. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      // Mantem a tela; o auth state listener finaliza se conseguir sair.
    }
  };

  if (loading) {
    return null;
  }

  return (
    <main className="lgpd-consent-gate" aria-live="polite">
      <section className="lgpd-consent-gate__panel">
        <p className="lgpd-consent-gate__eyebrow">Privacidade e termos</p>
        <h1>Antes de continuar</h1>

        <p>
          Para acessar a area logada deste projeto, confirme que voce leu e aceita os
          documentos atuais.
        </p>

        <div className="lgpd-consent-gate__docs">
          <button
            type="button"
            onClick={() => setModalDocumentos({ aberto: true, aba: "termos" })}
          >
            Termos de uso v{policy.termosUsoVersao}
          </button>
          <button
            type="button"
            onClick={() => setModalDocumentos({ aberto: true, aba: "politica" })}
          >
            Politica de privacidade v{policy.politicaPrivacidadeVersao}
          </button>
        </div>

        <label className="lgpd-consent-gate__check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>Li e aceito os termos e a politica de privacidade vigentes.</span>
        </label>

        {error ? <p className="lgpd-consent-gate__error">{error}</p> : null}

        <div className="lgpd-consent-gate__actions">
          <button type="button" onClick={handleAccept} disabled={!accepted || saving}>
            {saving ? "Salvando..." : "Aceitar e continuar"}
          </button>
          <button type="button" onClick={handleSignOut} disabled={saving}>
            Sair
          </button>
        </div>

        <TermosPrivacidadeModal
          aberto={modalDocumentos.aberto}
          initialTab={modalDocumentos.aba}
          termosUsoUrl={policy.termosUsoUrl}
          termosUsoVersao={policy.termosUsoVersao}
          politicaPrivacidadeUrl={policy.politicaPrivacidadeUrl}
          politicaPrivacidadeVersao={policy.politicaPrivacidadeVersao}
          onClose={() => setModalDocumentos((prev) => ({ ...prev, aberto: false }))}
        />
      </section>
    </main>
  );
}

export default LgpdConsentGate;
