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
import { db } from "../../Banco/init-firebase";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";
import LoginButton from "../Geral/LoginButton";
import Navbar from "../Navbar/Navbar";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import Layout from "../Temas/Layout.jsx";
import { obterTemaSkinPadrao, resolverTemaSkinEfetivo } from "../Temas/themesRegistry";
import { getEspacosDaSkin } from "./firebaseEspacos";

const ONEPAGE_ADMIN_USERNAME_KEY = "onePageAdminUsername";

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
  const onePagePublicaAtiva =
    tipoExperiencia === "onepage" && modoAcessoProjeto === "publico_sem_login";
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

  const aplicarFallbackOnePage = (configSistemaProjeto, usernameFallback = "") => {
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
          construirBaseUsernameOnePage(user)
        );
    const ownerUid = user?.uid || "";

    setUsername(usernameLocal);
    setSkins([]);
    setTheme(temaEfetivo);
    setEspacos([
      {
        id_espaco: "home",
        nome: "home",
        ownerUserId: ownerUid,
        skinOwner: localStorage.getItem("skinIdAtual") || null,
        visibilidade: "publico",
        isHome: true,
      },
    ]);
  };

  useEffect(() => {
    if (loading) return;

    let targetUsername = String(targetUsernameInicial || "").trim();

    const fetchSkinData = async () => {
      setIsLoading(true);
      let configSistemaProjeto =
        obterConfigSistemaCacheLocal() || configSistemaAtual || DEFAULT_SISTEMA_CONFIG;
      try {
        try {
          configSistemaProjeto = await obterConfigSistema();
        } catch {
          configSistemaProjeto = obterConfigSistemaCacheLocal() || configSistemaProjeto;
        }
        setConfigSistemaAtual(configSistemaProjeto);

        const onePagePublicaProjeto =
          configSistemaProjeto?.tipoExperiencia === "onepage" &&
          configSistemaProjeto?.modoAcessoProjeto === "publico_sem_login";
        const adminUidProjeto = String(
          configSistemaProjeto?.adminUid || localStorage.getItem("systemAdminUid") || ""
        ).trim();
        const adminEmailProjeto = String(configSistemaProjeto?.adminEmail || "")
          .trim()
          .toLowerCase();
        const emailUsuarioAtual = String(user?.email || "")
          .trim()
          .toLowerCase();
        const adminProjetoConfigurado = Boolean(adminUidProjeto || adminEmailProjeto);
        const usuarioEhAdminOnePage = Boolean(
          user?.uid &&
            ((adminUidProjeto && user.uid === adminUidProjeto) ||
              (adminEmailProjeto && emailUsuarioAtual === adminEmailProjeto) ||
              (!adminProjetoConfigurado && seforAdm(user)))
        );

        if (onePagePublicaProjeto) {
          targetUsername = "";
        }

        let skinDocResolvido = null;
        if (!targetUsername && onePagePublicaProjeto) {
          if (adminUidProjeto) {
            const skinAdminQuery = query(
              collection(db, "users", adminUidProjeto, "skins"),
              limit(1)
            );
            let skinAdminSnap = await getDocs(skinAdminQuery);

            if (
              skinAdminSnap.empty &&
              user?.uid &&
              user.uid === adminUidProjeto
            ) {
              const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
              await criarSkinUnicaOnePage({
                firebaseUser: user,
                temaPadraoSkin,
              });
              skinAdminSnap = await getDocs(skinAdminQuery);
            }

            if (!skinAdminSnap.empty) {
              skinDocResolvido = skinAdminSnap.docs[0];
            }
          }

          if (!skinDocResolvido && usuarioEhAdminOnePage && user?.uid) {
            const skinUsuarioQuery = query(
              collection(db, "users", user.uid, "skins"),
              limit(1)
            );
            let skinUsuarioSnap = await getDocs(skinUsuarioQuery);

            if (skinUsuarioSnap.empty) {
              const temaPadraoSkin = obterTemaSkinPadrao(configSistemaProjeto?.temaPadraoSistema);
              await criarSkinUnicaOnePage({
                firebaseUser: user,
                temaPadraoSkin,
              });
              skinUsuarioSnap = await getDocs(skinUsuarioQuery);
            }

            if (!skinUsuarioSnap.empty) {
              skinDocResolvido = skinUsuarioSnap.docs[0];
            }
          }

          if (!skinDocResolvido) {
            const skinPublicaQuery = query(
              collectionGroup(db, "skins"),
              where("visibilidade", "==", "publico"),
              limit(1)
            );
            const skinPublicaSnap = await getDocs(skinPublicaQuery);
            if (!skinPublicaSnap.empty) {
              skinDocResolvido = skinPublicaSnap.docs[0];
            }
          }

          if (!skinDocResolvido) {
            if (onePagePublicaProjeto) {
              aplicarFallbackOnePage(configSistemaProjeto, targetUsername);
              return;
            }
            navigate("/Error");
            return;
          }

          targetUsername = String(skinDocResolvido.data()?.username || "").trim();
          if (!targetUsername) {
            if (onePagePublicaProjeto) {
              aplicarFallbackOnePage(configSistemaProjeto, targetUsername);
              return;
            }
            navigate("/Error");
            return;
          }
        }

        let skinsSnap = { empty: true, docs: [] };
        if (skinDocResolvido) {
          skinsSnap = { empty: false, docs: [skinDocResolvido] };
        } else if (user?.uid) {
          const ownerQuery = query(
            collection(db, "users", user.uid, "skins"),
            where("username", "==", targetUsername),
            limit(1)
          );
          skinsSnap = await getDocs(ownerQuery);
        }

        if (skinsSnap.empty) {
          const publicQuery = query(
            collectionGroup(db, "skins"),
            where("username", "==", targetUsername),
            where("visibilidade", "==", "publico"),
            limit(1)
          );

          if (user?.uid) {
            const preferredQuery = query(
              collectionGroup(db, "skins"),
              where("username", "==", targetUsername),
              where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
              limit(1)
            );

            try {
              skinsSnap = await getDocs(preferredQuery);
            } catch (err) {
              if (err?.code !== "permission-denied") throw err;
              const compatQuery = query(
                collectionGroup(db, "skins"),
                where("username", "==", targetUsername),
                where("visibilidade", "in", ["publico", "publico_restritivo"]),
                limit(1)
              );
              skinsSnap = await getDocs(compatQuery);
            }
          } else {
            skinsSnap = await getDocs(publicQuery);
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
              if (err?.code !== "permission-denied") throw err;
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

        const isOwner = user && user.uid === skinData.ownerUserId;
        const isPublic = !skinData.visibilidade || skinData.visibilidade === "publico";
        const isAuthPublic =
          (skinData.visibilidade === "publico_restritivo" ||
            skinData.visibilidade === "privado") &&
          !!user;

        if (!isOwner && !isPublic && !isAuthPublic) {
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
        try {
          pagesList = await getEspacosDaSkin({
            userId: skinData.ownerUserId,
            skinId,
            viewerUserId: user?.uid || null,
          });
        } catch (espacosErr) {
          if (espacosErr?.code !== "permission-denied") throw espacosErr;
          console.warn(
            "Permissao negada ao ler espacos da skin. Perfil sera exibido sem lista de espacos.",
            espacosErr?.message
          );
        }

        setEspacos(pagesList);

        if (
          user?.uid === skinData.ownerUserId ||
          (onePagePublicaProjeto && usuarioEhAdminOnePage && user?.uid)
        ) {
          localStorage.setItem("skinIdAtual", skinId);
          localStorage.setItem("skinLogadoUser", targetUsername);
        }

        if (user?.uid === skinData.ownerUserId) {
          try {
            await setDoc(
              doc(db, "users", user.uid),
              {
                uid: user.uid,
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
        const onePageProjetoAtual =
          configEmErro?.tipoExperiencia === "onepage" &&
          configEmErro?.modoAcessoProjeto === "publico_sem_login";

        if (err?.code === "permission-denied") {
          if (onePageProjetoAtual) {
            const adminUidErro = String(configEmErro?.adminUid || "").trim();
            const adminEmailErro = String(configEmErro?.adminEmail || "")
              .trim()
              .toLowerCase();
            const emailAtualErro = String(user?.email || "")
              .trim()
              .toLowerCase();
            const adminConfiguradoErro = Boolean(adminUidErro || adminEmailErro);
            const usuarioEhAdminOnePageErro = Boolean(
              user?.uid &&
                ((adminUidErro && user.uid === adminUidErro) ||
                  (adminEmailErro && emailAtualErro === adminEmailErro) ||
                  (!adminConfiguradoErro && seforAdm(user)))
            );

            if (usuarioEhAdminOnePageErro) {
              const temaPadraoSkin = obterTemaSkinPadrao(configEmErro?.temaPadraoSistema);
              await criarSkinUnicaOnePage({
                firebaseUser: user,
                temaPadraoSkin,
              });
            }

            if (retryNonce < 3) {
              setTimeout(() => {
                setRetryNonce((valor) => valor + 1);
              }, 700);
              return;
            }

            aplicarFallbackOnePage(configEmErro, targetUsername);
            return;
          }

          console.warn(
            "Permissao negada ao ler skin. Confirme deploy das regras com: npm run firestore:rules:deploy"
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
  }, [loading, navigate, retryNonce, targetUsernameInicial, user]);

  useEffect(() => {
    if (!espacos.length || !username || hasNavigated) return;

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
                width: "170px",
                height: "170px",
                margin: "0 auto",
                transform: "none",
                pointerEvents: "none",
              }
            : { display: menuOpen ? "none" : "block" }
        }
      >
        <Navegacoes />
        {String(skins?.[0]?.cardProfileUrl || "").trim() ? (
          <img
            src={String(skins?.[0]?.cardProfileUrl || "").trim()}
            id="imgBustoHome"
            alt="imagem"
            style={
              onePagePublicaAtiva && configSistemaAtual?.layoutTema?.headerVisible !== false
                ? {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
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

  const contentJSX = (
    <>
      <Navbar pages={espacos} username={username} />

      <Suspense fallback={<div>Carregando...</div>}>
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
    </>
  );

  if (loading || isLoading || !theme) return <div>Carregando...</div>;

  return (
    <>
      <Layout theme={theme} profile={profileJSX} content={contentJSX} />
      <FirebaseProjectBadge />
    </>
  );
}

export default Estrutura;
