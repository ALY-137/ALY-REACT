export {
  gerarBlocoEnvProjeto,
  limparEnvsProjetoNoVercel,
  removerProjetoNoGerenciador,
  listarProjetosNoGerenciador,
  criarProjetoNoGerenciador,
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
  listarPreconfiguracoesNoGerenciador,
  salvarPreconfiguracaoProjetoNoGerenciador,
  listarIconCollectionsNoGerenciador,
  criarIconCollectionNoGerenciador,
  salvarIconCollectionNoGerenciador,
  removerIconCollectionNoGerenciador,
  listarAddOnsNoGerenciador,
  criarAddOnNoGerenciador,
  salvarAddOnNoGerenciador,
  removerAddOnNoGerenciador,
} from "./gerenciadorSistemasApi";

// Compatibilidade temporaria: alguns fluxos ainda usam nomes antigos.
export {
  gerenciadorSistemasHabilitado as gerenciadorProjetosHabilitado,
  listarSistemasNoGerenciador,
  criarSistemaNoGerenciador,
  obterConfigSistemaDoGerenciador,
  salvarConfigSistemaNoGerenciador,
} from "./gerenciadorSistemasApi";
