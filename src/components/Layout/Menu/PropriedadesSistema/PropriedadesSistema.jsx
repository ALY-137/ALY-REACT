import { useEffect, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import { SYSTEM_THEMES } from "../../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  obterConfigSistema,
  salvarConfigSistemaAdmin,
} from "../../Sistema/configSistema";

function lerArquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function PropriedadesSistema({ onConfigSalva, modoBootstrap = false }) {
  const { user, loading } = useAuth();
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

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (loading) return;

      if (!user || !seforAdm(user)) {
        if (ativo) setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro("");

      try {
        const configAtual = await obterConfigSistema();
        if (!ativo) return;
        setConfig(configAtual);
        aplicarBrandingNoDocumento(configAtual);
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
  }, [loading, user]);

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
      if (campo === "faviconUrl" || campo === "tituloSistema") {
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
      const configSalva = await salvarConfigSistemaAdmin({
        ...config,
        adminUid: user?.uid || null,
      });
      setConfig(configSalva);
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
      if (typeof onConfigSalva === "function") {
        onConfigSalva(configSalva);
      }
    } catch (error) {
      setErro("Falha ao salvar configuracoes. Verifique sua permissao de administrador.");
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    setMensagem("");
    setErro("");
    setConfig(DEFAULT_SISTEMA_CONFIG);
    aplicarTemaNoBody(DEFAULT_SISTEMA_CONFIG.temaPadraoSistema);
    aplicarBrandingNoDocumento(DEFAULT_SISTEMA_CONFIG);
  };

  if (loading || carregando) {
    return <p>Carregando...</p>;
  }

  if (!user || (!modoBootstrap && !seforAdm(user))) {
    return (
      <div>
        <h2>PROPRIEDADES DO SISTEMA</h2>
        <p>Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>PROPRIEDADES DO SISTEMA</h2>
      <p>
        Defina comportamento global, identidade visual e modulos ativos do projeto.
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
            aplicarBrandingNoDocumento({
              ...config,
              tituloSistema: novoTitulo,
            });
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
            aplicarBrandingNoDocumento({
              ...config,
              faviconUrl: novaFavicon,
            });
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
          Deixe vazio para usar a largura padrao do tema. Novos metodos de login poderao ser adicionados nesta mesma secao.
        </p>
      </div>

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
