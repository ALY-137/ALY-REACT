import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  activeFirebaseProjectKey,
  storage,
} from "../../../Banco/init-firebase";
import { SYSTEM_THEMES } from "../../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  isManagerProjectRuntime,
  normalizarConfigSistema,
  obterManagerProjectIdConfigurado,
  obterManagerProjectLabel,
  obterConfigSistema,
  salvarConfigSistemaAdmin,
} from "../../Sistema/configSistema";
import {
  applyLoginPresetToConfig,
  getLoginPresetById,
} from "../../Sistema/loginPresets";
import {
  listarIconCollectionsNoGerenciador,
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";
import {
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../../Banco/sharedBucketApi";

function nomeArquivoSeguro(nome = "branding.png") {
  return String(nome || "branding.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

function extrairPrimeiraUrl(texto = "") {
  const bruto = String(texto || "").trim();
  if (!bruto) return "";

  const semAspas = bruto.replace(/^['"]|['"]$/g, "").trim();
  if (/^https?:\/\//i.test(semAspas)) {
    return semAspas;
  }

  const hrefMatch = bruto.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch?.[1]) {
    const href = String(hrefMatch[1]).trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const importMatch = bruto.match(/url\(([^)]+)\)/i);
  if (importMatch?.[1]) {
    const href = String(importMatch[1]).replace(/^['"]|['"]$/g, "").trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const geral = bruto.match(/https?:\/\/[^\s"'<>]+/i);
  return geral?.[0] ? String(geral[0]).trim() : "";
}

function formatarFamilyGoogleCss2(value = "") {
  return encodeURI(String(value || "").trim().replace(/\s+/g, "+"));
}

function normalizarUrlGoogleFonts(url = "") {
  const href = extrairPrimeiraUrl(url);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    const host = String(parsed.hostname || "").toLowerCase();

    if (host.includes("fonts.googleapis.com")) {
      return parsed.toString();
    }

    if (host.includes("fonts.google.com") && parsed.pathname.startsWith("/share")) {
      const familias = parsed.searchParams
        .getAll("selection.family")
        .flatMap((value) => String(value || "").split("|"))
        .map((value) => value.trim())
        .filter(Boolean);

      if (!familias.length) return "";

      const queryFamilias = familias
        .map((family) => `family=${formatarFamilyGoogleCss2(family)}`)
        .join("&");
      return `https://fonts.googleapis.com/css2?${queryFamilias}&display=swap`;
    }
  } catch {
    return "";
  }

  return "";
}

async function subirImagemBranding({
  file,
  campo,
  projetoGerenciadoKey = "",
  currentUid = "",
  currentUser = null,
}) {
  const nome = `${Date.now()}-${nomeArquivoSeguro(file?.name || `${campo}.png`)}`;
  const chaveProjeto = String(projetoGerenciadoKey || activeFirebaseProjectKey || "default")
    .trim()
    .toLowerCase();
  const uid = String(currentUid || "anon").trim() || "anon";
  const path = `users/${uid}/branding/${chaveProjeto}/${campo}/${nome}`;

  if (usandoBucketCompartilhadoCrossProject()) {
    const upload = await uploadArquivoNoBucketCompartilhado({
      user: currentUser,
      path,
      file,
    });
    return {
      url: String(upload?.url || ""),
      path,
    };
  }

  const arquivoRef = ref(storage, path);
  await uploadBytes(arquivoRef, file);
  return {
    url: await getDownloadURL(arquivoRef),
    path,
  };
}

function normalizarGoogleFontsUrlsTexto(value = "") {
  return Array.from(
    new Set(
      String(value || "")
        .split(/\r?\n/g)
        .map((item) => normalizarUrlGoogleFonts(item))
        .filter((item) => /^https?:\/\/fonts\.googleapis\.com\//i.test(item))
    )
  ).slice(0, 20);
}

function extrairFamiliasGoogleFonts(url = "") {
  const href = normalizarUrlGoogleFonts(url);
  if (!href) return [];

  try {
    const parsed = new URL(href);
    if (!String(parsed.hostname || "").toLowerCase().includes("fonts.googleapis.com")) {
      return [];
    }
    const familias = parsed.searchParams.getAll("family");
    if (!familias.length) return [];

    return familias
      .flatMap((valor) => String(valor || "").split("|"))
      .map((family) => String(family || "").split(":")[0].replace(/\+/g, " ").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function PropriedadesSistema({
  onConfigSalva,
  modoBootstrap = false,
  tituloSecao = "PROPRIEDADES DO SISTEMA",
  projetoGerenciado = null,
}) {
  const { user, loading } = useAuth();
  const managerProjectId = obterManagerProjectIdConfigurado();
  const managerProjectLabel = obterManagerProjectLabel();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [config, setConfig] = useState(DEFAULT_SISTEMA_CONFIG);
  const [googleFontsUrlsInput, setGoogleFontsUrlsInput] = useState("");
  const [uploadCampoAtivo, setUploadCampoAtivo] = useState("");
  const [arquivosBrandingSelecionados, setArquivosBrandingSelecionados] = useState({});
  const [iconCollectionsDisponiveis, setIconCollectionsDisponiveis] = useState([]);
  const isManagerProject = isManagerProjectRuntime(config);
  const loginGoogleHabilitado = config?.metodosLoginHabilitados?.google !== false;
  const loginTwitterHabilitado = config?.metodosLoginHabilitados?.twitter !== false;
  const loginEmailSenhaHabilitado =
    config?.metodosLoginHabilitados?.emailSenha !== false;
  const loginPresetId = String(config?.loginPresetId || "manual").toLowerCase();
  const loginPresetSelecionado = getLoginPresetById(loginPresetId);
  const googleFontsUrlsProjeto = Array.isArray(config?.googleFontsUrls)
    ? config.googleFontsUrls
    : [];
  const familiasGoogleFontsDisponiveis = useMemo(() => {
    const coletadas = googleFontsUrlsProjeto.flatMap((url) => extrairFamiliasGoogleFonts(url));
    return Array.from(new Set(coletadas));
  }, [googleFontsUrlsProjeto]);
  const opcoesFonteMensagens = useMemo(() => {
    const atuais = [
      String(config?.mensagemEspacoLoginRestritoFontFamily || "").trim(),
      String(config?.mensagemEspacoAssinanteRestritoFontFamily || "").trim(),
    ].filter(Boolean);

    return Array.from(new Set([...familiasGoogleFontsDisponiveis, ...atuais]));
  }, [
    familiasGoogleFontsDisponiveis,
    config?.mensagemEspacoLoginRestritoFontFamily,
    config?.mensagemEspacoAssinanteRestritoFontFamily,
  ]);
  const projetoGerenciadoKey = String(projetoGerenciado?.systemKey || "").trim().toLowerCase();
  const editandoProjetoExterno =
    !!projetoGerenciadoKey && projetoGerenciadoKey !== managerProjectId;
  const exibindoConfiguracoesProjeto = !isManagerProject || editandoProjetoExterno;
  const tipoExperienciaAtual = String(config?.tipoExperiencia || "multiowner")
    .trim()
    .toLowerCase();
  const projetoOneOwner = tipoExperienciaAtual === "oneowner";
  const bootstrapPrimeiroAdminHabilitado =
    isManagerProject && !!user && !(config?.ownerUid || config?.adminUid);
  const acessoAdminLiberado = modoBootstrap || bootstrapPrimeiroAdminHabilitado || seforAdm(user);
  const modoAcessoProjetoAtual = String(config?.modoAcessoProjeto || "privado_com_login")
    .trim()
    .toLowerCase();
  const exibirDestinoPosLogin =
    modoAcessoProjetoAtual === "privado_com_login" ||
    modoAcessoProjetoAtual === "publico_com_area_restrita";

  const erroPermissao = (error) => {
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    return (
      code.includes("permission-denied") ||
      code.includes("insufficient") ||
      message.includes("missing or insufficient permissions")
    );
  };

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (!isManagerProject) {
        if (ativo) setCarregando(false);
        return;
      }

      if (loading) return;

      if (!user || !seforAdm(user)) {
        if (ativo) setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro("");

      try {
        let configAtual = null;

        if (editandoProjetoExterno) {
          const hostnameProjeto = Array.isArray(projetoGerenciado?.domains)
            ? String(projetoGerenciado.domains[0] || "")
            : "";
          const configGerenciada = await obterConfigProjetoDoGerenciador({
            projectKey: projetoGerenciado?.systemKey || "",
            projectId: projetoGerenciado?.firebaseProjectId || "",
            hostname: hostnameProjeto,
          });

          configAtual = normalizarConfigSistema(
            configGerenciada || {
              tituloSistema:
                projetoGerenciado?.nomeProjeto ||
                projetoGerenciado?.systemKey ||
                DEFAULT_SISTEMA_CONFIG.tituloSistema,
            }
          );
        } else {
          configAtual = await obterConfigSistema();
        }

        if (!ativo) return;
        setConfig(configAtual);
        setGoogleFontsUrlsInput(
          Array.isArray(configAtual?.googleFontsUrls)
            ? configAtual.googleFontsUrls.join("\n")
            : ""
        );

        if (!editandoProjetoExterno) {
          aplicarBrandingNoDocumento(configAtual);
        }
      } catch (error) {
        if (!ativo) return;
        setErro("Nao foi possivel carregar as configuracoes do sistema.");
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
  }, [isManagerProject, loading, user, editandoProjetoExterno, projetoGerenciado]);

  useEffect(() => {
    let ativo = true;

    async function carregarColecoesIcones() {
      if (!isManagerProject || !editandoProjetoExterno) return;
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
  }, [isManagerProject, editandoProjetoExterno]);

  const uploadImagem = async (event, campo) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setArquivosBrandingSelecionados((prev) => ({
      ...prev,
      [campo]: String(arquivo.name || ""),
    }));

    if (!arquivo.type?.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem valido.");
      event.target.value = "";
      return;
    }

    if (arquivo.size > 3 * 1024 * 1024) {
      setErro("Imagem muito grande. Use arquivo de ate 3MB.");
      event.target.value = "";
      return;
    }

    setUploadCampoAtivo(campo);
    setErro("");
    setMensagem("");

    try {
      const upload = await subirImagemBranding({
        file: arquivo,
        campo,
        projetoGerenciadoKey: projetoGerenciado?.systemKey || "",
        currentUid: user?.uid || "",
        currentUser: user || null,
      });
      setConfig((prev) => ({
        ...prev,
        [campo]: upload.url,
        ...(campo === "cardProfileUrl" ? { cardProfilePath: upload.path } : {}),
      }));
      if (!editandoProjetoExterno && campo === "faviconUrl") {
        aplicarBrandingNoDocumento({
          ...config,
          [campo]: upload.url,
        });
      }
      setMensagem("Imagem carregada. Clique em salvar para persistir.");
    } catch (uploadError) {
      const codigo = String(uploadError?.code || "").trim();
      const detalhe = String(uploadError?.message || "").trim();
      setErro(
        detalhe || codigo
          ? `Falha ao carregar imagem${codigo ? ` (${codigo})` : ""}: ${detalhe || "erro desconhecido"}.`
          : "Falha ao carregar imagem."
      );
    } finally {
      setUploadCampoAtivo("");
      event.target.value = "";
    }
  };

  const validarGoogleFontsUrls = () => {
    const urlsValidadas = normalizarGoogleFontsUrlsTexto(googleFontsUrlsInput);
    setConfig((prev) => ({
      ...prev,
      googleFontsUrls: urlsValidadas,
    }));
    setErro("");
    setMensagem(
      urlsValidadas.length
        ? `${urlsValidadas.length} URL(s) de Google Fonts validada(s).`
        : "Nenhuma URL valida de Google Fonts foi detectada."
    );
  };

  const salvar = async () => {
    setSalvando(true);
    setMensagem("");
    setErro("");

    try {
      let configSalva = null;
      const urlsGoogleFontsValidadas = normalizarGoogleFontsUrlsTexto(googleFontsUrlsInput);
      const configParaSalvar = {
        ...config,
        googleFontsUrls: urlsGoogleFontsValidadas,
      };

      if (editandoProjetoExterno) {
        const configNormalizada = normalizarConfigSistema(configParaSalvar);
        const hostnameProjeto = Array.isArray(projetoGerenciado?.domains)
          ? String(projetoGerenciado.domains[0] || "")
          : "";

        try {
          await salvarConfigProjetoNoGerenciador({
            projectKey: projetoGerenciado?.systemKey || "",
            projectId: projetoGerenciado?.firebaseProjectId || "",
            hostname: hostnameProjeto,
            configSistema: configNormalizada,
            atualizadoPorUid: user?.uid || null,
          });
        } catch (saveError) {
          if (!erroPermissao(saveError) || !isManagerProject || !user?.uid) {
            throw saveError;
          }

          // Bootstrap de owner dinamico no projeto gerenciador e nova tentativa.
          const configGerenciadorAtual = await obterConfigSistema();
          await salvarConfigSistemaAdmin({
            ...configGerenciadorAtual,
            ownerUid: user.uid,
            adminUid: user.uid,
          });

          await salvarConfigProjetoNoGerenciador({
            projectKey: projetoGerenciado?.systemKey || "",
            projectId: projetoGerenciado?.firebaseProjectId || "",
            hostname: hostnameProjeto,
            configSistema: configNormalizada,
            atualizadoPorUid: user?.uid || null,
          });
        }

        configSalva = configNormalizada;
        setMensagem("Configuracoes do projeto salvas com sucesso.");
      } else {
        configSalva = await salvarConfigSistemaAdmin({
          ...configParaSalvar,
          ownerUid: user?.uid || null,
          adminUid: user?.uid || null,
        });
        aplicarTemaNoBody(configSalva.temaPadraoSistema);
        aplicarBrandingNoDocumento(configSalva);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sistema-config-atualizada", {
              detail: configSalva,
            })
          );
        }
        setMensagem("Configuracoes salvas com sucesso.");
      }

      setConfig(configSalva);
      setGoogleFontsUrlsInput(
        Array.isArray(configSalva?.googleFontsUrls)
          ? configSalva.googleFontsUrls.join("\n")
          : ""
      );
      if (typeof onConfigSalva === "function") {
        onConfigSalva(configSalva);
      }
    } catch (error) {
      const codigo = String(error?.code || "desconhecido");
      if (erroPermissao(error)) {
        setErro(
          `Falha ao salvar configuracoes por permissao no Firestore (${codigo}). Verifique se o seu UID esta definido como owner no gerenciador.`
        );
      } else {
        setErro(`Falha ao salvar configuracoes (${codigo}).`);
      }
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    setMensagem("");
    setErro("");
    const basePadrao = normalizarConfigSistema({
      ...DEFAULT_SISTEMA_CONFIG,
      tituloSistema:
        projetoGerenciado?.nomeProjeto ||
        projetoGerenciado?.systemKey ||
        DEFAULT_SISTEMA_CONFIG.tituloSistema,
    });
    setConfig(basePadrao);
    setGoogleFontsUrlsInput(
      Array.isArray(basePadrao?.googleFontsUrls) ? basePadrao.googleFontsUrls.join("\n") : ""
    );

    if (!editandoProjetoExterno) {
      aplicarTemaNoBody(DEFAULT_SISTEMA_CONFIG.temaPadraoSistema);
      aplicarBrandingNoDocumento(DEFAULT_SISTEMA_CONFIG);
    }
  };

  if (loading || carregando) {
    return <p>Carregando...</p>;
  }

  if (!isManagerProject) {
    return (
      <div>
        <h2>{tituloSecao}</h2>
        <p>
          Configuracoes centralizadas no Gerenciador de Projetos. Abra o projeto
          <code>{` ${managerProjectLabel} `}</code> para editar.
        </p>
      </div>
    );
  }

  if (!user || !acessoAdminLiberado) {
    return (
      <div>
        <h2>{tituloSecao}</h2>
        <p>Acesso restrito ao owner.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>{tituloSecao}</h2>
      <p>
        {editandoProjetoExterno
          ? "Defina identidade visual, layout e modulos do projeto selecionado."
          : "Defina identidade visual e configuracoes de layout do gerenciador."}
      </p>

      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Identidade do projeto</h3>

        <label htmlFor="tituloSistema">Titulo exibido no navegador</label>
        <input
          id="tituloSistema"
          type="text"
          value={config.tituloSistema}
          onChange={(event) => {
            const novoTitulo = event.target.value;
            setConfig((prev) => ({
              ...prev,
              tituloSistema: novoTitulo,
            }));
            if (!editandoProjetoExterno) {
              aplicarBrandingNoDocumento({
                ...config,
                tituloSistema: novoTitulo,
              });
            }
          }}
          placeholder="Ex: NovoSistema"
          style={{ width: "100%", marginTop: 8 }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={config.exibirBadgeProjetoFirebase !== false}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                exibirBadgeProjetoFirebase: event.target.checked,
              }))
            }
          />
          Exibir caixinha de infraestrutura do projeto (FB/Storage)
        </label>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Mostra no canto da interface o projeto Firebase, hostname atual e bucket de storage em
          uso.
        </p>

        <label htmlFor="logoLoginUrl" style={{ display: "block", marginTop: 12 }}>
          URL da logo do projeto (tela de login)
        </label>
        <input
          id="logoLoginUrl"
          type="text"
          value={config.logoLoginUrl}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              logoLoginUrl: event.target.value,
            }))
          }
          placeholder="https://... ou use o upload abaixo"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="logoUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar arquivo de logo
        </label>
        <input
          id="logoUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "logoLoginUrl")}
          disabled={salvando || uploadCampoAtivo === "logoLoginUrl"}
        />
        {arquivosBrandingSelecionados.logoLoginUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "logoLoginUrl" ? "Enviando arquivo:" : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.logoLoginUrl}
          </p>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          {String(config.logoLoginUrl || "").trim() ? (
            <img
              src={config.logoLoginUrl}
              alt="Preview da logo do projeto"
              style={{ maxWidth: 150, maxHeight: 150, objectFit: "contain" }}
            />
          ) : (
            <p style={{ margin: 0, opacity: 0.7 }}>Nenhuma imagem de login carregada.</p>
          )}
        </div>

        <label htmlFor="loginButtonIconUrl" style={{ display: "block", marginTop: 12 }}>
          URL do icone do botao de login
        </label>
        <input
          id="loginButtonIconUrl"
          type="text"
          value={config.loginButtonIconUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              loginButtonIconUrl: event.target.value,
            }))
          }
          placeholder="https://... ou use o upload abaixo"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="loginButtonIconUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar icone do botao de login
        </label>
        <input
          id="loginButtonIconUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "loginButtonIconUrl")}
          disabled={salvando || uploadCampoAtivo === "loginButtonIconUrl"}
        />
        {arquivosBrandingSelecionados.loginButtonIconUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "loginButtonIconUrl"
              ? "Enviando arquivo:"
              : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.loginButtonIconUrl}
          </p>
        ) : null}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Preview do botao:</span>
          {String(config.loginButtonIconUrl || "").trim() ? (
            <img
              src={config.loginButtonIconUrl}
              alt="Preview do icone do botao de login"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
          ) : (
            <span style={{ opacity: 0.7 }}>Sem icone configurado.</span>
          )}
        </div>

        <label htmlFor="chatButtonIconUrl" style={{ display: "block", marginTop: 12 }}>
          URL do icone do botao de chat
        </label>
        <input
          id="chatButtonIconUrl"
          type="text"
          value={config.chatButtonIconUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              chatButtonIconUrl: event.target.value,
            }))
          }
          placeholder="https://... ou use o upload abaixo"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="chatButtonIconUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar icone do botao de chat
        </label>
        <input
          id="chatButtonIconUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "chatButtonIconUrl")}
          disabled={salvando || uploadCampoAtivo === "chatButtonIconUrl"}
        />
        {arquivosBrandingSelecionados.chatButtonIconUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "chatButtonIconUrl"
              ? "Enviando arquivo:"
              : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.chatButtonIconUrl}
          </p>
        ) : null}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Preview chat:</span>
          {String(config.chatButtonIconUrl || "").trim() ? (
            <img
              src={config.chatButtonIconUrl}
              alt="Preview do icone do botao de chat"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
          ) : (
            <span style={{ opacity: 0.7 }}>Sem icone configurado.</span>
          )}
        </div>

        <label htmlFor="iconSkinPadraoUrl" style={{ display: "block", marginTop: 12 }}>
          URL do avatar padrao de usuario (antes de carregar foto)
        </label>
        <input
          id="iconSkinPadraoUrl"
          type="text"
          value={config.iconSkinPadraoUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              iconSkinPadraoUrl: event.target.value,
            }))
          }
          placeholder="https://... ou use o upload abaixo"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="iconSkinPadraoUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar avatar padrao
        </label>
        <input
          id="iconSkinPadraoUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "iconSkinPadraoUrl")}
          disabled={salvando || uploadCampoAtivo === "iconSkinPadraoUrl"}
        />
        {arquivosBrandingSelecionados.iconSkinPadraoUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "iconSkinPadraoUrl"
              ? "Enviando arquivo:"
              : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.iconSkinPadraoUrl}
          </p>
        ) : null}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Preview avatar padrao:</span>
          {String(config.iconSkinPadraoUrl || "").trim() ? (
            <img
              src={config.iconSkinPadraoUrl}
              alt="Preview do avatar padrao"
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: "50%" }}
            />
          ) : (
            <span style={{ opacity: 0.7 }}>Sem avatar padrao configurado.</span>
          )}
        </div>

        <label htmlFor="faviconUrl" style={{ display: "block", marginTop: 12 }}>
          Icone do navegador (favicon)
        </label>
        <input
          id="faviconUrl"
          type="text"
          value={config.faviconUrl}
          onChange={(event) => {
            const novaFavicon = event.target.value;
            setConfig((prev) => ({
              ...prev,
              faviconUrl: novaFavicon,
            }));
            if (!editandoProjetoExterno) {
              aplicarBrandingNoDocumento({
                ...config,
                faviconUrl: novaFavicon,
              });
            }
          }}
          placeholder="/favicon.ico ou https://..."
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="faviconUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar arquivo de favicon
        </label>
        <input
          id="faviconUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "faviconUrl")}
          disabled={salvando || uploadCampoAtivo === "faviconUrl"}
        />
        {arquivosBrandingSelecionados.faviconUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "faviconUrl" ? "Enviando arquivo:" : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.faviconUrl}
          </p>
        ) : null}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Preview favicon:</span>
          <img
            src={config.faviconUrl || DEFAULT_SISTEMA_CONFIG.faviconUrl}
            alt="Preview favicon"
            style={{ width: 20, height: 20, objectFit: "contain" }}
          />
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Tela de login</h4>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={config.exibirTituloSistemaNoLogin !== false}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                exibirTituloSistemaNoLogin: event.target.checked,
              }))
            }
          />
          Exibir titulo do sistema na tela de login
        </label>

        <label htmlFor="textoLogin" style={{ display: "block", marginTop: 10 }}>
          Frase da tela de login
        </label>
        <input
          id="textoLogin"
          type="text"
          value={config.textoLogin || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              textoLogin: event.target.value,
            }))
          }
          placeholder="Ex: EMBARQUE COM O GOOGLE"
          style={{ width: "100%", marginTop: 8 }}
        />

        <label htmlFor="loginLoadingMode" style={{ display: "block", marginTop: 12 }}>
          Tela de carregamento do login
        </label>
        <select
          id="loginLoadingMode"
          value={String(config.loginLoadingMode || "auto")}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              loginLoadingMode: String(event.target.value || "auto"),
            }))
          }
          style={{ width: "100%", marginTop: 8 }}
        >
          <option value="auto">Automatico (tema)</option>
          <option value="simple">Sem animacao (simples)</option>
          <option value="ritual">Ritual</option>
          <option value="sprite_sheet">Sprite sheet</option>
        </select>

        {String(config.loginLoadingMode || "auto") === "sprite_sheet" ? (
          <>
            <label htmlFor="loginLoadingSpriteUrl" style={{ display: "block", marginTop: 10 }}>
              URL da imagem sprite sheet
            </label>
            <input
              id="loginLoadingSpriteUrl"
              type="text"
              value={config.loginLoadingSpriteUrl || ""}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  loginLoadingSpriteUrl: event.target.value,
                }))
              }
              placeholder="https://... ou use o upload abaixo"
              style={{ width: "100%", marginTop: 8 }}
            />
            <label htmlFor="loginLoadingSpriteUpload" style={{ display: "block", marginTop: 8 }}>
              Carregar imagem sprite sheet
            </label>
            <input
              id="loginLoadingSpriteUpload"
              type="file"
              accept="image/*"
              onChange={(event) => uploadImagem(event, "loginLoadingSpriteUrl")}
              disabled={salvando || uploadCampoAtivo === "loginLoadingSpriteUrl"}
            />
            {arquivosBrandingSelecionados.loginLoadingSpriteUrl ? (
              <p style={{ marginTop: 6, opacity: 0.8 }}>
                {uploadCampoAtivo === "loginLoadingSpriteUrl"
                  ? "Enviando arquivo:"
                  : "Arquivo selecionado:"}{" "}
                {arquivosBrandingSelecionados.loginLoadingSpriteUrl}
              </p>
            ) : null}
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              Formato esperado: sprite horizontal com 8 frames de 128x128 (total 1024x128).
            </p>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span>Preview da sprite:</span>
              {String(config.loginLoadingSpriteUrl || "").trim() ? (
                <img
                  src={config.loginLoadingSpriteUrl}
                  alt="Preview da sprite sheet"
                  style={{
                    width: 128,
                    height: 128,
                    objectFit: "cover",
                    border: "1px solid #ccc",
                  }}
                />
              ) : (
                <span style={{ opacity: 0.7 }}>Sem sprite configurada.</span>
              )}
            </div>
          </>
        ) : null}
      </div>

      {exibindoConfiguracoesProjeto ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Tipo de login</h3>
          <label htmlFor="loginPresetId">Preset de login do projeto</label>
          <select
            id="loginPresetId"
            value={loginPresetId}
            onChange={(event) => {
              const novoPresetId = String(event.target.value || "manual").toLowerCase();
              setConfig((prev) => {
                if (novoPresetId === "manual") {
                  return normalizarConfigSistema({
                    ...prev,
                    loginPresetId: "manual",
                  });
                }
                return normalizarConfigSistema(applyLoginPresetToConfig(prev, novoPresetId));
              });
              setErro("");
              if (novoPresetId === "manual") {
                setMensagem(
                  "Preset manual ativo. A configuracao atual foi mantida e pode ser editada livremente."
                );
              } else {
                const presetLabel = getLoginPresetById(novoPresetId).label;
                setMensagem(
                  `Preset ${presetLabel} aplicado; voce pode ajustar os campos abaixo.`
                );
              }
            }}
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="manual">Manual</option>
            <option value="aly137">ALY-137</option>
          </select>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            {loginPresetSelecionado.id === "manual"
              ? "Manual: define os campos de login individualmente."
              : "Preset aplicado; voce pode ajustar os campos abaixo."}
          </p>
        </div>
      ) : null}

      {editandoProjetoExterno ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Colecoes de icones do projeto</h3>
          <p style={{ marginTop: 0 }}>
            Defina quais colecoes centralizadas este projeto pode usar ao editar espacos.
          </p>
          {!iconCollectionsDisponiveis.length ? (
            <p style={{ opacity: 0.8 }}>
              Nenhuma colecao de icones cadastrada no gerenciador.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {iconCollectionsDisponiveis.map((colecao) => (
                <label
                  key={colecao.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={(config.iconCollectionIds || []).includes(colecao.id)}
                    onChange={() =>
                      setConfig((prev) => ({
                        ...prev,
                        iconCollectionIds: (prev.iconCollectionIds || []).includes(colecao.id)
                          ? (prev.iconCollectionIds || []).filter((id) => id !== colecao.id)
                          : [...(prev.iconCollectionIds || []), colecao.id],
                      }))
                    }
                  />
                  <span>
                    <strong>{colecao.nome}</strong>
                    <span style={{ opacity: 0.75 }}>
                      {` | temas: ${(colecao.themeIds || []).join(", ") || "-"}`}
                    </span>
                    <span style={{ opacity: 0.75 }}>
                      {` | icones: ${(colecao.icons || []).length}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Configuracao de layout</h3>
        <p style={{ marginTop: 0 }}>
          Tema padrao para login e paginas gerais fora do contexto das skins.
        </p>

        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Layout geral / padrao</h4>
        <label htmlFor="temaPadraoSistema">Tema padrao do sistema</label>
        <select
          id="temaPadraoSistema"
          value={config.temaPadraoSistema}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              temaPadraoSistema: event.target.value,
            }))
          }
          style={{ width: "100%", marginTop: 8 }}
        >
          {SYSTEM_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            type="checkbox"
            checked={config?.layoutTema?.headerVisible !== false}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                layoutTema: {
                  ...(prev?.layoutTema || DEFAULT_SISTEMA_CONFIG.layoutTema),
                  headerVisible: event.target.checked,
                },
              }))
            }
          />
          Habilitar cabecalho do projeto
        </label>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Quando habilitado, o cardProfile do cabecalho passa a ser configurado no
          proprio projeto.
        </p>
        <label htmlFor="cardProfileUrl" style={{ display: "block", marginTop: 12 }}>
          URL da imagem do cardProfile
        </label>
        <input
          id="cardProfileUrl"
          type="text"
          value={config.cardProfileUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              cardProfileUrl: event.target.value,
            }))
          }
          placeholder="https://... ou use o upload abaixo"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="cardProfileUpload" style={{ display: "block", marginTop: 8 }}>
          Carregar imagem do cardProfile
        </label>
        <input
          id="cardProfileUpload"
          type="file"
          accept="image/*"
          onChange={(event) => uploadImagem(event, "cardProfileUrl")}
          disabled={salvando || uploadCampoAtivo === "cardProfileUrl"}
        />
        {arquivosBrandingSelecionados.cardProfileUrl ? (
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {uploadCampoAtivo === "cardProfileUrl" ? "Enviando arquivo:" : "Arquivo selecionado:"}{" "}
            {arquivosBrandingSelecionados.cardProfileUrl}
          </p>
        ) : null}
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          {String(config.cardProfileUrl || "").trim() ? (
            <img
              src={config.cardProfileUrl}
              alt="Preview do cardProfile"
              style={{ maxWidth: 160, maxHeight: 160, objectFit: "contain" }}
            />
          ) : (
            <p style={{ margin: 0, opacity: 0.7 }}>Nenhum cardProfile carregado.</p>
          )}
        </div>
        {String(config.cardProfileUrl || "").trim() ? (
          <button
            type="button"
            style={{ marginTop: 8 }}
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                cardProfileUrl: "",
                cardProfilePath: "",
              }))
            }
          >
            Remover cardProfile
          </button>
        ) : null}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            type="checkbox"
            checked={config?.layoutTema?.headerSticky !== false}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                layoutTema: {
                  ...(prev?.layoutTema || DEFAULT_SISTEMA_CONFIG.layoutTema),
                  headerSticky: event.target.checked,
                },
              }))
            }
          />
          Fixar cabecalho ao rolar
        </label>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Desative para deixar o cabecalho seguir o fluxo da pagina em vez de ficar preso no topo.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            type="checkbox"
            checked={config?.layoutTema?.navbarTabsSticky !== false}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                layoutTema: {
                  ...(prev?.layoutTema || DEFAULT_SISTEMA_CONFIG.layoutTema),
                  navbarTabsSticky: event.target.checked,
                },
              }))
            }
          />
          Fixar abas do navbar ao rolar
        </label>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Controle separado para as abas dos espacos, independente do cabecalho principal.
        </p>

        <label htmlFor="cardProfileSizePx" style={{ display: "block", marginTop: 10 }}>
          Tamanho base do cardProfile no cabecalho (px)
        </label>
        <input
          id="cardProfileSizePx"
          type="number"
          min="96"
          max="320"
          value={config?.layoutTema?.cardProfileSizePx ?? 170}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              layoutTema: {
                ...(prev?.layoutTema || DEFAULT_SISTEMA_CONFIG.layoutTema),
                cardProfileSizePx: Number(event.target.value || 170),
              },
            }))
          }
          style={{ width: "100%", marginTop: 8 }}
        />
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Fallback usado quando nao houver imagem suficiente para definir as dimensoes automaticamente.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Layout de login</h4>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={loginPresetId === "aly137"}
            onChange={(event) => {
              const ativarPreset = event.target.checked;
              setConfig((prev) => {
                if (!ativarPreset) {
                  return normalizarConfigSistema({
                    ...prev,
                    loginPresetId: "manual",
                  });
                }
                return normalizarConfigSistema(applyLoginPresetToConfig(prev, "aly137"));
              });
              setErro("");
              setMensagem(
                ativarPreset
                  ? "Preset ALY-137 aplicado; voce pode ajustar os campos abaixo."
                  : "Preset ALY-137 desativado. Configuracao manual ativa."
              );
            }}
          />
          Aplicar preset de login ALY-137
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={loginGoogleHabilitado}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                metodosLoginHabilitados: {
                  ...(prev?.metodosLoginHabilitados ||
                    DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados),
                  google: event.target.checked,
                },
              }))
            }
          />
          Exibir opcao de login com Google
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={loginTwitterHabilitado}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                metodosLoginHabilitados: {
                  ...(prev?.metodosLoginHabilitados ||
                    DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados),
                  twitter: event.target.checked,
                },
              }))
            }
          />
          Exibir opcao de login com X/Twitter
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={loginEmailSenhaHabilitado}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                metodosLoginHabilitados: {
                  ...(prev?.metodosLoginHabilitados ||
                    DEFAULT_SISTEMA_CONFIG.metodosLoginHabilitados),
                  emailSenha: event.target.checked,
                },
              }))
            }
          />
          Exibir opcao de cadastro/login com email e senha
        </label>
        <label htmlFor="larguraIconsLoginPx" style={{ display: "block", marginTop: 10 }}>
          Largura do bloco de login (`iconsLogin`) em px
        </label>
        <input
          id="larguraIconsLoginPx"
          type="number"
          min="120"
          max="640"
          step="1"
          value={config.larguraIconsLoginPx ?? ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              larguraIconsLoginPx: event.target.value,
            }))
          }
          placeholder="Padrao do tema"
          style={{ width: "100%", marginTop: 8 }}
        />
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Deixe vazio para usar a largura padrao do tema. O preset ALY-137 e os metodos Google/X/Email podem ser combinados nesta secao.
        </p>
        <label htmlFor="termosUsoUrl" style={{ display: "block", marginTop: 12 }}>
          URL dos termos de uso
        </label>
        <input
          id="termosUsoUrl"
          type="url"
          value={config.termosUsoUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              termosUsoUrl: event.target.value,
            }))
          }
          placeholder="https://seuprojeto.com/termos"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label htmlFor="politicaPrivacidadeUrl" style={{ display: "block", marginTop: 10 }}>
          URL da politica de privacidade
        </label>
        <input
          id="politicaPrivacidadeUrl"
          type="url"
          value={config.politicaPrivacidadeUrl || ""}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              politicaPrivacidadeUrl: event.target.value,
            }))
          }
          placeholder="https://seuprojeto.com/privacidade"
          style={{ width: "100%", marginTop: 8 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={config.exigirAceiteTermosNoCadastro === true}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                exigirAceiteTermosNoCadastro: event.target.checked,
              }))
            }
          />
          Exigir aceite de termos no cadastro por email e senha
        </label>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Recomendado quando o projeto permite cadastro por email e senha. O aceite vale para o fluxo de criacao de conta, nao para login em conta existente.
        </p>
      </div>

      {exibindoConfiguracoesProjeto ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Modo do projeto</h3>

          <label htmlFor="tipoExperiencia">Tipo de experiencia</label>
          <select
            id="tipoExperiencia"
            value={config.tipoExperiencia || "multiowner"}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                tipoExperiencia: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="multiowner">Multiowner</option>
            <option value="oneowner">Oneowner</option>
          </select>

          <label htmlFor="modoAcessoProjeto" style={{ display: "block", marginTop: 12 }}>
            Modelo de acesso
          </label>
          <select
            id="modoAcessoProjeto"
            value={config.modoAcessoProjeto || "privado_com_login"}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                modoAcessoProjeto: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="privado_com_login">Privado com login</option>
            <option value="publico_com_area_restrita">Publico com area restrita</option>
            <option value="publico_sem_login">Publico sem login de usuario</option>
          </select>

          {exibirDestinoPosLogin ? (
            <>
              <label htmlFor="destinoPosLogin" style={{ display: "block", marginTop: 12 }}>
                Destino apos login
              </label>
              <select
                id="destinoPosLogin"
                value={config.destinoPosLogin || "home_skin_usuario"}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    destinoPosLogin: String(event.target.value || "home_skin_usuario"),
                  }))
                }
                style={{ width: "100%", marginTop: 8 }}
              >
                <option value="home_central_projeto">Home central do projeto</option>
                <option value="home_skin_usuario">Home skin do usuario</option>
              </select>
              <p style={{ marginTop: 8, opacity: 0.85 }}>
                Home central: apos logar, abre <code>/</code> (ou <code>/home</code> em oneowner
                publica). Home skin: mantem fluxo direto para a skin/perfil do usuario.
              </p>
            </>
          ) : null}

          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Em projetos <code>oneowner</code> com acesso publico, a pagina principal fica em{" "}
            <code>/</code>, <code>/login</code> continua para usuarios comuns e o login owner usa{" "}
            <code>/loginowner</code>.
          </p>

          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Mensagens de restricao de acesso</h4>
          <label htmlFor="googleFontsUrls" style={{ display: "block", marginTop: 8 }}>
            URLs do Google Fonts (1 por linha)
          </label>
          <textarea
            id="googleFontsUrls"
            rows={3}
            value={googleFontsUrlsInput}
            onChange={(event) => {
              setGoogleFontsUrlsInput(event.target.value);
            }}
            placeholder="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
            style={{ width: "100%", marginTop: 8 }}
          />
          <button
            type="button"
            onClick={validarGoogleFontsUrls}
            disabled={salvando}
            style={{ marginTop: 8 }}
          >
            Validar URLs de fontes
          </button>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Adicione os links CSS do Google Fonts para liberar selecao de fonte nas frases abaixo.
          </p>
          {familiasGoogleFontsDisponiveis.length ? (
            <p style={{ marginTop: 4, opacity: 0.85 }}>
              Fontes detectadas: {familiasGoogleFontsDisponiveis.join(", ")}
            </p>
          ) : (
            <p style={{ marginTop: 4, opacity: 0.75 }}>
              Nenhuma fonte detectada ainda. Cole o link CSS do Google Fonts (URL, &lt;link&gt; ou @import).
            </p>
          )}

          <label
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
          >
            <input
              type="checkbox"
              checked={config.exibirBotaoLoginMensagemRestricao !== false}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  exibirBotaoLoginMensagemRestricao: event.target.checked,
                }))
              }
            />
            Exibir botao de login apos mensagem de restricao (quando exigir login)
          </label>

          <label
            htmlFor="mensagemRestricaoAvatarUrl"
            style={{ display: "block", marginTop: 10 }}
          >
            URL da imagem do balao de restricao
          </label>
          <input
            id="mensagemRestricaoAvatarUrl"
            type="text"
            value={config.mensagemRestricaoAvatarUrl || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                mensagemRestricaoAvatarUrl: event.target.value,
              }))
            }
            placeholder="https://... ou use o upload abaixo"
            style={{ width: "100%", marginTop: 8 }}
          />
          <label htmlFor="mensagemRestricaoAvatarUpload" style={{ display: "block", marginTop: 8 }}>
            Carregar imagem do balao de restricao
          </label>
          <input
            id="mensagemRestricaoAvatarUpload"
            type="file"
            accept="image/*"
            onChange={(event) => uploadImagem(event, "mensagemRestricaoAvatarUrl")}
            disabled={salvando || uploadCampoAtivo === "mensagemRestricaoAvatarUrl"}
          />
          {arquivosBrandingSelecionados.mensagemRestricaoAvatarUrl ? (
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              {uploadCampoAtivo === "mensagemRestricaoAvatarUrl"
                ? "Enviando arquivo:"
                : "Arquivo selecionado:"}{" "}
              {arquivosBrandingSelecionados.mensagemRestricaoAvatarUrl}
            </p>
          ) : null}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Preview:</span>
            {String(config.mensagemRestricaoAvatarUrl || "").trim() ? (
              <img
                src={config.mensagemRestricaoAvatarUrl}
                alt="Preview imagem do balao de restricao"
                style={{
                  width: 44,
                  height: 44,
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: "1px solid #ccc",
                }}
              />
            ) : (
              <span style={{ opacity: 0.7 }}>Sem imagem configurada.</span>
            )}
          </div>

          <label
            htmlFor="mensagemEspacoLoginRestrito"
            style={{ display: "block", marginTop: 8 }}
          >
            Frase para aba que exige login
          </label>
          <input
            id="mensagemEspacoLoginRestrito"
            type="text"
            value={config.mensagemEspacoLoginRestrito || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                mensagemEspacoLoginRestrito: event.target.value,
              }))
            }
            placeholder="Este {nomeEspacoSingular} requer login para visualizar o conteudo."
            style={{ width: "100%", marginTop: 8 }}
          />
          <label
            htmlFor="mensagemEspacoLoginRestritoFontFamily"
            style={{ display: "block", marginTop: 8 }}
          >
            Fonte da frase de login restrito
          </label>
          <select
            id="mensagemEspacoLoginRestritoFontFamily"
            value={config.mensagemEspacoLoginRestritoFontFamily || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                mensagemEspacoLoginRestritoFontFamily: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="">Fonte padrao do tema</option>
            {opcoesFonteMensagens.map((fontFamily) => (
              <option key={`login-font-${fontFamily}`} value={fontFamily}>
                {fontFamily}
              </option>
            ))}
          </select>

          <label
            htmlFor="mensagemEspacoAssinanteRestrito"
            style={{ display: "block", marginTop: 10 }}
          >
            Frase para aba exclusiva de assinantes
          </label>
          <input
            id="mensagemEspacoAssinanteRestrito"
            type="text"
            value={config.mensagemEspacoAssinanteRestrito || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                mensagemEspacoAssinanteRestrito: event.target.value,
              }))
            }
            placeholder="Este {nomeEspacoSingular} requer assinatura para visualizar o conteudo."
            style={{ width: "100%", marginTop: 8 }}
          />
          <label
            htmlFor="mensagemEspacoAssinanteRestritoFontFamily"
            style={{ display: "block", marginTop: 8 }}
          >
            Fonte da frase de assinante restrito
          </label>
          <select
            id="mensagemEspacoAssinanteRestritoFontFamily"
            value={config.mensagemEspacoAssinanteRestritoFontFamily || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                mensagemEspacoAssinanteRestritoFontFamily: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="">Fonte padrao do tema</option>
            {opcoesFonteMensagens.map((fontFamily) => (
              <option key={`assinante-font-${fontFamily}`} value={fontFamily}>
                {fontFamily}
              </option>
            ))}
          </select>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Placeholder disponivel: <code>{"{nomeEspacoSingular}"}</code>.
          </p>

          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Status das solicitacoes</h4>
          <label
            htmlFor="solicitacaoStatusAguardandoSpriteUrl"
            style={{ display: "block", marginTop: 8 }}
          >
            Sprite para status aguardando confirmacao
          </label>
          <input
            id="solicitacaoStatusAguardandoSpriteUrl"
            type="text"
            value={config.solicitacaoStatusAguardandoSpriteUrl || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                solicitacaoStatusAguardandoSpriteUrl: event.target.value,
              }))
            }
            placeholder="https://... ou use o upload abaixo"
            style={{ width: "100%", marginTop: 8 }}
          />
          <label
            htmlFor="solicitacaoStatusAguardandoSpriteUpload"
            style={{ display: "block", marginTop: 8 }}
          >
            Carregar sprite de aguardando
          </label>
          <input
            id="solicitacaoStatusAguardandoSpriteUpload"
            type="file"
            accept="image/*"
            onChange={(event) => uploadImagem(event, "solicitacaoStatusAguardandoSpriteUrl")}
            disabled={salvando || uploadCampoAtivo === "solicitacaoStatusAguardandoSpriteUrl"}
          />
          {arquivosBrandingSelecionados.solicitacaoStatusAguardandoSpriteUrl ? (
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              {uploadCampoAtivo === "solicitacaoStatusAguardandoSpriteUrl"
                ? "Enviando arquivo:"
                : "Arquivo selecionado:"}{" "}
              {arquivosBrandingSelecionados.solicitacaoStatusAguardandoSpriteUrl}
            </p>
          ) : null}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Preview sprite:</span>
            {String(config.solicitacaoStatusAguardandoSpriteUrl || "").trim() ? (
              <img
                src={config.solicitacaoStatusAguardandoSpriteUrl}
                alt="Preview sprite aguardando confirmacao"
                style={{
                  width: 84,
                  height: 84,
                  objectFit: "cover",
                  border: "1px solid #ccc",
                }}
              />
            ) : (
              <span style={{ opacity: 0.7 }}>Sem sprite configurada.</span>
            )}
          </div>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Formato esperado: sprite horizontal com 8 frames de 128x128.
          </p>

          <label
            htmlFor="solicitacaoStatusConfirmadoIconUrl"
            style={{ display: "block", marginTop: 10 }}
          >
            Icone para status pagamento confirmado
          </label>
          <input
            id="solicitacaoStatusConfirmadoIconUrl"
            type="text"
            value={config.solicitacaoStatusConfirmadoIconUrl || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                solicitacaoStatusConfirmadoIconUrl: event.target.value,
              }))
            }
            placeholder="https://... ou use o upload abaixo"
            style={{ width: "100%", marginTop: 8 }}
          />
          <label
            htmlFor="solicitacaoStatusConfirmadoIconUpload"
            style={{ display: "block", marginTop: 8 }}
          >
            Carregar icone de confirmado
          </label>
          <input
            id="solicitacaoStatusConfirmadoIconUpload"
            type="file"
            accept="image/*"
            onChange={(event) => uploadImagem(event, "solicitacaoStatusConfirmadoIconUrl")}
            disabled={salvando || uploadCampoAtivo === "solicitacaoStatusConfirmadoIconUrl"}
          />
          {arquivosBrandingSelecionados.solicitacaoStatusConfirmadoIconUrl ? (
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              {uploadCampoAtivo === "solicitacaoStatusConfirmadoIconUrl"
                ? "Enviando arquivo:"
                : "Arquivo selecionado:"}{" "}
              {arquivosBrandingSelecionados.solicitacaoStatusConfirmadoIconUrl}
            </p>
          ) : null}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Preview confirmado:</span>
            {String(config.solicitacaoStatusConfirmadoIconUrl || "").trim() ? (
              <img
                src={config.solicitacaoStatusConfirmadoIconUrl}
                alt="Preview icone pagamento confirmado"
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "contain",
                  border: "1px solid #ccc",
                }}
              />
            ) : (
              <span style={{ opacity: 0.7 }}>Sem icone configurado.</span>
            )}
          </div>

          {projetoOneOwner ? (
            <>
              <label htmlFor="ownerUidProjeto" style={{ display: "block", marginTop: 12 }}>
                UID do owner do projeto
              </label>
              <input
                id="ownerUidProjeto"
                type="text"
                value={config.ownerUid || config.adminUid || ""}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    ownerUid: event.target.value,
                    adminUid: event.target.value,
                  }))
                }
                placeholder="UID do Firebase Auth"
                style={{ width: "100%", marginTop: 8 }}
              />
              <label htmlFor="ownerEmailProjeto" style={{ display: "block", marginTop: 10 }}>
                Email do owner do projeto
              </label>
              <input
                id="ownerEmailProjeto"
                type="email"
                value={config.ownerEmail || config.adminEmail || ""}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    ownerEmail: event.target.value,
                    adminEmail: event.target.value,
                  }))
                }
                placeholder="owner@seuprojeto.com"
                style={{ width: "100%", marginTop: 8 }}
              />
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Em <code>oneowner</code>, somente este UID ou email pode entrar em{" "}
                <code>/loginowner</code> e acessar <code>/menu/owner</code>.
              </p>
            </>
          ) : (
            <p style={{ marginTop: 10, opacity: 0.8 }}>
              Em <code>multiowner</code>, o owner operacional e o projeto{" "}
              <code>{managerProjectLabel}</code>; nao e necessario configurar UID/email de owner aqui.
            </p>
          )}
        </div>
      ) : null}

      {exibindoConfiguracoesProjeto ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nomenclatura e limites</h3>

          <label htmlFor="nomeSkinSingular">Nome singular da skin</label>
          <input
            id="nomeSkinSingular"
            type="text"
            value={config.nomeSkinSingular}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeSkinSingular: event.target.value,
              }))
            }
            placeholder="Ex: perfil"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="nomeSkinPlural" style={{ display: "block", marginTop: 10 }}>
            Nome plural da skin
          </label>
          <input
            id="nomeSkinPlural"
            type="text"
            value={config.nomeSkinPlural}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeSkinPlural: event.target.value,
              }))
            }
            placeholder="Ex: perfis"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="nomeEspacoSingular" style={{ display: "block", marginTop: 10 }}>
            Nome singular de espaco
          </label>
          <input
            id="nomeEspacoSingular"
            type="text"
            value={config.nomeEspacoSingular || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeEspacoSingular: event.target.value,
              }))
            }
            placeholder="Ex: ambiente"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="nomeEspacoPlural" style={{ display: "block", marginTop: 10 }}>
            Nome plural de espaco
          </label>
          <input
            id="nomeEspacoPlural"
            type="text"
            value={config.nomeEspacoPlural || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeEspacoPlural: event.target.value,
              }))
            }
            placeholder="Ex: ambientes"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="nomeBlocoSingular" style={{ display: "block", marginTop: 10 }}>
            Nome singular de bloco
          </label>
          <input
            id="nomeBlocoSingular"
            type="text"
            value={config.nomeBlocoSingular || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeBlocoSingular: event.target.value,
              }))
            }
            placeholder="Ex: item"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="nomeBlocoPlural" style={{ display: "block", marginTop: 10 }}>
            Nome plural de bloco
          </label>
          <input
            id="nomeBlocoPlural"
            type="text"
            value={config.nomeBlocoPlural || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                nomeBlocoPlural: event.target.value,
              }))
            }
            placeholder="Ex: itens"
            style={{ width: "100%", marginTop: 8 }}
          />

          <label htmlFor="limiteSkinsPorUsuario" style={{ display: "block", marginTop: 10 }}>
            Quantidade de skins por usuario
          </label>
          <select
            id="limiteSkinsPorUsuario"
            value={config.limiteSkinsPorUsuario}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                limiteSkinsPorUsuario: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="1">Apenas 1</option>
            <option value="ilimitado">Ilimitado</option>
          </select>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Administradores sempre podem criar quantidade ilimitada.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={!!config.permitirTemasSkinSecundarios}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  permitirTemasSkinSecundarios: event.target.checked,
                }))
              }
            />
            Permitir temas secundarios de skin
          </label>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Quando desativado, todas as skins herdam automaticamente o tema base da familia do
            tema do sistema.
          </p>
        </div>
      ) : null}

      {exibindoConfiguracoesProjeto ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Modulos do sistema</h3>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={!!config.chatHabilitado}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  chatHabilitado: event.target.checked,
                }))
              }
            />
            Habilitar sistema de chat
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={!!config.livesHabilitadas}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  livesHabilitadas: event.target.checked,
                }))
              }
            />
            Habilitar blocos do tipo Live
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!config.mercadoPagoHabilitado}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  mercadoPagoHabilitado: event.target.checked,
                }))
              }
            />
            Habilitar integracao com Mercado Pago
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!config.pixManualHabilitado}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  pixManualHabilitado: event.target.checked,
                }))
              }
            />
            Habilitar pagamento manual por PIX (alternativa ao Mercado Pago)
          </label>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            O PIX manual funciona como alternativa ao Mercado Pago para conteudos de comprador.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!config.blocoCardsHabilitado}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  blocoCardsHabilitado: event.target.checked,
                }))
              }
            />
            Habilitar conteudo de bloco tipo Card
          </label>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuracoes"}
        </button>
        <button onClick={restaurarPadrao} disabled={salvando}>
          Restaurar padrao
        </button>
      </div>

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
      {!!erro && <p style={{ marginTop: 10 }}>{erro}</p>}
    </div>
  );
}
export default PropriedadesSistema;
