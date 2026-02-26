import { useEffect, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import { activeFirebaseProjectKey } from "../../../Banco/init-firebase";
import { SYSTEM_THEMES } from "../../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  normalizarConfigSistema,
  obterConfigSistema,
  salvarConfigSistemaAdmin,
} from "../../Sistema/configSistema";
import {
  applyLoginPresetToConfig,
  getLoginPresetById,
} from "../../Sistema/loginPresets";
import {
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
} from "../../Sistema/gerenciadorProjetosApi";

function lerArquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function PropriedadesSistema({
  onConfigSalva,
  modoBootstrap = false,
  tituloSecao = "PROPRIEDADES DO SISTEMA",
  projetoGerenciado = null,
}) {
  const { user, loading } = useAuth();
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [config, setConfig] = useState(DEFAULT_SISTEMA_CONFIG);
  const [uploadCampoAtivo, setUploadCampoAtivo] = useState("");
  const loginGoogleHabilitado = config?.metodosLoginHabilitados?.google !== false;
  const loginTwitterHabilitado = config?.metodosLoginHabilitados?.twitter !== false;
  const loginEmailSenhaHabilitado =
    config?.metodosLoginHabilitados?.emailSenha !== false;
  const loginPresetId = String(config?.loginPresetId || "manual").toLowerCase();
  const loginPresetSelecionado = getLoginPresetById(loginPresetId);
  const projetoGerenciadoKey = String(projetoGerenciado?.systemKey || "").trim().toLowerCase();
  const editandoProjetoExterno =
    !!projetoGerenciadoKey && projetoGerenciadoKey !== "gerenciador-aly";
  const exibindoConfiguracoesProjeto = !isManagerProject || editandoProjetoExterno;
  const bootstrapPrimeiroAdminHabilitado =
    isManagerProject && !!user && !config?.adminUid;
  const acessoAdminLiberado = modoBootstrap || bootstrapPrimeiroAdminHabilitado || seforAdm(user);

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

  const uploadImagem = async (event, campo) => {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    if (!arquivo.type?.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem valido.");
      return;
    }

    if (arquivo.size > 850 * 1024) {
      setErro("Imagem muito grande. Use arquivo de ate 850KB.");
      return;
    }

    setUploadCampoAtivo(campo);
    setErro("");
    setMensagem("");

    try {
      const dataUrl = await lerArquivoComoDataUrl(arquivo);
      setConfig((prev) => ({
        ...prev,
        [campo]: dataUrl,
      }));
      if (!editandoProjetoExterno && (campo === "faviconUrl" || campo === "tituloSistema")) {
        aplicarBrandingNoDocumento({
          ...config,
          [campo]: dataUrl,
        });
      }
      setMensagem("Imagem carregada. Clique em salvar para persistir.");
    } catch (uploadError) {
      setErro("Falha ao carregar imagem.");
    } finally {
      setUploadCampoAtivo("");
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setMensagem("");
    setErro("");

    try {
      let configSalva = null;

      if (editandoProjetoExterno) {
        const configNormalizada = normalizarConfigSistema(config);
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

          // Bootstrap de admin dinamico no projeto gerenciador e nova tentativa.
          const configGerenciadorAtual = await obterConfigSistema();
          await salvarConfigSistemaAdmin({
            ...configGerenciadorAtual,
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
          ...config,
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
      if (typeof onConfigSalva === "function") {
        onConfigSalva(configSalva);
      }
    } catch (error) {
      const codigo = String(error?.code || "desconhecido");
      if (erroPermissao(error)) {
        setErro(
          `Falha ao salvar configuracoes por permissao no Firestore (${codigo}). Verifique se o seu UID esta definido como admin no gerenciador.`
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
          <code> gerenciador-aly </code> para editar.
        </p>
      </div>
    );
  }

  if (!user || !acessoAdminLiberado) {
    return (
      <div>
        <h2>{tituloSecao}</h2>
        <p>Acesso restrito ao administrador.</p>
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
          placeholder="Ex: Obeyon"
          style={{ width: "100%", marginTop: 8 }}
        />

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
          placeholder="/logoNeon.png ou https://..."
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

        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          <img
            src={config.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl}
            alt="Preview da logo do projeto"
            style={{ maxWidth: 150, maxHeight: 150, objectFit: "contain" }}
          />
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
      </div>

      {exibindoConfiguracoesProjeto ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Modo do projeto</h3>

          <label htmlFor="tipoExperiencia">Tipo de experiencia</label>
          <select
            id="tipoExperiencia"
            value={config.tipoExperiencia || "multipage"}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                tipoExperiencia: event.target.value,
              }))
            }
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="multipage">Multipage</option>
            <option value="onepage">Onepage</option>
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

          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Em <code>publico_sem_login</code>, a pagina principal fica publica e o login admin passa
            a usar a rota <code>/login</code>.
          </p>

          <label htmlFor="adminUidProjeto" style={{ display: "block", marginTop: 12 }}>
            UID do administrador do projeto
          </label>
          <input
            id="adminUidProjeto"
            type="text"
            value={config.adminUid || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                adminUid: event.target.value,
              }))
            }
            placeholder="UID do Firebase Auth"
            style={{ width: "100%", marginTop: 8 }}
          />
          <label htmlFor="adminEmailProjeto" style={{ display: "block", marginTop: 10 }}>
            Email do administrador do projeto
          </label>
          <input
            id="adminEmailProjeto"
            type="email"
            value={config.adminEmail || ""}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                adminEmail: event.target.value,
              }))
            }
            placeholder="admin@seuprojeto.com"
            style={{ width: "100%", marginTop: 8 }}
          />
          <p style={{ marginTop: 6, opacity: 0.85 }}>
            No modo <code>publico_sem_login</code>, somente este UID ou email pode entrar em{" "}
            <code>/login</code> e acessar <code>/menu/admin</code>.
          </p>
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
