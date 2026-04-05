import React, { useEffect, useMemo, useState } from "react";

import {
  listarAcessosNoGerenciador,
  listarProjetosNoGerenciador,
  listarUsuariosEspelhadosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectIdConfigurado } from "../../../Sistema/configSistema";
import "./users.css";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const USERS_PAGE_SIZE = 18;
const RESERVED_ROOT_SEGMENTS = new Set([
  "",
  "__",
  "error",
  "gerenciador",
  "home",
  "login",
  "loginowner",
  "menu",
]);
const RESERVED_MENU_SEGMENTS = new Set([
  "",
  "acessos",
  "config",
  "contatos",
  "conversas",
  "formularios",
  "gerenciador",
  "owner",
  "perfil",
  "propriedades",
  "propriedadessistema",
  "propriedades-sistema",
  "skins",
  "solicitacoes",
  "users",
]);

const MANAGER_PROJECT_ID = String(obterManagerProjectIdConfigurado() || "")
  .trim()
  .toLowerCase();

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarEmail(valor) {
  return normalizarTexto(valor).toLowerCase();
}

function normalizarTipoProjeto(valor) {
  const raw = normalizarTexto(valor).toLowerCase();
  if (raw === "manager" || raw === "menager" || raw === "gerenciador") return "manager";
  if (raw === "onepage") return "oneowner";
  if (raw === "multipage") return "multiowner";
  if (raw === "oneowner") return "oneowner";
  return raw === "oneowner" ? "oneowner" : "multiowner";
}

function rotuloTipoProjeto(tipoProjeto = "") {
  const normalizado = normalizarTipoProjeto(tipoProjeto);
  if (normalizado === "oneowner") return "Oneowner";
  if (normalizado === "manager") return "Manager";
  return "Multiowner";
}

function resolverIconeProjeto(projeto = {}) {
  return normalizarTexto(
    projeto?.configSistema?.faviconUrl ||
      projeto?.configSistema?.logoLoginUrl ||
      projeto?.configSistema?.cardProfileUrl
  );
}

function resolverTipoProjetoProjeto(projeto = {}) {
  const systemKey = normalizarTexto(projeto?.systemKey || projeto?.id).toLowerCase();
  const firebaseProjectId = normalizarTexto(
    projeto?.firebaseProjectId ||
      projeto?.firebaseRuntimeConfig?.projectId ||
      projeto?.configSistema?.firebaseProjectId ||
      projeto?.configSistema?.firebaseRuntimeConfig?.projectId
  ).toLowerCase();

  if (
    MANAGER_PROJECT_ID &&
    (systemKey === MANAGER_PROJECT_ID || firebaseProjectId === MANAGER_PROJECT_ID)
  ) {
    return "manager";
  }

  return normalizarTipoProjeto(
    projeto?.configSistema?.tipoExperiencia || projeto?.tipoProjeto
  );
}

function obterTimestampMs(valor) {
  if (!valor) return 0;
  if (typeof valor?.toDate === "function") {
    return valor.toDate().getTime();
  }
  if (typeof valor?.seconds === "number") {
    return valor.seconds * 1000;
  }
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }
  const convertido = new Date(valor).getTime();
  return Number.isFinite(convertido) ? convertido : 0;
}

function formatarData(valor) {
  const timestampMs = obterTimestampMs(valor);
  if (!timestampMs) return "--";
  return new Date(timestampMs).toLocaleString("pt-BR");
}

function formatarDuracaoMs(valor) {
  const duracaoMs = Number(valor);
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0) return "--";

  const totalSegundos = Math.round(duracaoMs / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  if (minutos <= 0) return `${segundos}s`;
  if (segundos <= 0) return `${minutos}min`;
  return `${minutos}min ${segundos}s`;
}

function resolverChaveUsuario(item = {}, fallbackId = "") {
  const email = normalizarEmail(
    item?.emailGoogle || item?.email || item?.emailUser || item?.ownerEmail
  );
  if (email) return `email:${email}`;

  const uid = normalizarTexto(item?.uid || item?.ownerUid || item?.userUid);
  if (uid) return `uid:${uid}`;

  const hash = normalizarTexto(item?.visitorHash || item?.hash);
  if (hash) return `hash:${hash}`;

  const fallback = normalizarTexto(fallbackId);
  return fallback ? `fallback:${fallback}` : "";
}

