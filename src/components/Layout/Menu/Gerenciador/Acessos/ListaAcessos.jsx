import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listarAcessosNoGerenciador,
  obterConfigAcessosNoGerenciador,
  listarProjetosNoGerenciador,
  salvarConfigAcessosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectLabel } from "../../../Sistema/configSistema";
import "./acessos.css";

const GROUP_PAGE_SIZE = 12;
const ACCESS_GROUP_PREVIEW_SIZE = 3;
const ACCESS_QUERY_LIMIT = 100;

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveFirstText(...candidates) {
  for (const candidate of candidates) {
    const value = normalizeText(candidate);
    if (value) return value;
  }

  return "";
}

function resolveGeoText(...candidates) {
  const value = resolveFirstText(...candidates);
  if (value) return value;
  return "--";
}

function joinUnique(values = []) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))].join(", ") || "--";
}

function resolveOrigemAcesso(acesso) {
  const hostname = normalizeText(acesso?.hostname).toLowerCase();
  if (!hostname) return "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    return "localhost";
  }
  return "dominio";
}

function resolveTipoUsuario(acesso) {
  const perfil = normalizeText(acesso?.perfilAcesso).toLowerCase();
  return perfil === "owner" ? "owner" : "viewer";
}

function resolveAccessHash(acesso) {
  return normalizeText(acesso?.visitorHash || acesso?.hash);
}

function resolveAccessIp(acesso) {
  return resolveFirstText(acesso?.ip, acesso?.geo?.ip);
}

function resolveAccessProjectKey(acesso) {
  return normalizeText(acesso?.projectSystemKey || acesso?.runtimeProjectKey).toLowerCase();
}

function normalizeIpBloqueio(value) {
  return normalizeText(value).replace(/^::ffff:/, "").toLowerCase();
}

function normalizeUsuarioBloqueio(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return normalized.includes("@") ? normalized.toLowerCase() : normalized;
}

function normalizarIpsBloqueados(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => normalizeIpBloqueio(item)).filter(Boolean))
  );
}

function normalizarUsuariosBloqueados(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => normalizeUsuarioBloqueio(item)).filter(Boolean))
  );
}

function resolveAccessUserLabel(acesso) {
  return (
    normalizeText(acesso?.displayName || acesso?.email || acesso?.uid) ||
    "Visitante"
  );
}

function resolveAccessUserIdentifiers(acesso) {
  return normalizarUsuariosBloqueados([acesso?.uid, acesso?.email]);
}

function isAccessRecordBlocked(acesso = {}) {
  return acesso?.registroBloqueado === true || acesso?.bloqueado === true;
}

function formatarUsuarioBloqueio(usuario = "") {
  const normalized = normalizeUsuarioBloqueio(usuario);
  if (!normalized) return "usuario";
  return normalized.includes("@") ? `email ${normalized}` : `uid ${normalized}`;
}

function resolveAccessGeoInfo(acesso = {}) {
  const geo = acesso?.geo && typeof acesso.geo === "object" ? acesso.geo : {};

  return {
    country: resolveFirstText(acesso?.country, acesso?.pais, geo?.country, geo?.pais),
    region: resolveFirstText(acesso?.region, acesso?.regiao, geo?.region, geo?.regiao),
    city: resolveFirstText(acesso?.city, acesso?.cidade, geo?.city, geo?.cidade),
    uf: resolveFirstText(acesso?.uf, acesso?.regionCode, geo?.uf, geo?.regionCode),
    org: resolveFirstText(acesso?.org, geo?.org),
    cep: resolveFirstText(acesso?.cep, geo?.cep),
    source: resolveFirstText(acesso?.geoSource, geo?.source, geo?._geoSource),
    error: resolveFirstText(acesso?.geoError, geo?.error, geo?._geoError),
    latitude: Number.isFinite(Number(acesso?.latitude))
      ? Number(acesso.latitude)
      : (Number.isFinite(Number(geo?.latitude)) ? Number(geo.latitude) : null),
    longitude: Number.isFinite(Number(acesso?.longitude))
      ? Number(acesso.longitude)
      : (Number.isFinite(Number(geo?.longitude)) ? Number(geo.longitude) : null),
  };
}

function formatarData(value) {
  const timestampMs = resolveDataTimestampMs(value);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "--";
  return new Date(timestampMs).toLocaleString("pt-BR");
}

function formatarDuracaoMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) return "--";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}min ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

function resolveDataTimestampMs(value) {
  if (!value) return NaN;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).getTime();
  }
  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000).getTime();
  }
  const timestampMs =
    value instanceof Date
      ? value.getTime()
      : (typeof value === "number" && Number.isFinite(value) ? value : new Date(value).getTime());
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return NaN;
  return timestampMs;
}

