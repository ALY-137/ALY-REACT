// Componente criado para testar funcionalidades antes de disponibilizá-las para usuárias.

export function seforAdm(user) {
  if (!user) return false;

  // UID do admin
  const ADMIN_UID = "WnGJjmU6btgKmMMFAQq5Hpupsap1";
  const ADMIN_UID_DINAMICO = localStorage.getItem("systemAdminUid");
  const ADMIN_UID_ENV = process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID;
  const ADMIN_EMAIL_DINAMICO = String(
    localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const ADMIN_EMAIL_ENV = String(
    process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL || ""
  )
    .trim()
    .toLowerCase();
  const USER_EMAIL = String(user?.email || "")
    .trim()
    .toLowerCase();

  return (
    user.uid === ADMIN_UID ||
    user.uid === ADMIN_UID_DINAMICO ||
    user.uid === ADMIN_UID_ENV ||
    (ADMIN_EMAIL_DINAMICO && USER_EMAIL === ADMIN_EMAIL_DINAMICO) ||
    (ADMIN_EMAIL_ENV && USER_EMAIL === ADMIN_EMAIL_ENV)
  );
}