function construirMetaProjeto(projetosMap, projectKey, extras = {}) {
  const keyNormalizada = normalizarTexto(projectKey).toLowerCase();
  const projetoConhecido = keyNormalizada ? projetosMap.get(keyNormalizada) : null;
  const firebaseProjectId = normalizarTexto(
    extras?.firebaseProjectId ||
      extras?.runtimeProjectId ||
      projetoConhecido?.firebaseProjectId
  ).toLowerCase();
  const tipoProjeto =
    MANAGER_PROJECT_ID &&
    (keyNormalizada === MANAGER_PROJECT_ID || firebaseProjectId === MANAGER_PROJECT_ID)
      ? "manager"
      : normalizarTipoProjeto(
          projetoConhecido?.tipoProjeto || extras?.tipoProjeto || extras?.tipoExperiencia
        );

  return {
    key: keyNormalizada || normalizarTexto(extras?.runtimeProjectKey).toLowerCase() || "",
    nomeProjeto:
      normalizarTexto(projetoConhecido?.nomeProjeto) ||
      normalizarTexto(extras?.nomeProjeto || extras?.projectNome) ||
      keyNormalizada ||
      "--",
    tipoProjeto,
    iconeProjeto: normalizarTexto(projetoConhecido?.iconeProjeto || extras?.iconeProjeto),
    firebaseProjectId,
  };
}

function resolveRouteSkinUsername(fullPath = "") {
  const path = normalizarTexto(fullPath).split("?")[0].split("#")[0];
  const segments = path
    .split("/")
    .map((segment) => normalizarTexto(segment))
    .filter(Boolean);

  if (!segments.length) return "";

  const first = segments[0].toLowerCase();
  if (!RESERVED_ROOT_SEGMENTS.has(first)) {
    return segments[0];
  }

  if (first === "menu" && segments.length > 1) {
    const second = segments[1].toLowerCase();
    if (!RESERVED_MENU_SEGMENTS.has(second)) {
      return segments[1];
    }
  }

  return "";
}

function normalizarSkinsResumo(lista = []) {
  const dedupe = new Map();

  (Array.isArray(lista) ? lista : []).forEach((item, index) => {
    const id = normalizarTexto(item?.id || item?.id_skin || `skin_${index}`);
    const username = normalizarTexto(item?.username);
    if (!id && !username) return;

    const chave = (id || username).toLowerCase();
    if (!chave || dedupe.has(chave)) return;

    dedupe.set(chave, {
      skinKey: chave,
      id,
      username,
      is_main: Boolean(item?.is_main),
      theme: normalizarTexto(item?.theme),
    });
  });

  return Array.from(dedupe.values());
}

