// Componente criado para testar funcionalidades antes de disponibilizá-las para usuárias.

export function seforAdm(user) {
  if (!user) return false;

  // UID do admin
  const ADMIN_UID = "WnGJjmU6btgKmMMFAQq5Hpupsap1";
  const ADMIN_UID_DINAMICO = localStorage.getItem("systemAdminUid");

  return user.uid === ADMIN_UID || user.uid === ADMIN_UID_DINAMICO;
}


