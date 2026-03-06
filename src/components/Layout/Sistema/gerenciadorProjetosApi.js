export {
  gerarBlocoEnvProjeto,
  limparEnvsProjetoNoVercel,
  removerProjetoNoGerenciador,
  listarProjetosNoGerenciador,
  criarProjetoNoGerenciador,
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
  listarIconCollectionsNoGerenciador,
  criarIconCollectionNoGerenciador,
  salvarIconCollectionNoGerenciador,
  removerIconCollectionNoGerenciador,
} from "./gerenciadorSistemasApi";

// Compatibilidade temporaria: alguns fluxos ainda usam nomes antigos.
export {
  gerenciadorSistemasHabilitado as gerenciadorProjetosHabilitado,
  listarSistemasNoGerenciador,
  criarSistemaNoGerenciador,
  obterConfigSistemaDoGerenciador,
  salvarConfigSistemaNoGerenciador,
} from "./gerenciadorSistemasApi";
