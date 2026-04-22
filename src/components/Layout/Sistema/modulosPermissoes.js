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
