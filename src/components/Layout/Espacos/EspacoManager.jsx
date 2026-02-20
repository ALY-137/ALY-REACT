import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../Banco/init-firebase";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
  obterRotulosEspaco,
} from "../Sistema/configSistema";

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

export default function EspacoManager() {
  const [homeDaSkin, setHomeDaSkin] = useState(null);
  const [espacosRelacionados, setEspacosRelacionados] = useState([]);
  const [espacosRelacionaveis, setEspacosRelacionaveis] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingEspacoId, setEditingEspacoId] = useState(null);
  const [editingNome, setEditingNome] = useState("");
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeEspacoPlural, setNomeEspacoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
  );

  const userId = auth.currentUser?.uid;
  const skinIdAtual = localStorage.getItem("skinIdAtual");
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeEspacoPluralCapitalizado = capitalizar(nomeEspacoPlural);

  useEffect(() => {
    if (userId && skinIdAtual) carregarEspacos();
  }, [userId, skinIdAtual]);

  useEffect(() => {
    let ativo = true;

    async function carregarNomenclatura() {
      try {
        const configSistema = await obterConfigSistema();
        if (!ativo) return;
        const rotulosEspaco = obterRotulosEspaco(configSistema);
        setNomeEspacoSingular(rotulosEspaco?.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(rotulosEspaco?.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
      } catch {
        if (!ativo) return;
        setNomeEspacoSingular(DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
      }
    }

    carregarNomenclatura();
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

  const carregarEspacos = async () => {
    setLoading(true);
    try {
      const espacosSnap = await getDocs(collection(db, "users", userId, "espacos"));

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

      setHomeDaSkin(home);
      setEspacosRelacionados(relacionados);
      setEspacosRelacionaveis(relacionaveis);
    } finally {
      setLoading(false);
    }
  };

  const criarEspaco = async () => {
    if (!novoNome.trim()) return;

    const ref = doc(collection(db, "users", userId, "espacos"));

    await setDoc(ref, {
      id_espaco: ref.id,
      nome: novoNome.trim(),
      ordem: proxOrdem,
      ownerUserId: userId,
      skins_relacionadas: [skinIdAtual],
      skinOwner: skinIdAtual,
      visibilidade: "privado",
      createdAt: serverTimestamp(),
      isHome: false,
    });

    setNovoNome("");
    carregarEspacos();
  };

  const iniciarEdicao = (espaco) => {
    setEditingEspacoId(espaco.id);
    setEditingNome(espaco.nome || "");
  };

  const cancelarEdicao = () => {
    setEditingEspacoId(null);
    setEditingNome("");
  };

  const salvarEdicao = async (espacoId) => {
    if (!editingNome.trim()) return;

    await updateDoc(doc(db, "users", userId, "espacos", espacoId), {
      nome: editingNome.trim(),
    });

    cancelarEdicao();
    carregarEspacos();
  };

  const excluirEspaco = async (espaco) => {
    const ok = window.confirm(
      `Excluir o ${nomeEspacoSingular} "${espaco.nome}"? Esta acao nao pode ser desfeita.`
    );
    if (!ok) return;

    await deleteDoc(doc(db, "users", userId, "espacos", espaco.id));

    if (editingEspacoId === espaco.id) {
      cancelarEdicao();
    }

    carregarEspacos();
  };

  const salvarOrdem = async (listaOrdenada) => {
    const updates = listaOrdenada.map((espaco, index) =>
      updateDoc(doc(db, "users", userId, "espacos", espaco.id), {
        ordem: index + 1,
      })
    );

    await Promise.all(updates);
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
    await updateDoc(doc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayUnion(skinIdAtual),
    });
    carregarEspacos();
  };

  const remover = async (id) => {
    await updateDoc(doc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayRemove(skinIdAtual),
    });
    carregarEspacos();
  };

  if (!userId || !skinIdAtual) {
    return <p>Usuario ou skin nao carregados.</p>;
  }

  return (
    <div>
      <h2>Home da Skin</h2>

      {homeDaSkin ? <strong>{homeDaSkin.nome}</strong> : <p>Home nao encontrada.</p>}

      <hr />

      <h3>{`${nomeEspacoPluralCapitalizado} Relacionados`}</h3>
      {loading && <p>Carregando...</p>}

      {!loading && espacosRelacionados.length === 0 && (
        <p>{`Nenhum ${nomeEspacoSingular} relacionado.`}</p>
      )}

      {espacosRelacionados.map((e) => (
        <div key={e.id} style={{ marginBottom: 12 }}>
          <strong>{e.nome}</strong> <small>(ordem: {e.ordem ?? "-"})</small>

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
              />{" "}
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
      />{" "}
      <button onClick={criarEspaco}>{`Criar ${nomeEspacoSingularCapitalizado}`}</button>
    </div>
  );
}
