import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  criarSistemaNoGerenciador,
  gerarBlocoEnvProjeto,
  listarSistemasNoGerenciador,
} from "../../Sistema/gerenciadorSistemasApi";

function prefixoEnvPorSystemKey(systemKey = "") {
  return String(systemKey || "").replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

function montarBlocoEnvFinal({ systemKey, domains, firebaseConfig }) {
  const prefixo = prefixoEnvPorSystemKey(systemKey);
  const atuais = String(process.env.REACT_APP_FIREBASE_PROJECT_KEYS || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const finalKeys = Array.from(new Set([...atuais, prefixo]));
  const linhaProjectKeys = `REACT_APP_FIREBASE_PROJECT_KEYS=${finalKeys.join(",")}`;
  const blocoProjeto = gerarBlocoEnvProjeto({
    systemKey,
    domains,
    firebaseConfig,
  });
  return `${linhaProjectKeys}\n\n${blocoProjeto}`;
}

const FORM_INICIAL = {
  nomeProjeto: "",
  systemKey: "",
  domains: "",
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  databaseURL: "",
  functionsRegion: "us-central1",
};

function GerenciadorSistemas() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sistemas, setSistemas] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [envGerada, setEnvGerada] = useState("");
  const [mostrarCriacao, setMostrarCriacao] = useState(false);

  const sistemasOrdenados = useMemo(
    () => [...sistemas].sort((a, b) => a.systemKey.localeCompare(b.systemKey)),
    [sistemas]
  );

  const carregarSistemas = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarSistemasNoGerenciador();
      setSistemas(lista);
    } catch (error) {
      setErro("Falha ao carregar sistemas.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    carregarSistemas();
  }, [loading]);

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const criarSistema = async (event) => {
    event.preventDefault();
    setErro("");
    setMensagem("");
    setSalvando(true);
    setEnvGerada("");

    try {
      const criado = await criarSistemaNoGerenciador({
        nomeProjeto: form.nomeProjeto,
        systemKey: form.systemKey,
        domains: form.domains,
        firebaseConfig: {
          apiKey: form.apiKey,
          authDomain: form.authDomain,
          projectId: form.projectId,
          storageBucket: form.storageBucket,
          messagingSenderId: form.messagingSenderId,
          appId: form.appId,
          databaseURL: form.databaseURL,
          functionsRegion: form.functionsRegion,
        },
        criadoPorUid: user?.uid || null,
      });

      const bloco = montarBlocoEnvFinal({
        systemKey: criado.systemKey,
        domains: criado.domains,
        firebaseConfig: criado.firebaseRuntimeConfig,
      });
      setEnvGerada(bloco);
      setMensagem("Sistema criado com sucesso.");
      setForm(FORM_INICIAL);
      setMostrarCriacao(false);
      await carregarSistemas();
    } catch (error) {
      setErro(error?.message || "Falha ao criar sistema.");
    } finally {
      setSalvando(false);
    }
  };

  const gerarEnvParaSistemaExistente = (sistema) => {
    const bloco = montarBlocoEnvFinal({
      systemKey: sistema.systemKey,
      domains: sistema.domains || [],
      firebaseConfig: sistema.firebaseRuntimeConfig || {},
    });
    setEnvGerada(bloco);
    setMensagem(`ENV gerada para ${sistema.systemKey}.`);
    setErro("");
  };

  if (loading || carregando) {
    return <p>Carregando sistemas...</p>;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>GERENCIADOR DE SISTEMAS</h2>
        <p>Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>GERENCIADOR DE SISTEMAS</h2>
      <p>Liste, cadastre e prepare as envs de novos sistemas.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setMostrarCriacao((prev) => !prev)}>
          {mostrarCriacao ? "Fechar criacao" : "Criar projeto"}
        </button>
        <button type="button" onClick={carregarSistemas}>
          Atualizar lista
        </button>
      </div>

      {mostrarCriacao ? (
        <form
          onSubmit={criarSistema}
          style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 14 }}
        >
          <h3 style={{ marginTop: 0 }}>Novo sistema</h3>

          <label htmlFor="nomeProjeto">Nome do projeto</label>
          <input
            id="nomeProjeto"
            type="text"
            required
            value={form.nomeProjeto}
            onChange={(event) => atualizarCampo("nomeProjeto", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="systemKey" style={{ display: "block", marginTop: 8 }}>
            Chave do sistema (opcional)
          </label>
          <input
            id="systemKey"
            type="text"
            value={form.systemKey}
            onChange={(event) => atualizarCampo("systemKey", event.target.value)}
            placeholder="ex: gerenciador-aly"
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="domains" style={{ display: "block", marginTop: 8 }}>
            Dominios (separados por virgula)
          </label>
          <input
            id="domains"
            type="text"
            value={form.domains}
            onChange={(event) => atualizarCampo("domains", event.target.value)}
            placeholder="ex: obeyon.vercel.app, passy.vercel.app"
            style={{ width: "100%", marginTop: 6 }}
          />

          <h4 style={{ marginTop: 12, marginBottom: 8 }}>Credenciais Firebase</h4>

          <label htmlFor="apiKey">API Key</label>
          <input
            id="apiKey"
            type="text"
            required
            value={form.apiKey}
            onChange={(event) => atualizarCampo("apiKey", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="authDomain" style={{ display: "block", marginTop: 8 }}>
            Auth Domain
          </label>
          <input
            id="authDomain"
            type="text"
            required
            value={form.authDomain}
            onChange={(event) => atualizarCampo("authDomain", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="projectId" style={{ display: "block", marginTop: 8 }}>
            Project ID
          </label>
          <input
            id="projectId"
            type="text"
            required
            value={form.projectId}
            onChange={(event) => atualizarCampo("projectId", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="storageBucket" style={{ display: "block", marginTop: 8 }}>
            Storage Bucket
          </label>
          <input
            id="storageBucket"
            type="text"
            required
            value={form.storageBucket}
            onChange={(event) => atualizarCampo("storageBucket", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="messagingSenderId" style={{ display: "block", marginTop: 8 }}>
            Messaging Sender ID
          </label>
          <input
            id="messagingSenderId"
            type="text"
            required
            value={form.messagingSenderId}
            onChange={(event) => atualizarCampo("messagingSenderId", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="appId" style={{ display: "block", marginTop: 8 }}>
            App ID
          </label>
          <input
            id="appId"
            type="text"
            required
            value={form.appId}
            onChange={(event) => atualizarCampo("appId", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="databaseURL" style={{ display: "block", marginTop: 8 }}>
            Database URL (opcional)
          </label>
          <input
            id="databaseURL"
            type="text"
            value={form.databaseURL}
            onChange={(event) => atualizarCampo("databaseURL", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <label htmlFor="functionsRegion" style={{ display: "block", marginTop: 8 }}>
            Functions Region
          </label>
          <input
            id="functionsRegion"
            type="text"
            value={form.functionsRegion}
            onChange={(event) => atualizarCampo("functionsRegion", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />

          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={salvando}>
              {salvando ? "Criando..." : "Criar sistema"}
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Sistemas cadastrados</h3>
        {sistemasOrdenados.length === 0 ? (
          <p>Nenhum sistema cadastrado.</p>
        ) : (
          sistemasOrdenados.map((sistema) => (
            <div
              key={sistema.id}
              style={{
                border: "1px solid #666",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>{sistema.nomeProjeto || sistema.systemKey}</strong>
              </p>
              <p style={{ margin: "6px 0 0 0" }}>Key: {sistema.systemKey}</p>
              <p style={{ margin: "2px 0 0 0" }}>
                Firebase Project: {sistema.firebaseProjectId || "-"}
              </p>
              <p style={{ margin: "2px 0 8px 0" }}>
                Dominios: {(sistema.domains || []).join(", ") || "-"}
              </p>
              <button type="button" onClick={() => gerarEnvParaSistemaExistente(sistema)}>
                Gerar ENV
              </button>
            </div>
          ))
        )}
      </div>

      {envGerada ? (
        <div style={{ marginTop: 12, border: "1px solid #999", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>ENV pronta para Vercel</h3>
          <textarea
            value={envGerada}
            readOnly
            rows={16}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
          />
        </div>
      ) : null}

      {mensagem ? <p style={{ marginTop: 10 }}>{mensagem}</p> : null}
      {erro ? <p style={{ marginTop: 10 }}>{erro}</p> : null}
    </div>
  );
}

export default GerenciadorSistemas;

