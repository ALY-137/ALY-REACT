import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";
import { obterStatusMercadoPago, obterStatusPixManual } from "../Pagamentos/mercadoPagoApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistema,
  obterRotulosEspaco,
} from "../Sistema/configSistema";
import { listarIconCollectionsNoGerenciador } from "../Sistema/gerenciadorProjetosApi";
import {
  removerEstruturaPublicaEspaco,
  sincronizarEstruturaPublicaEspaco,
} from "./firebaseEspacos";

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const OPCOES_VISIBILIDADE_ESPACO_BASE = [
  { value: "publico", label: "Publico" },
  { value: "publico_restritivo", label: "Publico restritivo" },
  { value: "privado", label: "Privado (autenticado)" },
];

const OPCOES_VISIBILIDADE_ESPACO_ASSINATURA = [
  { value: "exclusivo_assinante", label: "Exclusivo assinante" },
];

const LABEL_VISIBILIDADE_ESPACO = {
  publico: "Publico",
  publico_restritivo: "Publico restritivo",
  privado: "Privado (autenticado)",
  exclusivo_assinante: "Exclusivo assinante",
};

const buildIconSelectionValue = (espaco = {}) => {
  const collectionId = String(espaco?.iconCollectionId || "").trim();
  const iconId = String(espaco?.iconId || "").trim();
  if (!collectionId || !iconId) return "";
  return `${collectionId}::${iconId}`;
};

const parseIconSelectionValue = (valor = "", colecoes = []) => {
  const [collectionId, iconId] = String(valor || "").split("::");
  if (!collectionId || !iconId) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  const colecao = (colecoes || []).find((item) => item.id === collectionId);
  const icon = (colecao?.icons || []).find((item) => item.id === iconId);
  if (!icon) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  return {
    iconCollectionId: collectionId,
    iconId,
    iconUrl: String(icon.url || "").trim(),
    iconLabel: String(icon.label || "").trim(),
  };
};