function ordenarSkins(lista = []) {
  return [...lista].sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) {
      return a.is_main ? -1 : 1;
    }
    return normalizarTexto(a.username || a.id).localeCompare(
      normalizarTexto(b.username || b.id),
      "pt-BR"
    );
  });
}
function consolidarUsuarios({ usuariosEspelhados, acessos, projetosMap, agoraMs }) {
  const usuariosMap = new Map();

  const garantirUsuario = (item, fallbackId = "") => {
    const chave = resolverChaveUsuario(item, fallbackId);
    if (!chave) return null;

    if (!usuariosMap.has(chave)) {
      usuariosMap.set(chave, {
        id: chave,
        uid: "",
        email: "",
        nome: "",
        avatar: "",
        hashAnonimo: "",
        projetosMap: new Map(),
        skinsResumoMap: new Map(),
        skinsPorProjetoBaseMap: new Map(),
        historicoSkinsMap: new Map(),
        ultimaNavegacaoMs: 0,
        ultimaNavegacaoRaw: null,
        ultimaRota: "",
        ultimoHost: "",
        ultimoProjetoVisitado: "",
        ultimaSincronizacaoMs: 0,
        ultimaSincronizacaoRaw: null,
      });
    }

    return usuariosMap.get(chave);
  };

  usuariosEspelhados.forEach((usuario) => {
    const registro = garantirUsuario(usuario, usuario?.id);
    if (!registro) return;

    registro.uid = registro.uid || normalizarTexto(usuario?.uid);
    registro.email = registro.email || normalizarTexto(usuario?.emailGoogle);
    registro.nome =
      registro.nome ||
      normalizarTexto(usuario?.nomeCompletoGoogle || usuario?.nomeGoogle || usuario?.displayName);
    registro.avatar = registro.avatar || normalizarTexto(usuario?.picGoogle || usuario?.photoURL);

    const projectKey = normalizarTexto(
      usuario?.projectSystemKey || usuario?.runtimeProjectKey
    ).toLowerCase();
    const projetoMeta = construirMetaProjeto(projetosMap, projectKey, {
      nomeProjeto: usuario?.projectNome,
      tipoProjeto: usuario?.tipoProjeto,
      runtimeProjectKey: usuario?.runtimeProjectKey,
      runtimeProjectId: usuario?.runtimeProjectId,
    });
    if (projetoMeta.key) {
      registro.projetosMap.set(projetoMeta.key, projetoMeta);
    }

    normalizarSkinsResumo(usuario?.skinsResumo).forEach((skin) => {
      const key = normalizarTexto(skin?.skinKey || skin?.id || skin?.username).toLowerCase();
      if (!key || registro.skinsResumoMap.has(key)) return;
      registro.skinsResumoMap.set(key, skin);
      if (projetoMeta.key) {
        if (!registro.skinsPorProjetoBaseMap.has(projetoMeta.key)) {
          registro.skinsPorProjetoBaseMap.set(projetoMeta.key, new Map());
        }
        registro.skinsPorProjetoBaseMap.get(projetoMeta.key).set(key, skin);
      }
    });

    (Array.isArray(usuario?.skinUsernames) ? usuario.skinUsernames : []).forEach((username, index) => {
      const usernameNormalizado = normalizarTexto(username);
      if (!usernameNormalizado) return;
      const key = usernameNormalizado.toLowerCase();
      if (registro.skinsResumoMap.has(key)) return;
      registro.skinsResumoMap.set(key, {
        skinKey: key,
        id: "",
        username: usernameNormalizado,
        is_main: index === 0,
        theme: "",
      });
      if (projetoMeta.key) {
        if (!registro.skinsPorProjetoBaseMap.has(projetoMeta.key)) {
          registro.skinsPorProjetoBaseMap.set(projetoMeta.key, new Map());
        }
        registro.skinsPorProjetoBaseMap.get(projetoMeta.key).set(key, {
          skinKey: key,
          id: "",
          username: usernameNormalizado,
          is_main: index === 0,
          theme: "",
        });
      }
    });

    const sincronizacaoMs = obterTimestampMs(usuario?.updatedAt || usuario?.lastLoginAt);
    if (sincronizacaoMs >= registro.ultimaSincronizacaoMs) {
      registro.ultimaSincronizacaoMs = sincronizacaoMs;
      registro.ultimaSincronizacaoRaw = usuario?.updatedAt || usuario?.lastLoginAt || null;
    }
  });

  acessos.forEach((acesso) => {
    const registro = garantirUsuario(acesso, acesso?.id);
    if (!registro) return;

    registro.uid = registro.uid || normalizarTexto(acesso?.uid);
    registro.email = registro.email || normalizarTexto(acesso?.email);
    registro.nome =
      registro.nome || normalizarTexto(acesso?.displayName || acesso?.nome || acesso?.email);
    registro.hashAnonimo = registro.hashAnonimo || normalizarTexto(acesso?.visitorHash || acesso?.hash);

    const projectKey = normalizarTexto(
      acesso?.projectSystemKey || acesso?.runtimeProjectKey
    ).toLowerCase();
    const projetoMeta = construirMetaProjeto(projetosMap, projectKey, {
      nomeProjeto: acesso?.projectNome,
      tipoProjeto: acesso?.tipoExperiencia,
      tipoExperiencia: acesso?.tipoExperiencia,
      runtimeProjectKey: acesso?.runtimeProjectKey,
      runtimeProjectId: acesso?.runtimeProjectId,
    });
    if (projetoMeta.key) {
      registro.projetosMap.set(projetoMeta.key, projetoMeta);
    }

    const acessoMs = obterTimestampMs(acesso?.data || acesso?.criadoEm);
    if (acessoMs >= registro.ultimaNavegacaoMs) {
      registro.ultimaNavegacaoMs = acessoMs;
      registro.ultimaNavegacaoRaw = acesso?.data || acesso?.criadoEm || null;
      registro.ultimaRota = normalizarTexto(acesso?.fullPath || acesso?.path);
      registro.ultimoHost = normalizarTexto(acesso?.hostname);
      registro.ultimoProjetoVisitado = projetoMeta.nomeProjeto;
    }

    const skinUsername =
      normalizarTexto(acesso?.skinUsername) ||
      normalizarTexto(acesso?.skinUsernameRota) ||
      resolveRouteSkinUsername(acesso?.fullPath || acesso?.path);
    const skinId = normalizarTexto(acesso?.skinId);

    if (skinUsername || skinId) {
      const skinKey = (skinId || skinUsername).toLowerCase();
      if (!registro.skinsResumoMap.has(skinKey)) {
        registro.skinsResumoMap.set(skinKey, {
          skinKey,
          id: skinId,
          username: skinUsername,
          is_main: false,
          theme: "",
        });
      }

      if (!registro.historicoSkinsMap.has(skinKey)) {
        registro.historicoSkinsMap.set(skinKey, {
          skinKey,
          skinId,
          skinUsername: skinUsername || "Sem username",
          eventos: [],
        });
      }

      registro.historicoSkinsMap.get(skinKey).eventos.push({
        id: acesso?.id,
        dataRaw: acesso?.data || acesso?.criadoEm || null,
        dataMs: acessoMs,
        fullPath: normalizarTexto(acesso?.fullPath || acesso?.path) || "/",
        hostname: normalizarTexto(acesso?.hostname),
        eventoTipo: normalizarTexto(acesso?.eventoTipo) || "page_view",
        eventoAcao: normalizarTexto(acesso?.eventoAcao),
        elementoTexto: normalizarTexto(acesso?.elementoTexto),
        duracaoMs: Number(acesso?.duracaoMs) || 0,
        projectKey: projetoMeta.key,
        projectNome: projetoMeta.nomeProjeto,
        tipoProjeto: projetoMeta.tipoProjeto,
      });
    }
  });

  return Array.from(usuariosMap.values()).map((usuario) => {
    const projetos = Array.from(usuario.projetosMap.values()).sort((a, b) =>
      a.nomeProjeto.localeCompare(b.nomeProjeto, "pt-BR")
    );
    const skinsResumo = ordenarSkins(Array.from(usuario.skinsResumoMap.values()));
    const historicoPorSkin = Array.from(usuario.historicoSkinsMap.values())
      .map((grupo) => ({
        ...grupo,
        eventos: [...grupo.eventos]
          .sort((a, b) => (b.dataMs || 0) - (a.dataMs || 0))
          .slice(0, 24),
      }))
      .sort((a, b) => {
        const maxA = a.eventos[0]?.dataMs || 0;
        const maxB = b.eventos[0]?.dataMs || 0;
        if (maxA !== maxB) return maxB - maxA;
        return normalizarTexto(a.skinUsername).localeCompare(
          normalizarTexto(b.skinUsername),
          "pt-BR"
        );
      });

    const skinsPorProjetoMap = new Map();
    projetos.forEach((projeto) => {
      skinsPorProjetoMap.set(
        projeto.key,
        new Map(usuario.skinsPorProjetoBaseMap?.get?.(projeto.key) || [])
      );
    });

    historicoPorSkin.forEach((grupo) => {
      grupo.eventos.forEach((evento) => {
        const projectKeyEvento = normalizarTexto(evento?.projectKey).toLowerCase();
        if (!projectKeyEvento) return;
        if (!skinsPorProjetoMap.has(projectKeyEvento)) {
          skinsPorProjetoMap.set(projectKeyEvento, new Map());
        }
        skinsPorProjetoMap.get(projectKeyEvento).set(grupo.skinKey, {
          skinKey: grupo.skinKey,
          id: grupo.skinId,
          username: grupo.skinUsername,
          is_main: Boolean(
            skinsResumo.find((skin) => skin.skinKey === grupo.skinKey)?.is_main
          ),
        });
      });
    });

    if (projetos.length === 1) {
      const projetoKey = projetos[0]?.key;
      if (projetoKey && skinsResumo.length) {
        const mapaProjeto = skinsPorProjetoMap.get(projetoKey) || new Map();
        skinsResumo.forEach((skin) => {
          mapaProjeto.set(skin.skinKey, skin);
        });
        skinsPorProjetoMap.set(projetoKey, mapaProjeto);
      }
    }

    projetos.forEach((projeto) => {
      if (normalizarTipoProjeto(projeto.tipoProjeto) !== "manager") return;
      const mapaProjeto = skinsPorProjetoMap.get(projeto.key) || new Map();
      skinsResumo.forEach((skin) => {
        mapaProjeto.set(skin.skinKey, skin);
      });
      skinsPorProjetoMap.set(projeto.key, mapaProjeto);
    });

    const skinsPorProjeto = {};
    skinsPorProjetoMap.forEach((skinsMap, projectKey) => {
      skinsPorProjeto[projectKey] = ordenarSkins(Array.from(skinsMap.values()));
    });

    const tiposProjeto = Array.from(
      new Set(projetos.map((projeto) => normalizarTipoProjeto(projeto.tipoProjeto)))
    );
    const online =
      usuario.ultimaNavegacaoMs > 0 && agoraMs - usuario.ultimaNavegacaoMs <= ONLINE_WINDOW_MS;

    return {
      ...usuario,
      nome: usuario.nome || usuario.email || usuario.uid || usuario.hashAnonimo || "Usuario",
      email: usuario.email || "--",
      avatar: usuario.avatar || "/favicon.ico",
      projetos,
      totalProjetos: projetos.length,
      tiposProjeto,
      online,
      skinsResumo,
      skinsPorProjeto,
      historicoPorSkin,
    };
  });
}
function Users() {
  const [usuariosEspelhados, setUsuariosEspelhados] = useState([]);
  const [acessos, setAcessos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroOnline, setFiltroOnline] = useState("");
  const [ordemUltimaNavegacao, setOrdemUltimaNavegacao] = useState("desc");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [agoraMs, setAgoraMs] = useState(Date.now());
  const [projetoAbertoPorUsuario, setProjetoAbertoPorUsuario] = useState({});
  const [skinAbertaPorUsuario, setSkinAbertaPorUsuario] = useState({});
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    listarProjetosNoGerenciador()
      .then((lista) => {
        if (!ativo) return;
        setProjetos(Array.isArray(lista) ? lista : []);
      })
      .catch((error) => {
        console.error("Erro ao carregar projetos para Users:", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setAgoraMs(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarUsuarios = async () => {
      try {
        const lista = await listarUsuariosEspelhadosNoGerenciador();
        if (!ativo) return;
        setErro("");
        setUsuariosEspelhados(Array.isArray(lista) ? lista : []);
      } catch (error) {
        if (!ativo) return;
        console.error("Erro ao carregar usuarios espelhados do gerenciador:", error);
        setErro("Nao foi possivel carregar os usuarios.");
        setUsuariosEspelhados([]);
      }
    };

    carregarUsuarios();
    const timerId = window.setInterval(carregarUsuarios, 30000);

    return () => {
      ativo = false;
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarAcessos = async () => {
      try {
        const lista = await listarAcessosNoGerenciador({ limit: 300 });
        if (!ativo) return;
        setErro("");
        setAcessos(Array.isArray(lista) ? lista : []);
      } catch (error) {
        if (!ativo) return;
        console.error("Erro ao carregar acessos do gerenciador para Users:", error);
        setErro("Nao foi possivel carregar o historico de navegacao dos usuarios.");
        setAcessos([]);
      }
    };

    carregarAcessos();
    const timerId = window.setInterval(carregarAcessos, 30000);

    return () => {
      ativo = false;
      window.clearInterval(timerId);
    };
  }, []);

  const projetosMap = useMemo(() => {
    const mapa = new Map();

    projetos.forEach((projeto) => {
      const key = normalizarTexto(projeto?.systemKey || projeto?.id).toLowerCase();
      if (!key) return;
      mapa.set(key, {
        key,
        nomeProjeto: normalizarTexto(projeto?.nomeProjeto) || key,
        tipoProjeto: resolverTipoProjetoProjeto(projeto),
        iconeProjeto: resolverIconeProjeto(projeto),
        firebaseProjectId: normalizarTexto(
          projeto?.firebaseProjectId ||
            projeto?.firebaseRuntimeConfig?.projectId ||
            projeto?.configSistema?.firebaseProjectId ||
            projeto?.configSistema?.firebaseRuntimeConfig?.projectId
        ).toLowerCase(),
      });
    });

    return mapa;
  }, [projetos]);

  const usuariosConsolidados = useMemo(
    () =>
      consolidarUsuarios({
        usuariosEspelhados,
        acessos,
        projetosMap,
        agoraMs,
      }),
    [usuariosEspelhados, acessos, projetosMap, agoraMs]
  );

  const opcoesProjeto = useMemo(() => {
    if (!filtroTipo || filtroTipo === "manager") return [];

    const mapa = new Map();

    projetos.forEach((projeto) => {
      const key = normalizarTexto(projeto?.systemKey || projeto?.id).toLowerCase();
      if (!key) return;

      const tipoProjeto = resolverTipoProjetoProjeto(projeto);
      if (tipoProjeto !== filtroTipo) return;

      mapa.set(key, {
        value: key,
        label: normalizarTexto(projeto?.nomeProjeto) || key,
      });
    });

    return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [projetos, filtroTipo]);

  useEffect(() => {
    if (!filtroTipo || filtroTipo === "manager") {
      setFiltroProjeto("");
      return;
    }

    const projetoValido = opcoesProjeto.some((projeto) => projeto.value === filtroProjeto);
    if (!projetoValido) {
      setFiltroProjeto("");
    }
  }, [filtroTipo, filtroProjeto, opcoesProjeto]);

  const usuariosFiltrados = useMemo(() => {
    const lista = usuariosConsolidados.filter((usuario) => {
      if (
        filtroTipo &&
        !usuario.projetos.some(
          (projeto) => normalizarTipoProjeto(projeto.tipoProjeto) === filtroTipo
        )
      ) {
        return false;
      }

      if (filtroProjeto && !usuario.projetos.some((projeto) => projeto.key === filtroProjeto)) {
        return false;
      }

      if (filtroOnline === "online" && !usuario.online) return false;
      if (filtroOnline === "offline" && usuario.online) return false;

      return true;
    });

    lista.sort((a, b) => {
      const valorA = a.ultimaNavegacaoMs || 0;
      const valorB = b.ultimaNavegacaoMs || 0;
      if (valorA !== valorB) {
        return ordemUltimaNavegacao === "asc" ? valorA - valorB : valorB - valorA;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return lista;
  }, [usuariosConsolidados, filtroProjeto, filtroTipo, filtroOnline, ordemUltimaNavegacao]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroTipo, filtroProjeto, filtroOnline, ordemUltimaNavegacao]);

  const totalOnline = useMemo(
    () => usuariosFiltrados.filter((usuario) => usuario.online).length,
    [usuariosFiltrados]
  );

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / USERS_PAGE_SIZE));
  const paginaAtualSegura = Math.min(paginaAtual, totalPaginas);

  useEffect(() => {
    if (paginaAtual !== paginaAtualSegura) {
      setPaginaAtual(paginaAtualSegura);
    }
  }, [paginaAtual, paginaAtualSegura]);

  const usuariosPagina = useMemo(() => {
    const inicio = (paginaAtualSegura - 1) * USERS_PAGE_SIZE;
    return usuariosFiltrados.slice(inicio, inicio + USERS_PAGE_SIZE);
  }, [paginaAtualSegura, usuariosFiltrados]);

  const selecionarProjetoUsuario = (usuarioId, projetoKey) => {
    setProjetoAbertoPorUsuario((prev) => {
      const atual = normalizarTexto(prev?.[usuarioId]).toLowerCase();
      const proximo = atual === projetoKey ? "" : projetoKey;
      return {
        ...prev,
        [usuarioId]: proximo,
      };
    });
    setSkinAbertaPorUsuario((prev) => ({
      ...prev,
      [usuarioId]: "",
    }));
  };

  const selecionarSkinUsuario = (usuarioId, skinKey) => {
    setSkinAbertaPorUsuario((prev) => {
      const atual = normalizarTexto(prev?.[usuarioId]).toLowerCase();
      return {
        ...prev,
        [usuarioId]: atual === skinKey ? "" : skinKey,
      };
    });
  };

  return (
    <section className="gerenciador-users">
      <div className="gerenciador-users__header">
        <div>
          <h1 className="gerenciador-users__title">USERS</h1>
          <p className="gerenciador-users__subtitle">
            Usuarios consolidados de todos os sistemas, com historico por skin e atividade de UX.
          </p>
        </div>

        <div className="gerenciador-users__filters">
          <label>
            <span>Tipo de projeto</span>
            <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
              <option value="">Todos</option>
              <option value="multiowner">Multiowner</option>
              <option value="oneowner">Oneowner</option>
              <option value="manager">Manager</option>
            </select>
          </label>

          {filtroTipo && filtroTipo !== "manager" ? (
            <label>
              <span>Projeto</span>
              <select
                value={filtroProjeto}
                onChange={(event) => setFiltroProjeto(event.target.value)}
              >
                <option value="">Todos</option>
                {opcoesProjeto.map((projeto) => (
                  <option key={projeto.value} value={projeto.value}>
                    {projeto.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            <span>Status</span>
            <select value={filtroOnline} onChange={(event) => setFiltroOnline(event.target.value)}>
              <option value="">Todos</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </label>

          <label>
            <span>Ultima navegacao</span>
            <select
              value={ordemUltimaNavegacao}
              onChange={(event) => setOrdemUltimaNavegacao(event.target.value)}
            >
              <option value="desc">Mais recente</option>
              <option value="asc">Mais antiga</option>
            </select>
          </label>
        </div>
      </div>

      <div className="gerenciador-users__summary">
        <span>{`Usuarios exibidos: ${usuariosFiltrados.length}`}</span>
        <span>{`Online: ${totalOnline}`}</span>
        <span>{`Pagina: ${paginaAtualSegura}/${totalPaginas}`}</span>
      </div>

      {totalPaginas > 1 ? (
        <div className="gerenciador-users__pagination">
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
            disabled={paginaAtualSegura <= 1}
          >
            Anterior
          </button>
          <span>{`Pagina ${paginaAtualSegura} de ${totalPaginas}`}</span>
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
            disabled={paginaAtualSegura >= totalPaginas}
          >
            Proxima
          </button>
        </div>
      ) : null}

      {erro ? <p className="gerenciador-users__error">{erro}</p> : null}

      {!erro && !usuariosFiltrados.length ? (
        <p className="gerenciador-users__empty">Nenhum usuario encontrado.</p>
      ) : null}

      {!erro && usuariosPagina.length ? (
        <div className="gerenciador-users__grid">
          {usuariosPagina.map((usuario) => {
            const projetoSelecionadoKey = normalizarTexto(
              projetoAbertoPorUsuario?.[usuario.id]
            ).toLowerCase();
            const projetoSelecionado = usuario.projetos.find(
              (projeto) => projeto.key === projetoSelecionadoKey
            );
            const skinsProjetoSelecionado = projetoSelecionado
              ? usuario.skinsPorProjeto?.[projetoSelecionado.key] || []
              : [];
            const skinSelecionadaKey = normalizarTexto(
              skinAbertaPorUsuario?.[usuario.id]
            ).toLowerCase();
            const grupoSkinSelecionada = usuario.historicoPorSkin.find(
              (grupo) => grupo.skinKey === skinSelecionadaKey
            );
            const eventosSkinSelecionada = grupoSkinSelecionada
              ? grupoSkinSelecionada.eventos.filter(
                  (evento) => !projetoSelecionado || evento.projectKey === projetoSelecionado.key
                )
              : [];

            return (
              <article key={usuario.id} className="gerenciador-users__card">
                <div className="gerenciador-users__avatarWrap">
                  <img
                    className="gerenciador-users__avatar"
                    src={usuario.avatar}
                    alt={`Foto de ${usuario.nome}`}
                  />
                  <span
                    className={`gerenciador-users__statusBadge ${
                      usuario.online ? "is-online" : "is-offline"
                    }`}
                  >
                    {usuario.online ? "Online" : "Offline"}
                  </span>
                </div>

                <div className="gerenciador-users__info">
                  <div className="gerenciador-users__topline">
                    <strong>{usuario.nome}</strong>
                    <span>{`Projetos: ${usuario.totalProjetos}`}</span>
                  </div>

                  <span>{usuario.email}</span>
                  <span>{`ID user: ${usuario.uid || "--"}`}</span>
                  <span>{`Hash anonimo: ${usuario.hashAnonimo || "--"}`}</span>
                  <span>{`Ultima navegacao: ${formatarData(usuario.ultimaNavegacaoRaw)}`}</span>
                  <span>{`Ultima rota: ${usuario.ultimaRota || "--"}`}</span>
                  <span>{`Host: ${usuario.ultimoHost || "--"}`}</span>
                  <span>{`Ultimo projeto navegado: ${usuario.ultimoProjetoVisitado || "--"}`}</span>
                  <span>{`Ultima sincronizacao: ${formatarData(usuario.ultimaSincronizacaoRaw)}`}</span>

                  <div className="gerenciador-users__projectList">
                    {usuario.projetos.length ? (
                      usuario.projetos.map((projeto) => {
                        const ativo = projeto.key === projetoSelecionadoKey;
                        return (
                          <button
                            key={`${usuario.id}:${projeto.key}`}
                            type="button"
                            className={`gerenciador-users__projectChip ${ativo ? "is-active" : ""}`}
                            onClick={() => selecionarProjetoUsuario(usuario.id, projeto.key)}
                          >
                            {projeto.iconeProjeto ? (
                              <img
                                className="gerenciador-users__projectIcon"
                                src={projeto.iconeProjeto}
                                alt={`Icone do projeto ${projeto.nomeProjeto}`}
                              />
                            ) : null}
                            <span>{`${projeto.nomeProjeto} - ${rotuloTipoProjeto(projeto.tipoProjeto)}`}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="gerenciador-users__projectChip">Sem projeto associado</span>
                    )}
                  </div>

                  {projetoSelecionado ? (
                    <div className="gerenciador-users__panel">
                      <div className="gerenciador-users__panelHeader">
                        <strong>{`Skins em ${projetoSelecionado.nomeProjeto}`}</strong>
                        <span>{skinsProjetoSelecionado.length}</span>
                      </div>

                      {skinsProjetoSelecionado.length ? (
                        <div className="gerenciador-users__skinList">
                          {skinsProjetoSelecionado.map((skin) => {
                            const ativa = skin.skinKey === skinSelecionadaKey;
                            return (
                              <button
                                key={`${usuario.id}:skin:${skin.skinKey}`}
                                type="button"
                                className={`gerenciador-users__skinChip ${ativa ? "is-active" : ""}`}
                                onClick={() => selecionarSkinUsuario(usuario.id, skin.skinKey)}
                              >
                                <span>{skin.username || skin.id || "Skin sem username"}</span>
                                {skin.is_main ? <strong>main</strong> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="gerenciador-users__detailsEmpty">
                          Nenhuma skin vinculada a este projeto.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {grupoSkinSelecionada ? (
                    <div className="gerenciador-users__panel">
                      <div className="gerenciador-users__panelHeader">
                        <strong>{`Historico de ${grupoSkinSelecionada.skinUsername || grupoSkinSelecionada.skinId || "skin"}`}</strong>
                        <span>{eventosSkinSelecionada.length}</span>
                      </div>

                      {eventosSkinSelecionada.length ? (
                        <ul className="gerenciador-users__historyList">
                          {eventosSkinSelecionada.map((evento) => (
                            <li key={`${grupoSkinSelecionada.skinKey}:${evento.id || evento.dataMs}`}>
                              <strong>{formatarData(evento.dataRaw)}</strong>
                              <span>{evento.fullPath || "/"}</span>
                              <span>{`Projeto: ${evento.projectNome || "--"} (${rotuloTipoProjeto(evento.tipoProjeto)})`}</span>
                              <span>{`Evento: ${evento.eventoTipo || "--"}`}</span>
                              {evento.eventoAcao ? <span>{`Acao: ${evento.eventoAcao}`}</span> : null}
                              {evento.elementoTexto ? (
                                <span>{`Elemento: ${evento.elementoTexto}`}</span>
                              ) : null}
                              {evento.duracaoMs ? (
                                <span>{`Tempo na pagina: ${formatarDuracaoMs(evento.duracaoMs)}`}</span>
                              ) : null}
                              {evento.hostname ? <span>{`Host: ${evento.hostname}`}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="gerenciador-users__detailsEmpty">
                          Nenhum evento encontrado para esta skin neste projeto.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {totalPaginas > 1 ? (
        <div className="gerenciador-users__pagination">
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
            disabled={paginaAtualSegura <= 1}
          >
            Anterior
          </button>
          <span>{`Pagina ${paginaAtualSegura} de ${totalPaginas}`}</span>
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
            disabled={paginaAtualSegura >= totalPaginas}
          >
            Proxima
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default Users;
