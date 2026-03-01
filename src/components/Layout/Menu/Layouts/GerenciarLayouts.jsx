import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  obterConfigSistema,
  salvarConfigSistemaAdmin,
} from "../../Sistema/configSistema";
import {
  DEFAULT_LAYOUT_THEME_OVERRIDES,
  LAYOUT_STANDARD_OPERATIONS,
  SYSTEM_THEMES,
  obterConfigLayoutTemaSkin,
  obterTemaSkinPadrao,
} from "../../Temas/themesRegistry";

function resumoTemaBase(temaSistemaId) {
  const temaSkinBase = obterTemaSkinPadrao(temaSistemaId);
  return obterConfigLayoutTemaSkin(temaSkinBase);
}

function textoMenuPosition(valor) {
  if (valor === "top") return "Abas superiores";
  return "Gaveta";
}

function textoSurfaceDensity(valor) {
  if (valor === "airy") return "Arejado";
  if (valor === "comfortable") return "Confortavel";
  return "Compacto";
}

export default function GerenciarLayouts() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [config, setConfig] = useState(DEFAULT_SISTEMA_CONFIG);

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
      } catch {
        if (!ativo) return;
        setErro("Nao foi possivel carregar as configuracoes de layout.");
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
  }, [loading, user]);

  const temaAtualId = String(
    config?.temaPadraoSistema || DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
  ).toUpperCase();
  const temaAtualDef = useMemo(
    () => SYSTEM_THEMES.find((tema) => tema.id === temaAtualId) || SYSTEM_THEMES[0],
    [temaAtualId]
  );

  const layoutEfetivo = useMemo(() => {
    const temaSkinBase = obterTemaSkinPadrao(temaAtualId);
    return obterConfigLayoutTemaSkin(temaSkinBase, config?.layoutTema);
  }, [temaAtualId, config?.layoutTema]);

  const atualizarLayoutTema = (campo, valor) => {
    setConfig((prev) => ({
      ...prev,
      layoutTema: {
        ...(prev?.layoutTema || DEFAULT_LAYOUT_THEME_OVERRIDES),
        [campo]: valor,
      },
    }));
  };

  const salvar = async () => {
    setSalvando(true);
    setMensagem("");
    setErro("");

    try {
      const configSalva = await salvarConfigSistemaAdmin({
        ...config,
        adminUid: config?.adminUid || user?.uid || null,
      });
      setConfig(configSalva);
      aplicarTemaNoBody(configSalva.temaPadraoSistema);
      aplicarBrandingNoDocumento(configSalva);
      window.dispatchEvent(
        new CustomEvent("sistema-config-atualizada", {
          detail: configSalva,
        })
      );
      setMensagem("Layout salvo com sucesso.");
    } catch (error) {
      setErro(error?.message || "Falha ao salvar configuracoes de layout.");
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadraoLayout = () => {
    setMensagem("");
    setErro("");
    setConfig((prev) => ({
      ...prev,
      layoutTema: { ...DEFAULT_LAYOUT_THEME_OVERRIDES },
    }));
  };

  if (loading || carregando) {
    return <p>Carregando...</p>;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>GERENCIAR LAYOUTS</h2>
        <p>Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>GERENCIAR LAYOUTS</h2>
      <p>
        Catalogue layouts base do sistema e padronize os overrides de tema que o
        runtime consegue aplicar hoje.
      </p>

      {erro ? <p>{erro}</p> : null}
      {mensagem ? <p>{mensagem}</p> : null}

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Layouts disponiveis</h3>
        <p style={{ marginTop: 0 }}>
          {`Tema ativo no gerenciador: ${temaAtualDef?.label || temaAtualId}`}
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {SYSTEM_THEMES.map((tema) => {
            const resumo = resumoTemaBase(tema.id);
            const ativo = tema.id === temaAtualId;

            return (
              <div
                key={tema.id}
                style={{
                  border: ativo ? "1px solid #7e0eff" : "1px solid #666",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{tema.label}</strong>
                    <p style={{ margin: "4px 0 0 0", opacity: 0.8 }}>
                      {tema.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        temaPadraoSistema: tema.id,
                      }))
                    }
                  >
                    {ativo ? "Layout ativo" : "Usar este layout"}
                  </button>
                </div>
                <p style={{ margin: "10px 0 0 0" }}>
                  {`Menu base: ${textoMenuPosition(resumo.menuPosition)} | Densidade: ${textoSurfaceDensity(
                    resumo.surfaceDensity
                  )} | Frame: ${resumo.frameMaxWidth}px | Margem: ${resumo.viewportMargin}px`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Operacoes padronizadas do tema</h3>
        <p style={{ marginTop: 0 }}>
          Esses ajustes formam a camada comum que qualquer layout do sistema pode
          respeitar sem precisar nascer como tema novo.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {LAYOUT_STANDARD_OPERATIONS.map((operacao) => (
            <div
              key={operacao.id}
              style={{ border: "1px solid #666", borderRadius: 8, padding: 10 }}
            >
              <strong>{operacao.label}</strong>
              <p style={{ margin: "4px 0 0 0", opacity: 0.8 }}>
                {operacao.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #999", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Overrides ativos no gerenciador</h3>
        <p style={{ marginTop: 0 }}>
          {`Layout efetivo atual: menu ${textoMenuPosition(
            layoutEfetivo.menuPosition
          ).toLowerCase()}, densidade ${textoSurfaceDensity(
            layoutEfetivo.surfaceDensity
          ).toLowerCase()}, cabecalho ${
            layoutEfetivo.headerVisible ? "visivel" : "oculto"
          }, altura ${layoutEfetivo.headerHeightPx}px, cabecalho ${
            layoutEfetivo.headerSticky ? "fixo" : "solto"
          }, abas ${layoutEfetivo.navbarTabsSticky ? "fixas" : "soltas"}.`}
        </p>

        <label htmlFor="temaPadraoSistema">Familia de layout</label>
        <select
          id="temaPadraoSistema"
          value={temaAtualId}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              temaPadraoSistema: event.target.value,
            }))
          }
          style={{ width: "100%", marginTop: 6 }}
        >
          {SYSTEM_THEMES.map((tema) => (
            <option key={tema.id} value={tema.id}>
              {tema.label}
            </option>
          ))}
        </select>

        <label htmlFor="menuPositionOverride" style={{ display: "block", marginTop: 10 }}>
          Posicao do menu
        </label>
        <select
          id="menuPositionOverride"
          value={config?.layoutTema?.menuPositionOverride || "inherit"}
          onChange={(event) =>
            atualizarLayoutTema("menuPositionOverride", event.target.value)
          }
          style={{ width: "100%", marginTop: 6 }}
        >
          <option value="inherit">Herdar do layout base</option>
          <option value="drawer">Forcar gaveta</option>
          <option value="top">Forcar menu superior</option>
        </select>

        <label htmlFor="surfaceDensityOverride" style={{ display: "block", marginTop: 10 }}>
          Densidade da interface
        </label>
        <select
          id="surfaceDensityOverride"
          value={config?.layoutTema?.surfaceDensityOverride || "inherit"}
          onChange={(event) =>
            atualizarLayoutTema("surfaceDensityOverride", event.target.value)
          }
          style={{ width: "100%", marginTop: 6 }}
        >
          <option value="inherit">Herdar do layout base</option>
          <option value="compact">Compacto</option>
          <option value="comfortable">Confortavel</option>
          <option value="airy">Arejado</option>
        </select>

        <label htmlFor="frameMaxWidth" style={{ display: "block", marginTop: 10 }}>
          Largura maxima do frame (px)
        </label>
        <input
          id="frameMaxWidth"
          type="number"
          min="720"
          max="1600"
          value={config?.layoutTema?.frameMaxWidth ?? ""}
          onChange={(event) =>
            atualizarLayoutTema(
              "frameMaxWidth",
              event.target.value === "" ? null : Number(event.target.value)
            )
          }
          placeholder="Herdar do layout base"
          style={{ width: "100%", marginTop: 6 }}
        />

        <label htmlFor="viewportMargin" style={{ display: "block", marginTop: 10 }}>
          Margem do viewport (px)
        </label>
        <input
          id="viewportMargin"
          type="number"
          min="4"
          max="40"
          value={config?.layoutTema?.viewportMargin ?? ""}
          onChange={(event) =>
            atualizarLayoutTema(
              "viewportMargin",
              event.target.value === "" ? null : Number(event.target.value)
            )
          }
          placeholder="Herdar do layout base"
          style={{ width: "100%", marginTop: 6 }}
        />

        <label htmlFor="headerHeightPx" style={{ display: "block", marginTop: 10 }}>
          Altura do cabecalho (px)
        </label>
        <input
          id="headerHeightPx"
          type="number"
          min="32"
          max="160"
          value={config?.layoutTema?.headerHeightPx ?? 40}
          onChange={(event) =>
            atualizarLayoutTema("headerHeightPx", Number(event.target.value || 40))
          }
          style={{ width: "100%", marginTop: 6 }}
        />

        <label htmlFor="cardProfileShape" style={{ display: "block", marginTop: 10 }}>
          Forma do card profile
        </label>
        <select
          id="cardProfileShape"
          value={config?.layoutTema?.cardProfileShape || "round"}
          onChange={(event) =>
            atualizarLayoutTema("cardProfileShape", event.target.value)
          }
          style={{ width: "100%", marginTop: 6 }}
        >
          <option value="round">Redondo</option>
          <option value="square">Quadrado</option>
        </select>

        <label
          htmlFor="headerVisible"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          <input
            id="headerVisible"
            type="checkbox"
            checked={config?.layoutTema?.headerVisible !== false}
            onChange={(event) =>
              atualizarLayoutTema("headerVisible", event.target.checked)
            }
          />
          Cabecalho visivel
        </label>
        <label
          htmlFor="headerSticky"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            id="headerSticky"
            type="checkbox"
            checked={config?.layoutTema?.headerSticky !== false}
            onChange={(event) =>
              atualizarLayoutTema("headerSticky", event.target.checked)
            }
          />
          Fixar cabecalho ao rolar
        </label>
        <label
          htmlFor="navbarTabsSticky"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            id="navbarTabsSticky"
            type="checkbox"
            checked={config?.layoutTema?.navbarTabsSticky !== false}
            onChange={(event) =>
              atualizarLayoutTema("navbarTabsSticky", event.target.checked)
            }
          />
          Fixar abas do navbar ao rolar
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar layout"}
          </button>
          <button type="button" onClick={restaurarPadraoLayout} disabled={salvando}>
            Restaurar padrao do layout
          </button>
        </div>
      </div>
    </div>
  );
}
