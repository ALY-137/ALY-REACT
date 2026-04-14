import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  criarProjetoNoGerenciador,
  gerarBlocoEnvProjeto,
  limparEnvsProjetoNoVercel,
  listarPreconfiguracoesNoGerenciador,
  listarProjetosNoGerenciador,
  removerProjetoNoGerenciador,
  salvarConfigProjetoNoGerenciador,
  salvarPreconfiguracaoProjetoNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import {
  obterManagerProjectIdConfigurado,
  obterManagerProjectLabel,
} from "../../Sistema/configSistema";
import {
  getProjectStatusLabel,
  normalizeProjectStatus,
  PROJECT_STATUS_OPTIONS,
} from "../../Sistema/projectStatus";
import { listConfiguredFirebaseProjects } from "../../../../config/firebaseProjects";
import PropriedadesSistema from "./PropriedadesSistema/PropriedadesSistema";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";

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
  preconfigKey: "",
  tipoProjeto: "multiowner",
  domains: "",
  ownerUid: "",
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
  if (raw === "manager" || raw === "menager" || raw === "gerenciador") return "manager";
  if (raw === "onepage") return "oneowner";
  if (raw === "multipage") return "multiowner";
  if (raw === "oneowner") return "oneowner";
  return raw === "manager" ? "manager" : "multiowner";
}

function rotuloTipoProjeto(tipoProjeto = "") {
  const normalizado = normalizeTipoProjeto(tipoProjeto);
  if (normalizado === "oneowner") return "Oneowner";
  if (normalizado === "manager") return "Manager";
  return "Multiowner";
}

function resolveTipoProjetoProjeto(projeto = {}) {
  const managerProjectId = normalizeText(obterManagerProjectIdConfigurado()).toLowerCase();
  const systemKeyProjeto = normalizeText(projeto?.systemKey || projeto?.key || projeto?.id).toLowerCase();
  const firebaseProjectIdProjeto = normalizeText(
    projeto?.firebaseProjectId ||
      projeto?.projectId ||
      projeto?.firebaseRuntimeConfig?.projectId ||
      projeto?.configSistema?.firebaseProjectId
  ).toLowerCase();

  if (
    managerProjectId &&
    (systemKeyProjeto === managerProjectId || firebaseProjectIdProjeto === managerProjectId)
  ) {
    return "manager";
  }

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
  const tipoProjeto = resolveTipoProjetoProjeto(projeto);
  const projetosConfigurados = listConfiguredFirebaseProjects();

  if ((tipoProjeto === "oneowner" || tipoProjeto === "manager") && firebaseProjectId) {
    const matchByProjectId = projetosConfigurados.find(
      (item) => normalizeText(item?.projectId).toLowerCase() === firebaseProjectId
    );
    if (matchByProjectId?.key) {
      return normalizeText(matchByProjectId.key);
    }
  }

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

  return tipoProjeto === "oneowner" || tipoProjeto === "manager"
    ? normalizeText(firebaseProjectId || systemKey)
    : systemKey;
}

function limparCachesLocaisProjeto(systemKey = "", domains = []) {
  const keyNormalizada = normalizeText(systemKey).toLowerCase();
  if (typeof window === "undefined" || !keyNormalizada) return;

  try {
    const aliases = JSON.parse(localStorage.getItem(FIREBASE_PROJECT_ALIASES_STORAGE_KEY) || "{}");
    if (aliases && typeof aliases === "object") {
      delete aliases[keyNormalizada];
      localStorage.setItem(FIREBASE_PROJECT_ALIASES_STORAGE_KEY, JSON.stringify(aliases));
    }
  } catch {
    // Ignora indisponibilidade de storage local.
  }

  try {
    const targetAtual = normalizeText(localStorage.getItem("firebaseProjectTarget")).toLowerCase();
    if (targetAtual === keyNormalizada) {
      localStorage.removeItem("firebaseProjectTarget");
    }
  } catch {
    // Ignora indisponibilidade de storage local.
  }

  try {
    const contextoAtual = normalizeText(localStorage.getItem("systemProjectContextKey")).toLowerCase();
    if (contextoAtual === keyNormalizada) {
      localStorage.removeItem("systemProjectContextKey");
    }
  } catch {
    // Ignora indisponibilidade de storage local.
  }

  domains.forEach((domain) => {
    const host = normalizeHost(domain);
    if (!host) return;
    try {
      localStorage.removeItem(`firebaseManagerDomain:v2:${host}`);
    } catch {
      // Ignora indisponibilidade de storage local.
    }
  });
}

