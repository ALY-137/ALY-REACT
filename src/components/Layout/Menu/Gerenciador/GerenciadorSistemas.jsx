import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  criarProjetoNoGerenciador,
  gerarBlocoEnvProjeto,
  listarProjetosNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import { listConfiguredFirebaseProjects } from "../../../../config/firebaseProjects";
import PropriedadesSistema from "../PropriedadesSistema/PropriedadesSistema";

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

const NOMES_FIXOS_PROJETOS = {
  "teste-aa015": "ALY-137",
  "teste-aa15": "ALY-137",
  passyrela: "PASSYRELA",
  obeyon: "OBEYDON",
  obeydon: "OBEYDON",
};

const PROJETOS_FIXOS_MINIMOS = [
  { key: "teste-aa015", nomeProjeto: "ALY-137" },
  { key: "passyrela", nomeProjeto: "PASSYRELA" },
  { key: "obeyon", nomeProjeto: "OBEYDON" },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeHost(value) {
  return normalizeText(value).toLowerCase().replace(/^https?:\/\//i, "").split("/")[0];
}

function nomeProjetoFallback(systemKey = "") {
  const key = normalizeText(systemKey).toLowerCase();
  if (!key) return "";
  return NOMES_FIXOS_PROJETOS[key] || key.toUpperCase();
}

function projetoComCamposPadrao(projeto = {}) {
  const keyNormalizada = normalizeText(projeto.systemKey || projeto.key || projeto.id).toLowerCase();
  const nomeProjeto = normalizeText(projeto.nomeProjeto || nomeProjetoFallback(keyNormalizada));
  const domainsNormalizados = Array.isArray(projeto.domains)
    ? projeto.domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : [];

  return {
    id: projeto.id || keyNormalizada,
    sourceCollection: projeto.sourceCollection || "systems",
    systemKey: keyNormalizada,
    nomeProjeto,
    firebaseProjectId: normalizeText(projeto.firebaseProjectId || projeto.projectId),
    domains: domainsNormalizados,
    firebaseRuntimeConfig:
      projeto.firebaseRuntimeConfig && typeof projeto.firebaseRuntimeConfig === "object"
        ? projeto.firebaseRuntimeConfig
        : {},
    configSistema:
      projeto.configSistema && typeof projeto.configSistema === "object" ? projeto.configSistema : {},
  };
}

function mesclarProjetosGerenciadorComEnv(listaGerenciador = []) {
  const mapa = new Map();

  listaGerenciador.forEach((item) => {
    const projeto = projetoComCamposPadrao(item);
    if (!projeto.systemKey) return;
    mapa.set(projeto.systemKey, projeto);
  });

  listConfiguredFirebaseProjects().forEach((projetoEnv) => {
    const key = normalizeText(projetoEnv.key).toLowerCase();
    if (!key) return;

    const atual = mapa.get(key);
    const domainsMesclados = Array.from(
      new Set([...(atual?.domains || []), ...((projetoEnv.domains || []).map((d) => normalizeHost(d)))]),
    ).filter(Boolean);

    const firebaseRuntimeConfigEnv = {
      ...(projetoEnv.firebaseConfig || {}),
      functionsRegion: projetoEnv.functionsRegion || "us-central1",
    };

    mapa.set(
      key,
      projetoComCamposPadrao({
        ...atual,
        id: atual?.id || `env:${key}`,
        sourceCollection: atual?.sourceCollection || "env",
        systemKey: key,
        nomeProjeto: atual?.nomeProjeto || nomeProjetoFallback(key),
        firebaseProjectId: atual?.firebaseProjectId || projetoEnv.projectId || "",
        domains: domainsMesclados,
        firebaseRuntimeConfig: {
          ...firebaseRuntimeConfigEnv,
          ...(atual?.firebaseRuntimeConfig || {}),
        },
      }),
    );
  });

  PROJETOS_FIXOS_MINIMOS.forEach((projetoBase) => {
    const key = normalizeText(projetoBase.key).toLowerCase();
    if (!key || mapa.has(key)) return;

    mapa.set(
      key,
      projetoComCamposPadrao({
        id: `preset:${key}`,
        sourceCollection: "preset",
        systemKey: key,
        nomeProjeto: projetoBase.nomeProjeto,
      }),
    );
  });

  return Array.from(mapa.values());
}

function GerenciadorProjetos() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [projetos, setProjetos] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [envGerada, setEnvGerada] = useState("");
  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [projetoEmGerenciamento, setProjetoEmGerenciamento] = useState(null);

  const projetosOrdenados = useMemo(
    () => [...projetos].sort((a, b) => a.systemKey.localeCompare(b.systemKey)),
    [projetos]
  );

  const carregarProjetos = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarProjetosNoGerenciador();
      setProjetos(mesclarProjetosGerenciadorComEnv(lista));
    } catch (error) {
      setProjetos(mesclarProjetosGerenciadorComEnv([]));
      setErro("Falha ao carregar projetos do Firestore. Exibindo projetos configurados via ENV.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    carregarProjetos();
  }, [loading]);

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const criarProjeto = async (event) => {
    event.preventDefault();
    setErro("");
    setMensagem("");
    setSalvando(true);
    setEnvGerada("");

    try {
      const criado = await criarProjetoNoGerenciador({
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
      setMensagem("Projeto criado com sucesso.");
      setForm(FORM_INICIAL);
      setMostrarCriacao(false);
      await carregarProjetos();
    } catch (error) {
      setErro(error?.message || "Falha ao criar projeto.");
    } finally {
      setSalvando(false);
    }
  };

  const gerarEnvParaProjetoExistente = (projeto) => {
    const bloco = montarBlocoEnvFinal({
      systemKey: projeto.systemKey,
      domains: projeto.domains || [],
      firebaseConfig: projeto.firebaseRuntimeConfig || {},
    });
    setEnvGerada(bloco);
    setMensagem(`ENV gerada para ${projeto.systemKey}.`);
    setErro("");
  };

  const abrirLoginDoProjeto = (projeto) => {
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    if (!systemKey) return;

    const hostAtual = String(window.location.hostname || "").toLowerCase();
    const executandoNoLocalhost =
      hostAtual === "localhost" || hostAtual === "127.0.0.1" || hostAtual === "::1";
    const dominioConfigurado = Array.isArray(projeto?.domains)
      ? projeto.domains.find(Boolean)
      : "";

    try {
      localStorage.setItem("firebaseProjectTarget", systemKey);
    } catch {
      // Segue mesmo sem storage.
    }

    if (executandoNoLocalhost) {
      window.location.assign(`/?firebaseProject=${encodeURIComponent(systemKey)}`);
      return;
    }

    if (dominioConfigurado) {
      window.location.assign(`https://${dominioConfigurado}/`);
      return;
    }

    window.location.assign(`/?firebaseProject=${encodeURIComponent(systemKey)}`);
  };

  const abrirGerenciadorDoProjeto = (projeto) => {
    setProjetoEmGerenciamento(projeto);
    setMensagem(`Gerenciando projeto: ${projeto.nomeProjeto || projeto.systemKey}.`);
    setErro("");
  };

  if (loading || carregando) {
    return <p>Carregando projetos...</p>;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>GERENCIADO DE PROJETOS</h2>
        <p>Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>GERENCIADO DE PROJETOS</h2>
      <p>Liste projetos ja criados, cadastre novos e gere as envs para deploy.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setMostrarCriacao((prev) => !prev)}>
          {mostrarCriacao ? "Fechar criacao" : "Criar projeto"}
        </button>
        <button type="button" onClick={carregarProjetos}>
          Atualizar lista
        </button>
      </div>

      {mostrarCriacao ? (
        <form
          onSubmit={criarProjeto}
          style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 14 }}
        >
          <h3 style={{ marginTop: 0 }}>Novo projeto</h3>

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
            Chave do projeto (opcional)
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
              {salvando ? "Criando..." : "Criar projeto"}
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>
          {`Projetos ja criados (${projetosOrdenados.length})`}
        </h3>
        {projetosOrdenados.length === 0 ? (
          <p>Nenhum projeto encontrado no gerenciador.</p>
        ) : (
          projetosOrdenados.map((projeto) => (
            <div
              key={projeto.id}
              style={{
                border: "1px solid #666",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>{projeto.nomeProjeto || projeto.systemKey}</strong>
              </p>
              <p style={{ margin: "6px 0 0 0" }}>Key: {projeto.systemKey}</p>
              <p style={{ margin: "2px 0 0 0" }}>
                Firebase Project: {projeto.firebaseProjectId || "-"}
              </p>
              <p style={{ margin: "2px 0 8px 0" }}>
                Dominios: {(projeto.domains || []).join(", ") || "-"}
              </p>
              <p style={{ margin: "2px 0 8px 0", opacity: 0.75 }}>
                Origem: {projeto.sourceCollection || "systems"}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => abrirLoginDoProjeto(projeto)}>
                  Abrir login do projeto
                </button>
                <button type="button" onClick={() => abrirGerenciadorDoProjeto(projeto)}>
                  Abrir gerenciador
                </button>
                <button type="button" onClick={() => gerarEnvParaProjetoExistente(projeto)}>
                  Gerar ENV
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {projetoEmGerenciamento ? (
        <div style={{ marginTop: 12, border: "1px solid #999", borderRadius: 8, padding: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <strong>
              {`Gerenciador: ${
                projetoEmGerenciamento.nomeProjeto || projetoEmGerenciamento.systemKey
              }`}
            </strong>
            <button type="button" onClick={() => setProjetoEmGerenciamento(null)}>
              Fechar gerenciador
            </button>
          </div>

          <PropriedadesSistema
            tituloSecao={`GERENCIAMENTO DO PROJETO: ${
              projetoEmGerenciamento.nomeProjeto || projetoEmGerenciamento.systemKey
            }`}
            projetoGerenciado={projetoEmGerenciamento}
            onConfigSalva={(configSalva) => {
              setProjetos((prev) =>
                prev.map((item) =>
                  item.systemKey === projetoEmGerenciamento.systemKey
                    ? {
                        ...item,
                        configSistema: configSalva,
                        nomeProjeto: configSalva?.tituloSistema || item.nomeProjeto,
                      }
                    : item
                )
              );
            }}
          />
        </div>
      ) : null}

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

export default GerenciadorProjetos;
