export {
  gerarBlocoEnvProjeto,
  limparEnvsProjetoNoVercel,
  removerProjetoNoGerenciador,
  listarProjetosNoGerenciador,
  criarProjetoNoGerenciador,
  obterConfigProjetoDoGerenciador,
  salvarConfigProjetoNoGerenciador,
} from "./gerenciadorSistemasApi";

// Compatibilidade temporaria: alguns fluxos ainda usam nomes antigos.
export {
  gerenciadorSistemasHabilitado as gerenciadorProjetosHabilitado,
  listarSistemasNoGerenciador,
  criarSistemaNoGerenciador,
  obterConfigSistemaDoGerenciador,
  salvarConfigSistemaNoGerenciador,
} from "./gerenciadorSistemasApi";
