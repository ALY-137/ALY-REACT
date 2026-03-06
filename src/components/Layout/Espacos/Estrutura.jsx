import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { useAuth } from "../../../hooks/auth/useAuth";
import { auth, db } from "../../Banco/init-firebase";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";
import LoginButton from "../Geral/LoginButton";
import Navbar from "../Navbar/Navbar";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import Layout from "../Temas/Layout.jsx";
import { obterTemaSkinPadrao, resolverTemaSkinEfetivo } from "../Temas/themesRegistry";
import {
  getEspacosDaSkin,
  getEspacosDoOwner,
  getEspacosEstruturaPublica,
  sincronizarEstruturaPublicaEspaco,
} from "./firebaseEspacos";

const ONEPAGE_ADMIN_USERNAME_KEY = "onePageAdminUsername";
const ONEPAGE_CARDPROFILE_MAX_WIDTH = 420;
const ONEPAGE_CARDPROFILE_MAX_HEIGHT = 420;
const ONEPAGE_CARDPROFILE_VIEWPORT_PADDING = 48;

const limparUsername = (valor = "") =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const construirBaseUsernameOnePage = (firebaseUser = null) => {
  const nome = limparUsername(firebaseUser?.displayName || "");
  if (nome) return nome.slice(0, 18);

  const emailPrefix = limparUsername(String(firebaseUser?.email || "").split("@")[0] || "");
  if (emailPrefix) return emailPrefix.slice(0, 18);

  const uid = limparUsername(firebaseUser?.uid || "");
  return `user${uid.slice(0, 8) || "one"}`.slice(0, 18);
};

const tentarBuscarPrimeiraSkin = async (consulta) => {
  const snap = await getDocs(consulta);
  return snap.empty ? null : snap.docs[0];
};

const selecionarSkinPreferencial = (docs = []) => {
  if (!Array.isArray(docs) || !docs.length) return null;
  return (
    docs.find((docSnap) => docSnap?.data?.()?.is_main === true) ||
    docs.find((docSnap) => docSnap?.data?.()?.is_main) ||
    docs[0] ||
    null
  );
};

const buscarSkinPreferencial = async (consulta) => {
  const snap = await getDocs(consulta);
  if (snap.empty) return null;
  return selecionarSkinPreferencial(snap.docs);
};

const erroConsultaRecuperavelSkin = (err) =>
  err?.code === "permission-denied" || err?.code === "failed-precondition";

