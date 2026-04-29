export const RASTREABILIDADE_PERMISSOES_GESTAO = [
  {
    value: "owner_projeto",
    label: "Somente owner do projeto",
  },
  {
    value: "dono_espaco",
    label: "Dono do espaco",
  },
  {
    value: "admin_ou_dono_espaco",
    label: "Admins e dono do espaco",
  },
];

export const AUDITORIA_PERMISSOES_GESTAO = RASTREABILIDADE_PERMISSOES_GESTAO;

export const AUDITORIA_CATEGORIAS = [
  {
    value: "acessos",
    label: "Acessos",
    permissionField: "auditoriaVerAcessosPermissao",
    enabledField: "auditarAcessos",
  },
  {
    value: "conteudo",
    label: "Conteudo",
    permissionField: "auditoriaVerConteudoPermissao",
    enabledField: "auditarConteudo",
  },
  {
    value: "configuracoes",
    label: "Configuracoes",
    permissionField: "auditoriaVerConfiguracoesPermissao",
    enabledField: "auditarConfiguracoes",
  },
  {
    value: "rastreaveis",
    label: "Rastreaveis",
    permissionField: "auditoriaVerRastreaveisPermissao",
    enabledField: "auditarRastreaveis",
  },
];

const PERMISSOES_GESTAO_VALIDAS = new Set(
  RASTREABILIDADE_PERMISSOES_GESTAO.map((item) => item.value)
);

export function normalizarPermissaoGestaoModulo(value = "", fallback = "dono_espaco") {
  const normalizado = String(value || "").trim().toLowerCase();
  if (PERMISSOES_GESTAO_VALIDAS.has(normalizado)) return normalizado;
  return PERMISSOES_GESTAO_VALIDAS.has(fallback) ? fallback : "dono_espaco";
}

function normalizarTexto(value = "") {
  return String(value || "").trim();
}

function normalizarEmail(value = "") {
  return normalizarTexto(value).toLowerCase();
}

export function usuarioPodeGerenciarPorPermissao({
  permissao = "dono_espaco",
  usuarioUid = "",
  usuarioEmail = "",
  ownerProjetoUid = "",
  ownerProjetoEmail = "",
  adminProjetoUid = "",
  adminProjetoEmail = "",
  recursoOwnerUid = "",
  coCriadoresUids = [],
} = {}) {
  const permissaoNormalizada = normalizarPermissaoGestaoModulo(permissao);
  const uid = normalizarTexto(usuarioUid);
  const email = normalizarEmail(usuarioEmail);
  if (!uid && !email) return false;

  const ownerProjeto = normalizarTexto(ownerProjetoUid);
  const ownerProjetoMail = normalizarEmail(ownerProjetoEmail);
  const adminProjeto = normalizarTexto(adminProjetoUid);
  const adminProjetoMail = normalizarEmail(adminProjetoEmail);
  const ownerRecurso = normalizarTexto(recursoOwnerUid);
  const coCriadores = Array.isArray(coCriadoresUids)
    ? coCriadoresUids.map((item) => normalizarTexto(item)).filter(Boolean)
    : [];

  const isOwnerProjeto =
    (uid && (uid === ownerProjeto || uid === adminProjeto)) ||
    (email && (email === ownerProjetoMail || email === adminProjetoMail));
  const isDonoRecurso = uid && uid === ownerRecurso;
  const isCoCriadorRecurso = uid && coCriadores.includes(uid);

  if (permissaoNormalizada === "owner_projeto") {
    return isOwnerProjeto;
  }

  if (permissaoNormalizada === "admin_ou_dono_espaco") {
    return isOwnerProjeto || isDonoRecurso || isCoCriadorRecurso;
  }

  return isDonoRecurso || isCoCriadorRecurso;
}

function obterContextoPermissaoAuditoria({
  configSistema = {},
  usuarioUid = "",
  usuarioEmail = "",
  recursoOwnerUid = "",
  coCriadoresUids = [],
} = {}) {
  return {
    usuarioUid,
    usuarioEmail,
    ownerProjetoUid:
      configSistema?.ownerUid ||
      configSistema?.adminUid ||
      configSistema?.projectOwnerUid ||
      "",
    ownerProjetoEmail:
      configSistema?.ownerEmail ||
      configSistema?.adminEmail ||
      configSistema?.projectOwnerEmail ||
      "",
    adminProjetoUid: configSistema?.adminUid || "",
    adminProjetoEmail: configSistema?.adminEmail || "",
    recursoOwnerUid,
    coCriadoresUids,
  };
}

export function usuarioPodeVerAuditoriaProjeto(contexto = {}) {
  const { configSistema = {} } = contexto;
  if (configSistema?.auditoriaAtiva === false) return false;
  return usuarioPodeGerenciarPorPermissao({
    ...obterContextoPermissaoAuditoria(contexto),
    permissao: configSistema?.auditoriaVerHistoricoPermissao || "owner_projeto",
  });
}

export function obterCategoriaAuditoria(value = "") {
  const normalizado = normalizarTexto(value).toLowerCase();
  return AUDITORIA_CATEGORIAS.find((categoria) => categoria.value === normalizado) || null;
}

export function usuarioPodeVerAuditoriaCategoriaProjeto(contexto = {}, categoriaValue = "") {
  const { configSistema = {} } = contexto;
  if (configSistema?.auditoriaAtiva === false) return false;

  const categoria = obterCategoriaAuditoria(categoriaValue);
  if (!categoria) return usuarioPodeVerAuditoriaProjeto(contexto);
  if (configSistema?.[categoria.enabledField] === false) return false;

  return usuarioPodeGerenciarPorPermissao({
    ...obterContextoPermissaoAuditoria(contexto),
    permissao:
      configSistema?.[categoria.permissionField] ||
      configSistema?.auditoriaVerHistoricoPermissao ||
      "owner_projeto",
  });
}

export function usuarioPodeExportarAuditoriaProjeto(contexto = {}) {
  const { configSistema = {} } = contexto;
  if (configSistema?.auditoriaAtiva === false) return false;
  return usuarioPodeGerenciarPorPermissao({
    ...obterContextoPermissaoAuditoria(contexto),
    permissao: configSistema?.auditoriaExportarPermissao || "owner_projeto",
  });
}

export function usuarioPodeRemoverRegistrosAuditaveisProjeto(contexto = {}) {
  const { configSistema = {} } = contexto;
  if (configSistema?.auditoriaAtiva === false) return false;
  return usuarioPodeGerenciarPorPermissao({
    ...obterContextoPermissaoAuditoria(contexto),
    permissao: configSistema?.auditoriaExcluirRegistrosPermissao || "owner_projeto",
  });
}
