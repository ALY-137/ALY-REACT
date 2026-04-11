import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  collection,
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
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";
import LoginButton from "../Geral/LoginButton";
import Navbar from "../Navbar/Navbar";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  isOneOwnerHomeCentralProjeto,
  isOneOwnerHomeSkinDoOwner,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  usuarioCorrespondeOwnerConfigurado,
} from "../Sistema/configSistema";
import Layout from "../Temas/Layout.jsx";
import {
  CYBERPINK_SUBTHEME_STORAGE_KEY,
  normalizeCyberpinkSubtheme,
} from "../Temas/cyberpink/subthemes";
import { obterTemaSkinPadrao, resolverTemaSkinEfetivo } from "../Temas/themesRegistry";
import { findSkinByUsernameAcrossProject } from "../Skins/skinLookup";
import {
  getEspacosDaSkin,
  getEspacosDoOwner,
  getEspacosEstruturaPublica,
  sincronizarEstruturaPublicaEspaco,
} from "./firebaseEspacos";

const ONEOWNER_OWNER_USERNAME_KEY = "oneOwnerOwnerUsername";
const ONEOWNER_CARDPROFILE_MAX_WIDTH = 420;
const ONEOWNER_CARDPROFILE_MAX_HEIGHT = 420;
const ONEOWNER_CARDPROFILE_VIEWPORT_PADDING = 48;
const CYBERPINK_THEME_KEY = "CYBERPINK";

