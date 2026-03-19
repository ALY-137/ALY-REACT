import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import {
  listarProjetosNoGerenciador,
  obterFirestoreDoGerenciador,
} from "../../Layout/Sistema/gerenciadorSistemasApi";
import "./acessos.css";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function formatarData(valor) {
  if (!valor) return "—";
  if (typeof valor?.toDate === "function") {
    return valor.toDate().toLocaleString("pt-BR");
  }
  if (typeof valor?.seconds === "number") {
    return new Date(valor.seconds * 1000).toLocaleString("pt-BR");
  }
  return "—";
}

function ListaAcessos() {
  const [acessos, setAcessos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [projetos, setProjetos] = useState([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    listarProjetosNoGerenciador()
      .then((lista) => {
        if (!ativo) return;
        setProjetos(Array.isArray(lista) ? lista : []);
      })
      .catch((error) => {
        console.error("Erro ao carregar projetos para filtro de acessos:", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const managerDb = obterFirestoreDoGerenciador();
    if (!managerDb) {
      setErro("Banco do gerenciador nao configurado.");
      setAcessos([]);
      return undefined;
    }

    const acessosRef = query(collection(managerDb, "acessos"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(
      acessosRef,
      (snapshot) => {
        setErro("");
        setAcessos(
          snapshot.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          }))
        );
      },
      (error) => {
        console.error("Erro ao carregar acessos do gerenciador:", error);
        setErro("Nao foi possivel carregar os acessos.");
      }
    );

    return () => unsubscribe();
  }, []);

  const opcoesProjeto = useMemo(() => {
    const mapa = new Map();

    projetos.forEach((projeto) => {
      const key = normalizarTexto(projeto?.systemKey);
      if (!key) return;
      mapa.set(key, {
        value: key,
        label: normalizarTexto(projeto?.nomeProjeto) || key,
      });
    });

    acessos.forEach((acesso) => {
      const key =
        normalizarTexto(acesso?.projectSystemKey) ||
        normalizarTexto(acesso?.runtimeProjectKey);
      if (!key || mapa.has(key)) return;
      mapa.set(key, {
        value: key,
        label: normalizarTexto(acesso?.projectNome) || key,
      });
    });

    return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [acessos, projetos]);

  const acessosFiltrados = useMemo(() => {
    if (!filtroProjeto) return acessos;

    return acessos.filter((acesso) => {
      const projectSystemKey = normalizarTexto(acesso?.projectSystemKey);
      const runtimeProjectKey = normalizarTexto(acesso?.runtimeProjectKey);
      return projectSystemKey === filtroProjeto || runtimeProjectKey === filtroProjeto;
    });
  }, [acessos, filtroProjeto]);

  return (
    <section className="acessos-lista">
      <div className="acessos-lista__header">
        <div>
          <h1 className="acessos-lista__title">ACESSOS</h1>
          <p className="acessos-lista__subtitle">
            Registro centralizado no projeto gerenciador-aly.
          </p>
        </div>

        <label className="acessos-lista__filter">
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
      </div>

      <div className="acessos-lista__summary">
        <span>{`Total exibido: ${acessosFiltrados.length}`}</span>
        {filtroProjeto ? <span>{`Filtro ativo: ${filtroProjeto}`}</span> : null}
      </div>

      {erro ? <p className="acessos-lista__error">{erro}</p> : null}

      {!erro && !acessosFiltrados.length ? (
        <p className="acessos-lista__empty">Nenhum acesso encontrado.</p>
      ) : null}

      {!erro && acessosFiltrados.length ? (
        <div className="acessos-lista__table-wrap">
          <table className="acessos-lista__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Projeto</th>
                <th>Dominio</th>
                <th>Caminho</th>
                <th>Perfil</th>
                <th>Usuario</th>
                <th>Localizacao</th>
                <th>IP</th>
                <th>Org</th>
              </tr>
            </thead>
            <tbody>
              {acessosFiltrados.map((acesso) => (
                <tr key={acesso.id}>
                  <td>{formatarData(acesso.data)}</td>
                  <td>
                    <strong>{normalizarTexto(acesso.projectNome) || "—"}</strong>
                    <div className="acessos-lista__meta">
                      {normalizarTexto(acesso.projectSystemKey || acesso.runtimeProjectKey) || "—"}
                    </div>
                  </td>
                  <td>{normalizarTexto(acesso.hostname) || "—"}</td>
                  <td>{normalizarTexto(acesso.fullPath || acesso.path) || "—"}</td>
                  <td>{normalizarTexto(acesso.perfilAcesso) || "—"}</td>
                  <td>
                    {normalizarTexto(acesso.email || acesso.displayName || acesso.uid) || "—"}
                  </td>
                  <td>
                    {[
                      normalizarTexto(acesso.city || acesso.cidade),
                      normalizarTexto(acesso.uf),
                      normalizarTexto(acesso.country),
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                  <td>{normalizarTexto(acesso.ip) || "—"}</td>
                  <td>{normalizarTexto(acesso.org) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default ListaAcessos;
