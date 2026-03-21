import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  criarProjetoNoGerenciador,
  gerarBlocoEnvProjeto,
  limparEnvsProjetoNoVercel,
  listarProjetosNoGerenciador,
  removerProjetoNoGerenciador,
  salvarConfigProjetoNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import { listConfiguredFirebaseProjects } from "../../../../config/firebaseProjects";
import PropriedadesSistema from "../PropriedadesSistema/PropriedadesSistema";

const VERCEL_ENV_AUTOMATION_ENABLED =
  String(process.env.REACT_APP_VERCEL_ENV_AUTOMATION || "").toLowerCase() === "true";
const SYSTEM_KEYS_OCULTAS_STORAGE_KEY = "gerenciadorProjetos.systemKeysOcultas";
const FIREBASE_PROJECT_ALIASES_STORAGE_KEY = "firebaseProjectAliases";
const NON_CONFIGURABLE_MANAGER_SYSTEM_KEYS = new Set(["aly-onepages-runtime"]);

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

function montarChecklistRemocaoEnvVercel(systemKey = "") {
  const prefixo = prefixoEnvPorSystemKey(systemKey);
  if (!prefixo) return "";

  const envsProjeto = [
    `REACT_APP_FIREBASE_${prefixo}_KEY`,
    `REACT_APP_FIREBASE_${prefixo}_API_KEY`,
    `REACT_APP_FIREBASE_${prefixo}_AUTH_DOMAIN`,
    `REACT_APP_FIREBASE_${prefixo}_PROJECT_ID`,
    `REACT_APP_FIREBASE_${prefixo}_STORAGE_BUCKET`,
    `REACT_APP_FIREBASE_${prefixo}_MESSAGING_SENDER_ID`,
    `REACT_APP_FIREBASE_${prefixo}_APP_ID`,
    `REACT_APP_FIREBASE_${prefixo}_DATABASE_URL`,
    `REACT_APP_FIREBASE_${prefixo}_FUNCTIONS_REGION`,
    `REACT_APP_FIREBASE_${prefixo}_DOMAINS`,
  ];

  return [
    `# Limpeza manual de ENV no Vercel para ${systemKey}`,
    "",
    "1) No Vercel: Project > Settings > Environment Variables",
    "2) Remova (se existirem) as chaves abaixo:",
    ...envsProjeto.map((item) => `- ${item}`),
    "",
    `3) Edite REACT_APP_FIREBASE_PROJECT_KEYS removendo ${prefixo}`,
    "",
    "4) Faça um novo Deploy no Vercel para aplicar a mudanca.",
  ].join("\n");
}

const FORM_INICIAL = {
  nomeProjeto: "",
  systemKey: "",
  tipoProjeto: "multiowner",
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
  obeyon: "OBEYDON",
  obeydon: "OBEYDON",
};

const PROJETOS_FIXOS_MINIMOS = [
  { key: "teste-aa015", nomeProjeto: "ALY-137" },
  { key: "obeyon", nomeProjeto: "OBEYDON" },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeHost(value) {
  return normalizeText(value).toLowerCase().replace(/^https?:\/\//i, "").split("/")[0];
}

function normalizeTipoProjeto(value) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "onepage") return "oneowner";
  if (raw === "multipage") return "multiowner";
  return raw === "oneowner" ? "oneowner" : "multiowner";
}

function resolveTipoProjetoProjeto(projeto = {}) {
  const configTipoExperiencia = normalizeText(projeto?.configSistema?.tipoExperiencia);
  if (configTipoExperiencia) {
    return normalizeTipoProjeto(configTipoExperiencia);
  }

  return normalizeTipoProjeto(projeto?.tipoProjeto || "multiowner");
}

function isNonConfigurableManagerProject(item = {}) {
  const systemKey = normalizeText(item?.systemKey || item?.key || item?.id).toLowerCase();
  return NON_CONFIGURABLE_MANAGER_SYSTEM_KEYS.has(systemKey);
}

function carregarSystemKeysOcultasStorage() {
  try {
    const raw = localStorage.getItem(SYSTEM_KEYS_OCULTAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.map((item) => normalizeText(item).toLowerCase()).filter(Boolean))
    );
  } catch {
    return [];
  }
}