const construirOwnerCandidates = (
  configSistemaProjeto = {},
  authUserAtual = null,
  { includeAuthUser = true } = {}
) =>
  Array.from(
    new Set(
      [
        configSistemaProjeto?.adminUid,
        configSistemaProjeto?.projectOwnerUid,
        configSistemaProjeto?.projectLastEditorUid,
        includeAuthUser ? authUserAtual?.uid : "",
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const calcularDimensoesCardProfileOnePage = (dimensoesNaturais = null) => {
  const larguraNatural = Number(dimensoesNaturais?.width || 0);
  const alturaNatural = Number(dimensoesNaturais?.height || 0);

  if (!larguraNatural || !alturaNatural) return null;

  const larguraViewport =
    typeof window !== "undefined"
      ? Math.max(160, Number(window.innerWidth || 0) - ONEPAGE_CARDPROFILE_VIEWPORT_PADDING)
      : ONEPAGE_CARDPROFILE_MAX_WIDTH;
  const larguraMaxima = Math.min(ONEPAGE_CARDPROFILE_MAX_WIDTH, larguraViewport);
  const alturaMaxima = ONEPAGE_CARDPROFILE_MAX_HEIGHT;
  const escala = Math.min(1, larguraMaxima / larguraNatural, alturaMaxima / alturaNatural);

  return {
    width: Math.max(1, Math.round(larguraNatural * escala)),
    height: Math.max(1, Math.round(alturaNatural * escala)),
  };
};

const criarSkinUnicaOnePage = async ({ firebaseUser, temaPadraoSkin }) => {
  if (!firebaseUser?.uid) return false;

  const uid = firebaseUser.uid;
  const base = construirBaseUsernameOnePage(firebaseUser);
  const usernameOnePage = `${base}-${uid.slice(0, 6)}`.slice(0, 24);
  const temaCriacao = String(temaPadraoSkin || "").trim() || "CYBERPINK";
  const skinId = `skin_${uid.slice(0, 20)}`;
  const espacoId = "home";

  if (typeof firebaseUser.getIdToken === "function") {
    try {
      await firebaseUser.getIdToken();
    } catch {
      // Continua tentativa de escrita no Firestore com token em cache.
    }
  }

  try {
    const userRef = doc(db, "users", uid);
    const skinRef = doc(db, "users", uid, "skins", skinId);
    const espacoRef = doc(db, "users", uid, "espacos", espacoId);

    await setDoc(
      userRef,
      {
        uid,
        idGoogle: uid,
        nomeGoogle: String(firebaseUser.displayName || "").split(" ")[0] || "",
        nomeCompletoGoogle: firebaseUser.displayName || "",
        emailGoogle: firebaseUser.email || "",
        picGoogle: firebaseUser.photoURL || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      skinRef,
      {
        ownerUserId: uid,
        id_skin: skinId,
        username: usernameOnePage,
        theme: temaCriacao,
        cardProfileUrl: "",
        cardProfilePath: "",
        is_main: true,
        visibilidade: "publico",
        data: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      espacoRef,
      {
        id_espaco: espacoId,
        nome: "home",
        conteudo: "Conteudo da pagina principal",
        ordem: 0,
        ownerUserId: uid,
        skinOwner: skinId,
        coCriadoresUids: [],
        visibilidade: "publico",
        createdAt: serverTimestamp(),
        isHome: true,
        skins_relacionadas: [skinId],
      },
      { merge: true }
    );
    await sincronizarEstruturaPublicaEspaco(uid, {
      id: espacoId,
      id_espaco: espacoId,
      nome: "home",
      ordem: 0,
      ownerUserId: uid,
      skinOwner: skinId,
      visibilidade: "publico",
      isHome: true,
      skins_relacionadas: [skinId],
    });

    localStorage.setItem("targetUsername", usernameOnePage);
    localStorage.setItem("skinLogadoUser", usernameOnePage);
    localStorage.setItem("skinIdAtual", skinId);
    return true;
  } catch {
    // Deixa fallback visual assumir sem bloquear a pagina.
  }

  return false;
};

function Estrutura({ username: propUsername, skins: propSkins }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const authUserAtual = user || auth.currentUser || null;

  const [username, setUsername] = useState(propUsername || "");
  const [skins, setSkins] = useState(propSkins || []);
  const [theme, setTheme] = useState("");
  const [espacos, setEspacos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [configSistemaAtual, setConfigSistemaAtual] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [cardProfileNaturalDimensions, setCardProfileNaturalDimensions] = useState(null);
  const [cardProfileDimensions, setCardProfileDimensions] = useState(null);

  const urlUsername = location.pathname.split("/")[1];
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");
  const skinIdAtual = localStorage.getItem("skinIdAtual") || null;
  const targetUsernameInicial =
    urlUsername ||
    localStorage.getItem("targetUsername") ||
    skinLogadoUser ||
    "";
  const tipoExperiencia =
    configSistemaAtual?.tipoExperiencia || DEFAULT_SISTEMA_CONFIG.tipoExperiencia;
  const modoAcessoProjeto =
    configSistemaAtual?.modoAcessoProjeto || DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto;
  const onePagePublicaAtiva = isOnePageComEntradaPublica({
    tipoExperiencia,
    modoAcessoProjeto,
  });
  const adminUidProjetoConfigurado = String(
    configSistemaAtual?.adminUid || localStorage.getItem("systemAdminUid") || ""
  ).trim();
  const adminEmailProjetoConfigurado = String(
    configSistemaAtual?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const emailUsuarioAtual = String(user?.email || "")
    .trim()
    .toLowerCase();
  const adminProjetoConfigurado = Boolean(
    adminUidProjetoConfigurado || adminEmailProjetoConfigurado
  );
  const usuarioEhAdminOnePage = Boolean(
    user?.uid &&
      (
        (adminUidProjetoConfigurado && user.uid === adminUidProjetoConfigurado) ||
        (adminEmailProjetoConfigurado &&
          emailUsuarioAtual === adminEmailProjetoConfigurado) ||
        (!adminProjetoConfigurado &&
          seforAdm(user))
      )
  );
  const usuarioPodeAbrirMenuOnePage = Boolean(user?.uid);
  const segmentosRota = location.pathname
    .split("/")
    .map((segmento) => decodeURIComponent(segmento || "").trim())
    .filter(Boolean);
  const nomeEspacoAtualRota = onePagePublicaAtiva
    ? String(segmentosRota[0] || "").trim()
    : String(segmentosRota[1] || "").trim();
  const cardProfileUrlEfetiva = String(
    configSistemaAtual?.cardProfileUrl || skins?.[0]?.cardProfileUrl || ""
  ).trim();

  useEffect(() => {
    if (cardProfileUrlEfetiva) return;
    setCardProfileNaturalDimensions(null);
    setCardProfileDimensions(null);
  }, [cardProfileUrlEfetiva]);

  useEffect(() => {
    const deveUsarImagemComoReferencia =
      onePagePublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false;

    if (!deveUsarImagemComoReferencia || !cardProfileNaturalDimensions) {
      setCardProfileDimensions(null);
      return;
    }

    const atualizarDimensoes = () => {
      setCardProfileDimensions(
        calcularDimensoesCardProfileOnePage(cardProfileNaturalDimensions)
      );
    };

    atualizarDimensoes();
    window.addEventListener("resize", atualizarDimensoes);
    return () => window.removeEventListener("resize", atualizarDimensoes);
  }, [
    cardProfileNaturalDimensions,
    configSistemaAtual?.layoutTema?.headerVisible,
    onePagePublicaAtiva,
  ]);

  const aplicarFallbackOnePage = async (
    configSistemaProjeto,
    usernameFallback = "",
    ownerUidOverride = ""
  ) => {
    const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
    const temaEfetivo = resolverTemaSkinEfetivo(
      temaPadraoSkin,
      configSistemaProjeto?.temaPadraoSistema,
      configSistemaProjeto?.permitirTemasSkinSecundarios !== false
    );
    const usernameAdminCache = String(
      localStorage.getItem(ONEPAGE_ADMIN_USERNAME_KEY) || ""
    ).trim();
    const usernameLocal = onePagePublicaAtiva && !usuarioEhAdminOnePage
      ? (usernameFallback || usernameAdminCache)
      : (
          usernameFallback ||
          localStorage.getItem("targetUsername") ||
          construirBaseUsernameOnePage(authUserAtual)
        );
    const ownerUid = String(
      ownerUidOverride ||
        configSistemaProjeto?.adminUid ||
        configSistemaProjeto?.projectOwnerUid ||
        configSistemaProjeto?.projectLastEditorUid ||
        (usuarioEhAdminOnePage ? authUserAtual?.uid : "") ||
        ""
    ).trim();
    let espacosFallback = [
      {
        id_espaco: "home",
        nome: "home",
        ownerUserId: ownerUid,
        skinOwner: localStorage.getItem("skinIdAtual") || null,
        visibilidade: "publico",
        isHome: true,
      },
    ];

    if (ownerUid) {
      try {
        const espacosOwner = await getEspacosDoOwner({
          userId: ownerUid,
          viewerUserId: authUserAtual?.uid || null,
          ignorarVisibilidade: onePagePublicaAtiva,
        });
        if (espacosOwner.length) {
          espacosFallback = espacosOwner;
        }
      } catch (err) {
        if (!erroConsultaRecuperavelSkin(err)) {
          throw err;
        }
        try {
          const estruturaPublica = await getEspacosEstruturaPublica(ownerUid);
          if (estruturaPublica.length) {
            espacosFallback = estruturaPublica;
          }
        } catch (publicErr) {
          if (!erroConsultaRecuperavelSkin(publicErr)) {
            throw publicErr;
          }
        }
      }
    }

    setUsername(usernameLocal);
    setSkins([]);
    setTheme(temaEfetivo);
    setEspacos(espacosFallback);
  };

  useEffect(() => {
    if (loading) return;

    let targetUsername = String(targetUsernameInicial || "").trim();

    const fetchSkinData = async () => {
      setIsLoading(true);
      let configSistemaProjeto =
        obterConfigSistemaCacheLocal() || configSistemaAtual || DEFAULT_SISTEMA_CONFIG;
      try {
        if (typeof authUserAtual?.getIdToken === "function") {
          try {
            await authUserAtual.getIdToken();
          } catch {
            // Continua com token em cache.
          }
        }

        try {
          configSistemaProjeto = await obterConfigSistema();
        } catch {
          configSistemaProjeto = obterConfigSistemaCacheLocal() || configSistemaProjeto;
        }
        setConfigSistemaAtual(configSistemaProjeto);

        const onePagePublicaProjeto = isOnePageComEntradaPublica(configSistemaProjeto);
        const adminUidProjeto = String(
          configSistemaProjeto?.adminUid || localStorage.getItem("systemAdminUid") || ""
        ).trim();
        const adminEmailProjeto = String(configSistemaProjeto?.adminEmail || "")
          .trim()
          .toLowerCase();
        const emailUsuarioAtual = String(authUserAtual?.email || "")
          .trim()
          .toLowerCase();
        const adminProjetoConfigurado = Boolean(adminUidProjeto || adminEmailProjeto);
        const usuarioEhAdminOnePage = Boolean(
          authUserAtual?.uid &&
            ((adminUidProjeto && authUserAtual.uid === adminUidProjeto) ||
              (adminEmailProjeto && emailUsuarioAtual === adminEmailProjeto) ||
              (!adminProjetoConfigurado && seforAdm(authUserAtual)))
        );
        const ownerUidCandidates = construirOwnerCandidates(
          configSistemaProjeto,
          authUserAtual,
          { includeAuthUser: !onePagePublicaProjeto || usuarioEhAdminOnePage }
        );

        if (onePagePublicaProjeto) {
          targetUsername = "";
        }

        let skinDocResolvido = null;
        if (!targetUsername && onePagePublicaProjeto) {
          const usernameAdminCache = String(
            localStorage.getItem(ONEPAGE_ADMIN_USERNAME_KEY) || ""
          ).trim();
          if (ownerUidCandidates.length) {
            for (const ownerUidCandidate of ownerUidCandidates) {
              const colecaoSkinsOwner = collection(db, "users", ownerUidCandidate, "skins");

              if (authUserAtual?.uid && authUserAtual.uid === ownerUidCandidate) {
                const skinOwnerQuery = query(colecaoSkinsOwner);
                skinDocResolvido = await buscarSkinPreferencial(skinOwnerQuery);

                if (!skinDocResolvido) {
                  const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
                  await criarSkinUnicaOnePage({
                    firebaseUser: authUserAtual,
                    temaPadraoSkin,
                  });
                  skinDocResolvido = await buscarSkinPreferencial(skinOwnerQuery);
                }
              } else {
                const consultasOwner = authUserAtual?.uid
                  ? [
                      query(
                        colecaoSkinsOwner,
                        where("visibilidade", "in", ["publico", "publico_restritivo", "privado"])
                      ),
                      query(colecaoSkinsOwner, where("visibilidade", "==", "publico")),
                      query(
                        collectionGroup(db, "skins"),
                        where("ownerUserId", "==", ownerUidCandidate),
                        where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
                        limit(10)
                      ),
                      query(
                        collectionGroup(db, "skins"),
                        where("ownerUserId", "==", ownerUidCandidate),
                        where("visibilidade", "==", "publico"),
                        limit(10)
                      ),
                      query(colecaoSkinsOwner, where("visibilidade", "==", null)),
                    ]
                  : [
                      query(colecaoSkinsOwner, where("visibilidade", "==", "publico")),
                      query(
                        collectionGroup(db, "skins"),
                        where("ownerUserId", "==", ownerUidCandidate),
                        where("visibilidade", "==", "publico"),
                        limit(10)
                      ),
                      query(colecaoSkinsOwner, where("visibilidade", "==", null)),
                    ];

                for (const consulta of consultasOwner) {
                  try {
                    skinDocResolvido = await buscarSkinPreferencial(consulta);
                  } catch (err) {
                    if (!erroConsultaRecuperavelSkin(err)) {
                      throw err;
                    }
                  }
                  if (skinDocResolvido) break;
                }
              }

              if (skinDocResolvido) break;
            }
          }

          if (!skinDocResolvido && usuarioEhAdminOnePage && authUserAtual?.uid) {
            const skinUsuarioQuery = query(
              collection(db, "users", authUserAtual.uid, "skins"),
              limit(1)
            );
            let skinUsuarioSnap = await getDocs(skinUsuarioQuery);

            if (skinUsuarioSnap.empty) {
              const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
              await criarSkinUnicaOnePage({
                firebaseUser: authUserAtual,
                temaPadraoSkin,
              });
              skinUsuarioSnap = await getDocs(skinUsuarioQuery);
            }

            if (!skinUsuarioSnap.empty) {
              skinDocResolvido = skinUsuarioSnap.docs[0];
            }
          }

          if (!skinDocResolvido) {
            if (onePagePublicaProjeto && usernameAdminCache) {
              targetUsername = usernameAdminCache;
            } else if (onePagePublicaProjeto) {
              await aplicarFallbackOnePage(
                configSistemaProjeto,
                targetUsername,
                adminUidProjeto
              );
              return;
            } else {
              navigate("/Error");
              return;
            }
          }

          targetUsername = String(skinDocResolvido.data()?.username || "").trim();
          if (!targetUsername) {
            if (onePagePublicaProjeto) {
              await aplicarFallbackOnePage(
                configSistemaProjeto,
                targetUsername,
                adminUidProjeto
              );
              return;
            }
            navigate("/Error");
            return;
          }
        }

        let skinsSnap = { empty: true, docs: [] };
        if (skinDocResolvido) {
          skinsSnap = { empty: false, docs: [skinDocResolvido] };
        } else if (authUserAtual?.uid) {
          const ownerQuery = query(
            collection(db, "users", authUserAtual.uid, "skins"),
            where("username", "==", targetUsername),
            limit(1)
          );
          try {
            skinsSnap = await getDocs(ownerQuery);
          } catch (err) {
            if (!erroConsultaRecuperavelSkin(err)) throw err;
          }
        }

        if (skinsSnap.empty) {
          const publicQuery = query(
            collectionGroup(db, "skins"),
            where("username", "==", targetUsername),
            where("visibilidade", "==", "publico"),
            limit(1)
          );

          if (authUserAtual?.uid) {
            const preferredQuery = query(
              collectionGroup(db, "skins"),
              where("username", "==", targetUsername),
              where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
              limit(1)
            );

            try {
              skinsSnap = await getDocs(preferredQuery);
            } catch (err) {
              if (!erroConsultaRecuperavelSkin(err)) throw err;

              try {
                const compatQuery = query(
                  collectionGroup(db, "skins"),
                  where("username", "==", targetUsername),
                  where("visibilidade", "in", ["publico", "publico_restritivo"]),
                  limit(1)
                );
                skinsSnap = await getDocs(compatQuery);
              } catch (compatErr) {
                if (!erroConsultaRecuperavelSkin(compatErr)) throw compatErr;
              }
            }
          } else {
            try {
              skinsSnap = await getDocs(publicQuery);
            } catch (err) {
              if (!erroConsultaRecuperavelSkin(err)) throw err;
            }
          }

          if (skinsSnap.empty) {
            const legacyVisibilityQuery = query(
              collectionGroup(db, "skins"),
              where("username", "==", targetUsername),
              where("visibilidade", "==", null),
              limit(1)
            );
            try {
              skinsSnap = await getDocs(legacyVisibilityQuery);
            } catch (err) {
              if (!erroConsultaRecuperavelSkin(err)) throw err;
            }
          }

          if (skinsSnap.empty && onePagePublicaProjeto) {
            if (adminUidProjeto) {
              try {
                const adminSkinsRef = collection(db, "users", adminUidProjeto, "skins");
                const consultasAdminFallback = authUserAtual?.uid
                  ? [
                      query(
                        adminSkinsRef,
                        where("visibilidade", "in", ["publico", "publico_restritivo", "privado"])
                      ),
                      query(adminSkinsRef, where("visibilidade", "==", "publico")),
                      query(adminSkinsRef, where("visibilidade", "==", null)),
                    ]
                  : [
                      query(adminSkinsRef, where("visibilidade", "==", "publico")),
                      query(adminSkinsRef, where("visibilidade", "==", null)),
                    ];

                for (const consulta of consultasAdminFallback) {
                  const docPreferencial = await buscarSkinPreferencial(consulta);
                  if (docPreferencial) {
                    skinsSnap = { empty: false, docs: [docPreferencial] };
                    break;
                  }
                }
              } catch (err) {
                if (!erroConsultaRecuperavelSkin(err)) throw err;
              }
            }

            if (skinsSnap.empty && usuarioEhAdminOnePage && authUserAtual?.uid) {
              try {
                const adminOwnerSkinDoc = await buscarSkinPreferencial(
                  query(collection(db, "users", authUserAtual.uid, "skins"))
                );
                if (adminOwnerSkinDoc) {
                  skinsSnap = { empty: false, docs: [adminOwnerSkinDoc] };
                }
              } catch (err) {
                if (!erroConsultaRecuperavelSkin(err)) throw err;
              }
            }
          }
        }

        if (skinsSnap.empty) {
          if (onePagePublicaProjeto) {
            aplicarFallbackOnePage(configSistemaProjeto, targetUsername);
            return;
          }
          navigate("/Error");
          return;
        }

        const skinDoc = skinsSnap.docs[0];
        const skinData = skinDoc.data();

        const isOwner = authUserAtual && authUserAtual.uid === skinData.ownerUserId;
        const isPublic = !skinData.visibilidade || skinData.visibilidade === "publico";
        const isAuthPublic =
          (skinData.visibilidade === "publico_restritivo" ||
            skinData.visibilidade === "privado") &&
          !!authUserAtual;
        const usarSkinAdminNaOnePage =
          onePagePublicaProjeto &&
          Boolean(adminUidProjeto) &&
          String(skinData.ownerUserId || "").trim() === adminUidProjeto;

        if (!isOwner && !isPublic && !isAuthPublic && !usarSkinAdminNaOnePage) {
          if (onePagePublicaProjeto) {
            aplicarFallbackOnePage(configSistemaProjeto, targetUsername);
            return;
          }
          navigate("/Error");
          return;
        }

        const skinId = skinDoc.id;
        const temaEfetivo = resolverTemaSkinEfetivo(
          skinData.theme,
          configSistemaProjeto.temaPadraoSistema,
          configSistemaProjeto.permitirTemasSkinSecundarios !== false
        );

        setUsername(targetUsername);
        setSkins([skinData]);
        setTheme(temaEfetivo);
        localStorage.setItem("targetUsername", targetUsername);
        if (onePagePublicaProjeto && targetUsername) {
          localStorage.setItem(ONEPAGE_ADMIN_USERNAME_KEY, targetUsername);
        }

        let pagesList = [];
        if (onePagePublicaProjeto && skinData.ownerUserId) {
          try {
            pagesList = await getEspacosDoOwner({
              userId: skinData.ownerUserId,
              viewerUserId: authUserAtual?.uid || null,
              ignorarVisibilidade: true,
            });
            if (usuarioEhAdminOnePage && pagesList.length) {
              await Promise.all(
                pagesList.map((espaco) =>
                  sincronizarEstruturaPublicaEspaco(skinData.ownerUserId, {
                    ...espaco,
                    id: espaco.id || espaco.id_espaco,
                    ownerUserId: espaco.ownerUserId || skinData.ownerUserId,
                  })
                )
              );
            }
          } catch (err) {
            if (!erroConsultaRecuperavelSkin(err)) throw err;
            try {
              pagesList = await getEspacosEstruturaPublica(skinData.ownerUserId);
            } catch (estruturaErr) {
              if (!erroConsultaRecuperavelSkin(estruturaErr)) throw estruturaErr;
            }

            if (!pagesList.length && authUserAtual?.uid && retryNonce < 3) {
              setTimeout(() => {
                setRetryNonce((valor) => valor + 1);
              }, 500);
              return;
            }
          }
        } else {
          try {
            pagesList = await getEspacosDaSkin({
              userId: skinData.ownerUserId,
              skinId,
              viewerUserId: authUserAtual?.uid || null,
            });
          } catch (espacosErr) {
            if (espacosErr?.code !== "permission-denied") throw espacosErr;
            console.warn(
              "Permissao negada ao ler espacos da skin. Perfil sera exibido sem lista de espacos.",
              espacosErr?.message
            );
          }
        }

        if (onePagePublicaProjeto && skinData.ownerUserId && !pagesList.length) {
          try {
            const homeQueries = authUserAtual?.uid
              ? [
                  query(
                    collection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
                    limit(1)
                  ),
                  query(
                    collection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "==", null),
                    limit(1)
                  ),
                ]
              : [
                  query(
                    collection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "==", "publico"),
                    limit(1)
                  ),
                  query(
                    collection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "==", null),
                    limit(1)
                  ),
                ];

            for (const homeQuery of homeQueries) {
              try {
                const homeSnap = await getDocs(homeQuery);
                if (!homeSnap.empty) {
                  const homeData = homeSnap.docs[0].data() || {};
                  pagesList = [
                    {
                      id: homeSnap.docs[0].id,
                      ownerUserId: homeData.ownerUserId || skinData.ownerUserId,
                      ...homeData,
                    },
                  ];
                  break;
                }
              } catch (homeErr) {
                if (!erroConsultaRecuperavelSkin(homeErr)) throw homeErr;
              }
            }
          } catch (homeFallbackErr) {
            if (!erroConsultaRecuperavelSkin(homeFallbackErr)) throw homeFallbackErr;
          }
        }

        setEspacos(pagesList);

        if (
          authUserAtual?.uid === skinData.ownerUserId ||
          (onePagePublicaProjeto && usuarioEhAdminOnePage && authUserAtual?.uid)
        ) {
          localStorage.setItem("skinIdAtual", skinId);
          localStorage.setItem("skinLogadoUser", targetUsername);
        }

        if (authUserAtual?.uid === skinData.ownerUserId) {
          try {
            await setDoc(
              doc(db, "users", authUserAtual.uid),
              {
                uid: authUserAtual.uid,
                skinAtivaId: skinId,
              },
              { merge: true }
            );
          } catch (updateErr) {
            console.warn(
              "Falha ao atualizar skinAtivaId:",
              updateErr?.code,
              updateErr?.message
            );
          }
        }
      } catch (err) {
        const configEmErro =
          obterConfigSistemaCacheLocal() || configSistemaProjeto || configSistemaAtual;
        const onePageProjetoAtual = isOnePageComEntradaPublica(configEmErro);

        if (err?.code === "permission-denied" || err?.code === "failed-precondition") {
          if (onePageProjetoAtual) {
            const adminUidErro = String(configEmErro?.adminUid || "").trim();
            const adminEmailErro = String(configEmErro?.adminEmail || "")
              .trim()
              .toLowerCase();
            const emailAtualErro = String(authUserAtual?.email || "")
              .trim()
              .toLowerCase();
            const adminConfiguradoErro = Boolean(adminUidErro || adminEmailErro);
            const usuarioEhAdminOnePageErro = Boolean(
              authUserAtual?.uid &&
                ((adminUidErro && authUserAtual.uid === adminUidErro) ||
                  (adminEmailErro && emailAtualErro === adminEmailErro) ||
                  (!adminConfiguradoErro && seforAdm(authUserAtual)))
            );

            if (usuarioEhAdminOnePageErro) {
              const temaPadraoSkin = obterTemaSkinPadrao(configEmErro?.temaPadraoSistema);
              await criarSkinUnicaOnePage({
                firebaseUser: authUserAtual,
                temaPadraoSkin,
              });
            }

            if (retryNonce < 3) {
              setTimeout(() => {
                setRetryNonce((valor) => valor + 1);
              }, 700);
              return;
            }

            await aplicarFallbackOnePage(
              configEmErro,
              targetUsername,
              adminUidErro
            );
            return;
          }

          console.warn(
            err?.code === "failed-precondition"
              ? "Consulta de skin exige indice do Firestore. Confirme deploy de firestore.indexes.json."
              : "Permissao negada ao ler skin. Confirme deploy das regras com: npm run firestore:rules:deploy"
          );
          navigate("/Error");
          return;
        }

        console.error("Erro ao buscar skin:", err?.code, err?.message, err);
        navigate("/Error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkinData();
  }, [authUserAtual, loading, navigate, retryNonce, targetUsernameInicial, user]);

  useEffect(() => {
    if (!espacos.length || hasNavigated) return;
    if (!onePagePublicaAtiva && !username) return;

    const mainPage = espacos.find((p) => p.isHome === true);
    if (!mainPage) {
      console.warn("Pagina principal nao encontrada.");
      navigate("/Error");
      setHasNavigated(true);
      return;
    }

    const espacoAtualValido = espacos.some(
      (pagina) => String(pagina?.nome || "").trim() === nomeEspacoAtualRota
    );
    if (espacoAtualValido) {
      setHasNavigated(true);
      return;
    }

    const destinoPrincipal = onePagePublicaAtiva
      ? `/${mainPage.nome}`
      : `/${username}/${mainPage.nome}`;
    if (location.pathname !== destinoPrincipal) {
      navigate(destinoPrincipal, { replace: true });
    }
    setHasNavigated(true);
  }, [
    espacos,
    hasNavigated,
    location.pathname,
    navigate,
    nomeEspacoAtualRota,
    onePagePublicaAtiva,
    username,
  ]);

  const resolverUsernameMenuOnePage = async () => {
    if (!user?.uid) return "";

    const usernameStorage = String(localStorage.getItem("skinLogadoUser") || "").trim();
    if (usernameStorage) return usernameStorage;

    const skinUsuarioQuery = query(
      collection(db, "users", user.uid, "skins"),
      limit(1)
    );
    let skinUsuarioSnap = await getDocs(skinUsuarioQuery);

    if (skinUsuarioSnap.empty) {
      const temaPadraoSkin = obterTemaSkinPadrao(configSistemaAtual?.temaPadraoSistema);
      await criarSkinUnicaOnePage({
        firebaseUser: user,
        temaPadraoSkin,
      });
      skinUsuarioSnap = await getDocs(skinUsuarioQuery);
    }

    if (skinUsuarioSnap.empty) return "";

    const skinDoc = skinUsuarioSnap.docs[0];
    const skinData = skinDoc.data() || {};
    const usernameUsuario = String(skinData.username || "").trim();
    if (!usernameUsuario) return "";

    localStorage.setItem("skinLogadoUser", usernameUsuario);
    localStorage.setItem("targetUsername", usernameUsuario);
    localStorage.setItem("skinIdAtual", skinDoc.id);
    return usernameUsuario;
  };

  const toggleMenu = async () => {
    if (onePagePublicaAtiva && !usuarioPodeAbrirMenuOnePage) {
      alert("Faca login para abrir o menu.");
      return;
    }

    let destinoMenu = "";
    let destinoFechar = "/";

    if (onePagePublicaAtiva) {
      if (usuarioEhAdminOnePage) {
        destinoMenu = "/menu/admin";
      } else {
        const usernameMenuOnePage = await resolverUsernameMenuOnePage();
        if (!usernameMenuOnePage) {
          alert("Nao foi possivel identificar sua skin para abrir o menu.");
          return;
        }
        destinoMenu = `/menu/${usernameMenuOnePage}`;
      }
      destinoFechar = "/home";
    } else {
      const usernameMenu = skinLogadoUser || username || targetUsernameInicial;
      if (usernameMenu) {
        localStorage.setItem("skinLogadoUser", usernameMenu);
        localStorage.setItem("targetUsername", usernameMenu);
      }
      if (!usernameMenu) {
        alert("Nao foi possivel identificar a skin ativa para abrir o menu.");
        return;
      }
      destinoMenu = `/menu/${usernameMenu}`;
      destinoFechar = `/${usernameMenu}/home`;
    }

    const proximoMenuAberto = !menuOpen;
    setMenuOpen(proximoMenuAberto);
    navigate(proximoMenuAberto ? destinoMenu : destinoFechar);
  };

  const profileJSX = (
    <>
      <div id="navbar-menu" style={{ textAlign: "center" }}>
        {!user ? (
          <LoginButton />
        ) : !onePagePublicaAtiva || usuarioPodeAbrirMenuOnePage ? (
          <p onClick={toggleMenu} style={{ cursor: "pointer" }}>
            ㆔
          </p>
        ) : null}
      </div>

      <div
        id="cardProfile"
        style={
          onePagePublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false
            ? {
                display: menuOpen ? "none" : "block",
                position: "relative",
                right: "auto",
                top: "auto",
                margin: "0 auto",
                transform: "none",
                pointerEvents: "none",
              }
            : { display: menuOpen ? "none" : "block" }
        }
      >
        <Navegacoes />
        {cardProfileUrlEfetiva ? (
          <img
            src={cardProfileUrlEfetiva}
            id="imgBustoHome"
            alt="imagem"
            onLoad={(event) => {
              const larguraNatural = Number(event.currentTarget.naturalWidth || 0);
              const alturaNatural = Number(event.currentTarget.naturalHeight || 0);
              if (!larguraNatural || !alturaNatural) {
                setCardProfileNaturalDimensions(null);
                return;
              }
              setCardProfileNaturalDimensions({
                width: larguraNatural,
                height: alturaNatural,
              });
            }}
            style={
              onePagePublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false
                ? {
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    left: "0",
                    right: "0",
                    margin: "0 auto",
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </>
  );

  const navigationJSX = <Navbar pages={espacos} username={username} />;
  const loginLoadingMode = String(configSistemaAtual?.loginLoadingMode || "")
    .trim()
    .toLowerCase();
  const loginLoadingSpriteUrl = String(configSistemaAtual?.loginLoadingSpriteUrl || "").trim();
  const exibirLoaderSprite = loginLoadingMode === "sprite_sheet" && Boolean(loginLoadingSpriteUrl);
  const loaderVisualJSX = exibirLoaderSprite ? (
    <div className="sprite-loader-layer sprite-loader-layer-inline" aria-live="polite">
      <div
        className="loader-cherry"
        aria-hidden="true"
        style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
      />
    </div>
  ) : (
    <div className="system-loading-indicator" aria-live="polite">
      <div className="system-loading-dot" aria-hidden="true" />
    </div>
  );

  const contentJSX = (
    <Suspense fallback={loaderVisualJSX}>
      <Outlet
        context={{
          user,
          skinIdAtual,
          espacos,
          onePagePublicaAtiva,
          usuarioPodeAbrirMenuOnePage,
        }}
      />
    </Suspense>
  );

  if (loading || isLoading || !theme) return loaderVisualJSX;

  return (
    <>
      <Layout
        theme={theme}
        profile={profileJSX}
        navigation={navigationJSX}
        content={contentJSX}
        configSistemaOverride={configSistemaAtual}
        cardProfileDimensionsOverride={cardProfileDimensions}
      />
      <FirebaseProjectBadge />
    </>
  );
}

export default Estrutura;
