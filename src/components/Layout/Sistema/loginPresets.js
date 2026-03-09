const LOGIN_PRESETS = {
  manual: {
    id: "manual",
    label: "Manual",
    applyConfig: {},
  },
  aly137: {
    id: "aly137",
    label: "ALY-137",
    applyConfig: {
      tipoExperiencia: "oneowner",
      modoAcessoProjeto: "publico_com_area_restrita",
      destinoPosLogin: "home_central_projeto",
      metodosLoginHabilitados: {
        google: true,
        emailSenha: true,
        twitter: false,
      },
      exibirTituloSistemaNoLogin: true,
      textoLogin: "ACESSO ADMINISTRATIVO ALY-137",
    },
  },
};

export const APPLYABLE_LOGIN_PRESET_IDS = Object.keys(LOGIN_PRESETS);

export function getLoginPresetById(id) {
  const key = String(id || "").trim().toLowerCase();
  return LOGIN_PRESETS[key] || LOGIN_PRESETS.manual;
}

export function applyLoginPresetToConfig(baseConfig = {}, presetId = "manual") {
  const preset = getLoginPresetById(presetId);
  const base = baseConfig && typeof baseConfig === "object" ? baseConfig : {};

  if (preset.id === "manual") {
    return {
      ...base,
      loginPresetId: "manual",
    };
  }

  const presetConfig = preset.applyConfig || {};
  return {
    ...base,
    ...presetConfig,
    metodosLoginHabilitados: {
      ...(base.metodosLoginHabilitados || {}),
      ...(presetConfig.metodosLoginHabilitados || {}),
    },
    loginPresetId: preset.id,
  };
}

export { LOGIN_PRESETS };
