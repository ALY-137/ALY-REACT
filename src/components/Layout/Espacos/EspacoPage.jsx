import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref } from "firebase/storage";

import CriadorBloco from "../Blocos/CriadorBloco";
import EditorBloco from "../Blocos/EditorBloco";
import LoginButton from "../Geral/LoginButton";
import { auth, db, storage } from "../../Banco/init-firebase";

const isRenderableUrl = (valor) =>
  typeof valor === "string" &&
  (
    valor.startsWith("https://") ||
    valor.startsWith("http://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:image/")
  );

const normalizarListaImagens = (valor) => {
  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }
  if (typeof valor === "string" && valor) {
    return [valor];
  }
  return [];
};

export default function EspacoPage() {
  const navigate = useNavigate();
  const { espacoNome } = useParams();
  const { espacos, skinIdAtual, user } = useOutletContext();
  const [blocos, setBlocos] = useState([]);
  const [erroBlocos, setErroBlocos] = useState("");
  const [isAssinante, setIsAssinante] = useState(false);
  const [assinaturaCheckPronto, setAssinaturaCheckPronto] = useState(false);
  const [compradorPorBloco, setCompradorPorBloco] = useState({});
  const [originaisPorBloco, setOriginaisPorBloco] = useState({});
  const [previewsPorBloco, setPreviewsPorBloco] = useState({});
  const [reloadNonce, setReloadNonce] = useState(0);
  const [blocoEmAtualizacaoId, setBlocoEmAtualizacaoId] = useState(null);
  const [blocoEmExclusaoId, setBlocoEmExclusaoId] = useState(null);
  const [erroAcaoBloco, setErroAcaoBloco] = useState("");
  const blockedOriginalPathsRef = useRef(new Set());
  const blockedPreviewPathsRef = useRef(new Set());
  const backfilledPublicUrlsRef = useRef(new Set());

  if (!espacos) return null;

  const persistedUid = localStorage.getItem("userId");
  const authUid = auth.currentUser?.uid || null;
  const currentUid = user?.uid || authUid || persistedUid || null;
  const espacoAtual = espacos.find((e) => e.nome === espacoNome);
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco;
  const ownerUserId = espacoAtual?.ownerUserId || espacos?.[0]?.ownerUserId || null;
  const isOwner = !!currentUid && ownerUserId === currentUid;
  const isCoCriador =
    !!currentUid &&
    Array.isArray(espacoAtual?.coCriadoresUids) &&
    espacoAtual.coCriadoresUids.includes(currentUid);
  const isSkinOwner =
    !!currentUid &&
    !!skinIdAtual &&
    !!espacoAtual?.skinOwner &&
    espacoAtual.skinOwner === skinIdAtual;
  const podeGerenciar = isOwner || isCoCriador || isSkinOwner;
  const visibilidadeEspaco = espacoAtual?.visibilidade || "publico";

  const idsAssinantePossiveis = useMemo(
    () => [currentUid, skinIdAtual].filter(Boolean),
    [currentUid, skinIdAtual]
  );

  const podeVerEspaco = (() => {
    if (podeGerenciar) return true;
    if (!visibilidadeEspaco || visibilidadeEspaco === "publico") return true;
    if (visibilidadeEspaco === "publico_restritivo" || visibilidadeEspaco === "privado") {
      return !!currentUid;
    }
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return isAssinante;
    }
    return true;
  })();

  const espacoExigeChecagemAssinatura =
    visibilidadeEspaco === "exclusivo_assinante" && !podeGerenciar;
  const acessoEspacoResolvido = !espacoExigeChecagemAssinatura || assinaturaCheckPronto;

  const podeVerBloco = (bloco) => {
    if (podeGerenciar) return true;

    const vis = bloco?.visibilidade || "publico";
    if (vis === "publico") return true;
    if (vis === "publico_restritivo" || vis === "privado") return !!currentUid;
    if (vis === "exclusivo_assinante") return isAssinante;
    if (vis === "exclusivo_comprador" || vis === "comprado") {
      return !!compradorPorBloco[bloco.id];
    }
    return true;
  };

  const tipoRestricaoBloco = (bloco) => {
    const vis = bloco?.visibilidade || "publico";
    if (vis === "exclusivo_assinante") return "assinante";
    if (vis === "exclusivo_comprador" || vis === "comprado") return "comprador";
    return "login";
  };

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    async function checarAssinaturaEspaco() {
      if (!idsAssinantePossiveis.length) {
        setIsAssinante(false);
        setAssinaturaCheckPronto(true);
        return;
      }

      setAssinaturaCheckPronto(false);
      try {
        let found = false;
        for (const assinanteId of idsAssinantePossiveis) {
          try {
            const assinaturaRef = doc(
              db,
              "users",
              ownerUserId,
              "espacos",
              espacoId,
              "assinantes",
              assinanteId
            );
            const assinaturaSnap = await getDoc(assinaturaRef);
            if (assinaturaSnap.exists()) {
              found = true;
              break;
            }
          } catch (err) {
            if (err?.code !== "permission-denied") throw err;
          }
        }
        setIsAssinante(found);
      } catch (err) {
        console.error("Erro ao checar assinatura do espaco:", err);
        setIsAssinante(false);
      } finally {
        setAssinaturaCheckPronto(true);
      }
    }

    checarAssinaturaEspaco();
  }, [espacoId, ownerUserId, idsAssinantePossiveis]);

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    if (espacoExigeChecagemAssinatura && !assinaturaCheckPronto) {
      return;
    }

    if (!podeVerEspaco) {
      setBlocos([]);
      setOriginaisPorBloco({});
      setPreviewsPorBloco({});
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
      setErroBlocos("");
      return;
    }

    async function carregarBlocos() {
      try {
        setErroBlocos("");
        const blocosRef = collection(
          db,
          "users",
          ownerUserId,
          "espacos",
          espacoId,
          "blocos"
        );

        const docs = [];

        try {
          const snap = await getDocs(blocosRef);
          docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
        } catch (allErr) {
          if (allErr?.code !== "permission-denied") throw allErr;

          const queries = [
            query(blocosRef, where("visibilidade", "==", "publico")),
            query(blocosRef, where("visibilidade", "==", "publico_restritivo")),
            query(blocosRef, where("visibilidade", "==", "privado")),
            query(blocosRef, where("visibilidade", "==", "exclusivo_assinante")),
            query(blocosRef, where("visibilidade", "==", "exclusivo_comprador")),
            query(blocosRef, where("visibilidade", "==", "comprado")),
          ];

          const results = await Promise.allSettled(
            queries.map((qRef) => getDocs(qRef))
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              docs.push(
                ...result.value.docs.map((d) => ({ __legacy: false, docSnap: d }))
              );
            } else if (
              result.reason?.code &&
              result.reason.code !== "permission-denied"
            ) {
              throw result.reason;
            }
          }
        }

        if (!docs.length) {
          const legacyQuery = query(
            collection(db, "blocos"),
            where("espacoId", "==", espacoId)
          );
          try {
            const legacySnap = await getDocs(legacyQuery);
            docs.push(
              ...legacySnap.docs.map((d) => ({ __legacy: true, docSnap: d }))
            );
          } catch (legacyErr) {
            if (legacyErr?.code !== "permission-denied") throw legacyErr;
          }
        }

        const dedupe = new Map();
        for (const item of docs) {
          const d = item.docSnap;
          dedupe.set(d.id, { id: d.id, __legacy: item.__legacy, ...d.data() });
        }

        const lista = [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        setBlocos(lista);
      } catch (err) {
        console.error("Erro ao carregar blocos:", err);
        setErroBlocos(err?.message || "Erro ao carregar blocos");
      }
    }

    carregarBlocos();
  }, [
    espacoId,
    ownerUserId,
    podeVerEspaco,
    espacoExigeChecagemAssinatura,
    assinaturaCheckPronto,
    reloadNonce,
  ]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setCompradorPorBloco({});
      return;
    }

    async function checarCompras() {
      if (!idsAssinantePossiveis.length) {
        setCompradorPorBloco({});
        return;
      }

      const mapa = {};

      for (const bloco of blocos) {
        const vis = bloco?.visibilidade || "publico";
        const exigeCompra = vis === "exclusivo_comprador" || vis === "comprado";
        if (!exigeCompra) continue;

        let found = false;
        for (const compradorId of idsAssinantePossiveis) {
          try {
            const compradorRef = bloco.__legacy
              ? doc(db, "blocos", bloco.id, "compradores", compradorId)
              : doc(
                  db,
                  "users",
                  ownerUserId,
                  "espacos",
                  espacoId,
                  "blocos",
                  bloco.id,
                  "compradores",
                  compradorId
                );

            const compradorSnap = await getDoc(compradorRef);
            if (compradorSnap.exists()) {
              found = true;
              break;
            }
          } catch (err) {
            if (err?.code !== "permission-denied") throw err;
          }
        }
        mapa[bloco.id] = found;
      }

      setCompradorPorBloco(mapa);
    }

    checarCompras().catch((err) => {
      console.error("Erro ao checar compras dos blocos:", err);
      setCompradorPorBloco({});
    });
  }, [blocos, idsAssinantePossiveis, ownerUserId, espacoId, podeVerEspaco]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setOriginaisPorBloco((prev) => (Object.keys(prev).length ? {} : prev));
      blockedOriginalPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarOriginaisAutorizadas() {
      const mapa = {};

      for (const bloco of blocos) {
        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (!currentUid && visibilidadeBloco === "publico") {
          // Visitante deslogado usa URLs publicas tokenizadas do documento.
          continue;
        }
        if (!podeVerBloco(bloco)) continue;

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) continue;

        const urls = [];
        for (const path of paths) {
          if (blockedOriginalPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await getDownloadURL(ref(storage, path));
            urls.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedOriginalPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver imagem original do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        if (urls.length) {
          mapa[bloco.id] = urls;
        }
      }

      if (!cancelado) {
        setOriginaisPorBloco(mapa);
      }
    }

    carregarOriginaisAutorizadas();

    return () => {
      cancelado = true;
    };
  }, [
    blocos,
    podeVerEspaco,
    currentUid,
    podeGerenciar,
    authUid,
    isAssinante,
    compradorPorBloco,
  ]);

  useEffect(() => {
    if (!podeGerenciar || !authUid || !ownerUserId || !espacoId || !blocos.length) {
      return;
    }

    let cancelado = false;

    async function backfillUrlsPublicasOriginais() {
      for (const bloco of blocos) {
        if (cancelado) return;

        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (visibilidadeBloco !== "publico") continue;
        if (backfilledPublicUrlsRef.current.has(bloco.id)) continue;

        const existentes = normalizarListaImagens(bloco.imagensOriginaisPublicas)
          .filter(isRenderableUrl);
        if (existentes.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const urlsPublicas = [];
        for (const path of paths) {
          try {
            const url = await getDownloadURL(ref(storage, path));
            urlsPublicas.push(url);
          } catch {
            // Mantem silencioso; novo ciclo pode resolver apos refresh/login.
          }
        }

        if (!urlsPublicas.length) continue;

        const blocoRef = bloco.__legacy
          ? doc(db, "blocos", bloco.id)
          : doc(db, "users", ownerUserId, "espacos", espacoId, "blocos", bloco.id);

        try {
          await updateDoc(blocoRef, {
            imagensOriginaisPublicas: urlsPublicas,
            imagens: urlsPublicas,
          });

          backfilledPublicUrlsRef.current.add(bloco.id);
          if (cancelado) return;

          setBlocos((prev) =>
            prev.map((item) =>
              item.id === bloco.id
                ? {
                    ...item,
                    imagensOriginaisPublicas: urlsPublicas,
                    imagens: urlsPublicas,
                  }
                : item
            )
          );
        } catch (err) {
          if (err?.code !== "permission-denied") {
            console.warn("Falha no backfill de URLs publicas:", bloco.id, err?.message);
          }
        }
      }
    }

    backfillUrlsPublicasOriginais();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeGerenciar, authUid, ownerUserId, espacoId]);

  useEffect(() => {
    // Se o contexto de acesso mudou (ex.: login do criador), limpa caches de bloqueio.
    blockedOriginalPathsRef.current.clear();
    blockedPreviewPathsRef.current.clear();
  }, [currentUid, podeGerenciar, espacoId]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setPreviewsPorBloco({});
      blockedPreviewPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarPreviewsPermitidas() {
      const mapa = {};

      for (const bloco of blocos) {
        const fromDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
        const fromPaths = normalizarListaImagens(bloco.imagensPreviewPaths)
          .filter((path) => typeof path === "string" && path.includes("/preview/"));

        const resolved = [];
        for (const path of fromPaths) {
          if (blockedPreviewPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await getDownloadURL(ref(storage, path));
            resolved.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedPreviewPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver preview do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        const unicas = [...new Set([...fromDoc, ...resolved])];
        if (unicas.length) {
          mapa[bloco.id] = unicas;
        }
      }

      if (!cancelado) {
        setPreviewsPorBloco(mapa);
      }
    }

    carregarPreviewsPermitidas();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeVerEspaco, currentUid]);

  if (!espacoAtual) {
    return <p>Espaco nao encontrado</p>;
  }

  const mensagemRestricaoEspaco = (() => {
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return "Este espaco requer assinatura para visualizar o conteudo.";
    }
    if (visibilidadeEspaco === "privado" || visibilidadeEspaco === "publico_restritivo") {
      return "Este espaco requer login para visualizar o conteudo.";
    }
    return "Conteudo restrito.";
  })();

  const irParaAssinatura = () => {
    const skinLogadoUser = localStorage.getItem("skinLogadoUser");
    if (!skinLogadoUser) {
      alert("Selecione uma skin para assinar espacos.");
      return;
    }
    navigate(`/menu/${skinLogadoUser}/espacos`);
  };

  const irParaCompra = () => {
    const skinLogadoUser = localStorage.getItem("skinLogadoUser");
    if (!skinLogadoUser) {
      alert("Selecione uma skin para comprar blocos.");
      return;
    }
    navigate(`/menu/${skinLogadoUser}`);
  };

  const renderCtaRestricao = (tipoRestricao) => {
    if (!currentUid) {
      return <LoginButton />;
    }
    if (tipoRestricao === "assinante") {
      return <button onClick={irParaAssinatura}>Assinar para desbloquear</button>;
    }
    if (tipoRestricao === "comprador") {
      return <button onClick={irParaCompra}>Comprar para desbloquear</button>;
    }
    return null;
  };

  const adicionarBloco = (bloco) => {
    setBlocos((prev) => {
      const dedupe = new Map(prev.map((item) => [item.id, item]));
      dedupe.set(bloco.id, bloco);
      return [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });

    // Reconsulta após breve janela para pegar dados consolidados (rules/indexações).
    window.setTimeout(() => {
      setReloadNonce((n) => n + 1);
    }, 1200);
  };

  const getBlocoDocRef = (bloco) =>
    bloco.__legacy
      ? doc(db, "blocos", bloco.id)
      : doc(db, "users", ownerUserId, "espacos", espacoId, "blocos", bloco.id);

  const atualizarBloco = async (blocoId, updates) => {
    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return;

    setErroAcaoBloco("");
    setBlocoEmAtualizacaoId(blocoId);

    try {
      await updateDoc(getBlocoDocRef(bloco), updates);

      setBlocos((prev) =>
        prev.map((item) => (item.id === blocoId ? { ...item, ...updates } : item))
      );

      // Visibilidade alterada muda caminhos de resolucao de imagem/preview.
      if (Object.prototype.hasOwnProperty.call(updates, "visibilidade")) {
        blockedOriginalPathsRef.current.clear();
        blockedPreviewPathsRef.current.clear();
      }
    } catch (err) {
      console.error("Erro ao atualizar bloco:", err);
      setErroAcaoBloco(err?.message || "Falha ao atualizar bloco.");
    } finally {
      setBlocoEmAtualizacaoId(null);
    }
  };

  const excluirBloco = async (blocoId) => {
    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return;

    const confirmou = window.confirm("Excluir este bloco?");
    if (!confirmou) return;

    setErroAcaoBloco("");
    setBlocoEmExclusaoId(blocoId);

    try {
      const pathsOriginais = normalizarListaImagens(bloco.imagensOriginaisPaths);
      const pathsPreviews = normalizarListaImagens(bloco.imagensPreviewPaths);
      const allPaths = [...new Set([...pathsOriginais, ...pathsPreviews])]
        .filter((path) => typeof path === "string" && path.includes("/"));

      for (const path of allPaths) {
        try {
          await deleteObject(ref(storage, path));
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir arquivo do bloco:", path, err?.message);
          }
        }
      }

      await deleteDoc(getBlocoDocRef(bloco));

      setBlocos((prev) => prev.filter((item) => item.id !== blocoId));
      setOriginaisPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setPreviewsPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setCompradorPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      backfilledPublicUrlsRef.current.delete(blocoId);
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
    } catch (err) {
      console.error("Erro ao excluir bloco:", err);
      setErroAcaoBloco(err?.message || "Falha ao excluir bloco.");
    } finally {
      setBlocoEmExclusaoId(null);
    }
  };

  return (
    <div>
      <h2>{espacoAtual.nome}</h2>

      {podeGerenciar && (
        <CriadorBloco
          onCreate={adicionarBloco}
          espacoAtual={espacoAtual}
          skinIdAtual={skinIdAtual}
        />
      )}

      {!!erroBlocos && <p style={{ color: "red" }}>{erroBlocos}</p>}
      {!!erroAcaoBloco && <p style={{ color: "red" }}>{erroAcaoBloco}</p>}

      {!acessoEspacoResolvido && <p>Carregando acesso...</p>}

      {acessoEspacoResolvido && !podeVerEspaco && (
        <div style={{ padding: 16, border: "1px solid #666", marginBottom: 16 }}>
          <p>{mensagemRestricaoEspaco}</p>
          {renderCtaRestricao(
            visibilidadeEspaco === "exclusivo_assinante" ? "assinante" : "login"
          )}
        </div>
      )}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        blocos.map((bloco) => {
          const visivel = podeVerBloco(bloco);
          const bloqueado = !visivel;
          const tipoRestricao = tipoRestricaoBloco(bloco);

          const previewsDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
          const previewsResolvidas = Array.isArray(previewsPorBloco[bloco.id])
            ? previewsPorBloco[bloco.id]
            : [];
          const previews = [...new Set([...previewsDoc, ...previewsResolvidas])];
          const originalsAutorizadas = Array.isArray(originaisPorBloco[bloco.id])
            ? originaisPorBloco[bloco.id]
            : [];
          const originaisPublicas = normalizarListaImagens(bloco.imagensOriginaisPublicas)
            .filter(isRenderableUrl);
          const fallbackLegado = normalizarListaImagens(bloco.imagens);
          const imagensBloqueadas = previews;

          const imagensParaExibir = bloqueado
            ? imagensBloqueadas
            : originalsAutorizadas.length
              ? originalsAutorizadas
              : originaisPublicas.length
                ? originaisPublicas
              : previews.length
                ? previews
                : fallbackLegado;

          return (
            <div
              key={bloco.id}
              className="bloco-imagem"
              style={{ position: "relative", marginBottom: 16 }}
            >
              {!!imagensParaExibir.length && (
                <div
                  style={{
                    filter: bloqueado ? "blur(10px)" : "none",
                    opacity: bloqueado ? 0.7 : 1,
                    transition: "filter 150ms ease",
                  }}
                >
                  {imagensParaExibir.map((url, i) => (
                    <img
                      key={`${bloco.id}-${i}`}
                      src={url}
                      alt=""
                      style={{ maxWidth: "200px", margin: "4px" }}
                    />
                  ))}
                </div>
              )}

              {bloqueado && !imagensParaExibir.length && (
                <div
                  style={{
                    width: 200,
                    height: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #2f2f2f, #5c5c5c)",
                    color: "#f0f0f0",
                    borderRadius: 6,
                    filter: "blur(1px)",
                  }}
                >
                  Preview protegido
                </div>
              )}

              {bloqueado && (
                <div style={{ marginTop: 8 }}>
                  <p>Conteudo restrito do bloco.</p>
                  {renderCtaRestricao(tipoRestricao)}
                </div>
              )}

              {podeGerenciar && (
                <EditorBloco
                  bloco={bloco}
                  onSalvar={(updates) => atualizarBloco(bloco.id, updates)}
                  onExcluir={() => excluirBloco(bloco.id)}
                  salvando={blocoEmAtualizacaoId === bloco.id}
                  excluindo={blocoEmExclusaoId === bloco.id}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}