function nomeProjetoFallback(systemKey = "") {
  const key = normalizeText(systemKey).toLowerCase();
  if (!key) return "";
  return NOMES_FIXOS_PROJETOS[key] || key.toUpperCase();
}

function resolverFirebaseTargetPorProjeto(projeto) {
  const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
  const firebaseProjectId = normalizeText(projeto?.firebaseProjectId).toLowerCase();
  const projetosConfigurados = listConfiguredFirebaseProjects();

  const matchByKey = projetosConfigurados.find(
    (item) => normalizeText(item?.key).toLowerCase() === systemKey
  );
  if (matchByKey?.key) {
    return normalizeText(matchByKey.key);
  }

  const matchByProjectId = projetosConfigurados.find(
    (item) => normalizeText(item?.projectId).toLowerCase() === firebaseProjectId
  );
  if (matchByProjectId?.key) {
    return normalizeText(matchByProjectId.key);
  }

  return systemKey;
}

function validarFormularioCriacao(form, oneownerRuntimeProjectId) {
  const nomeProjeto = normalizeText(form?.nomeProjeto);
  if (!nomeProjeto) {
    return "Informe o nome do projeto.";
  }

  const tipoProjeto = normalizeTipoProjeto(form?.tipoProjeto);
  if (tipoProjeto === "oneowner") {
    if (!normalizeText(oneownerRuntimeProjectId)) {
      return "Runtime oneowner nao configurado no .env.local.";
    }
    return "";
  }

  const camposObrigatorios = [
    { key: "apiKey", label: "API Key" },
    { key: "authDomain", label: "Auth Domain" },
    { key: "projectId", label: "Project ID" },
    { key: "storageBucket", label: "Storage Bucket" },
    { key: "messagingSenderId", label: "Messaging Sender ID" },
    { key: "appId", label: "App ID" },
  ];

  const faltando = camposObrigatorios
    .filter((campo) => !normalizeText(form?.[campo.key]))
    .map((campo) => campo.label);

  if (faltando.length > 0) {
    return `Preencha os campos obrigatorios: ${faltando.join(", ")}.`;
  }

  return "";
}

