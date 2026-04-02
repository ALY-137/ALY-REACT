import { DEFAULT_SISTEMA_CONFIG } from "./configSistema";
import { normalizarTemaRegistrado } from "../Temas/themesRegistry";

export function buildIconSelectionValue(entity = {}) {
  const collectionId = String(entity?.iconCollectionId || "").trim();
  const iconId = String(entity?.iconId || "").trim();
  if (!collectionId || !iconId) return "";
  return `${collectionId}::${iconId}`;
}

export function parseIconSelectionValue(value = "", collections = []) {
  const [collectionId, iconId] = String(value || "").split("::");
  if (!collectionId || !iconId) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  const collection = (collections || []).find((item) => item.id === collectionId);
  const icon = (collection?.icons || []).find((item) => item.id === iconId);

  if (!icon) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  return {
    iconCollectionId: collectionId,
    iconId,
    iconUrl: String(icon.url || "").trim(),
    iconLabel: String(icon.label || "").trim(),
  };
}

export function filtrarColecoesIconesPermitidas(collections = [], configSistema = DEFAULT_SISTEMA_CONFIG) {
  const temaProjeto = normalizarTemaRegistrado(
    configSistema?.temaPadraoSistema || DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
  );
  const permittedCollectionIds = Array.isArray(configSistema?.iconCollectionIds)
    ? configSistema.iconCollectionIds
    : [];

  return (collections || []).filter((collection) => {
    const collectionAllowedByProject =
      !permittedCollectionIds.length || permittedCollectionIds.includes(collection.id);
    const collectionThemeIds = Array.isArray(collection?.themeIds) ? collection.themeIds : [];
    const collectionAllowedByTheme =
      !collectionThemeIds.length ||
      collectionThemeIds.map((item) => normalizarTemaRegistrado(item)).includes(temaProjeto);

    return collectionAllowedByProject && collectionAllowedByTheme;
  });
}
