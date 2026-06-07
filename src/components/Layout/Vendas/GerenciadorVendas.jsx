import { useEffect, useMemo, useState } from "react";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { useAuth } from "../../../hooks/auth/useAuth";
import { storage } from "../../Banco/init-firebase";
import {
  excluirArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import ProjectLoadingFallback from "../Geral/ProjectLoadingFallback";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterOwnerUidConfigurado,
  usuarioCorrespondeOwnerConfigurado,
} from "../Sistema/configSistema";
import {
  atualizarStatusPedidoVenda,
  criarProdutoVenda,
  formatarPrecoVenda,
  listarPedidosVenda,
  listarProdutosVenda,
  normalizarLocaisRecebimentoVenda,
  normalizarTamanhosVenda,
  removerProdutoVenda,
  salvarProdutoVenda,
  serializarLocaisRecebimentoVenda,
} from "./vendasApi";

const STATUS_PEDIDOS = [
  { value: "solicitado", label: "Solicitado" },
  { value: "em_conversa", label: "Em conversa" },
  { value: "em_producao", label: "Em producao" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

function nomeArquivoSeguro(nome = "produto.png") {
  return String(nome || "produto.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

function isArquivoSelecionado(file) {
  return typeof File !== "undefined" && file instanceof File;
}

async function subirFotoProdutoVenda({ file, produtoId, currentUser, ownerUserId }) {
  const ownerUid = String(ownerUserId || currentUser?.uid || "").trim();
  const productId = String(produtoId || "").trim();

  if (!ownerUid) {
    throw new Error("Usuario autenticado obrigatorio para enviar foto do produto.");
  }

  if (!productId) {
    throw new Error("Produto obrigatorio para enviar foto.");
  }

  if (!isArquivoSelecionado(file) || !String(file.type || "").startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem valido.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A foto do produto deve ter ate 10MB.");
  }

  const nome = `${Date.now()}-${nomeArquivoSeguro(file?.name || "produto.png")}`;
  const path = `users/${ownerUid}/produtos_venda/${productId}/${nome}`;

  if (usandoBucketCompartilhadoCrossProject()) {
    const upload = await uploadArquivoNoBucketCompartilhado({
      user: currentUser,
      path,
      file,
    });
    return {
      url: String(upload?.url || ""),
      path,
    };
  }

  const arquivoRef = ref(storage, path);
  await uploadBytes(arquivoRef, file);
  return {
    url: await getDownloadURL(arquivoRef),
    path,
  };
}

async function removerFotoProdutoVendaStorage({ path = "", currentUser }) {
  const pathNormalizado = String(path || "").trim();
  if (!pathNormalizado) return;

  if (usandoBucketCompartilhadoCrossProject()) {
    await excluirArquivoNoBucketCompartilhado({
      user: currentUser,
      path: pathNormalizado,
    });
    return;
  }

  await deleteObject(ref(storage, pathNormalizado));
}

const criarDraftProdutoVazio = () => ({
  nome: "",
  descricao: "",
  tipoProduto: "roupa",
  categoria: "",
  imagemUrl: "",
  imagemPath: "",
  preco: "",
  ativo: true,
  sobMedida: false,
  porEncomenda: false,
  tamanhosTexto: "PP, P, M, G, GG",
  locaisTexto: "",
  entregaHabilitada: false,
  taxaEntrega: "",
  observacoesEntrega: "",
  duvidasChatHabilitado: true,
  duvidasChatVisibilidade: "usuarios_logados",
  observacoesVenda: "",
});

const produtoParaDraft = (produto = {}) => ({
  nome: produto.nome || "",
  descricao: produto.descricao || "",
  tipoProduto: produto.tipoProduto || "roupa",
  categoria: produto.categoria || "",
  imagemUrl: produto.imagemUrl || "",
  imagemPath: produto.imagemPath || "",
  preco:
    Number.isFinite(Number(produto.precoCentavos)) && Number(produto.precoCentavos) >= 0
      ? String((Number(produto.precoCentavos) / 100).toFixed(2)).replace(".", ",")
      : "",
  ativo: produto.ativo !== false,
  sobMedida: produto.sobMedida === true,
  porEncomenda: produto.porEncomenda === true,
  tamanhosTexto: normalizarTamanhosVenda(produto.tamanhos).join(", "),
  locaisTexto: serializarLocaisRecebimentoVenda(produto.locaisRecebimento || []),
  entregaHabilitada: produto.entregaDomicilio?.habilitada === true,
  taxaEntrega:
    Number.isFinite(Number(produto.entregaDomicilio?.taxaCentavos)) &&
    Number(produto.entregaDomicilio?.taxaCentavos) >= 0
      ? String((Number(produto.entregaDomicilio.taxaCentavos) / 100).toFixed(2)).replace(".", ",")
      : "",
  observacoesEntrega: produto.entregaDomicilio?.observacoes || "",
  duvidasChatHabilitado: produto.duvidasChatHabilitado !== false,
  duvidasChatVisibilidade: produto.duvidasChatVisibilidade || "usuarios_logados",
  observacoesVenda: produto.observacoesVenda || "",
});

const parsePrecoCentavos = (value = "") => {
  const parsed = Number(String(value || "").replace(",", ".").trim());
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
};

const draftParaPayload = (draft = {}) => ({
  nome: draft.nome,
  descricao: draft.descricao,
  tipoProduto: draft.tipoProduto || "produto",
  categoria: draft.categoria,
  imagemUrl: draft.imagemUrl,
  imagemPath: draft.imagemPath,
  precoCentavos: parsePrecoCentavos(draft.preco),
  moeda: "BRL",
  ativo: draft.ativo !== false,
  sobMedida: draft.sobMedida === true,
  porEncomenda: draft.porEncomenda === true,
  tamanhos: normalizarTamanhosVenda(draft.tamanhosTexto),
  locaisRecebimento: normalizarLocaisRecebimentoVenda(draft.locaisTexto),
  entregaDomicilio: {
    habilitada: draft.entregaHabilitada === true,
    taxaCentavos: parsePrecoCentavos(draft.taxaEntrega),
    observacoes: draft.observacoesEntrega,
  },
  duvidasChatHabilitado: draft.duvidasChatHabilitado !== false,
  duvidasChatVisibilidade:
    draft.duvidasChatHabilitado === false ? "desativado" : "usuarios_logados",
  observacoesVenda: draft.observacoesVenda,
});

const formatarDataPedido = (value = null) => {
  const ms = Number(value?.seconds) ? Number(value.seconds) * 1000 : Date.parse(String(value || ""));
  if (!Number.isFinite(ms) || !ms) return "--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
};

export default function GerenciadorVendas() {
  const { user, loading } = useAuth();
  const [configSistema, setConfigSistema] = useState(DEFAULT_SISTEMA_CONFIG);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState("produtos");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [novoProduto, setNovoProduto] = useState(() => criarDraftProdutoVazio());
  const [novoProdutoArquivo, setNovoProdutoArquivo] = useState(null);
  const [arquivosPorProdutoId, setArquivosPorProdutoId] = useState({});
  const [salvandoKey, setSalvandoKey] = useState("");

  const oneOwnerAtivo = isOneOwnerComEntradaPublica(configSistema);
  const ownerUidConfigurado = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const usuarioEhOwnerProjeto = Boolean(
    user?.uid &&
      (
        usuarioCorrespondeOwnerConfigurado(configSistema, {
          uid: user.uid,
          email: user?.email,
        }) ||
        (!ownerUidConfigurado && seforAdm(user))
      )
  );
  const ownerUserId = String(
    oneOwnerAtivo
      ? ownerUidConfigurado || (usuarioEhOwnerProjeto ? user?.uid : "")
      : user?.uid || ""
  ).trim();
  const podeGerenciarVendas = Boolean(
    user?.uid && ownerUserId && (!oneOwnerAtivo || usuarioEhOwnerProjeto)
  );

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const config = await obterConfigSistema();
      const configFinal = config || DEFAULT_SISTEMA_CONFIG;
      setConfigSistema(configFinal);

      const configOneOwnerAtivo = isOneOwnerComEntradaPublica(configFinal);
      const configOwnerUid = String(obterOwnerUidConfigurado(configFinal) || "").trim();
      const configUsuarioEhOwner = Boolean(
        user?.uid &&
          (
            usuarioCorrespondeOwnerConfigurado(configFinal, {
              uid: user.uid,
              email: user?.email,
            }) ||
            (!configOwnerUid && seforAdm(user))
          )
      );
      const ownerUid = String(
        configOneOwnerAtivo
          ? configOwnerUid || (configUsuarioEhOwner ? user?.uid : "")
          : user?.uid || ""
      ).trim();

      if (!ownerUid || (configOneOwnerAtivo && !configUsuarioEhOwner)) {
        setProdutos([]);
        setPedidos([]);
        setDrafts({});
        return;
      }

      let listaProdutos = [];
      let listaPedidos = [];
      const errosCarregamento = [];

      try {
        listaProdutos = await listarProdutosVenda({ ownerUserId: ownerUid });
      } catch (error) {
        errosCarregamento.push(`Produtos: ${error?.message || "falha ao carregar"}`);
      }

      try {
        listaPedidos = await listarPedidosVenda({ ownerUserId: ownerUid });
      } catch (error) {
        errosCarregamento.push(`Pedidos: ${error?.message || "falha ao carregar"}`);
      }

      setProdutos(listaProdutos);
      setPedidos(listaPedidos);
      setDrafts(
        listaProdutos.reduce((acc, produto) => {
          acc[produto.id] = produtoParaDraft(produto);
          return acc;
        }, {})
      );
      if (errosCarregamento.length) {
        setErro(errosCarregamento.join(" | "));
      }
    } catch (error) {
      setErro(error?.message || "Falha ao carregar vendas.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    void carregar();
  }, [loading, user?.uid]);

  const produtosFiltrados = useMemo(() => {
    const buscaNormalizada = String(busca || "").trim().toLowerCase();
    return produtos.filter((produto) => {
      if (!buscaNormalizada) return true;
      return (
        String(produto.nome || "").toLowerCase().includes(buscaNormalizada) ||
        String(produto.descricao || "").toLowerCase().includes(buscaNormalizada) ||
        String(produto.categoria || "").toLowerCase().includes(buscaNormalizada)
      );
    });
  }, [produtos, busca]);

  const atualizarDraft = (produtoId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [produtoId]: {
        ...(prev[produtoId] || criarDraftProdutoVazio()),
        ...patch,
      },
    }));
  };

  const criarProduto = async () => {
    if (!podeGerenciarVendas) {
      setErro("Voce nao tem permissao para gerenciar vendas neste projeto.");
      return;
    }
    setErro("");
    setMensagem("");
    setSalvandoKey("novo");
    try {
      const payloadProduto = draftParaPayload(novoProduto);
      const produtoCriado = await criarProdutoVenda({
        ownerUserId,
        criadoPorUid: user?.uid || "",
        ...payloadProduto,
      });

      if (isArquivoSelecionado(novoProdutoArquivo)) {
        const upload = await subirFotoProdutoVenda({
          file: novoProdutoArquivo,
          produtoId: produtoCriado.id,
          currentUser: user || null,
          ownerUserId,
        });

        await salvarProdutoVenda({
          ownerUserId,
          produtoId: produtoCriado.id,
          atualizadoPorUid: user?.uid || "",
          ...payloadProduto,
          imagemUrl: upload.url,
          imagemPath: upload.path,
        });
      }

      setNovoProduto(criarDraftProdutoVazio());
      setNovoProdutoArquivo(null);
      setMensagem("Produto criado.");
      await carregar();
    } catch (error) {
      setErro(error?.message || "Falha ao criar produto.");
    } finally {
      setSalvandoKey("");
    }
  };

  const salvarProduto = async (produto) => {
    if (!podeGerenciarVendas) return;
    const draft = drafts[produto.id] || produtoParaDraft(produto);
    setErro("");
    setMensagem("");
    setSalvandoKey(produto.id);
    try {
      const arquivoNovo = arquivosPorProdutoId[produto.id];
      let payloadProduto = draftParaPayload(draft);
      let novoImagemPath = "";

      if (isArquivoSelecionado(arquivoNovo)) {
        const upload = await subirFotoProdutoVenda({
          file: arquivoNovo,
          produtoId: produto.id,
          currentUser: user || null,
          ownerUserId,
        });
        payloadProduto = {
          ...payloadProduto,
          imagemUrl: upload.url,
          imagemPath: upload.path,
        };
        novoImagemPath = upload.path;
      }

      await salvarProdutoVenda({
        ownerUserId,
        produtoId: produto.id,
        atualizadoPorUid: user?.uid || "",
        ...payloadProduto,
      });

      if (
        novoImagemPath &&
        produto.imagemPath &&
        produto.imagemPath !== novoImagemPath
      ) {
        await removerFotoProdutoVendaStorage({
          path: produto.imagemPath,
          currentUser: user || null,
        }).catch(() => {});
      }

      if (isArquivoSelecionado(arquivoNovo)) {
        setArquivosPorProdutoId((prev) => {
          const next = { ...prev };
          delete next[produto.id];
          return next;
        });
      }

      setMensagem(`Produto "${draft.nome}" atualizado.`);
      await carregar();
    } catch (error) {
      setErro(error?.message || "Falha ao salvar produto.");
    } finally {
      setSalvandoKey("");
    }
  };

  const excluirProduto = async (produto) => {
    if (!podeGerenciarVendas) return;
    const ok = window.confirm(`Excluir o produto "${produto.nome}"?`);
    if (!ok) return;
    setErro("");
    setMensagem("");
    setSalvandoKey(`excluir:${produto.id}`);
    try {
      await removerProdutoVenda({ ownerUserId, produtoId: produto.id });
      if (produto.imagemPath) {
        await removerFotoProdutoVendaStorage({
          path: produto.imagemPath,
          currentUser: user || null,
        }).catch(() => {});
      }
      setMensagem(`Produto "${produto.nome}" excluido.`);
      await carregar();
    } catch (error) {
      setErro(error?.message || "Falha ao excluir produto.");
    } finally {
      setSalvandoKey("");
    }
  };

  const atualizarStatusPedido = async (pedido, status) => {
    if (!podeGerenciarVendas) return;
    setErro("");
    setMensagem("");
    setSalvandoKey(`pedido:${pedido.id}`);
    try {
      await atualizarStatusPedidoVenda({
        ownerUserId,
        pedidoId: pedido.id,
        status,
        atualizadoPorUid: user?.uid || "",
      });
      setMensagem("Status do pedido atualizado.");
      await carregar();
    } catch (error) {
      setErro(error?.message || "Falha ao atualizar pedido.");
    } finally {
      setSalvandoKey("");
    }
  };

  const renderProdutoForm = (draft, onChange, options = {}) => (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Nome</span>
        <input
          type="text"
          value={draft.nome}
          onChange={(event) => onChange({ nome: event.target.value })}
          placeholder="Ex.: Vestido cetim sob medida"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Descricao</span>
        <textarea
          rows={3}
          value={draft.descricao}
          onChange={(event) => onChange({ descricao: event.target.value })}
          placeholder="Detalhe tecido, caimento, prazo, composicao e cuidados."
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Tipo</span>
          <select
            value={draft.tipoProduto}
            onChange={(event) => onChange({ tipoProduto: event.target.value })}
          >
            <option value="roupa">Roupa</option>
            <option value="produto">Produto geral</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Categoria</span>
          <input
            type="text"
            value={draft.categoria}
            onChange={(event) => onChange({ categoria: event.target.value })}
            placeholder="Vestidos, camisetas, acessorios..."
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Preco base</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.preco}
            onChange={(event) => onChange({ preco: event.target.value })}
            placeholder="Ex.: 189,90"
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Imagem por URL</span>
        <input
          type="url"
          value={draft.imagemUrl}
          onChange={(event) => onChange({ imagemUrl: event.target.value })}
          placeholder="https://..."
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Enviar foto do dispositivo</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => options.onArquivoChange?.(event.target.files?.[0] || null)}
        />
      </label>

      {options.arquivoSelecionado ? (
        <span style={{ fontSize: 12, opacity: 0.78 }}>
          {`Arquivo selecionado: ${options.arquivoSelecionado.name}`}
        </span>
      ) : null}

      {draft.imagemUrl ? (
        <img
          src={draft.imagemUrl}
          alt=""
          aria-hidden="true"
          style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 6 }}
        />
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={draft.ativo}
            onChange={(event) => onChange({ ativo: event.target.checked })}
          />
          Produto ativo
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={draft.sobMedida}
            onChange={(event) => onChange({ sobMedida: event.target.checked })}
          />
          Sob medida
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={draft.porEncomenda}
            onChange={(event) => onChange({ porEncomenda: event.target.checked })}
          />
          Por encomenda
        </label>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Tamanhos predefinidos</span>
        <input
          type="text"
          value={draft.tamanhosTexto}
          onChange={(event) => onChange({ tamanhosTexto: event.target.value })}
          placeholder="PP, P, M, G, GG"
          disabled={draft.sobMedida}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Locais de recebimento/retirada e horarios</span>
        <textarea
          rows={3}
          value={draft.locaisTexto}
          onChange={(event) => onChange({ locaisTexto: event.target.value })}
          placeholder={"Atelie centro | Rua A, 123 | Seg a sex, 14h-18h\nEvento feira | Praca B | Sabado, 10h-16h"}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={draft.entregaHabilitada}
            onChange={(event) => onChange({ entregaHabilitada: event.target.checked })}
          />
          Entrega em casa
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Taxa de entrega</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.taxaEntrega}
            onChange={(event) => onChange({ taxaEntrega: event.target.value })}
            placeholder="Ex.: 15,00"
            disabled={!draft.entregaHabilitada}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Observacoes de entrega/encomenda</span>
        <textarea
          rows={2}
          value={draft.observacoesEntrega}
          onChange={(event) => onChange({ observacoesEntrega: event.target.value })}
          placeholder="Prazo, regioes atendidas, combinados de prova e retirada."
        />
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={draft.duvidasChatHabilitado !== false}
            onChange={(event) =>
              onChange({
                duvidasChatHabilitado: event.target.checked,
                duvidasChatVisibilidade: event.target.checked ? "usuarios_logados" : "desativado",
              })
            }
          />
          Permitir duvidas por chat
        </label>
        {draft.duvidasChatHabilitado !== false ? (
          <span style={{ fontSize: 12, opacity: 0.78 }}>
            Clientes logados poderao iniciar uma conversa com o assunto deste produto.
          </span>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Observacoes internas da venda</span>
        <textarea
          rows={2}
          value={draft.observacoesVenda}
          onChange={(event) => onChange({ observacoesVenda: event.target.value })}
          placeholder="Informacoes que ajudam no atendimento."
        />
      </label>

      {options.actions || null}
    </div>
  );

  if (loading || carregando) {
    return <ProjectLoadingFallback text="Carregando vendas..." />;
  }

  if (!user) {
    return (
      <div className="menu-panel-stack">
        <h2 className="menu-panel-main-title">VENDAS</h2>
        <div className="menu-panel-block">
          <p className="menu-panel-note">Faca login para gerenciar vendas.</p>
        </div>
      </div>
    );
  }

  if (!podeGerenciarVendas) {
    return (
      <div className="menu-panel-stack">
        <h2 className="menu-panel-main-title">VENDAS</h2>
        <div className="menu-panel-block">
          <p className="menu-panel-note">Acesso permitido apenas ao owner deste projeto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-panel-stack vendas-manager">
      <h2 className="menu-panel-main-title">VENDAS</h2>
      <p className="menu-panel-note">
        Cadastre produtos, roupas sob medida, pontos de recebimento e acompanhe pedidos.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setAba("produtos")} disabled={aba === "produtos"}>
          Produtos
        </button>
        <button type="button" onClick={() => setAba("pedidos")} disabled={aba === "pedidos"}>
          {`Pedidos (${pedidos.length})`}
        </button>
        <button type="button" onClick={() => void carregar()}>
          Atualizar
        </button>
      </div>

      {erro ? <p style={{ color: "#ff9090" }}>{erro}</p> : null}
      {mensagem ? <p style={{ color: "#9dffb4" }}>{mensagem}</p> : null}

      {aba === "produtos" ? (
        <>
          <div className="menu-panel-block">
            <h3 className="menu-panel-title">Novo produto</h3>
            {renderProdutoForm(
              novoProduto,
              (patch) => setNovoProduto((prev) => ({ ...prev, ...patch })),
              {
                arquivoSelecionado: novoProdutoArquivo,
                onArquivoChange: setNovoProdutoArquivo,
                actions: (
                  <button type="button" onClick={criarProduto} disabled={salvandoKey === "novo"}>
                    {salvandoKey === "novo" ? "Criando..." : "Criar produto"}
                  </button>
                ),
              }
            )}
          </div>

          <div className="menu-panel-block">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <h3 className="menu-panel-title" style={{ margin: 0 }}>Catalogo</h3>
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar produto"
                style={{ width: "min(320px, 100%)" }}
              />
            </div>

            {!produtosFiltrados.length ? (
              <p>Nenhum produto encontrado.</p>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {produtosFiltrados.map((produto) => {
                  const draft = drafts[produto.id] || produtoParaDraft(produto);
                  const arquivoSelecionado = arquivosPorProdutoId[produto.id] || null;
                  const salvandoProduto =
                    salvandoKey === produto.id || salvandoKey === `excluir:${produto.id}`;
                  return (
                    <article
                      key={produto.id}
                      className="menu-panel-item"
                      style={{ padding: 12, display: "grid", gap: 12 }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        {produto.imagemUrl ? (
                          <img
                            src={produto.imagemUrl}
                            alt={produto.nome}
                            style={{ width: 82, height: 82, objectFit: "cover", borderRadius: 6 }}
                          />
                        ) : null}
                        <div>
                          <strong>{produto.nome || "Produto sem nome"}</strong>
                          <div style={{ fontSize: 12, opacity: 0.78 }}>
                            {produto.ativo === false ? "Inativo" : "Ativo"}
                            {produto.precoCentavos ? ` / ${formatarPrecoVenda(produto.precoCentavos, produto.moeda)}` : ""}
                          </div>
                        </div>
                      </div>

                      {renderProdutoForm(draft, (patch) => atualizarDraft(produto.id, patch), {
                        arquivoSelecionado,
                        onArquivoChange: (file) =>
                          setArquivosPorProdutoId((prev) => ({
                            ...prev,
                            [produto.id]: file,
                          })),
                        actions: (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => salvarProduto(produto)}
                              disabled={salvandoProduto}
                            >
                              {salvandoKey === produto.id ? "Salvando..." : "Salvar produto"}
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirProduto(produto)}
                              disabled={salvandoProduto}
                              style={{ color: "#ff9db0" }}
                            >
                              {salvandoKey === `excluir:${produto.id}` ? "Excluindo..." : "Excluir"}
                            </button>
                          </div>
                        ),
                      })}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="menu-panel-block">
          <h3 className="menu-panel-title">Pedidos e encomendas</h3>
          {!pedidos.length ? (
            <p>Nenhum pedido recebido.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {pedidos.map((pedido) => {
                const produto = pedido.produtoSnapshot || {};
                const recebimento = pedido.recebimento || {};
                const medidas = pedido.medidas || {};
                const textoRecebimento =
                  recebimento.tipo === "entrega"
                    ? `Entrega em casa: ${recebimento.endereco || "endereco nao informado"}${recebimento.taxaCentavos ? ` / taxa ${formatarPrecoVenda(recebimento.taxaCentavos)}` : ""}`
                    : recebimento.tipo === "combinar"
                      ? "Recebimento a combinar com o cliente."
                      : `Recebimento: ${recebimento.localNome || "local combinado"} ${recebimento.endereco || ""} ${recebimento.horarios || ""}`;
                return (
                  <article
                    key={pedido.id}
                    className="menu-panel-item"
                    style={{ padding: 12, display: "grid", gap: 8 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{produto.nome || "Produto"}</strong>
                        <div style={{ fontSize: 12, opacity: 0.78 }}>
                          {`${formatarDataPedido(pedido.criadoEm)} / ${pedido.clienteNome || pedido.clienteEmail || pedido.clienteUid || "Cliente"}`}
                        </div>
                      </div>
                      <select
                        value={pedido.status || "solicitado"}
                        onChange={(event) => atualizarStatusPedido(pedido, event.target.value)}
                        disabled={salvandoKey === `pedido:${pedido.id}`}
                      >
                        {STATUS_PEDIDOS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {pedido.tamanhoSelecionado ? (
                      <span>{`Tamanho: ${pedido.tamanhoSelecionado}`}</span>
                    ) : null}
                    {Object.keys(medidas).length ? (
                      <span>{`Medidas: ${Object.entries(medidas).map(([key, value]) => `${key}: ${value}`).join(", ")}`}</span>
                    ) : null}
                    <span>{textoRecebimento}</span>
                    {pedido.observacoes ? <span>{`Observacoes: ${pedido.observacoes}`}</span> : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