export default function EspacoManager() {
  const [homeDaSkin, setHomeDaSkin] = useState(null);
  const [espacosRelacionados, setEspacosRelacionados] = useState([]);
  const [espacosRelacionaveis, setEspacosRelacionaveis] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaVisibilidade, setNovaVisibilidade] = useState("privado");
  const [loading, setLoading] = useState(false);

  const [editingEspacoId, setEditingEspacoId] = useState(null);
  const [editingNome, setEditingNome] = useState("");
  const [editingVisibilidade, setEditingVisibilidade] = useState("privado");
  const [editingIconSelection, setEditingIconSelection] = useState("");
  const [novaSelecaoIcone, setNovaSelecaoIcone] = useState("");
  const [homeIconSelection, setHomeIconSelection] = useState("");
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeEspacoPlural, setNomeEspacoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
  );
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [mpConectado, setMpConectado] = useState(false);
  const [pixManualConectado, setPixManualConectado] = useState(false);
  const [contextoCarregado, setContextoCarregado] = useState(false);
  const [userIdResolvido, setUserIdResolvido] = useState("");
  const [skinIdResolvida, setSkinIdResolvida] = useState("");
  const [configSistemaAtual, setConfigSistemaAtual] = useState(DEFAULT_SISTEMA_CONFIG);
  const [iconCollectionsDisponiveis, setIconCollectionsDisponiveis] = useState([]);

  const authUidAtual = auth.currentUser?.uid || "";
  const userId = userIdResolvido || authUidAtual || "";
  const skinIdAtual = skinIdResolvida || localStorage.getItem("skinIdAtual") || "";
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeEspacoPluralCapitalizado = capitalizar(nomeEspacoPlural);
  const metodoPagamentoAssinaturaDisponivel =
    (mercadoPagoSistemaHabilitado && mpConectado) ||
    (pixManualSistemaHabilitado && pixManualConectado);
  const temaProjeto = String(
    configSistemaAtual?.temaPadraoSistema || DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
  ).trim();
  const colecoesIconesPermitidas = Array.isArray(configSistemaAtual?.iconCollectionIds)
    ? configSistemaAtual.iconCollectionIds
    : [];
  const iconCollectionsFiltradas = useMemo(
    () =>
      iconCollectionsDisponiveis.filter((colecao) => {
        const collectionAllowedByProject =
          !colecoesIconesPermitidas.length || colecoesIconesPermitidas.includes(colecao.id);
        const collectionAllowedByTheme =
          !Array.isArray(colecao.themeIds) ||
          !colecao.themeIds.length ||
          colecao.themeIds.includes(temaProjeto);
        return collectionAllowedByProject && collectionAllowedByTheme;
      }),
    [iconCollectionsDisponiveis, colecoesIconesPermitidas, temaProjeto]
  );
  const projetoPossuiColecoesIcones = iconCollectionsFiltradas.length > 0;

  useEffect(() => {
    if (userId && skinIdAtual) carregarEspacos();
  }, [userId, skinIdAtual]);

  useEffect(() => {
    let ativo = true;

    async function resolverContextoEdicao() {
      try {
        const authUser = auth.currentUser;
        if (!authUser?.uid) {
          if (!ativo) return;
          setUserIdResolvido("");
          setSkinIdResolvida("");
          setContextoCarregado(true);
          return;
        }

        const configSistema = await obterConfigSistema().catch(() => DEFAULT_SISTEMA_CONFIG);
        if (!ativo) return;
        setConfigSistemaAtual(configSistema);
        const onepagePublica = isOnePageComEntradaPublica(configSistema);
        const ownerUidCandidates = Array.from(
          new Set(
            [
              onepagePublica ? configSistema?.adminUid : "",
              onepagePublica ? configSistema?.projectOwnerUid : "",
              onepagePublica ? configSistema?.projectLastEditorUid : "",
              authUser.uid,
            ]
              .map((value) => String(value || "").trim())
              .filter(Boolean)
          )
        );

        let skinId = String(localStorage.getItem("skinIdAtual") || "").trim();
        let ownerUidEncontrado = "";

        for (const ownerUidCandidate of ownerUidCandidates) {
          if (!ownerUidCandidate) continue;

          const skinsRef = getPrimaryProjectCollection(db, "users", ownerUidCandidate, "skins");
          let skinsSnap = await getDocs(query(skinsRef, where("is_main", "==", true), limit(1)));

          if (skinsSnap.empty) {
            skinsSnap = await getDocs(query(skinsRef, limit(1)));
          }

          if (!skinsSnap.empty) {
            ownerUidEncontrado = ownerUidCandidate;
            skinId = skinsSnap.docs[0].id;
            localStorage.setItem("skinIdAtual", skinId);
            const username = String(skinsSnap.docs[0].data()?.username || "").trim();
            if (username) {
              localStorage.setItem("skinLogadoUser", username);
              localStorage.setItem("targetUsername", username);
            }
            break;
          }
        }

        if (!ativo) return;
        setUserIdResolvido(ownerUidEncontrado || authUser.uid);
        setSkinIdResolvida(skinId);
        setContextoCarregado(true);
      } catch {
        if (!ativo) return;
        setUserIdResolvido(auth.currentUser?.uid || "");
        setSkinIdResolvida(String(localStorage.getItem("skinIdAtual") || "").trim());
        setContextoCarregado(true);
      }
    }

    resolverContextoEdicao();
    return () => {
      ativo = false;
    };
  }, [authUidAtual]);

  useEffect(() => {
    let ativo = true;

    async function carregarNomenclatura() {
      try {
        const configSistema = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistemaAtual(configSistema);
        const rotulosEspaco = obterRotulosEspaco(configSistema);
        setNomeEspacoSingular(rotulosEspaco?.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(rotulosEspaco?.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setMercadoPagoSistemaHabilitado(configSistema?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(configSistema?.pixManualHabilitado !== false);
      } catch {
        if (!ativo) return;
        setNomeEspacoSingular(DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setMercadoPagoSistemaHabilitado(DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado);
        setPixManualSistemaHabilitado(DEFAULT_SISTEMA_CONFIG.pixManualHabilitado);
      }
    }

    carregarNomenclatura();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarColecoesIcones() {
      try {
        const colecoes = await listarIconCollectionsNoGerenciador();
        if (!ativo) return;
        setIconCollectionsDisponiveis(colecoes);
      } catch {
        if (!ativo) return;
        setIconCollectionsDisponiveis([]);
      }
    }

    carregarColecoesIcones();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarStatusPagamentos() {
      try {
        const [statusMercadoPago, statusPixManual] = await Promise.allSettled([
          obterStatusMercadoPago(),
          obterStatusPixManual(),
        ]);

        if (!ativo) return;

        setMpConectado(
          statusMercadoPago.status === "fulfilled" && Boolean(statusMercadoPago.value?.conectado)
        );
        setPixManualConectado(
          statusPixManual.status === "fulfilled" &&
            Boolean(statusPixManual.value?.chavePix || statusPixManual.value?.conectado)
        );
      } catch {
        if (!ativo) return;
        setMpConectado(false);
        setPixManualConectado(false);
      }
    }

    carregarStatusPagamentos();
    return () => {
      ativo = false;
    };
  }, []);

  const proxOrdem = useMemo(() => {
    if (!espacosRelacionados.length) return 1;
    const maior = espacosRelacionados.reduce(
      (acc, e) => Math.max(acc, Number(e.ordem) || 0),
      0
    );
    return maior + 1;
  }, [espacosRelacionados]);

  const opcoesVisibilidadeEspaco = useMemo(() => {
    const opcoes = [...OPCOES_VISIBILIDADE_ESPACO_BASE];
    if (metodoPagamentoAssinaturaDisponivel) {
      opcoes.push(...OPCOES_VISIBILIDADE_ESPACO_ASSINATURA);
    }
    const valorEditando = editingVisibilidade || homeDaSkin?.visibilidade || novaVisibilidade;
    if (
      valorEditando &&
      !opcoes.some((opcao) => opcao.value === valorEditando) &&
      LABEL_VISIBILIDADE_ESPACO[valorEditando]
    ) {
      opcoes.push({
        value: valorEditando,
        label: LABEL_VISIBILIDADE_ESPACO[valorEditando],
      });
    }
    return opcoes;
  }, [
    editingVisibilidade,
    homeDaSkin?.visibilidade,
    metodoPagamentoAssinaturaDisponivel,
    novaVisibilidade,
  ]);

  const carregarEspacos = async () => {
    setLoading(true);
    try {
      try {
        await obterConfigSistema();
      } catch {
        // Continua com a leitura dos espacos com a config em cache.
      }

      const espacosSnap = await getDocs(getPrimaryProjectCollection(db, "users", userId, "espacos"));

      const todosEspacos = espacosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const home =
        todosEspacos.find((e) => e.skinOwner === skinIdAtual && e.isHome === true) || null;

      const relacionados = todosEspacos
        .filter(
          (e) =>
            Array.isArray(e.skins_relacionadas) &&
            e.skins_relacionadas.includes(skinIdAtual) &&
            e.isHome !== true
        )
        .sort(
          (a, b) =>
            (Number.isFinite(a.ordem) ? a.ordem : Number.MAX_SAFE_INTEGER) -
            (Number.isFinite(b.ordem) ? b.ordem : Number.MAX_SAFE_INTEGER)
        );

      const relacionaveis = todosEspacos
        .filter((e) => e.isHome !== true)
        .filter(
          (e) =>
            !Array.isArray(e.skins_relacionadas) ||
            !e.skins_relacionadas.includes(skinIdAtual)
        );

      await Promise.all(
        todosEspacos.map((espaco) =>
          sincronizarEstruturaPublicaEspaco(userId, {
            ...espaco,
            id: espaco.id,
            ownerUserId: espaco.ownerUserId || userId,
          })
        )
      );

      setHomeDaSkin(home);
      setEspacosRelacionados(relacionados);
      setEspacosRelacionaveis(relacionaveis);
    } finally {
      setLoading(false);
    }
  };

  const criarEspaco = async () => {
    if (!novoNome.trim()) return;
    const iconPayload = parseIconSelectionValue(novaSelecaoIcone, iconCollectionsFiltradas);

    const ref = doc(getPrimaryProjectCollection(db, "users", userId, "espacos"));

    const novoEspaco = {
      id_espaco: ref.id,
      nome: novoNome.trim(),
      ordem: proxOrdem,
      ownerUserId: userId,
      skins_relacionadas: [skinIdAtual],
      skinOwner: skinIdAtual,
      visibilidade: novaVisibilidade || "privado",
      ...iconPayload,
      createdAt: serverTimestamp(),
      isHome: false,
    };

    await setDoc(ref, novoEspaco);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...novoEspaco,
      id: ref.id,
    });

    setNovoNome("");
    setNovaVisibilidade("privado");
    setNovaSelecaoIcone("");
    carregarEspacos();
  };

  const iniciarEdicao = (espaco) => {
    setEditingEspacoId(espaco.id);
    setEditingNome(espaco.nome || "");
    setEditingVisibilidade(espaco.visibilidade || "publico");
    setEditingIconSelection(buildIconSelectionValue(espaco));
  };

  const cancelarEdicao = () => {
    setEditingEspacoId(null);
    setEditingNome("");
    setEditingVisibilidade("privado");
    setEditingIconSelection("");
  };

  const salvarEdicao = async (espacoId) => {
    if (!editingNome.trim()) return;
    const iconPayload = parseIconSelectionValue(editingIconSelection, iconCollectionsFiltradas);

    const espacoExistente = espacosRelacionados.find((espaco) => espaco.id === espacoId);
    const espacoAtualizado = {
      ...(espacoExistente || {}),
      id: espacoId,
      id_espaco: espacoId,
      nome: editingNome.trim(),
      visibilidade: editingVisibilidade || "publico",
      ...iconPayload,
      ownerUserId: espacoExistente?.ownerUserId || userId,
    };

    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espacoId), {
      nome: editingNome.trim(),
      visibilidade: editingVisibilidade || "publico",
      ...iconPayload,
    });
    await sincronizarEstruturaPublicaEspaco(userId, espacoAtualizado);

    cancelarEdicao();
    carregarEspacos();
  };

  const salvarHome = async (patch = {}) => {
    if (!homeDaSkin?.id) return;
    const proximoEspaco = {
      ...homeDaSkin,
      ...patch,
    };
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", homeDaSkin.id), {
      ...patch,
    });
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...proximoEspaco,
      id: homeDaSkin.id,
      ownerUserId: proximoEspaco.ownerUserId || userId,
    });
    carregarEspacos();
  };

  const excluirEspaco = async (espaco) => {
    const ok = window.confirm(
      `Excluir o ${nomeEspacoSingular} "${espaco.nome}"? Esta acao nao pode ser desfeita.`
    );
    if (!ok) return;

    await deleteDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espaco.id));
    await removerEstruturaPublicaEspaco(userId, espaco.id);

    if (editingEspacoId === espaco.id) {
      cancelarEdicao();
    }

    carregarEspacos();
  };

  const salvarOrdem = async (listaOrdenada) => {
    const updates = listaOrdenada.map((espaco, index) =>
      updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espaco.id), {
        ordem: index + 1,
      })
    );

    await Promise.all(updates);
    await Promise.all(
      listaOrdenada.map((espaco, index) =>
        sincronizarEstruturaPublicaEspaco(userId, {
          ...espaco,
          id: espaco.id,
          ordem: index + 1,
          ownerUserId: espaco.ownerUserId || userId,
        })
      )
    );
  };

  const moverEspaco = async (espacoId, direcao) => {
    const index = espacosRelacionados.findIndex((e) => e.id === espacoId);
    if (index < 0) return;

    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= espacosRelacionados.length) return;

    const ordenada = [...espacosRelacionados];
    const [movido] = ordenada.splice(index, 1);
    ordenada.splice(novoIndex, 0, movido);

    setEspacosRelacionados(ordenada);
    await salvarOrdem(ordenada);
  };

  const relacionar = async (id) => {
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayUnion(skinIdAtual),
    });
    const espaco = espacosRelacionaveis.find((item) => item.id === id);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...(espaco || {}),
      id,
      id_espaco: id,
      ownerUserId: espaco?.ownerUserId || userId,
      skins_relacionadas: Array.from(
        new Set([...(espaco?.skins_relacionadas || []), skinIdAtual].filter(Boolean))
      ),
    });
    carregarEspacos();
  };

  const remover = async (id) => {
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayRemove(skinIdAtual),
    });
    const espaco = espacosRelacionados.find((item) => item.id === id);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...(espaco || {}),
      id,
      id_espaco: id,
      ownerUserId: espaco?.ownerUserId || userId,
      skins_relacionadas: (espaco?.skins_relacionadas || []).filter(
        (skinId) => skinId !== skinIdAtual
      ),
    });
    carregarEspacos();
  };

  if (!contextoCarregado) {
    return <p>Carregando...</p>;
  }

  if (!userId || !skinIdAtual) {
    return <p>Usuario ou skin nao carregados.</p>;
  }

  return (
    <div>
      <h2>Home da Skin</h2>

      {homeDaSkin ? (
        <div style={{ marginBottom: 12 }}>
          <strong>{homeDaSkin.nome}</strong>{" "}
          <small>{`(${LABEL_VISIBILIDADE_ESPACO[homeDaSkin.visibilidade || "publico"] || "Publico"})`}</small>
          <div style={{ marginTop: 8 }}>
            <select
              value={homeDaSkin.visibilidade || "publico"}
              onChange={(event) => salvarHome({ visibilidade: event.target.value || "publico" })}
            >
              {opcoesVisibilidadeEspaco.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
            {projetoPossuiColecoesIcones ? (
              <select
                value={homeIconSelection || buildIconSelectionValue(homeDaSkin)}
                onChange={(event) => {
                  const valor = event.target.value;
                  setHomeIconSelection(valor);
                  salvarHome(parseIconSelectionValue(valor, iconCollectionsFiltradas));
                }}
                style={{ marginLeft: 8 }}
              >
                <option value="">Sem icone</option>
                {iconCollectionsFiltradas.map((colecao) => (
                  <optgroup key={colecao.id} label={colecao.nome}>
                    {(colecao.icons || []).map((icon) => (
                      <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                        {icon.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      ) : (
        <p>Home nao encontrada.</p>
      )}

      <hr />

      <h3>{`${nomeEspacoPluralCapitalizado} Relacionados`}</h3>
      {loading && <p>Carregando...</p>}

      {!loading && espacosRelacionados.length === 0 && (
        <p>{`Nenhum ${nomeEspacoSingular} relacionado.`}</p>
      )}

      {espacosRelacionados.map((e) => (
        <div key={e.id} style={{ marginBottom: 12 }}>
          <strong>{e.nome}</strong>{" "}
          <small>
            {`(ordem: ${e.ordem ?? "-"} | ${
              LABEL_VISIBILIDADE_ESPACO[e.visibilidade || "publico"] || "Publico"
            })`}
          </small>
          {String(e.iconUrl || "").trim() ? (
            <div style={{ marginTop: 6 }}>
              <img
                src={e.iconUrl}
                alt={e.iconLabel || e.nome}
                style={{ width: 20, height: 20, objectFit: "contain" }}
              />
            </div>
          ) : null}

          <div>
            <button onClick={() => remover(e.id)}>Remover</button>{" "}
            <button onClick={() => moverEspaco(e.id, -1)} title="Mover para cima">
              Subir
            </button>{" "}
            <button onClick={() => moverEspaco(e.id, 1)} title="Mover para baixo">
              Descer
            </button>{" "}
            <button onClick={() => iniciarEdicao(e)}>Editar</button>{" "}
            <button onClick={() => excluirEspaco(e)} style={{ color: "red" }}>
              Excluir
            </button>
          </div>

          {editingEspacoId === e.id && (
            <div style={{ marginTop: 8 }}>
              <input
                value={editingNome}
                onChange={(event) => setEditingNome(event.target.value)}
                placeholder={`Novo nome do ${nomeEspacoSingular}`}
              />
              <select
                value={editingVisibilidade}
                onChange={(event) => setEditingVisibilidade(event.target.value)}
                style={{ marginLeft: 8 }}
              >
                {opcoesVisibilidadeEspaco.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>{" "}
              {projetoPossuiColecoesIcones ? (
                <select
                  value={editingIconSelection}
                  onChange={(event) => setEditingIconSelection(event.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  <option value="">Sem icone</option>
                  {iconCollectionsFiltradas.map((colecao) => (
                    <optgroup key={colecao.id} label={colecao.nome}>
                      {(colecao.icons || []).map((icon) => (
                        <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                          {icon.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : null}
              <button onClick={() => salvarEdicao(e.id)}>{`Salvar ${nomeEspacoSingular}`}</button>{" "}
              <button onClick={cancelarEdicao}>Cancelar</button>
            </div>
          )}
        </div>
      ))}

      <hr />

      <h3>{`Relacionar ${nomeEspacoPluralCapitalizado}`}</h3>
      {espacosRelacionaveis.map((e) => (
        <button key={e.id} onClick={() => relacionar(e.id)}>
          {`Relacionar ${nomeEspacoSingular}: ${e.nome}`}
        </button>
      ))}

      <hr />

      <h3>{`Criar ${nomeEspacoSingularCapitalizado} Adicional`}</h3>
      <input
        value={novoNome}
        onChange={(e) => setNovoNome(e.target.value)}
        placeholder={`Nome do ${nomeEspacoSingular}`}
      />
      <select
        value={novaVisibilidade}
        onChange={(event) => setNovaVisibilidade(event.target.value)}
        style={{ marginLeft: 8 }}
      >
        {opcoesVisibilidadeEspaco.map((opcao) => (
          <option key={opcao.value} value={opcao.value}>
            {opcao.label}
          </option>
        ))}
      </select>{" "}
      {projetoPossuiColecoesIcones ? (
        <select
          value={novaSelecaoIcone}
          onChange={(event) => setNovaSelecaoIcone(event.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="">Sem icone</option>
          {iconCollectionsFiltradas.map((colecao) => (
            <optgroup key={colecao.id} label={colecao.nome}>
              {(colecao.icons || []).map((icon) => (
                <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                  {icon.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : null}
      <button onClick={criarEspaco}>{`Criar ${nomeEspacoSingularCapitalizado}`}</button>

      {!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          Metodos de pagamento desativados em PROPRIEDADES DO SISTEMA.
        </p>
      ) : !metodoPagamentoAssinaturaDisponivel ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          {`Conecte o Mercado Pago ou configure PIX manual para habilitar visibilidade exclusiva para assinantes de ${nomeEspacoPlural}.`}
        </p>
      ) : !projetoPossuiColecoesIcones ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          Nenhuma colecao de icones permitida para este projeto/tema.
        </p>
      ) : null}
    </div>
  );
}