function aplicarPreconfigAoFormulario(formAnterior, preconfig) {
  if (!preconfig) {
    return {
      ...FORM_INICIAL,
      nomeProjeto: formAnterior?.nomeProjeto || "",
      systemKey: formAnterior?.systemKey || "",
      domains: formAnterior?.domains || "",
      ownerUid: formAnterior?.ownerUid || "",
    };
  }

  const tipoProjeto = normalizeTipoProjeto(preconfig?.tipoProjeto);
  const firebaseTemplate =
    preconfig?.firebaseRuntimeTemplate && typeof preconfig.firebaseRuntimeTemplate === "object"
      ? preconfig.firebaseRuntimeTemplate
      : {};

  return {
    ...FORM_INICIAL,
    preconfigKey: normalizeText(preconfig?.preconfigKey),
    nomeProjeto: formAnterior?.nomeProjeto || "",
    systemKey: formAnterior?.systemKey || "",
    domains: formAnterior?.domains || "",
    ownerUid:
      tipoProjeto === "oneowner"
        ? formAnterior?.ownerUid || normalizeText(preconfig?.configSistemaTemplate?.ownerUid)
        : "",
    tipoProjeto,
    functionsRegion: normalizeText(firebaseTemplate?.functionsRegion || "us-central1") || "us-central1",
  };
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
  const statusProjeto = normalizeProjectStatus(
    projeto?.configSistema?.statusProjeto || projeto?.statusProjeto,
    {
      projectSystemKey:
        projeto?.configSistema?.projectSystemKey || projeto.systemKey || projeto.key || projeto.id,
      firebaseProjectId:
        projeto.firebaseProjectId ||
        projeto.projectId ||
        projeto?.firebaseRuntimeConfig?.projectId ||
        projeto?.configSistema?.firebaseProjectId,
      systemKey: projeto.systemKey || projeto.key || projeto.id,
      nomeProjeto,
      tituloSistema: projeto?.configSistema?.tituloSistema,
    }
  );
  const domainsNormalizados = Array.isArray(projeto.domains)
    ? projeto.domains.map((domain) => normalizeHost(domain)).filter(Boolean)
    : [];

  return {
    id: projeto.id || keyNormalizada,
    sourceCollection: projeto.sourceCollection || "systems",
    systemKey: keyNormalizada,
    nomeProjeto,
    tipoProjeto,
    statusProjeto,
    firebaseProjectId: normalizeText(
      projeto.firebaseProjectId ||
        projeto.projectId ||
        projeto?.firebaseRuntimeConfig?.projectId ||
        projeto?.configSistema?.firebaseProjectId
    ),
    domains: domainsNormalizados,
    firebaseRuntimeConfig:
      projeto.firebaseRuntimeConfig && typeof projeto.firebaseRuntimeConfig === "object"
        ? projeto.firebaseRuntimeConfig
        : {},
    preconfigBaseKey: normalizeText(projeto.preconfigBaseKey),
    preconfigBaseName: normalizeText(projeto.preconfigBaseName),
    configSistema:
      projeto.configSistema && typeof projeto.configSistema === "object"
        ? {
            ...projeto.configSistema,
            statusProjeto,
          }
        : { statusProjeto },
  };
}