const limparUsername = (valor = "") =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const construirBaseUsernameOneOwner = (firebaseUser = null) => {
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

const visibilidadeEspacoPermitida = (visibilidade = "", autenticado = false) => {
  const visibilidadeNormalizada = String(visibilidade || "")
    .trim()
    .toLowerCase();
  if (!visibilidadeNormalizada || visibilidadeNormalizada === "publico") return true;
  if (
    autenticado &&
    (visibilidadeNormalizada === "publico_restritivo" ||
      visibilidadeNormalizada === "privado")
  ) {
    return true;
  }
  return false;
};

const filtrarEspacosFallbackPorSkin = ({
  espacos = [],
  skinId = "",
  autenticado = false,
} = {}) => {
  const skinIdNormalizado = String(skinId || "").trim();

  return (Array.isArray(espacos) ? espacos : [])
    .filter((espaco) => {
      const visibilidade = espaco?.visibilidade;
      if (!visibilidadeEspacoPermitida(visibilidade, autenticado)) return false;

      if (!skinIdNormalizado) return true;

      const skinOwner = String(espaco?.skinOwner || "").trim();
      const skinsRelacionadas = Array.isArray(espaco?.skins_relacionadas)
        ? espaco.skins_relacionadas
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        : [];

      if (skinOwner && skinOwner === skinIdNormalizado) return true;
      if (skinsRelacionadas.length && skinsRelacionadas.includes(skinIdNormalizado)) return true;

      // No fallback por skin especifica, so entram espacos explicitamente vinculados
      // a essa skin. Sem isso, espacos desrelacionados continuam aparecendo.
      return false;
    })
    .sort((a, b) => (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0));
};

const construirOwnerCandidates = (
  configSistemaProjeto = {},
  authUserAtual = null,
  { includeAuthUser = true } = {}
) =>
  Array.from(
    new Set(
      [
        configSistemaProjeto?.ownerUid,
        configSistemaProjeto?.adminUid,
        configSistemaProjeto?.projectOwnerUid,
        configSistemaProjeto?.projectLastEditorUid,
        includeAuthUser ? authUserAtual?.uid : "",
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const calcularDimensoesCardProfileOneOwner = (dimensoesNaturais = null) => {
  const larguraNatural = Number(dimensoesNaturais?.width || 0);
  const alturaNatural = Number(dimensoesNaturais?.height || 0);

  if (!larguraNatural || !alturaNatural) return null;

  const larguraViewport =
    typeof window !== "undefined"
      ? Math.max(160, Number(window.innerWidth || 0) - ONEOWNER_CARDPROFILE_VIEWPORT_PADDING)
      : ONEOWNER_CARDPROFILE_MAX_WIDTH;
  const larguraMaxima = Math.min(ONEOWNER_CARDPROFILE_MAX_WIDTH, larguraViewport);
  const alturaMaxima = ONEOWNER_CARDPROFILE_MAX_HEIGHT;
  const escala = Math.min(1, larguraMaxima / larguraNatural, alturaMaxima / alturaNatural);

  return {
    width: Math.max(1, Math.round(larguraNatural * escala)),
    height: Math.max(1, Math.round(alturaNatural * escala)),
  };
};

const criarSkinUnicaOneOwner = async ({
  firebaseUser,
  temaPadraoSkin,
  iconSkinPadraoUrl = "",
}) => {
  if (!firebaseUser?.uid) return false;

  const uid = firebaseUser.uid;
  const base = construirBaseUsernameOneOwner(firebaseUser);
  const usernameOneOwner = `${base}-${uid.slice(0, 6)}`.slice(0, 24);
  const temaCriacao = String(temaPadraoSkin || "").trim() || "CYBERPINK";
  const iconSkinPadrao = String(
    iconSkinPadraoUrl || DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || ""
  ).trim();
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
    const userRef = getPrimaryProjectDoc(db, "users", uid);
    const skinRef = getPrimaryProjectDoc(db, "users", uid, "skins", skinId);
    const espacoRef = getPrimaryProjectDoc(db, "users", uid, "espacos", espacoId);

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
        username: usernameOneOwner,
        theme: temaCriacao,
        cardProfileUrl: "",
        cardProfilePath: "",
        is_main: true,
        visibilidade: "publico",
        data: serverTimestamp(),
        iconSkin: iconSkinPadrao || null,
      },
      { merge: true }
    );

    await setDoc(
      espacoRef,
      {
        id_espaco: espacoId,
        nome: "home",
        conteudo: "",
        ordem: 0,
        ownerUserId: uid,
        skinOwner: skinId,
        coCriadoresUids: [],
        visibilidade: "publico",
        subtema: normalizeCyberpinkSubtheme(),
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
      subtema: normalizeCyberpinkSubtheme(),
      isHome: true,
      skins_relacionadas: [skinId],
    });

    localStorage.setItem("targetUsername", usernameOneOwner);
    localStorage.setItem("skinLogadoUser", usernameOneOwner);
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
  const [layoutThemeReady, setLayoutThemeReady] = useState(false);

  const urlUsername = location.pathname.split("/")[1];
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");
  const skinIdAtual = localStorage.getItem("skinIdAtual") || null;
  const tipoExperiencia =
    configSistemaAtual?.tipoExperiencia || DEFAULT_SISTEMA_CONFIG.tipoExperiencia;
  const modoAcessoProjeto =
    configSistemaAtual?.modoAcessoProjeto || DEFAULT_SISTEMA_CONFIG.modoAcessoProjeto;
  const oneOwnerPublicaAtiva = isOneOwnerComEntradaPublica({
    tipoExperiencia,
    modoAcessoProjeto,
  });
  const oneOwnerHomeCentralAtiva = isOneOwnerHomeCentralProjeto(configSistemaAtual);
  const oneOwnerHomeSkinOwnerAtiva = isOneOwnerHomeSkinDoOwner(configSistemaAtual);
  const targetUsernameInicial = oneOwnerPublicaAtiva
    ? (
        localStorage.getItem("targetUsername") ||
        skinLogadoUser ||
        ""
      )
    : (
        urlUsername ||
        localStorage.getItem("targetUsername") ||
        skinLogadoUser ||
        ""
      );
  const ownerUidProjetoConfigurado = String(
    obterOwnerUidConfigurado(configSistemaAtual) || ""
  ).trim();
  const ownerEmailProjetoConfigurado = String(
    obterOwnerEmailConfigurado(configSistemaAtual) || ""
  )
    .trim()
    .toLowerCase();
  const ownerProjetoConfigurado = Boolean(
    ownerUidProjetoConfigurado || ownerEmailProjetoConfigurado
  );
  const usuarioEhOwnerOneOwner = Boolean(
    user?.uid &&
      (
        usuarioCorrespondeOwnerConfigurado(configSistemaAtual, {
          uid: user.uid,
          email: user?.email,
        }) ||
        (!ownerProjetoConfigurado &&
          seforAdm(user))
      )
  );
  const usuarioPodeAbrirMenuOneOwner = Boolean(user?.uid);
  const segmentosRota = location.pathname
    .split("/")
    .map((segmento) => decodeURIComponent(segmento || "").trim())
    .filter(Boolean);
  const nomeEspacoAtualRota = oneOwnerPublicaAtiva
    ? String(segmentosRota[0] || "").trim()
    : String(segmentosRota[1] || "").trim();
  const cardProfileUrlEfetiva = String(
    configSistemaAtual?.cardProfileUrl || skins?.[0]?.cardProfileUrl || ""
  ).trim();
  const espacoAtivoTema = useMemo(
    () =>
      espacos.find((pagina) => String(pagina?.nome || "").trim() === nomeEspacoAtualRota) ||
      espacos.find((pagina) => pagina.isHome === true) ||
      espacos[0] ||
      null,
    [espacos, nomeEspacoAtualRota]
  );
  const subtemaCyberpinkAtivo = useMemo(() => {
    const temaSistema = String(configSistemaAtual?.temaPadraoSistema || "")
      .trim()
      .toUpperCase();
    if (temaSistema !== CYBERPINK_THEME_KEY) return "";
    return normalizeCyberpinkSubtheme(espacoAtivoTema?.subtema);
  }, [configSistemaAtual?.temaPadraoSistema, espacoAtivoTema?.subtema]);

  useEffect(() => {
    if (subtemaCyberpinkAtivo) {
      localStorage.setItem(CYBERPINK_SUBTHEME_STORAGE_KEY, subtemaCyberpinkAtivo);
      return;
    }
    localStorage.removeItem(CYBERPINK_SUBTHEME_STORAGE_KEY);
  }, [subtemaCyberpinkAtivo]);

  useEffect(() => {
    if (cardProfileUrlEfetiva) return;
    setCardProfileNaturalDimensions(null);
    setCardProfileDimensions(null);
  }, [cardProfileUrlEfetiva]);

  useEffect(() => {
    setLayoutThemeReady(false);
  }, [theme]);

  useEffect(() => {
    const deveUsarImagemComoReferencia =
      oneOwnerPublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false;

    if (!deveUsarImagemComoReferencia || !cardProfileNaturalDimensions) {
      setCardProfileDimensions(null);
      return;
    }

    const atualizarDimensoes = () => {
      setCardProfileDimensions(
        calcularDimensoesCardProfileOneOwner(cardProfileNaturalDimensions)
      );
    };

    atualizarDimensoes();
    window.addEventListener("resize", atualizarDimensoes);
    return () => window.removeEventListener("resize", atualizarDimensoes);
  }, [
    cardProfileNaturalDimensions,
    configSistemaAtual?.layoutTema?.headerVisible,
    oneOwnerPublicaAtiva,
  ]);

  const aplicarFallbackOneOwner = async (
    configSistemaProjeto,
    usernameFallback = "",
    ownerUidOverride = "",
    options = {}
  ) => {
    const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
    const temaEfetivo = resolverTemaSkinEfetivo(
      temaPadraoSkin,
      configSistemaProjeto?.temaPadraoSistema,
      configSistemaProjeto?.permitirTemasSkinSecundarios !== false
    );
    const usarUsernameOwnerFallback = options?.usarUsernameOwnerFallback !== false;
    const usernameOwnerCache = String(
      localStorage.getItem(ONEOWNER_OWNER_USERNAME_KEY) || ""
    ).trim();
    const usernameLocal = oneOwnerPublicaAtiva && !usuarioEhOwnerOneOwner
      ? (usernameFallback || (usarUsernameOwnerFallback ? usernameOwnerCache : ""))
      : (
          usernameFallback ||
          localStorage.getItem("targetUsername") ||
          construirBaseUsernameOneOwner(authUserAtual)
        );
    const ownerUid = String(
      ownerUidOverride ||
        configSistemaProjeto?.ownerUid ||
        configSistemaProjeto?.adminUid ||
        configSistemaProjeto?.projectOwnerUid ||
        configSistemaProjeto?.projectLastEditorUid ||
        (usuarioEhOwnerOneOwner ? authUserAtual?.uid : "") ||
        ""
    ).trim();
    let espacosFallback = [
      {
        id_espaco: "home",
        nome: "home",
        ownerUserId: ownerUid,
        skinOwner: localStorage.getItem("skinIdAtual") || null,
        visibilidade: "publico",
        subtema: normalizeCyberpinkSubtheme(),
        isHome: true,
      },
    ];

    if (ownerUid) {
      try {
        const espacosOwner = await getEspacosDoOwner({
          userId: ownerUid,
          viewerUserId: authUserAtual?.uid || null,
          ignorarVisibilidade: oneOwnerPublicaAtiva,
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

        const oneOwnerPublicaProjeto =
          isOneOwnerComEntradaPublica(configSistemaProjeto);
        const oneOwnerHomeCentralProjeto =
          isOneOwnerHomeCentralProjeto(configSistemaProjeto);
        const oneOwnerHomeSkinOwnerProjeto =
          isOneOwnerHomeSkinDoOwner(configSistemaProjeto);
        const ownerUidProjeto = String(
          obterOwnerUidConfigurado(configSistemaProjeto) || ""
        ).trim();
        const ownerEmailProjeto = String(
          obterOwnerEmailConfigurado(configSistemaProjeto) || ""
        )
          .trim()
          .toLowerCase();
        const ownerProjetoConfigurado = Boolean(ownerUidProjeto || ownerEmailProjeto);
        const usuarioEhOwnerOneOwner = Boolean(
          authUserAtual?.uid &&
            (usuarioCorrespondeOwnerConfigurado(configSistemaProjeto, {
              uid: authUserAtual?.uid,
              email: authUserAtual?.email,
            }) ||
              (!ownerProjetoConfigurado && seforAdm(authUserAtual)))
        );
        const ownerUidCandidates = construirOwnerCandidates(
          configSistemaProjeto,
          authUserAtual,
          { includeAuthUser: !oneOwnerPublicaProjeto || usuarioEhOwnerOneOwner }
        );

        if (oneOwnerHomeCentralProjeto) {
          await aplicarFallbackOneOwner(
            configSistemaProjeto,
            "",
            ownerUidProjeto,
            { usarUsernameOwnerFallback: false }
          );
          return;
        }

        if (oneOwnerHomeSkinOwnerProjeto) {
          targetUsername = "";
        }

        let skinDocResolvido = null;
        if (!targetUsername && oneOwnerHomeSkinOwnerProjeto) {
          const usernameOwnerCache = String(
            localStorage.getItem(ONEOWNER_OWNER_USERNAME_KEY) || ""
          ).trim();
          if (ownerUidCandidates.length) {
            for (const ownerUidCandidate of ownerUidCandidates) {
              const colecaoSkinsOwner = getPrimaryProjectCollection(
                db,
                "users",
                ownerUidCandidate,
                "skins"
              );

              if (authUserAtual?.uid && authUserAtual.uid === ownerUidCandidate) {
                const skinOwnerQuery = query(colecaoSkinsOwner);
                skinDocResolvido = await buscarSkinPreferencial(skinOwnerQuery);

                if (!skinDocResolvido) {
                  const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
                  await criarSkinUnicaOneOwner({
                    firebaseUser: authUserAtual,
                    temaPadraoSkin,
                    iconSkinPadraoUrl: configSistemaProjeto?.iconSkinPadraoUrl,
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
                      query(colecaoSkinsOwner, where("visibilidade", "==", null)),
                    ]
                  : [
                      query(colecaoSkinsOwner, where("visibilidade", "==", "publico")),
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

          if (!skinDocResolvido && usuarioEhOwnerOneOwner && authUserAtual?.uid) {
            const skinUsuarioQuery = query(
              getPrimaryProjectCollection(db, "users", authUserAtual.uid, "skins"),
              limit(1)
            );
            let skinUsuarioSnap = await getDocs(skinUsuarioQuery);

            if (skinUsuarioSnap.empty) {
              const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
              await criarSkinUnicaOneOwner({
                firebaseUser: authUserAtual,
                temaPadraoSkin,
                iconSkinPadraoUrl: configSistemaProjeto?.iconSkinPadraoUrl,
              });
              skinUsuarioSnap = await getDocs(skinUsuarioQuery);
            }

            if (!skinUsuarioSnap.empty) {
              skinDocResolvido = skinUsuarioSnap.docs[0];
            }
          }

          if (!skinDocResolvido) {
            if (oneOwnerHomeSkinOwnerProjeto && usernameOwnerCache) {
              targetUsername = usernameOwnerCache;
            } else if (oneOwnerHomeSkinOwnerProjeto) {
              await aplicarFallbackOneOwner(
                configSistemaProjeto,
                targetUsername,
                ownerUidProjeto
              );
              return;
            } else {
              navigate("/Error");
              return;
            }
          }

          targetUsername = skinDocResolvido
            ? String(skinDocResolvido.data()?.username || "").trim()
            : String(targetUsername || "").trim();
          if (!targetUsername) {
            if (oneOwnerHomeSkinOwnerProjeto) {
              await aplicarFallbackOneOwner(
                configSistemaProjeto,
                targetUsername,
                ownerUidProjeto
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
            getPrimaryProjectCollection(db, "users", authUserAtual.uid, "skins"),
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
          try {
            const ownerCandidatesBusca = construirOwnerCandidates(configSistemaProjeto, authUserAtual, {
              includeAuthUser: true,
            });
            const skinByUsername = await findSkinByUsernameAcrossProject(db, targetUsername, {
              authenticated: Boolean(authUserAtual?.uid),
              allowPrivateWhenAuthenticated: Boolean(authUserAtual?.uid),
              includeLegacy: true,
              ownerUidCandidates: ownerCandidatesBusca,
            });
            if (skinByUsername) {
              skinsSnap = { empty: false, docs: [skinByUsername] };
            }
          } catch (err) {
            if (!erroConsultaRecuperavelSkin(err)) throw err;
          }

          if (skinsSnap.empty && oneOwnerHomeSkinOwnerProjeto) {
            if (ownerUidProjeto) {
              try {
                const ownerSkinsRef = getPrimaryProjectCollection(
                  db,
                  "users",
                  ownerUidProjeto,
                  "skins"
                );
                const consultasOwnerFallback = authUserAtual?.uid
                  ? [
                      query(
                        ownerSkinsRef,
                        where("visibilidade", "in", ["publico", "publico_restritivo", "privado"])
                      ),
                      query(ownerSkinsRef, where("visibilidade", "==", "publico")),
                      query(ownerSkinsRef, where("visibilidade", "==", null)),
                    ]
                  : [
                      query(ownerSkinsRef, where("visibilidade", "==", "publico")),
                      query(ownerSkinsRef, where("visibilidade", "==", null)),
                    ];

                for (const consulta of consultasOwnerFallback) {
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

            if (skinsSnap.empty && usuarioEhOwnerOneOwner && authUserAtual?.uid) {
              try {
                const ownerSelfSkinDoc = await buscarSkinPreferencial(
                  query(getPrimaryProjectCollection(db, "users", authUserAtual.uid, "skins"))
                );
                if (ownerSelfSkinDoc) {
                  skinsSnap = { empty: false, docs: [ownerSelfSkinDoc] };
                }
              } catch (err) {
                if (!erroConsultaRecuperavelSkin(err)) throw err;
              }
            }
          }
        }

        if (skinsSnap.empty) {
          if (oneOwnerPublicaProjeto) {
            aplicarFallbackOneOwner(configSistemaProjeto, targetUsername);
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
        const usarSkinOwnerNaOneOwner =
          oneOwnerHomeSkinOwnerProjeto &&
          Boolean(ownerUidProjeto) &&
          String(skinData.ownerUserId || "").trim() === ownerUidProjeto;

        if (!isOwner && !isPublic && !isAuthPublic && !usarSkinOwnerNaOneOwner) {
          if (oneOwnerPublicaProjeto) {
            aplicarFallbackOneOwner(configSistemaProjeto, targetUsername);
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
        if (oneOwnerHomeSkinOwnerProjeto && targetUsername) {
          localStorage.setItem(ONEOWNER_OWNER_USERNAME_KEY, targetUsername);
        }

        let pagesList = [];
        if (oneOwnerPublicaProjeto && skinData.ownerUserId) {
          try {
            pagesList = await getEspacosDoOwner({
              userId: skinData.ownerUserId,
              viewerUserId: authUserAtual?.uid || null,
              ignorarVisibilidade: true,
            });
            if (usuarioEhOwnerOneOwner && pagesList.length) {
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
            try {
              const espacosEstruturaPublica = await getEspacosEstruturaPublica(
                skinData.ownerUserId
              );
              pagesList = filtrarEspacosFallbackPorSkin({
                espacos: espacosEstruturaPublica,
                skinId,
                autenticado: Boolean(authUserAtual?.uid),
              });
            } catch (estruturaErr) {
              if (!erroConsultaRecuperavelSkin(estruturaErr)) throw estruturaErr;
            }
          }
        }

        if (oneOwnerPublicaProjeto && skinData.ownerUserId && !pagesList.length) {
          try {
            const homeQueries = authUserAtual?.uid
              ? [
                  query(
                    getPrimaryProjectCollection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
                    limit(1)
                  ),
                  query(
                    getPrimaryProjectCollection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "==", null),
                    limit(1)
                  ),
                ]
              : [
                  query(
                    getPrimaryProjectCollection(db, "users", skinData.ownerUserId, "espacos"),
                    where("isHome", "==", true),
                    where("visibilidade", "==", "publico"),
                    limit(1)
                  ),
                  query(
                    getPrimaryProjectCollection(db, "users", skinData.ownerUserId, "espacos"),
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
          (oneOwnerPublicaProjeto && usuarioEhOwnerOneOwner && authUserAtual?.uid)
        ) {
          localStorage.setItem("skinIdAtual", skinId);
          localStorage.setItem("skinLogadoUser", targetUsername);
        }

        if (authUserAtual?.uid === skinData.ownerUserId) {
          try {
            await setDoc(
              getPrimaryProjectDoc(db, "users", authUserAtual.uid),
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
        const oneOwnerProjetoAtual = isOneOwnerComEntradaPublica(configEmErro);

        if (err?.code === "permission-denied" || err?.code === "failed-precondition") {
          if (oneOwnerProjetoAtual) {
            const ownerUidErro = String(obterOwnerUidConfigurado(configEmErro) || "").trim();
            const ownerEmailErro = String(obterOwnerEmailConfigurado(configEmErro) || "")
              .trim()
              .toLowerCase();
            const ownerConfiguradoErro = Boolean(ownerUidErro || ownerEmailErro);
            const usuarioEhOwnerOneOwnerErro = Boolean(
              authUserAtual?.uid &&
                (usuarioCorrespondeOwnerConfigurado(configEmErro, {
                  uid: authUserAtual?.uid,
                  email: authUserAtual?.email,
                }) ||
                  (!ownerConfiguradoErro && seforAdm(authUserAtual)))
            );

            if (usuarioEhOwnerOneOwnerErro) {
              const temaPadraoSkin = obterTemaSkinPadrao(configEmErro?.temaPadraoSistema);
              await criarSkinUnicaOneOwner({
                firebaseUser: authUserAtual,
                temaPadraoSkin,
                iconSkinPadraoUrl: configEmErro?.iconSkinPadraoUrl,
              });
            }

            if (retryNonce < 3) {
              setTimeout(() => {
                setRetryNonce((valor) => valor + 1);
              }, 700);
              return;
            }

            await aplicarFallbackOneOwner(
              configEmErro,
              targetUsername,
              ownerUidErro
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
    const segmentos = String(location.pathname || "")
      .split("/")
      .filter(Boolean);
    const rotaPareceOneOwnerPublica = segmentos.length === 1;

    if (!oneOwnerPublicaAtiva && rotaPareceOneOwnerPublica && !loading && !user?.uid) {
      navigate("/login", { replace: true });
      return;
    }
  }, [loading, location.pathname, navigate, oneOwnerPublicaAtiva, user?.uid]);

  useEffect(() => {
    if (!espacos.length || hasNavigated) return;
    if (!oneOwnerPublicaAtiva && !username) return;

    const mainPage =
      espacos.find((p) => p.isHome === true) ||
      espacos.find((p) => p.is_main === true) ||
      espacos.find((p) => String(p?.id || p?.id_espaco || "").trim().toLowerCase() === "home") ||
      espacos.find((p) => String(p?.nome || "").trim().toLowerCase() === "home") ||
      (oneOwnerPublicaAtiva ? espacos[0] : null);
    if (!mainPage) {
      if (!espacos.length && !oneOwnerPublicaAtiva) {
        setHasNavigated(true);
        return;
      }
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

    const nomeMainPage =
      String(mainPage?.nome || mainPage?.id_espaco || mainPage?.id || "home").trim() || "home";
    const destinoPrincipal = oneOwnerPublicaAtiva
      ? `/${nomeMainPage}`
      : `/${username}/${nomeMainPage}`;
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
    oneOwnerPublicaAtiva,
    username,
  ]);

  const resolverUsernameMenuOneOwner = async () => {
    if (!user?.uid) return "";

    try {
      const projectSystemKeyAtual = String(configSistemaAtual?.projectSystemKey || "").trim().toLowerCase();
      if (projectSystemKeyAtual) {
        localStorage.setItem("systemProjectContextKey", projectSystemKeyAtual);
      }
    } catch {
      // Ignora indisponibilidade de storage local.
    }

    const usernameStorage = String(localStorage.getItem("skinLogadoUser") || "").trim();
    if (usernameStorage) return usernameStorage;

    const skinUsuarioQuery = query(
      getPrimaryProjectCollection(db, "users", user.uid, "skins"),
      limit(1)
    );
    let skinUsuarioSnap = await getDocs(skinUsuarioQuery);

    if (skinUsuarioSnap.empty) {
      const temaPadraoSkin = obterTemaSkinPadrao(configSistemaAtual?.temaPadraoSistema);
      await criarSkinUnicaOneOwner({
        firebaseUser: user,
        temaPadraoSkin,
        iconSkinPadraoUrl: configSistemaAtual?.iconSkinPadraoUrl,
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
    if (oneOwnerPublicaAtiva && !usuarioPodeAbrirMenuOneOwner) {
      alert("Faca login para abrir o menu.");
      return;
    }

    let destinoMenu = "";
    let destinoFechar = "/";

    if (oneOwnerPublicaAtiva) {
      if (usuarioEhOwnerOneOwner) {
        destinoMenu = "/menu/owner";
      } else {
        const usernameMenuOneOwner = await resolverUsernameMenuOneOwner();
        if (!usernameMenuOneOwner) {
          alert("Nao foi possivel identificar sua skin para abrir o menu.");
          return;
        }
        destinoMenu = `/menu/${usernameMenuOneOwner}`;
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

  const navbarMenuJSX = (
    <div id="navbar-menu" style={{ textAlign: "center" }}>
      {!user ? (
        <div className="navbar-menu__login-cta">
          <span
            aria-hidden="true"
            className="navbar-menu__login-arrow navbar-menu__login-arrow--left"
          />
          <LoginButton />
          <span
            aria-hidden="true"
            className="navbar-menu__login-arrow navbar-menu__login-arrow--right"
          />
        </div>
      ) : !oneOwnerPublicaAtiva || usuarioPodeAbrirMenuOneOwner ? (
        <p onClick={toggleMenu} style={{ cursor: "pointer" }}>
          ≡
        </p>
      ) : null}
    </div>
  );

  const profileJSX = (
    <div
      id="cardProfile"
      style={
        oneOwnerPublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false
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
            oneOwnerPublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false
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
  );

  const navigationJSX = (
    <>
      {navbarMenuJSX}
      <Navbar pages={espacos} username={username} />
    </>
  );
  const loginLoadingMode = String(configSistemaAtual?.loginLoadingMode || "")
    .trim()
    .toLowerCase();
  const loginLoadingSpriteUrl = String(configSistemaAtual?.loginLoadingSpriteUrl || "").trim();
  const temaSistemaPadrao = String(configSistemaAtual?.temaPadraoSistema || "")
    .trim()
    .toUpperCase();
  const estiloShellLoader =
    temaSistemaPadrao === "PASSY"
      ? { backgroundColor: "#eecadd" }
      : undefined;
  const exibirLoaderSprite = Boolean(loginLoadingSpriteUrl);
  const loaderVisualJSX = exibirLoaderSprite ? (
    <div
      id="login"
      className="sprite-loader-transition-shell"
      aria-live="polite"
      style={estiloShellLoader}
    >
      <div className="sprite-loader-layer sprite-loader-layer-inline">
        <div
          className="loader-cherry"
          aria-hidden="true"
          style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
        />
      </div>
    </div>
  ) : (
    <div id="login" aria-live="polite" style={estiloShellLoader}>
      <div className="system-loading-indicator">
        <div className="system-loading-dot" aria-hidden="true" />
      </div>
    </div>
  );

  const contentJSX = (
    <Suspense fallback={loaderVisualJSX}>
      <Outlet
        context={{
          user,
          skinIdAtual,
          espacos,
          oneOwnerPublicaAtiva,
          usuarioPodeAbrirMenuOneOwner,
        }}
      />
    </Suspense>
  );

  if (loading || isLoading || !theme) return loaderVisualJSX;

  const exibirBadgeProjetoFirebase = configSistemaAtual?.exibirBadgeProjetoFirebase !== false;

  return (
    <>
      {!layoutThemeReady ? loaderVisualJSX : null}
      <div style={!layoutThemeReady ? { visibility: "hidden" } : undefined}>
        <Layout
          theme={theme}
          profile={profileJSX}
          navigation={navigationJSX}
          content={contentJSX}
          spaceSubtheme={subtemaCyberpinkAtivo}
          configSistemaOverride={configSistemaAtual}
          cardProfileDimensionsOverride={cardProfileDimensions}
          onThemeReadyChange={setLayoutThemeReady}
        />
        <FirebaseProjectBadge visible={exibirBadgeProjetoFirebase} />
      </div>
    </>
  );
}

export default Estrutura;