function projetoComCamposPadrao(projeto = {}) {
  const keyNormalizada = normalizeText(projeto.systemKey || projeto.key || projeto.id).toLowerCase();
  const nomeProjeto = normalizeText(projeto.nomeProjeto || nomeProjetoFallback(keyNormalizada));
  const tipoProjeto = resolveTipoProjetoProjeto(projeto);
  const domainsNormalizados = Array.isArray(projeto.domains)
    ? projeto.domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : [];

  return {
    id: projeto.id || keyNormalizada,
    sourceCollection: projeto.sourceCollection || "systems",
    systemKey: keyNormalizada,
    nomeProjeto,
    tipoProjeto,
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
    if (isNonConfigurableManagerProject(item)) return;
    const projeto = projetoComCamposPadrao(item);
    if (!projeto.systemKey) return;
    mapa.set(projeto.systemKey, projeto);
  });

  listConfiguredFirebaseProjects().forEach((projetoEnv) => {
    const key = normalizeText(projetoEnv.key).toLowerCase();
    if (!key || NON_CONFIGURABLE_MANAGER_SYSTEM_KEYS.has(key)) return;

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
  const [checklistRemocaoEnv, setChecklistRemocaoEnv] = useState("");
  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [projetoEmGerenciamento, setProjetoEmGerenciamento] = useState(null);
  const [domainsProjetoEdicao, setDomainsProjetoEdicao] = useState("");
  const [salvandoDomainsProjeto, setSalvandoDomainsProjeto] = useState(false);
  const [limpandoEnvSystemKey, setLimpandoEnvSystemKey] = useState("");
  const [removendoProjetoSystemKey, setRemovendoProjetoSystemKey] = useState("");
  const [systemKeysOcultas, setSystemKeysOcultas] = useState(() =>
    carregarSystemKeysOcultasStorage()
  );
  const oneownerRuntimeProjectId = normalizeText(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_PROJECT_ID
  );

  const projetosOrdenados = useMemo(
    () => [...projetos].sort((a, b) => a.systemKey.localeCompare(b.systemKey)),
    [projetos]
  );

  const carregarProjetos = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarProjetosNoGerenciador();
      const projetosMesclados = mesclarProjetosGerenciadorComEnv(lista);
      setProjetos(
        projetosMesclados.filter(
          (item) => !systemKeysOcultas.includes(normalizeText(item?.systemKey).toLowerCase())
        )
      );
    } catch (error) {
      const projetosMesclados = mesclarProjetosGerenciadorComEnv([]);
      setProjetos(
        projetosMesclados.filter(
          (item) => !systemKeysOcultas.includes(normalizeText(item?.systemKey).toLowerCase())
        )
      );
      setErro("Falha ao carregar projetos do Firestore. Exibindo projetos configurados via ENV.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    carregarProjetos();
  }, [loading, systemKeysOcultas]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SYSTEM_KEYS_OCULTAS_STORAGE_KEY,
        JSON.stringify(systemKeysOcultas)
      );
    } catch {
      // Segue sem persistencia caso localStorage esteja indisponivel.
    }
  }, [systemKeysOcultas]);

  useEffect(() => {
    const aliases = {};
    projetos.forEach((projeto) => {
      const key = normalizeText(projeto?.systemKey).toLowerCase();
      const target = resolverFirebaseTargetPorProjeto(projeto);
      if (!key || !target) return;
      aliases[key] = target;
    });

    try {
      localStorage.setItem(
        FIREBASE_PROJECT_ALIASES_STORAGE_KEY,
        JSON.stringify(aliases)
      );
    } catch {
      // Segue sem persistencia de aliases.
    }
  }, [projetos]);

  useEffect(() => {
    if (!projetoEmGerenciamento) {
      setDomainsProjetoEdicao("");
      return;
    }

    setDomainsProjetoEdicao((projetoEmGerenciamento.domains || []).join(", "));
  }, [projetoEmGerenciamento]);

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

    const erroValidacao = validarFormularioCriacao(form, oneownerRuntimeProjectId);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    setEnvGerada("");
    setChecklistRemocaoEnv("");

    try {
      const criado = await criarProjetoNoGerenciador({
        nomeProjeto: form.nomeProjeto,
        systemKey: form.systemKey,
        tipoProjeto: normalizeTipoProjeto(form.tipoProjeto),
        domains: form.domains,
        firebaseConfig:
          normalizeTipoProjeto(form.tipoProjeto) === "oneowner"
            ? {}
            : {
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
      const keyCriada = normalizeText(criado.systemKey).toLowerCase();
      setSystemKeysOcultas((prev) => prev.filter((item) => item !== keyCriada));
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
    setChecklistRemocaoEnv("");
    setMensagem(`ENV gerada para ${projeto.systemKey}.`);
    setErro("");
  };

  const limparEnvVercelDoProjeto = async (projeto) => {
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    if (!systemKey || limpandoEnvSystemKey || removendoProjetoSystemKey) return;

    if (!VERCEL_ENV_AUTOMATION_ENABLED) {
      setErro("");
      setEnvGerada("");
      setChecklistRemocaoEnv(montarChecklistRemocaoEnvVercel(systemKey));
      setMensagem(
        `Automacao de limpeza no Vercel esta desativada neste ambiente. Use o checklist manual para ${systemKey}.`
      );
      return;
    }

    setErro("");
    setMensagem("");
    setChecklistRemocaoEnv("");
    setLimpandoEnvSystemKey(systemKey);

    try {
      const resultado = await limparEnvsProjetoNoVercel({ systemKey });
      const removidas = Number(resultado?.removedCount || 0);
      const projectKeysAtualizados = Number(resultado?.updatedProjectKeysCount || 0);
      const projectKeysIgnorados = Number(resultado?.skippedProjectKeysCount || 0);

      let detalhes = `ENV removidas: ${removidas}.`;
      if (projectKeysAtualizados > 0) {
        detalhes += ` REACT_APP_FIREBASE_PROJECT_KEYS atualizado em ${projectKeysAtualizados} ambiente(s).`;
      }
      if (projectKeysIgnorados > 0) {
        detalhes += ` ${projectKeysIgnorados} ambiente(s) sem valor legivel de REACT_APP_FIREBASE_PROJECT_KEYS.`;
      }

      setMensagem(`Limpeza no Vercel concluida para ${systemKey}. ${detalhes}`);
    } catch (error) {
      setErro(error?.message || "Falha ao limpar ENV no Vercel.");
    } finally {
      setLimpandoEnvSystemKey("");
    }
  };

  const removerProjetoComEnvs = async (projeto) => {
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    if (!systemKey || limpandoEnvSystemKey || removendoProjetoSystemKey) return;

    const nomeProjeto = projeto?.nomeProjeto || systemKey;
    const mensagemFluxoEnv = VERCEL_ENV_AUTOMATION_ENABLED
      ? "1. Limpar as ENV desse projeto no Vercel automaticamente."
      : "1. Nao sera possivel limpar ENV automaticamente (modo manual).";
    const confirma = window.confirm(
      `Remover o projeto "${nomeProjeto}"?\n\nIsso vai:\n${mensagemFluxoEnv}\n2. Remover o projeto da lista no Gerenciador.`
    );

    if (!confirma) return;

    setErro("");
    setMensagem("");
    setChecklistRemocaoEnv("");
    setRemovendoProjetoSystemKey(systemKey);

    try {
      const resultado = await removerProjetoNoGerenciador({
        systemKey,
        removerEnvVercel: VERCEL_ENV_AUTOMATION_ENABLED,
        ignorarErroLimpezaEnv: true,
      });
      const envRemovidas = Number(resultado?.envCleanup?.removedCount || 0);
      const docsRemovidos = Array.isArray(resultado?.docsRemovidos)
        ? resultado.docsRemovidos.length
        : 0;
      const envCleanupError = normalizeText(resultado?.envCleanupError);

      setProjetos((prev) =>
        prev.filter((item) => normalizeText(item?.systemKey).toLowerCase() !== systemKey)
      );
      setSystemKeysOcultas((prev) =>
        prev.includes(systemKey) ? prev : [...prev, systemKey]
      );
      setProjetoEmGerenciamento((atual) =>
        normalizeText(atual?.systemKey).toLowerCase() === systemKey ? null : atual
      );

      if (VERCEL_ENV_AUTOMATION_ENABLED && !envCleanupError) {
        setMensagem(
          `Projeto ${systemKey} removido. ENV removidas no Vercel: ${envRemovidas}. Registros removidos: ${docsRemovidos}.`
        );
      } else {
        setChecklistRemocaoEnv(montarChecklistRemocaoEnvVercel(systemKey));
        const detalheErro = envCleanupError
          ? ` Erro da automacao: ${envCleanupError}`
          : "";
        setMensagem(
          `Projeto ${systemKey} removido do gerenciador. Limpeza de ENV no Vercel precisa ser manual.${detalheErro}`
        );
      }
    } catch (error) {
      setErro(error?.message || "Falha ao remover projeto e ENV no Vercel.");
    } finally {
      setRemovendoProjetoSystemKey("");
    }
  };

  const abrirLoginDoProjeto = (projeto) => {
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    const firebaseTarget = resolverFirebaseTargetPorProjeto(projeto);
    if (!systemKey || !firebaseTarget) return;

    const hostAtual = String(window.location.hostname || "").toLowerCase();
    const executandoNoLocalhost =
      hostAtual === "localhost" || hostAtual === "127.0.0.1" || hostAtual === "::1";
    const dominioConfigurado = Array.isArray(projeto?.domains)
      ? projeto.domains.find(Boolean)
      : "";

    try {
      localStorage.setItem("firebaseProjectTarget", firebaseTarget);
    } catch {
      // Segue mesmo sem storage.
    }

    if (executandoNoLocalhost) {
      window.location.assign(`/?firebaseProject=${encodeURIComponent(firebaseTarget)}`);
      return;
    }

    if (dominioConfigurado) {
      window.location.assign(`https://${dominioConfigurado}/`);
      return;
    }

    window.location.assign(`/?firebaseProject=${encodeURIComponent(firebaseTarget)}`);
  };

  const abrirGerenciadorDoProjeto = (projeto) => {
    setProjetoEmGerenciamento(projeto);
    setMensagem(`Gerenciando projeto: ${projeto.nomeProjeto || projeto.systemKey}.`);
    setErro("");
  };

  const salvarDomainsProjeto = async () => {
    const projeto = projetoEmGerenciamento;
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    if (!systemKey || salvandoDomainsProjeto) return;

    setSalvandoDomainsProjeto(true);
    setErro("");
    setMensagem("");

    try {
      const domainsNormalizados = Array.from(
        new Set(
          normalizeText(domainsProjetoEdicao)
            .split(",")
            .map((item) => normalizeHost(item))
            .filter(Boolean)
        )
      );

      await salvarConfigProjetoNoGerenciador({
        projectKey: projeto.systemKey,
        projectId: projeto.firebaseProjectId || projeto.firebaseRuntimeConfig?.projectId || "",
        domains: domainsNormalizados,
        configSistema: projeto.configSistema || {},
        atualizadoPorUid: user?.uid || null,
      });

      const projetoAtualizado = {
        ...projeto,
        domains: domainsNormalizados,
      };

      setProjetoEmGerenciamento(projetoAtualizado);
      setProjetos((prev) =>
        prev.map((item) =>
          item.systemKey === projeto.systemKey
            ? {
                ...item,
                domains: domainsNormalizados,
              }
            : item
        )
      );
      setMensagem(`Dominios atualizados para ${projeto.nomeProjeto || projeto.systemKey}.`);
    } catch (error) {
      setErro(error?.message || "Falha ao salvar dominios do projeto.");
    } finally {
      setSalvandoDomainsProjeto(false);
    }
  };

  if (loading || carregando) {
    return <p>Carregando projetos...</p>;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>GERENCIADO DE PROJETOS</h2>
        <p>Acesso restrito ao owner.</p>
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
          noValidate
          style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 14 }}
        >
          <h3 style={{ marginTop: 0 }}>Novo projeto</h3>
          {erro ? <p style={{ marginTop: 0 }}>{erro}</p> : null}
          {mensagem ? <p style={{ marginTop: 0 }}>{mensagem}</p> : null}

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

          <label htmlFor="tipoProjeto" style={{ display: "block", marginTop: 8 }}>
            Tipo do projeto
          </label>
          <select
            id="tipoProjeto"
            value={form.tipoProjeto}
            onChange={(event) => atualizarCampo("tipoProjeto", event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          >
            <option value="multiowner">Multiowner</option>
            <option value="oneowner">Oneowner</option>
          </select>

          {normalizeTipoProjeto(form.tipoProjeto) === "oneowner" ? (
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              {`Oneowner usa runtime padrao: ${oneownerRuntimeProjectId || "nao configurado"}.`}
            </p>
          ) : null}

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

          {normalizeTipoProjeto(form.tipoProjeto) !== "oneowner" ? (
            <>
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
            </>
          ) : null}

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
                Tipo: {normalizeTipoProjeto(projeto.tipoProjeto) === "oneowner" ? "Oneowner" : "Multiowner"}
              </p>
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
                <button
                  type="button"
                  onClick={() => limparEnvVercelDoProjeto(projeto)}
                  disabled={Boolean(limpandoEnvSystemKey || removendoProjetoSystemKey)}
                >
                  {limpandoEnvSystemKey === projeto.systemKey
                    ? "Limpando ENV..."
                    : VERCEL_ENV_AUTOMATION_ENABLED
                      ? "Limpar ENV no Vercel"
                      : "Limpeza ENV (manual)"}
                </button>
                <button
                  type="button"
                  onClick={() => removerProjetoComEnvs(projeto)}
                  disabled={Boolean(limpandoEnvSystemKey || removendoProjetoSystemKey)}
                >
                  {removendoProjetoSystemKey === projeto.systemKey
                    ? "Removendo projeto..."
                    : "Remover projeto"}
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

          <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Dominios do projeto</h3>
            <label
              htmlFor="domainsProjetoEdicao"
              style={{ display: "block", marginBottom: 6 }}
            >
              Dominios vinculados a este oneowner/projeto
            </label>
            <input
              id="domainsProjetoEdicao"
              type="text"
              value={domainsProjetoEdicao}
              onChange={(event) => setDomainsProjetoEdicao(event.target.value)}
              placeholder="ex: passyrela.vercel.app, novodominio.com"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={salvarDomainsProjeto} disabled={salvandoDomainsProjeto}>
                {salvandoDomainsProjeto ? "Salvando dominios..." : "Salvar dominios"}
              </button>
            </div>
            <p style={{ marginTop: 8, opacity: 0.75 }}>
              Esse campo precisa listar todos os hostnames que devem abrir este mesmo projeto.
            </p>
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

      {checklistRemocaoEnv ? (
        <div style={{ marginTop: 12, border: "1px solid #999", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Checklist de remocao de ENV (manual)</h3>
          <textarea
            value={checklistRemocaoEnv}
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
