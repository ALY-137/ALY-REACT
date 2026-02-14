// Componente criado para testar funcionalidades antes de disponibilizá-las para usuárias.

export function seforAdm(user) {
  if (!user) return false;

  // UID do admin
  const ADMIN_UID = "WnGJjmU6btgKmMMFAQq5Hpupsap1";

  return user.uid === ADMIN_UID;
}