function resolverIconeProjeto(projeto = {}) {
  return normalizeText(
    projeto?.configSistema?.faviconUrl ||
      projeto?.configSistema?.logoLoginUrl ||
      projeto?.configSistema?.cardProfileUrl
  );
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
  const managerProjectLabel = obterManagerProjectLabel();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [projetos, setProjetos] = useState([]);
  const [preconfiguracoes, setPreconfiguracoes] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [envGerada, setEnvGerada] = useState("");
  const [checklistRemocaoEnv, setChecklistRemocaoEnv] = useState("");
  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [projetoEmGerenciamento, setProjetoEmGerenciamento] = useState(null);
  const [filtroTipoProjeto, setFiltroTipoProjeto] = useState("todos");
  const [domainsProjetoEdicao, setDomainsProjetoEdicao] = useState("");
  const [statusProjetoEdicao, setStatusProjetoEdicao] = useState("ativo");
  const [addOnIdsProjetoEdicao, setAddOnIdsProjetoEdicao] = useState([]);
  const [salvandoDomainsProjeto, setSalvandoDomainsProjeto] = useState(false);
  const [limpandoEnvSystemKey, setLimpandoEnvSystemKey] = useState("");
  const [removendoProjetoSystemKey, setRemovendoProjetoSystemKey] = useState("");
  const [salvandoPreconfigSystemKey, setSalvandoPreconfigSystemKey] = useState("");
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
  const preconfigSelecionada = useMemo(
    () =>
      preconfiguracoes.find(
        (item) => normalizeText(item?.preconfigKey) === normalizeText(form.preconfigKey)
      ) || null,
    [form.preconfigKey, preconfiguracoes]
  );
  const projetosFiltrados = useMemo(() => {
    if (filtroTipoProjeto === "todos") return projetosOrdenados;
    return projetosOrdenados.filter(
      (projeto) => resolveTipoProjetoProjeto(projeto) === filtroTipoProjeto
    );
  }, [filtroTipoProjeto, projetosOrdenados]);
  const carregarProjetos = async () => {
    setCarregando(true);
    setErro("");
    try {
      const lista = await listarProjetosNoGerenciador();
      let listaPreconfiguracoes = [];
      let avisoPreconfig = "";

      try {
        listaPreconfiguracoes = await listarPreconfiguracoesNoGerenciador();
      } catch (error) {
        avisoPreconfig =
          error?.message || "Falha ao carregar pre-configuracoes do gerenciador.";
      }

      const projetosMesclados = mesclarProjetosGerenciadorComEnv(lista);
      setPreconfiguracoes(listaPreconfiguracoes);
      setProjetos(
        projetosMesclados.filter(
          (item) => !systemKeysOcultas.includes(normalizeText(item?.systemKey).toLowerCase())
        )
      );
      if (avisoPreconfig) {
        setErro(avisoPreconfig);
      }
    } catch (error) {
      const projetosMesclados = mesclarProjetosGerenciadorComEnv([]);
      setPreconfiguracoes([]);
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
      setStatusProjetoEdicao("ativo");
      setAddOnIdsProjetoEdicao([]);
      return;
    }

    setDomainsProjetoEdicao((projetoEmGerenciamento.domains || []).join(", "));
    setStatusProjetoEdicao(
      normalizeProjectStatus(
        projetoEmGerenciamento?.configSistema?.statusProjeto ||
          projetoEmGerenciamento?.statusProjeto,
        {
          projectSystemKey:
            projetoEmGerenciamento?.configSistema?.projectSystemKey ||
            projetoEmGerenciamento?.systemKey,
          firebaseProjectId: projetoEmGerenciamento?.firebaseProjectId,
          systemKey: projetoEmGerenciamento?.systemKey,
          nomeProjeto: projetoEmGerenciamento?.nomeProjeto,
          tituloSistema: projetoEmGerenciamento?.configSistema?.tituloSistema,
        }
      )
    );
    setAddOnIdsProjetoEdicao(
      Array.isArray(projetoEmGerenciamento?.configSistema?.addOnIdsDisponiveis)
        ? Array.from(
            new Set(
              projetoEmGerenciamento.configSistema.addOnIdsDisponiveis
                .map((item) => normalizeText(item))
                .filter(Boolean)
            )
          )
        : []
    );
  }, [projetoEmGerenciamento]);

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const selecionarPreconfiguracao = (preconfigKey) => {
    const chaveNormalizada = normalizeText(preconfigKey);
    const preconfig = preconfiguracoes.find(
      (item) => normalizeText(item?.preconfigKey) === chaveNormalizada
    );

    setForm((prev) => ({
      ...aplicarPreconfigAoFormulario(prev, preconfig),
      preconfigKey: chaveNormalizada,
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
        ownerUid: form.ownerUid,
        preconfigInicial: preconfigSelecionada,
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
      limparCachesLocaisProjeto(systemKey, projeto?.domains || []);
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

  const salvarPreconfiguracaoProjeto = async (projeto) => {
    const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
    if (!systemKey || salvandoPreconfigSystemKey) return;

    const nomePadrao =
      normalizeText(projeto?.preconfigBaseName) ||
      normalizeText(projeto?.nomeProjeto) ||
      systemKey;
    const nomePreconfig = window.prompt(
      "Nome da pre-configuracao inicial:",
      nomePadrao
    );

    if (nomePreconfig === null) return;
    if (!normalizeText(nomePreconfig)) {
      setErro("Informe um nome valido para a pre-configuracao.");
      return;
    }

    setSalvandoPreconfigSystemKey(systemKey);
    setErro("");
    setMensagem("");

    try {
      const resultado = await salvarPreconfiguracaoProjetoNoGerenciador({
        projeto,
        preconfigKey:
          normalizeText(projeto?.preconfigBaseKey) || normalizeText(projeto?.systemKey),
        nomePreconfig,
        atualizadoPorUid: user?.uid || null,
      });

      setPreconfiguracoes((prev) => {
        const demais = prev.filter(
          (item) => normalizeText(item?.preconfigKey) !== normalizeText(resultado?.preconfigKey)
        );
        return [...demais, resultado].sort((a, b) =>
          normalizeText(a?.nomePreconfig).localeCompare(normalizeText(b?.nomePreconfig))
        );
      });

      setProjetos((prev) =>
        prev.map((item) =>
          normalizeText(item?.systemKey).toLowerCase() === systemKey
            ? {
                ...item,
                preconfigBaseKey: normalizeText(resultado?.preconfigKey),
                preconfigBaseName: normalizeText(resultado?.nomePreconfig),
              }
            : item
        )
      );
      setProjetoEmGerenciamento((atual) =>
        normalizeText(atual?.systemKey).toLowerCase() === systemKey
          ? {
              ...atual,
              preconfigBaseKey: normalizeText(resultado?.preconfigKey),
              preconfigBaseName: normalizeText(resultado?.nomePreconfig),
            }
          : atual
      );
      setMensagem(`Pre-configuracao salva: ${resultado?.nomePreconfig || nomePreconfig}.`);
    } catch (error) {
      setErro(error?.message || "Falha ao salvar pre-configuracao do projeto.");
    } finally {
      setSalvandoPreconfigSystemKey("");
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
        configSistema: {
          ...(projeto.configSistema || {}),
          statusProjeto: statusProjetoEdicao,
          addOnIdsDisponiveis: addOnIdsProjetoEdicao,
        },
        atualizadoPorUid: user?.uid || null,
      });

      const projetoAtualizado = {
        ...projeto,
        domains: domainsNormalizados,
        statusProjeto: statusProjetoEdicao,
        configSistema: {
          ...(projeto.configSistema || {}),
          statusProjeto: statusProjetoEdicao,
          addOnIdsDisponiveis: addOnIdsProjetoEdicao,
        },
      };

      setProjetoEmGerenciamento(projetoAtualizado);
      setProjetos((prev) =>
        prev.map((item) =>
          item.systemKey === projeto.systemKey
            ? {
                ...item,
                domains: domainsNormalizados,
                statusProjeto: statusProjetoEdicao,
                configSistema: {
                  ...(item.configSistema || {}),
                  statusProjeto: statusProjetoEdicao,
                  addOnIdsDisponiveis: addOnIdsProjetoEdicao,
                },
              }
            : item
        )
      );
      setMensagem(
        `Projeto atualizado: dominios e status de ${projeto.nomeProjeto || projeto.systemKey}.`
      );
    } catch (error) {
      setErro(error?.message || "Falha ao salvar dominios do projeto.");
    } finally {
      setSalvandoDomainsProjeto(false);
    }
  };

  if (loading || carregando) {
    return <ProjectLoadingFallback text="Carregando projetos..." />;
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setMostrarCriacao((prev) => !prev)}>
          {mostrarCriacao ? "Fechar criacao" : "Criar projeto"}
        </button>
        <button type="button" onClick={carregarProjetos}>
          Atualizar lista
        </button>
        <label
          htmlFor="filtroTipoProjeto"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}
        >
          <span>Filtro:</span>
          <select
            id="filtroTipoProjeto"
            value={filtroTipoProjeto}
            onChange={(event) => setFiltroTipoProjeto(event.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="multiowner">Multiowners</option>
            <option value="oneowner">Oneowners</option>
            <option value="manager">Manager</option>
          </select>
        </label>
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
            Slug / identificador do projeto (opcional)
          </label>
          <input
            id="systemKey"
            type="text"
            value={form.systemKey}
            onChange={(event) => atualizarCampo("systemKey", event.target.value)}
            placeholder="ex: passyrela"
            style={{ width: "100%", marginTop: 6 }}
          />
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            {normalizeTipoProjeto(form.tipoProjeto) === "oneowner"
              ? "Esta slug identifica o projeto dentro do sistema. Em oneowner ela continua unica, mesmo usando o runtime Firebase compartilhado."
              : "Esta slug identifica o projeto dentro do sistema e precisa ser unica."}
          </p>

          <label htmlFor="preconfigKey" style={{ display: "block", marginTop: 8 }}>
            Pre-configuracao inicial
          </label>
          <select
            id="preconfigKey"
            value={form.preconfigKey}
            onChange={(event) => selecionarPreconfiguracao(event.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          >
            <option value="">Nenhuma</option>
            {preconfiguracoes.map((item) => (
              <option key={item.preconfigKey} value={item.preconfigKey}>
                {`${item.nomePreconfig} (${rotuloTipoProjeto(item.tipoProjeto)})`}
              </option>
            ))}
          </select>
          {preconfigSelecionada ? (
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              {`Baseando novo projeto em: ${preconfigSelecionada.nomePreconfig}. Titulo e dominios continuam livres.`}
            </p>
          ) : null}

          <label htmlFor="tipoProjeto" style={{ display: "block", marginTop: 8 }}>
            Tipo do projeto
          </label>
          <select
            id="tipoProjeto"
            value={form.tipoProjeto}
            onChange={(event) => atualizarCampo("tipoProjeto", event.target.value)}
            disabled={Boolean(preconfigSelecionada)}
            style={{ width: "100%", marginTop: 6 }}
          >
            <option value="multiowner">Multiowner</option>
            <option value="oneowner">Oneowner</option>
          </select>

          {normalizeTipoProjeto(form.tipoProjeto) === "oneowner" ? (
            <>
              <p style={{ marginTop: 8, opacity: 0.8 }}>
                {`Oneowner usa runtime padrao: ${oneownerRuntimeProjectId || "nao configurado"}.`}
              </p>
              <label htmlFor="ownerUid" style={{ display: "block", marginTop: 8 }}>
                UID do owner inicial
              </label>
              <input
                id="ownerUid"
                type="text"
                value={form.ownerUid}
                onChange={(event) => atualizarCampo("ownerUid", event.target.value)}
                placeholder="UID do owner deste oneowner"
                style={{ width: "100%", marginTop: 6 }}
              />
            </>
          ) : null}

          <label htmlFor="domains" style={{ display: "block", marginTop: 8 }}>
            Dominios (separados por virgula)
          </label>
          <input
            id="domains"
            type="text"
            value={form.domains}
            onChange={(event) => atualizarCampo("domains", event.target.value)}
            placeholder="ex: meusite.com , meusite.com.br"
            style={{ width: "100%", marginTop: 6 }}
          />

          {normalizeTipoProjeto(form.tipoProjeto) !== "oneowner" ? (
            <>
              {preconfigSelecionada ? (
                <p style={{ marginTop: 8, opacity: 0.8 }}>
                  Credenciais Firebase continuam obrigatorias para novos projetos multiowner.
                </p>
              ) : null}
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
          {`Projetos ja criados (${projetosFiltrados.length}/${projetosOrdenados.length})`}
        </h3>
        {projetosFiltrados.length === 0 ? (
          <p>Nenhum projeto encontrado no gerenciador.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            {projetosFiltrados.map((projeto) => {
              const tipoProjetoResolvido = resolveTipoProjetoProjeto(projeto);
              const iconeProjeto = resolverIconeProjeto(projeto);
              const iniciaisProjeto = String(
                projeto.nomeProjeto || projeto.systemKey || "?"
              )
                .trim()
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={projeto.id}
                  style={{
                    border: "1px solid #666",
                    borderRadius: 14,
                    padding: 14,
                    display: "grid",
                    gridTemplateColumns: "64px minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "flex-start",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.06)",
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {iconeProjeto ? (
                      <img
                        src={iconeProjeto}
                        alt={`Icone do projeto ${projeto.nomeProjeto || projeto.systemKey}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span>{iniciaisProjeto}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0 }}>
                      <strong>{projeto.nomeProjeto || projeto.systemKey}</strong>
                    </p>
                    <p style={{ margin: "6px 0 0 0" }}>Slug: {projeto.systemKey}</p>
                    <p style={{ margin: "2px 0 0 0" }}>
                      Tipo: {rotuloTipoProjeto(tipoProjetoResolvido)}
                    </p>
                    <p style={{ margin: "2px 0 0 0" }}>
                      Firebase Project: {projeto.firebaseProjectId || "-"}
                    </p>
                    <p style={{ margin: "2px 0 0 0" }}>
                      Status: {getProjectStatusLabel(projeto.statusProjeto)}
                    </p>
                    <p style={{ margin: "2px 0 0 0" }}>
                      Pre-configuracao: {projeto.preconfigBaseName || projeto.preconfigBaseKey || "-"}
                    </p>
                    <p style={{ margin: "2px 0 0 0" }}>
                      Dominios: {(projeto.domains || []).join(", ") || "-"}
                    </p>
                    <p style={{ margin: "2px 0 10px 0", opacity: 0.75 }}>
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
                        onClick={() => salvarPreconfiguracaoProjeto(projeto)}
                        disabled={Boolean(salvandoPreconfigSystemKey)}
                      >
                        {salvandoPreconfigSystemKey === projeto.systemKey
                          ? "Salvando pre-config..."
                          : "Salvar pre-config"}
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
                </div>
              );
            })}
          </div>
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
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              {`Pre-configuracao vinculada: ${
                projetoEmGerenciamento.preconfigBaseName ||
                projetoEmGerenciamento.preconfigBaseKey ||
                "nenhuma"
              }`}
            </p>
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
              placeholder="ex: nome.vercel.app, novodominio.com"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <label
              htmlFor="statusProjetoEdicao"
              style={{ display: "block", marginBottom: 6 }}
            >
              Status publico do projeto
            </label>
            <select
              id="statusProjetoEdicao"
              value={statusProjetoEdicao}
              onChange={(event) => setStatusProjetoEdicao(event.target.value)}
              style={{ width: "100%", marginBottom: 10 }}
            >
              {PROJECT_STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={salvarDomainsProjeto} disabled={salvandoDomainsProjeto}>
                {salvandoDomainsProjeto
                  ? "Salvando projeto..."
                  : "Salvar dominios e status"}
              </button>
              <button
                type="button"
                onClick={() => salvarPreconfiguracaoProjeto(projetoEmGerenciamento)}
                disabled={Boolean(salvandoPreconfigSystemKey)}
              >
                {salvandoPreconfigSystemKey === projetoEmGerenciamento.systemKey
                  ? "Salvando pre-config..."
                  : "Salvar pre-config deste projeto"}
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
              statusProjetoAtual={statusProjetoEdicao}
              addOnIdsDisponiveisAtual={addOnIdsProjetoEdicao}
              onConfigSalva={(configSalva, resultadoProjetoSalvo) => {
                const statusProjetoAtualizado = normalizeProjectStatus(
                  resultadoProjetoSalvo?.statusProjeto ||
                    configSalva?.statusProjeto ||
                    projetoEmGerenciamento?.configSistema?.statusProjeto ||
                    projetoEmGerenciamento?.statusProjeto,
                  {
                    projectSystemKey:
                      configSalva?.projectSystemKey ||
                      projetoEmGerenciamento?.configSistema?.projectSystemKey ||
                      projetoEmGerenciamento?.systemKey,
                    firebaseProjectId:
                      resultadoProjetoSalvo?.firebaseProjectId ||
                      projetoEmGerenciamento?.firebaseProjectId,
                    systemKey: projetoEmGerenciamento?.systemKey,
                    nomeProjeto:
                      configSalva?.tituloSistema || projetoEmGerenciamento?.nomeProjeto,
                    tituloSistema: configSalva?.tituloSistema,
                  }
                );
                const addOnIdsAtualizados = Array.isArray(configSalva?.addOnIdsDisponiveis)
                  ? configSalva.addOnIdsDisponiveis
                  : addOnIdsProjetoEdicao;
                const configSistemaAtualizada = {
                  ...configSalva,
                  statusProjeto: statusProjetoAtualizado,
                  addOnIdsDisponiveis: addOnIdsAtualizados,
                };
                setProjetos((prev) =>
                  prev.map((item) =>
                    item.systemKey === projetoEmGerenciamento.systemKey
                      ? {
                          ...item,
                          configSistema: configSistemaAtualizada,
                          nomeProjeto: configSalva?.tituloSistema || item.nomeProjeto,
                          tipoProjeto: normalizeTipoProjeto(
                            configSalva?.tipoExperiencia || item.tipoProjeto
                          ),
                          statusProjeto: statusProjetoAtualizado,
                          firebaseProjectId:
                            resultadoProjetoSalvo?.firebaseProjectId || item.firebaseProjectId,
                          firebaseRuntimeConfig:
                          resultadoProjetoSalvo?.firebaseRuntimeConfig || item.firebaseRuntimeConfig,
                        preconfigBaseKey:
                          resultadoProjetoSalvo?.preconfigBaseKey || item.preconfigBaseKey,
                        preconfigBaseName:
                          resultadoProjetoSalvo?.preconfigBaseName || item.preconfigBaseName,
                      }
                    : item
                )
              );
                setProjetoEmGerenciamento((atual) =>
                  atual
                    ? {
                        ...atual,
                        configSistema: configSistemaAtualizada,
                        nomeProjeto: configSalva?.tituloSistema || atual.nomeProjeto,
                        tipoProjeto: normalizeTipoProjeto(
                          configSalva?.tipoExperiencia || atual.tipoProjeto
                        ),
                        statusProjeto: statusProjetoAtualizado,
                        firebaseProjectId:
                          resultadoProjetoSalvo?.firebaseProjectId || atual.firebaseProjectId,
                        firebaseRuntimeConfig:
                        resultadoProjetoSalvo?.firebaseRuntimeConfig || atual.firebaseRuntimeConfig,
                      preconfigBaseKey:
                        resultadoProjetoSalvo?.preconfigBaseKey || atual.preconfigBaseKey,
                      preconfigBaseName:
                        resultadoProjetoSalvo?.preconfigBaseName || atual.preconfigBaseName,
                    }
                  : atual
              );
              carregarProjetos();
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