function ListaAcessos() {
  const managerProjectLabel = obterManagerProjectLabel();
  const mountedRef = useRef(true);
  const [acessos, setAcessos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroTipoUsuario, setFiltroTipoUsuario] = useState("");
  const [filtroHash, setFiltroHash] = useState("");
  const [filtroIp, setFiltroIp] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [mostrarRegistrosBloqueados, setMostrarRegistrosBloqueados] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [ipsBloqueadosRegistro, setIpsBloqueadosRegistro] = useState([]);
  const [ipBloqueioInput, setIpBloqueioInput] = useState("");
  const [salvandoBloqueioIp, setSalvandoBloqueioIp] = useState(false);
  const [erroBloqueioIp, setErroBloqueioIp] = useState("");
  const [mensagemBloqueioIp, setMensagemBloqueioIp] = useState("");
  const [usuariosBloqueadosRegistro, setUsuariosBloqueadosRegistro] = useState([]);
  const [usuarioBloqueioInput, setUsuarioBloqueioInput] = useState("");
  const [salvandoBloqueioUsuario, setSalvandoBloqueioUsuario] = useState(false);
  const [erroBloqueioUsuario, setErroBloqueioUsuario] = useState("");
  const [mensagemBloqueioUsuario, setMensagemBloqueioUsuario] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    let ativo = true;

    listarProjetosNoGerenciador()
      .then((lista) => {
        if (!ativo) return;
        setProjetos(Array.isArray(lista) ? lista : []);
      })
      .catch((error) => {
        console.error("Erro ao carregar projetos para acessos:", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const carregarConfigBloqueioAcessos = useCallback(async () => {
    try {
      const configAcessos = await obterConfigAcessosNoGerenciador();
      if (!mountedRef.current) return;
      setIpsBloqueadosRegistro(
        normalizarIpsBloqueados(configAcessos?.ipsBloqueadosRegistro)
      );
      setUsuariosBloqueadosRegistro(
        normalizarUsuariosBloqueados(configAcessos?.usuariosBloqueadosRegistro)
      );
      setErroBloqueioIp("");
      setErroBloqueioUsuario("");
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar bloqueios de IP:", error);
      setErroBloqueioIp("Nao foi possivel carregar os IPs bloqueados.");
      setErroBloqueioUsuario("Nao foi possivel carregar os usuarios bloqueados.");
    }
  }, []);

  useEffect(() => {
    void carregarConfigBloqueioAcessos();
  }, [carregarConfigBloqueioAcessos]);

  const salvarIpsBloqueados = useCallback(async (ipsProximos = [], mensagemSucesso = "") => {
    const ipsNormalizados = normalizarIpsBloqueados(ipsProximos);
    const usuariosNormalizados = normalizarUsuariosBloqueados(usuariosBloqueadosRegistro);
    setSalvandoBloqueioIp(true);
    setErroBloqueioIp("");
    setMensagemBloqueioIp("");

    try {
      const resultado = await salvarConfigAcessosNoGerenciador({
        ipsBloqueadosRegistro: ipsNormalizados,
        usuariosBloqueadosRegistro: usuariosNormalizados,
      });
      if (!mountedRef.current) return;
      setIpsBloqueadosRegistro(
        normalizarIpsBloqueados(resultado?.ipsBloqueadosRegistro || ipsNormalizados)
      );
      setUsuariosBloqueadosRegistro(
        normalizarUsuariosBloqueados(
          resultado?.usuariosBloqueadosRegistro || usuariosNormalizados
        )
      );
      setMensagemBloqueioIp(mensagemSucesso || "Bloqueios de IP atualizados.");
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao salvar bloqueios de IP:", error);
      setErroBloqueioIp("Nao foi possivel salvar os IPs bloqueados.");
    } finally {
      if (mountedRef.current) {
        setSalvandoBloqueioIp(false);
      }
    }
  }, [usuariosBloqueadosRegistro]);

  const salvarUsuariosBloqueados = useCallback(
    async (usuariosProximos = [], mensagemSucesso = "") => {
      const usuariosNormalizados = normalizarUsuariosBloqueados(usuariosProximos);
      const ipsNormalizados = normalizarIpsBloqueados(ipsBloqueadosRegistro);
      setSalvandoBloqueioUsuario(true);
      setErroBloqueioUsuario("");
      setMensagemBloqueioUsuario("");

      try {
        const resultado = await salvarConfigAcessosNoGerenciador({
          ipsBloqueadosRegistro: ipsNormalizados,
          usuariosBloqueadosRegistro: usuariosNormalizados,
        });
        if (!mountedRef.current) return;
        setIpsBloqueadosRegistro(
          normalizarIpsBloqueados(resultado?.ipsBloqueadosRegistro || ipsNormalizados)
        );
        setUsuariosBloqueadosRegistro(
          normalizarUsuariosBloqueados(
            resultado?.usuariosBloqueadosRegistro || usuariosNormalizados
          )
        );
        setMensagemBloqueioUsuario(
          mensagemSucesso || "Bloqueios de usuario atualizados."
        );
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao salvar bloqueios de usuario:", error);
        setErroBloqueioUsuario("Nao foi possivel salvar os usuarios bloqueados.");
      } finally {
        if (mountedRef.current) {
          setSalvandoBloqueioUsuario(false);
        }
      }
    },
    [ipsBloqueadosRegistro]
  );

  const adicionarIpBloqueado = useCallback(
    (ip) => {
      const ipNormalizado = normalizeIpBloqueio(ip);
      if (!ipNormalizado) {
        setErroBloqueioIp("Informe um IP para bloquear.");
        return;
      }

      const proximos = normalizarIpsBloqueados([...ipsBloqueadosRegistro, ipNormalizado]);
      setIpBloqueioInput("");
      void salvarIpsBloqueados(
        proximos,
        `Registro de acessos bloqueado para o IP ${ipNormalizado}.`
      );
    },
    [ipsBloqueadosRegistro, salvarIpsBloqueados]
  );

  const adicionarUsuarioBloqueado = useCallback(
    (usuario) => {
      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
      if (!usuarioNormalizado) {
        setErroBloqueioUsuario("Informe um UID ou email para bloquear.");
        return;
      }

      const proximos = normalizarUsuariosBloqueados([
        ...usuariosBloqueadosRegistro,
        usuarioNormalizado,
      ]);
      setUsuarioBloqueioInput("");
      void salvarUsuariosBloqueados(
        proximos,
        `Registro de acessos bloqueado para ${formatarUsuarioBloqueio(
          usuarioNormalizado
        )}.`
      );
    },
    [salvarUsuariosBloqueados, usuariosBloqueadosRegistro]
  );

  const removerUsuarioBloqueado = useCallback(
    (usuario) => {
      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
      if (!usuarioNormalizado) return;
      const proximos = usuariosBloqueadosRegistro.filter(
        (item) => item !== usuarioNormalizado
      );
      void salvarUsuariosBloqueados(
        proximos,
        `Registro de acessos liberado para ${formatarUsuarioBloqueio(
          usuarioNormalizado
        )}.`
      );
    },
    [salvarUsuariosBloqueados, usuariosBloqueadosRegistro]
  );

  const removerIpBloqueado = useCallback(
    (ip) => {
      const ipNormalizado = normalizeIpBloqueio(ip);
      if (!ipNormalizado) return;
      const proximos = ipsBloqueadosRegistro.filter((item) => item !== ipNormalizado);
      void salvarIpsBloqueados(
        proximos,
        `Registro de acessos liberado para o IP ${ipNormalizado}.`
      );
    },
    [ipsBloqueadosRegistro, salvarIpsBloqueados]
  );

  const carregarAcessos = useCallback(async () => {
    setCarregando(true);

    try {
      const lista = await listarAcessosNoGerenciador({
        limit: ACCESS_QUERY_LIMIT,
        projectSystemKey: filtroProjeto,
        startDate: filtroDataInicio,
        endDate: filtroDataFim,
      });
      if (!mountedRef.current) return;
      setErro("");
      setAcessos(Array.isArray(lista) ? lista : []);
      setGruposExpandidos({});
      setUltimaAtualizacao(Date.now());
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar acessos do gerenciador:", error);
      setErro("Nao foi possivel carregar os acessos.");
      setAcessos([]);
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [filtroDataFim, filtroDataInicio, filtroProjeto]);

  useEffect(() => {
    void carregarAcessos();
  }, [carregarAcessos]);

  const projetosMap = useMemo(() => {
    const mapa = new Map();
    projetos.forEach((projeto) => {
      const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
      if (!systemKey) return;
      mapa.set(systemKey, projeto);
    });
    return mapa;
  }, [projetos]);

  const opcoesProjeto = useMemo(
    () =>
      projetos
        .map((projeto) => ({
          value: normalizeText(projeto?.systemKey).toLowerCase(),
          label: normalizeText(projeto?.nomeProjeto) || normalizeText(projeto?.systemKey),
        }))
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [projetos]
  );

  const acessosFiltrados = useMemo(() => {
    return acessos.filter((acesso) => {
      const projectKey = resolveAccessProjectKey(acesso);
      const hashAtual = resolveAccessHash(acesso).toLowerCase();
      const ipAtual = resolveAccessIp(acesso).toLowerCase();
      const acessoTimestamp = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
      if (!mostrarRegistrosBloqueados && isAccessRecordBlocked(acesso)) return false;
      if (filtroProjeto && projectKey !== filtroProjeto) return false;
      if (filtroOrigem && resolveOrigemAcesso(acesso) !== filtroOrigem) return false;
      if (filtroTipoUsuario && resolveTipoUsuario(acesso) !== filtroTipoUsuario) return false;
      if (filtroHash && !hashAtual.includes(filtroHash.toLowerCase())) return false;
      if (filtroIp && !ipAtual.includes(filtroIp.toLowerCase())) return false;
      if (filtroDataInicio) {
        const dataInicio = new Date(`${filtroDataInicio}T00:00:00`).getTime();
        if (!Number.isFinite(acessoTimestamp) || acessoTimestamp < dataInicio) return false;
      }
      if (filtroDataFim) {
        const dataFim = new Date(`${filtroDataFim}T23:59:59.999`).getTime();
        if (!Number.isFinite(acessoTimestamp) || acessoTimestamp > dataFim) return false;
      }
      return true;
    });
  }, [
    acessos,
    filtroDataFim,
    filtroDataInicio,
    filtroHash,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroTipoUsuario,
    mostrarRegistrosBloqueados,
  ]);

  const totalRegistrosBloqueadosOcultos = useMemo(
    () => acessos.filter((acesso) => isAccessRecordBlocked(acesso)).length,
    [acessos]
  );

  useEffect(() => {
    setPaginaAtual(1);
    setGruposExpandidos({});
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroHash,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroTipoUsuario,
    mostrarRegistrosBloqueados,
  ]);

  const ipsBloqueadosSet = useMemo(
    () => new Set(normalizarIpsBloqueados(ipsBloqueadosRegistro)),
    [ipsBloqueadosRegistro]
  );

  const usuariosBloqueadosSet = useMemo(
    () => new Set(normalizarUsuariosBloqueados(usuariosBloqueadosRegistro)),
    [usuariosBloqueadosRegistro]
  );

  const gruposAcessos = useMemo(() => {
    const gruposMap = new Map();

    acessosFiltrados.forEach((acesso, index) => {
      const hash = resolveAccessHash(acesso);
      const projectKey = resolveAccessProjectKey(acesso) || "sem-projeto";
      const fallbackKey =
        normalizeText(acesso?.uid || acesso?.email || resolveAccessIp(acesso) || acesso?.id) ||
        String(index);
      const groupKey = `${projectKey}|${hash || `sem-hash:${fallbackKey}`}`;

      if (!gruposMap.has(groupKey)) {
        gruposMap.set(groupKey, {
          key: groupKey,
          hash,
          projectKey,
          items: [],
          projetosSet: new Set(),
          ipsSet: new Set(),
          hostsSet: new Set(),
          countriesSet: new Set(),
          regionsSet: new Set(),
          citiesSet: new Set(),
          ufsSet: new Set(),
          orgsSet: new Set(),
          geoSourcesSet: new Set(),
          perfisSet: new Set(),
          eventosSet: new Set(),
          usersSet: new Set(),
          userIdentifiersSet: new Set(),
        });
      }

      const grupo = gruposMap.get(groupKey);
      const geoInfo = resolveAccessGeoInfo(acesso);
      const userIdentifiers = resolveAccessUserIdentifiers(acesso);
      grupo.items.push(acesso);
      grupo.projetosSet.add(resolveAccessProjectKey(acesso));
      grupo.ipsSet.add(resolveAccessIp(acesso));
      grupo.hostsSet.add(normalizeText(acesso?.hostname));
      grupo.countriesSet.add(geoInfo.country);
      grupo.regionsSet.add(geoInfo.region);
      grupo.citiesSet.add(geoInfo.city);
      grupo.ufsSet.add(geoInfo.uf);
      grupo.orgsSet.add(geoInfo.org);
      grupo.geoSourcesSet.add(geoInfo.source);
      grupo.perfisSet.add(normalizeText(acesso?.perfilAcesso));
      grupo.eventosSet.add(normalizeText(acesso?.eventoTipo));
      grupo.usersSet.add(resolveAccessUserLabel(acesso));
      userIdentifiers.forEach((identifier) => grupo.userIdentifiersSet.add(identifier));
    });

    return Array.from(gruposMap.values())
      .map((grupo) => {
        const itemsOrdenados = [...grupo.items].sort((a, b) => {
          const dataA = resolveDataTimestampMs(a?.data || a?.criadoEm) || 0;
          const dataB = resolveDataTimestampMs(b?.data || b?.criadoEm) || 0;
          return dataB - dataA;
        });
        const eventoMaisRecente = itemsOrdenados[0] || null;
        const primeiroEvento = itemsOrdenados[itemsOrdenados.length - 1] || null;

        return {
          key: grupo.key,
          hash: grupo.hash,
          projectKey: grupo.projectKey,
          items: itemsOrdenados,
          total: itemsOrdenados.length,
          totalBloqueados: itemsOrdenados.filter((item) => isAccessRecordBlocked(item)).length,
          usuario: Array.from(grupo.usersSet).filter(Boolean)[0] || "Visitante",
          projetos: Array.from(grupo.projetosSet).filter(Boolean),
          ips: Array.from(grupo.ipsSet).filter(Boolean),
          hosts: Array.from(grupo.hostsSet).filter(Boolean),
          countries: Array.from(grupo.countriesSet).filter(Boolean),
          regions: Array.from(grupo.regionsSet).filter(Boolean),
          cities: Array.from(grupo.citiesSet).filter(Boolean),
          ufs: Array.from(grupo.ufsSet).filter(Boolean),
          orgs: Array.from(grupo.orgsSet).filter(Boolean),
          geoSources: Array.from(grupo.geoSourcesSet).filter(Boolean),
          perfis: Array.from(grupo.perfisSet).filter(Boolean),
          eventos: Array.from(grupo.eventosSet).filter(Boolean),
          userIdentifiers: Array.from(grupo.userIdentifiersSet).filter(Boolean),
          primeiroEvento,
          eventoMaisRecente,
          primeiroEventoMs: resolveDataTimestampMs(primeiroEvento?.data || primeiroEvento?.criadoEm) || 0,
          eventoMaisRecenteMs:
            resolveDataTimestampMs(eventoMaisRecente?.data || eventoMaisRecente?.criadoEm) || 0,
        };
      })
      .sort((a, b) => b.eventoMaisRecenteMs - a.eventoMaisRecenteMs);
  }, [acessosFiltrados]);

  const totalPaginas = Math.max(1, Math.ceil(gruposAcessos.length / GROUP_PAGE_SIZE));
  const paginaAtualSegura = Math.min(paginaAtual, totalPaginas);

  useEffect(() => {
    if (paginaAtual !== paginaAtualSegura) {
      setPaginaAtual(paginaAtualSegura);
    }
  }, [paginaAtual, paginaAtualSegura]);

  const gruposPaginados = useMemo(() => {
    const inicio = (paginaAtualSegura - 1) * GROUP_PAGE_SIZE;
    return gruposAcessos.slice(inicio, inicio + GROUP_PAGE_SIZE);
  }, [gruposAcessos, paginaAtualSegura]);

  return (
    <section className="gerenciador-acessos">
      <div className="gerenciador-acessos__header">
        <div>
          <h1 className="gerenciador-acessos__title">ACESSOS</h1>
          <p className="gerenciador-acessos__subtitle">
            {`Eventos de acesso centralizados no projeto ${managerProjectLabel}.`}
          </p>
        </div>

        <div className="gerenciador-acessos__filters">
          <label className="gerenciador-acessos__filter">
            <span>Projeto</span>
            <select value={filtroProjeto} onChange={(event) => setFiltroProjeto(event.target.value)}>
              <option value="">Todos</option>
              {opcoesProjeto.map((projeto) => (
                <option key={projeto.value} value={projeto.value}>
                  {projeto.label}
                </option>
              ))}
            </select>
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Origem</span>
            <select value={filtroOrigem} onChange={(event) => setFiltroOrigem(event.target.value)}>
              <option value="">Todas</option>
              <option value="localhost">localhost</option>
              <option value="dominio">dominios</option>
            </select>
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Tipo de usuario</span>
            <select
              value={filtroTipoUsuario}
              onChange={(event) => setFiltroTipoUsuario(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="owner">owners</option>
              <option value="viewer">viewers</option>
            </select>
          </label>

          <div className="gerenciador-acessos__filter-pair">
            <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
              <span>Hash</span>
              <input
                type="text"
                value={filtroHash}
                onChange={(event) => setFiltroHash(event.target.value)}
                placeholder="Digite o hash"
              />
            </label>

            <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
              <span>IP</span>
              <input
                type="text"
                value={filtroIp}
                onChange={(event) => setFiltroIp(event.target.value)}
                placeholder="Digite o IP"
              />
            </label>
          </div>

          <label className="gerenciador-acessos__filter">
            <span>Data inicial</span>
            <input
              type="date"
              value={filtroDataInicio}
              max={filtroDataFim || undefined}
              onChange={(event) => setFiltroDataInicio(event.target.value)}
            />
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Data final</span>
            <input
              type="date"
              value={filtroDataFim}
              min={filtroDataInicio || undefined}
              onChange={(event) => setFiltroDataFim(event.target.value)}
            />
          </label>

          <label className="gerenciador-acessos__filter gerenciador-acessos__filter-check">
            <input
              type="checkbox"
              checked={mostrarRegistrosBloqueados}
              onChange={(event) => setMostrarRegistrosBloqueados(event.target.checked)}
            />
            <span>Mostrar bloqueados</span>
          </label>
        </div>
      </div>

      <div className="gerenciador-acessos__block-panel">
        <div>
          <strong>Bloqueio de registro por IP</strong>
          <p>
            IPs nesta lista nao geram novos registros de navegacao/acesso. Registros antigos
            continuam visiveis para auditoria.
          </p>
        </div>

        <form
          className="gerenciador-acessos__block-form"
          onSubmit={(event) => {
            event.preventDefault();
            adicionarIpBloqueado(ipBloqueioInput);
          }}
        >
          <input
            type="text"
            value={ipBloqueioInput}
            onChange={(event) => setIpBloqueioInput(event.target.value)}
            placeholder="IP para bloquear"
            disabled={salvandoBloqueioIp}
          />
          <button type="submit" disabled={salvandoBloqueioIp}>
            Bloquear IP
          </button>
        </form>

        {ipsBloqueadosRegistro.length ? (
          <div className="gerenciador-acessos__blocked-list">
            {ipsBloqueadosRegistro.map((ip) => (
              <span key={ip} className="gerenciador-acessos__blocked-chip">
                <code>{ip}</code>
                <button
                  type="button"
                  onClick={() => removerIpBloqueado(ip)}
                  disabled={salvandoBloqueioIp}
                >
                  remover
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="gerenciador-acessos__block-note">Nenhum IP bloqueado.</p>
        )}

        {erroBloqueioIp ? (
          <p className="gerenciador-acessos__error">{erroBloqueioIp}</p>
        ) : null}
        {mensagemBloqueioIp ? (
          <p className="gerenciador-acessos__success">{mensagemBloqueioIp}</p>
        ) : null}
      </div>

      <div className="gerenciador-acessos__block-panel">
        <div>
          <strong>Bloqueio de registro por usuario</strong>
          <p>
            UIDs ou emails nesta lista nao geram novos registros de navegacao/acesso
            quando o visitante estiver logado. Visitantes anonimos continuam dependendo
            de hash ou IP.
          </p>
        </div>

        <form
          className="gerenciador-acessos__block-form"
          onSubmit={(event) => {
            event.preventDefault();
            adicionarUsuarioBloqueado(usuarioBloqueioInput);
          }}
        >
          <input
            type="text"
            value={usuarioBloqueioInput}
            onChange={(event) => setUsuarioBloqueioInput(event.target.value)}
            placeholder="UID ou email para bloquear"
            disabled={salvandoBloqueioUsuario}
          />
          <button type="submit" disabled={salvandoBloqueioUsuario}>
            Bloquear usuario
          </button>
        </form>

        {usuariosBloqueadosRegistro.length ? (
          <div className="gerenciador-acessos__blocked-list">
            {usuariosBloqueadosRegistro.map((usuario) => (
              <span key={usuario} className="gerenciador-acessos__blocked-chip">
                <code>{usuario}</code>
                <button
                  type="button"
                  onClick={() => removerUsuarioBloqueado(usuario)}
                  disabled={salvandoBloqueioUsuario}
                >
                  remover
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="gerenciador-acessos__block-note">Nenhum usuario bloqueado.</p>
        )}

        {erroBloqueioUsuario ? (
          <p className="gerenciador-acessos__error">{erroBloqueioUsuario}</p>
        ) : null}
        {mensagemBloqueioUsuario ? (
          <p className="gerenciador-acessos__success">{mensagemBloqueioUsuario}</p>
        ) : null}
      </div>

      <div className="gerenciador-acessos__summary">
        <span>{`Total exibido: ${gruposAcessos.length} grupo(s) / ${acessosFiltrados.length} evento(s)`}</span>
        <span>{`Bloqueados ocultos: ${
          mostrarRegistrosBloqueados ? 0 : totalRegistrosBloqueadosOcultos
        }`}</span>
        <span>{`Pagina: ${paginaAtualSegura}/${totalPaginas}`}</span>
        <span>{`Consulta: ultimos ${ACCESS_QUERY_LIMIT} registros`}</span>
        <span>{`Atualizado: ${formatarData(ultimaAtualizacao)}`}</span>
        <button
          type="button"
          className="gerenciador-acessos__refresh"
          onClick={() => {
            void carregarAcessos();
          }}
          disabled={carregando}
        >
          {carregando ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {totalPaginas > 1 ? (
        <div className="gerenciador-acessos__pagination">
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

      {erro ? <p className="gerenciador-acessos__error">{erro}</p> : null}

      {!erro && !acessosFiltrados.length ? (
        <p className="gerenciador-acessos__empty">Nenhum acesso encontrado.</p>
      ) : null}

      {!erro && gruposPaginados.length ? (
        <div className="gerenciador-acessos__list">
          {gruposPaginados.map((grupo) => {
            const expandido = Boolean(gruposExpandidos[grupo.key]);
            const eventosVisiveis = expandido
              ? grupo.items
              : grupo.items.slice(0, ACCESS_GROUP_PREVIEW_SIZE);
            const eventosOcultos = Math.max(0, grupo.total - eventosVisiveis.length);
            const projetosGrupo =
              grupo.projetos
                .map((projectKey) => {
                  const projeto = projetosMap.get(projectKey);
                  return normalizeText(projeto?.nomeProjeto) || projectKey;
                })
                .filter(Boolean)
                .join(", ") || "--";
            const ipsGrupo = joinUnique(grupo.ips);
            const hostsGrupo = joinUnique(grupo.hosts);
            const paisesGrupo = joinUnique(grupo.countries);
            const regioesGrupo = joinUnique([...grupo.ufs, ...grupo.regions]);
            const cidadesGrupo = joinUnique(grupo.cities);
            const orgsGrupo = joinUnique(grupo.orgs);
            const fontesGeoGrupo = joinUnique(grupo.geoSources);
            const perfisGrupo = joinUnique(grupo.perfis);
            const eventosGrupo = joinUnique(grupo.eventos);

            return (
              <article key={grupo.key} className="gerenciador-acessos__group">
                <div className="gerenciador-acessos__group-header">
                  <div>
                    <strong>{grupo.usuario}</strong>
                    <span>{`Hash navegacao: ${grupo.hash || "--"}`}</span>
                  </div>
                  {grupo.total > ACCESS_GROUP_PREVIEW_SIZE ? (
                    <button
                      type="button"
                      className="gerenciador-acessos__more"
                      onClick={() =>
                        setGruposExpandidos((prev) => ({
                          ...prev,
                          [grupo.key]: !prev[grupo.key],
                        }))
                      }
                    >
                      {expandido ? "Ver menos" : `Ver mais (${eventosOcultos})`}
                    </button>
                  ) : null}
                </div>

                <div className="gerenciador-acessos__group-meta">
                  <span>{`Eventos: ${grupo.total}`}</span>
                  {grupo.totalBloqueados ? (
                    <span className="gerenciador-acessos__blocked-badge">
                      {`Bloqueados: ${grupo.totalBloqueados}`}
                    </span>
                  ) : null}
                  <span>{`Primeiro: ${formatarData(
                    grupo.primeiroEvento?.data || grupo.primeiroEvento?.criadoEm
                  )}`}</span>
                  <span>{`Ultimo: ${formatarData(
                    grupo.eventoMaisRecente?.data || grupo.eventoMaisRecente?.criadoEm
                  )}`}</span>
                  <span>{`Projetos: ${projetosGrupo}`}</span>
                  <span>{`Perfil: ${perfisGrupo}`}</span>
                  <span>{`Eventos tipo: ${eventosGrupo}`}</span>
                  <span>{`Hosts: ${hostsGrupo}`}</span>
                  <span>{`IPs: ${ipsGrupo}`}</span>
                  <span>{`Pais: ${paisesGrupo}`}</span>
                  <span>{`Regiao/UF: ${regioesGrupo}`}</span>
                  <span>{`Cidade: ${cidadesGrupo}`}</span>
                  <span>{`Org: ${orgsGrupo}`}</span>
                  <span>{`Geo fonte: ${fontesGeoGrupo}`}</span>
                </div>

                {grupo.ips.length ? (
                  <div className="gerenciador-acessos__ip-actions">
                    {grupo.ips.map((ip) => {
                      const ipNormalizado = normalizeIpBloqueio(ip);
                      const bloqueado = ipsBloqueadosSet.has(ipNormalizado);
                      return (
                        <button
                          key={ipNormalizado || ip}
                          type="button"
                          onClick={() =>
                            bloqueado
                              ? removerIpBloqueado(ipNormalizado)
                              : adicionarIpBloqueado(ipNormalizado)
                          }
                          disabled={salvandoBloqueioIp || !ipNormalizado}
                          className={
                            bloqueado
                              ? "gerenciador-acessos__ip-action is-blocked"
                              : "gerenciador-acessos__ip-action"
                          }
                        >
                          {bloqueado
                            ? `Liberar registro do IP ${ipNormalizado}`
                            : `Bloquear registro do IP ${ipNormalizado}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {grupo.userIdentifiers.length ? (
                  <div className="gerenciador-acessos__ip-actions">
                    {grupo.userIdentifiers.map((usuario) => {
                      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
                      const bloqueado = usuariosBloqueadosSet.has(usuarioNormalizado);
                      return (
                        <button
                          key={usuarioNormalizado || usuario}
                          type="button"
                          onClick={() =>
                            bloqueado
                              ? removerUsuarioBloqueado(usuarioNormalizado)
                              : adicionarUsuarioBloqueado(usuarioNormalizado)
                          }
                          disabled={salvandoBloqueioUsuario || !usuarioNormalizado}
                          className={
                            bloqueado
                              ? "gerenciador-acessos__ip-action is-blocked"
                              : "gerenciador-acessos__ip-action"
                          }
                        >
                          {bloqueado
                            ? `Liberar registro de ${formatarUsuarioBloqueio(
                                usuarioNormalizado
                              )}`
                            : `Bloquear registro de ${formatarUsuarioBloqueio(
                                usuarioNormalizado
                              )}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="gerenciador-acessos__events">
                  {eventosVisiveis.map((acesso) => {
                    const projectKey = resolveAccessProjectKey(acesso);
                    const projeto = projetosMap.get(projectKey);
                    const hashNavegacao = resolveAccessHash(acesso) || "--";
                    const ipAcesso = resolveAccessIp(acesso) || "--";
                    const origemAcesso = resolveOrigemAcesso(acesso) || "--";
                    const tipoUsuario = resolveTipoUsuario(acesso);
                    const geoInfo = resolveAccessGeoInfo(acesso);
                    const paisAcesso = resolveGeoText(geoInfo.country);
                    const regiaoAcesso = resolveGeoText(geoInfo.uf || geoInfo.region);
                    const cidadeAcesso = resolveGeoText(geoInfo.city);
                    const orgAcesso = resolveGeoText(geoInfo.org);
                    const fonteGeoAcesso = resolveGeoText(geoInfo.source);
                    const erroGeoAcesso = resolveGeoText(geoInfo.error);
                    const visibilidadeAba = resolveGeoText(
                      acesso?.documentVisibility || acesso?.visibilityState
                    );
                    const motivoRegistro = resolveGeoText(
                      acesso?.registroMotivo || acesso?.motivoRegistro
                    );
                    const registroBloqueado = isAccessRecordBlocked(acesso);
                    const motivoBloqueio = resolveGeoText(
                      acesso?.bloqueadoPor || acesso?.motivoBloqueio
                    );
                    const tempoAba = formatarDuracaoMs(acesso?.tempoDesdeAberturaMs);
                    const coordenadasAcesso =
                      geoInfo.latitude !== null && geoInfo.longitude !== null
                        ? `${geoInfo.latitude}, ${geoInfo.longitude}`
                        : "--";

                    return (
                      <article key={acesso.id} className="gerenciador-acessos__card">
                        <div className="gerenciador-acessos__topline">
                          <strong>{resolveAccessUserLabel(acesso)}</strong>
                          {registroBloqueado ? (
                            <span className="gerenciador-acessos__blocked-badge">
                              BLOQUEADO
                            </span>
                          ) : null}
                          <span>{`Data/Hora: ${formatarData(
                            acesso?.data || acesso?.criadoEm
                          )}`}</span>
                        </div>
                        <div className="gerenciador-acessos__meta">
                          <span>{`Projeto: ${
                            normalizeText(projeto?.nomeProjeto) ||
                            normalizeText(acesso?.projectNome) ||
                            projectKey ||
                            "--"
                          }`}</span>
                          <span>{`Perfil: ${normalizeText(acesso?.perfilAcesso) || "--"}`}</span>
                          <span>{`Evento: ${normalizeText(acesso?.eventoTipo) || "--"}`}</span>
                          <span>{`Motivo: ${motivoRegistro}`}</span>
                          <span>{`Bloqueio: ${registroBloqueado ? motivoBloqueio : "--"}`}</span>
                          <span>{`Visibilidade: ${visibilidadeAba}`}</span>
                          <span>{`Tempo aba: ${tempoAba}`}</span>
                          <span>{`Origem: ${origemAcesso}`}</span>
                          <span>{`Tipo usuario: ${tipoUsuario}`}</span>
                          <span>{`Runtime: ${normalizeText(acesso?.runtimeProjectId) || "--"}`}</span>
                          <span>{`Host: ${normalizeText(acesso?.hostname) || "--"}`}</span>
                          <span>{`IP: ${ipAcesso}`}</span>
                          <span>{`UID: ${normalizeText(acesso?.uid) || "--"}`}</span>
                          <span>{`Email: ${normalizeText(acesso?.email) || "--"}`}</span>
                          <span>{`Hash: ${hashNavegacao}`}</span>
                          <span>{`Pais: ${paisAcesso}`}</span>
                          <span>{`Regiao: ${regiaoAcesso}`}</span>
                          <span>{`Cidade: ${cidadeAcesso}`}</span>
                          <span>{`Org: ${orgAcesso}`}</span>
                          <span>{`Geo fonte: ${fonteGeoAcesso}`}</span>
                          <span>{`Geo erro: ${erroGeoAcesso}`}</span>
                          <span>{`Coordenadas: ${coordenadasAcesso}`}</span>
                        </div>
                        <div className="gerenciador-acessos__path">
                          <code>{normalizeText(acesso?.fullPath || acesso?.path) || "/"}</code>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {totalPaginas > 1 ? (
        <div className="gerenciador-acessos__pagination">
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

export default ListaAcessos;
