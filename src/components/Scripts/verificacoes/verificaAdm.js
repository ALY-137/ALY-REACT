// Compatibilidade: `seforAdm` permanece exportado, mas o termo canonico no sistema e `owner`.

export function seforOwner(user) {
  if (!user) return false;

  const OWNER_UID = "WnGJjmU6btgKmMMFAQq5Hpupsap1";
  const OWNER_UID_DINAMICO =
    localStorage.getItem("systemOwnerUid") || localStorage.getItem("systemAdminUid");
  const OWNER_UID_ENV =
    process.env.REACT_APP_SYSTEM_MANAGER_OWNER_UID ||
    process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID;
  const OWNER_EMAIL_DINAMICO = String(
    localStorage.getItem("systemOwnerEmail") || localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const OWNER_EMAIL_ENV = String(
    process.env.REACT_APP_SYSTEM_MANAGER_OWNER_EMAIL ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
      ""
  )
    .trim()
    .toLowerCase();
  const USER_EMAIL = String(user?.email || "")
    .trim()
    .toLowerCase();

  return (
    user.uid === OWNER_UID ||
    user.uid === OWNER_UID_DINAMICO ||
    user.uid === OWNER_UID_ENV ||
    (OWNER_EMAIL_DINAMICO && USER_EMAIL === OWNER_EMAIL_DINAMICO) ||
    (OWNER_EMAIL_ENV && USER_EMAIL === OWNER_EMAIL_ENV)
  );
}

export function seforAdm(user) {
  return seforOwner(user);
}
