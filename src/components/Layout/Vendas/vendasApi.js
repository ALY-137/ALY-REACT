import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  db,
} from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { encryptChatMessageText } from "../../Banco/chatMessageCrypto";
import { registrarAuditLog } from "../Sistema/auditLogsApi";
import { DEFAULT_SISTEMA_CONFIG, obterConfigSistema } from "../Sistema/configSistema";

const PRODUTOS_COLLECTION = "produtos_venda";
const PEDIDOS_COLLECTION = "pedidos_venda";
const VENDA_PRODUTO_CHAT_VISIBILIDADE_PADRAO = "usuarios_logados";

const normalizeText = (value = "") => String(value || "").trim();

const normalizeSearch = (value = "") =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeIdPart = (value = "") =>
  normalizeText(value)
    .replace(/[^\w-]/g, "_")
    .slice(0, 120);

const uniqueTextList = (items = []) =>
  Array.from(new Set(items.map(normalizeText).filter(Boolean)));

function normalizarChatVendaProdutoVisibilidade(value = "") {
  const normalizado = normalizeText(value).toLowerCase();
  if (normalizado === "desativado") return "desativado";
  return VENDA_PRODUTO_CHAT_VISIBILIDADE_PADRAO;
}

export function parsePrecoVendaCentavos(value = "") {
  const normalized = normalizeText(value).replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function formatarPrecoVenda(precoCentavos, moeda = "BRL") {
  const value = Number(precoCentavos);
  if (!Number.isFinite(value) || value <= 0) return "";

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda || "BRL",
    }).format(value / 100);
  } catch {
    return `R$ ${(value / 100).toFixed(2)}`;
  }
}

export function normalizarTamanhosVenda(value) {
  const source = Array.isArray(value)
    ? value
    : normalizeText(value)
        .split(",")
        .map((item) => item.trim());

  return Array.from(new Set(source.map(normalizeText).filter(Boolean)));
}

export function normalizarLocaisRecebimentoVenda(value) {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => ({
        id: normalizeText(item?.id) || `local_${index}`,
        nome: normalizeText(item?.nome || item?.label || `Local ${index + 1}`),
        endereco: normalizeText(item?.endereco || item?.address),
        horarios: normalizeText(item?.horarios || item?.hours),
      }))
      .filter((item) => item.nome || item.endereco || item.horarios);
  }

  return normalizeText(value)
    .split("\n")
    .map((line, index) => {
      const [nome = "", endereco = "", horarios = ""] = line.split("|");
      return {
        id: `local_${index}`,
        nome: normalizeText(nome) || `Local ${index + 1}`,
        endereco: normalizeText(endereco),
        horarios: normalizeText(horarios),
      };
    })
    .filter((item) => item.nome || item.endereco || item.horarios);
}

export function serializarLocaisRecebimentoVenda(locais = []) {
  return normalizarLocaisRecebimentoVenda(locais)
    .map((item) => [item.nome, item.endereco, item.horarios].map(normalizeText).join(" | "))
    .join("\n");
}

export function normalizarProdutoVenda(data = {}, id = "") {
  const tamanhos = normalizarTamanhosVenda(
    data.tamanhos || data.tamanhosPredefinidos || data.sizes
  );
  const locaisRecebimento = normalizarLocaisRecebimentoVenda(
    data.locaisRecebimento || data.enderecosEntrega || data.enderecosRecebimento
  );
  const precoCentavos = Number(data.precoCentavos);

  return {
    id: normalizeText(id || data.id),
    nome: normalizeText(data.nome || data.titulo),
    descricao: normalizeText(data.descricao),
    tipoProduto: normalizeText(data.tipoProduto || data.tipo || "produto") || "produto",
    categoria: normalizeText(data.categoria),
    imagemUrl: normalizeText(data.imagemUrl || data.imageUrl || data.imagem),
    imagemPath: normalizeText(data.imagemPath || data.imagePath || data.pathImagem),
    precoCentavos: Number.isFinite(precoCentavos) && precoCentavos >= 0 ? precoCentavos : null,
    moeda: normalizeText(data.moeda || "BRL") || "BRL",
    ativo: data.ativo !== false,
    sobMedida: data.sobMedida === true,
    porEncomenda: data.porEncomenda === true,
    tamanhos,
    locaisRecebimento,
    entregaDomicilio: {
      habilitada: data.entregaDomicilio?.habilitada === true,
      taxaCentavos: Number.isFinite(Number(data.entregaDomicilio?.taxaCentavos))
        ? Number(data.entregaDomicilio.taxaCentavos)
        : null,
      observacoes: normalizeText(data.entregaDomicilio?.observacoes),
    },
    duvidasChatHabilitado: data.duvidasChatHabilitado !== false,
    duvidasChatVisibilidade: normalizarChatVendaProdutoVisibilidade(
      data.duvidasChatVisibilidade || data.chatPrivacidade || data.privacidadeChat
    ),
    observacoesVenda: normalizeText(data.observacoesVenda),
    ownerUserId: normalizeText(data.ownerUserId),
    criadoPorUid: normalizeText(data.criadoPorUid),
    atualizadoPorUid: normalizeText(data.atualizadoPorUid),
    criadoEm: data.criadoEm || null,
    atualizadoEm: data.atualizadoEm || null,
  };
}

export function criarSnapshotProdutoVenda(produto = {}) {
  const normalizado = normalizarProdutoVenda(produto, produto?.id);
  return {
    id: normalizado.id,
    nome: normalizado.nome,
    descricao: normalizado.descricao,
    tipoProduto: normalizado.tipoProduto,
    categoria: normalizado.categoria,
    imagemUrl: normalizado.imagemUrl,
    imagemPath: normalizado.imagemPath,
    precoCentavos: normalizado.precoCentavos,
    moeda: normalizado.moeda,
    sobMedida: normalizado.sobMedida,
    porEncomenda: normalizado.porEncomenda,
    tamanhos: normalizado.tamanhos,
    locaisRecebimento: normalizado.locaisRecebimento,
    entregaDomicilio: normalizado.entregaDomicilio,
    duvidasChatHabilitado: normalizado.duvidasChatHabilitado,
    duvidasChatVisibilidade: normalizado.duvidasChatVisibilidade,
    observacoesVenda: normalizado.observacoesVenda,
  };
}

function getOwnerCollection(ownerUserId = "", collectionName = "") {
  const ownerUid = normalizeText(ownerUserId);
  if (!ownerUid) {
    throw new Error("Owner obrigatorio para gerenciar vendas.");
  }
  return getPrimaryProjectCollection(db, "users", ownerUid, collectionName);
}

function describeCollectionRef(collectionRef, label = "colecao") {
  return `${label} [projectKey=${activeFirebaseProjectKey || "-"} projectId=${activeFirebaseProjectId || "-"} path=${collectionRef?.path || "-"}]`;
}

function wrapFirestoreError(error, collectionRef, label = "colecao") {
  const message = error?.message || String(error || "Falha desconhecida.");
  const nextError = new Error(`${describeCollectionRef(collectionRef, label)}: ${message}`);
  nextError.code = error?.code;
  return nextError;
}

export async function listarProdutosVenda({
  ownerUserId = "",
  search = "",
  onlyActive = false,
} = {}) {
  const busca = normalizeSearch(search);
  const produtosRef = getOwnerCollection(ownerUserId, PRODUTOS_COLLECTION);
  const snap = await getDocs(produtosRef).catch((error) => {
    throw wrapFirestoreError(error, produtosRef, "produtos_venda");
  });

  return snap.docs
    .map((docItem) => normalizarProdutoVenda(docItem.data() || {}, docItem.id))
    .filter((item) => item.id)
    .filter((item) => (onlyActive ? item.ativo !== false : true))
    .filter((item) => {
      if (!busca) return true;
      return (
        normalizeSearch(item.nome).includes(busca) ||
        normalizeSearch(item.descricao).includes(busca) ||
        normalizeSearch(item.categoria).includes(busca)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarProdutoVenda({
  ownerUserId = "",
  criadoPorUid = "",
  ...produto
} = {}) {
  const nome = normalizeText(produto.nome);
  if (!nome) throw new Error("Informe o nome do produto.");

  const produtosCollection = getOwnerCollection(ownerUserId, PRODUTOS_COLLECTION);
  const docRef = doc(produtosCollection);
  const payload = {
    ...criarSnapshotProdutoVenda({ ...produto, id: docRef.id, nome }),
    nomeBusca: normalizeSearch(nome),
    ativo: produto.ativo !== false,
    ownerUserId: normalizeText(ownerUserId),
    criadoPorUid: normalizeText(criadoPorUid),
    atualizadoPorUid: normalizeText(criadoPorUid),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });
  await registrarAuditLog({
    action: "criou_produto_venda",
    entityType: "produtoVenda",
    entityId: docRef.id,
    ownerUserId,
    snapshotDepois: { id: docRef.id, ...payload },
  });

  return normalizarProdutoVenda(payload, docRef.id);
}

export async function salvarProdutoVenda({
  ownerUserId = "",
  produtoId = "",
  atualizadoPorUid = "",
  ...produto
} = {}) {
  const productId = normalizeText(produtoId);
  if (!productId) throw new Error("Produto invalido.");

  const nome = normalizeText(produto.nome);
  if (typeof produto.nome !== "undefined" && !nome) {
    throw new Error("Informe o nome do produto.");
  }

  const payload = {
    ...criarSnapshotProdutoVenda({ ...produto, id: productId }),
    nomeBusca: normalizeSearch(nome || produto.nome),
    ownerUserId: normalizeText(ownerUserId),
    atualizadoPorUid: normalizeText(atualizadoPorUid),
    atualizadoEm: serverTimestamp(),
  };

  if (typeof produto.ativo === "boolean") payload.ativo = produto.ativo;

  const produtoRef = doc(getOwnerCollection(ownerUserId, PRODUTOS_COLLECTION), productId);
  await setDoc(produtoRef, payload, { merge: true });
  await registrarAuditLog({
    action: "editou_produto_venda",
    entityType: "produtoVenda",
    entityId: productId,
    ownerUserId,
    snapshotDepois: { id: productId, ...payload },
  });

  return true;
}

export async function removerProdutoVenda({ ownerUserId = "", produtoId = "" } = {}) {
  const productId = normalizeText(produtoId);
  if (!productId) throw new Error("Produto invalido.");

  await deleteDoc(doc(getOwnerCollection(ownerUserId, PRODUTOS_COLLECTION), productId));
  await registrarAuditLog({
    action: "excluiu_produto_venda",
    entityType: "produtoVenda",
    entityId: productId,
    ownerUserId,
    motivo: "exclusao_manual",
  });

  return true;
}

export async function criarPedidoVenda({
  ownerUserId = "",
  espacoId = "",
  blocoId = "",
  produto = {},
  clienteUid = "",
  clienteNome = "",
  clienteEmail = "",
  tamanhoSelecionado = "",
  medidas = {},
  recebimento = {},
  observacoes = "",
} = {}) {
  const ownerUid = normalizeText(ownerUserId);
  const buyerUid = normalizeText(clienteUid);
  const produtoSnapshot = criarSnapshotProdutoVenda(produto);

  if (!ownerUid) throw new Error("Owner obrigatorio para criar pedido.");
  if (!buyerUid) throw new Error("Faca login para solicitar este produto.");
  if (!produtoSnapshot.id) throw new Error("Produto invalido.");

  const pedidosCollection = getOwnerCollection(ownerUid, PEDIDOS_COLLECTION);
  const docRef = doc(pedidosCollection);
  const payload = {
    id: docRef.id,
    ownerUserId: ownerUid,
    espacoId: normalizeText(espacoId),
    blocoId: normalizeText(blocoId),
    produtoId: produtoSnapshot.id,
    produtoSnapshot,
    clienteUid: buyerUid,
    clienteNome: normalizeText(clienteNome),
    clienteEmail: normalizeText(clienteEmail),
    tamanhoSelecionado: normalizeText(tamanhoSelecionado),
    medidas: Object.entries(medidas || {}).reduce((acc, [key, value]) => {
      const valueText = normalizeText(value);
      if (valueText) acc[key] = valueText;
      return acc;
    }, {}),
    recebimento: {
      tipo: normalizeText(recebimento?.tipo || "retirada"),
      localId: normalizeText(recebimento?.localId),
      localNome: normalizeText(recebimento?.localNome),
      endereco: normalizeText(recebimento?.endereco),
      horarios: normalizeText(recebimento?.horarios),
      taxaCentavos: Number.isFinite(Number(recebimento?.taxaCentavos))
        ? Number(recebimento.taxaCentavos)
        : null,
    },
    observacoes: normalizeText(observacoes),
    status: "solicitado",
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });
  await registrarAuditLog({
    action: "criou_pedido_venda",
    entityType: "pedidoVenda",
    entityId: docRef.id,
    ownerUserId: ownerUid,
    espacoId: normalizeText(espacoId),
    blocoId: normalizeText(blocoId),
    snapshotDepois: {
      id: docRef.id,
      produtoId: produtoSnapshot.id,
      clienteUid: buyerUid,
      status: payload.status,
    },
  });

  return { id: docRef.id, ...payload };
}

export async function listarPedidosVenda({ ownerUserId = "" } = {}) {
  const pedidosRef = getOwnerCollection(ownerUserId, PEDIDOS_COLLECTION);
  const snap = await getDocs(pedidosRef).catch((error) => {
    throw wrapFirestoreError(error, pedidosRef, "pedidos_venda");
  });
  return snap.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() || {}) }))
    .sort((a, b) => {
      const aSeconds = Number(a?.criadoEm?.seconds) || 0;
      const bSeconds = Number(b?.criadoEm?.seconds) || 0;
      return bSeconds - aSeconds;
    });
}

export async function atualizarStatusPedidoVenda({
  ownerUserId = "",
  pedidoId = "",
  status = "solicitado",
  atualizadoPorUid = "",
} = {}) {
  const orderId = normalizeText(pedidoId);
  const statusNormalizado = normalizeText(status) || "solicitado";
  if (!orderId) throw new Error("Pedido invalido.");

  await setDoc(
    doc(getOwnerCollection(ownerUserId, PEDIDOS_COLLECTION), orderId),
    {
      status: statusNormalizado,
      atualizadoPorUid: normalizeText(atualizadoPorUid),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  await registrarAuditLog({
    action: "atualizou_status_pedido_venda",
    entityType: "pedidoVenda",
    entityId: orderId,
    ownerUserId,
    snapshotDepois: { status: statusNormalizado },
  });

  return true;
}

function montarContatoProdutoVendaId({
  ownerUserId = "",
  produtoId = "",
  clienteUid = "",
} = {}) {
  const ownerPart = normalizeIdPart(ownerUserId);
  const produtoPart = normalizeIdPart(produtoId);
  const clientePart = normalizeIdPart(clienteUid);
  if (!ownerPart || !produtoPart || !clientePart) {
    throw new Error("Dados insuficientes para abrir conversa do produto.");
  }
  return `venda_${ownerPart}_${produtoPart}_${clientePart}`;
}

function getContatoVendaRefs(contatoId = "") {
  return getProjectDocCandidates(db, "contatos", normalizeText(contatoId));
}

function getConversaVendaRefs(contatoId = "", conversaId = "") {
  return getProjectDocCandidates(
    db,
    "contatos",
    normalizeText(contatoId),
    "conversas",
    normalizeText(conversaId)
  );
}

function getChatVendaRefs(contatoId = "", conversaId = "") {
  return getProjectCollectionCandidates(
    db,
    "contatos",
    normalizeText(contatoId),
    "conversas",
    normalizeText(conversaId),
    "chat"
  );
}

export async function garantirConversaProdutoVenda({
  ownerUserId = "",
  clienteUid = "",
  clienteNome = "",
  clienteEmail = "",
  clienteSkin = "",
  produto = {},
  bloco = {},
  espacoId = "",
  mensagemInicial = "",
} = {}) {
  const ownerUid = normalizeText(ownerUserId || produto?.ownerUserId || bloco?.ownerUserId || bloco?.criadoPor);
  const buyerUid = normalizeText(clienteUid);
  const productSnapshot = criarSnapshotProdutoVenda(produto);
  const produtoId = normalizeText(productSnapshot.id || produto?.id);

  if (!ownerUid) throw new Error("Vendedor obrigatorio para abrir conversa.");
  if (!buyerUid) throw new Error("Faca login para tirar duvidas sobre este produto.");
  if (!produtoId) throw new Error("Produto invalido para conversa.");
  if (productSnapshot.duvidasChatHabilitado === false) {
    throw new Error("O vendedor desativou duvidas por chat para este produto.");
  }
  if (normalizarChatVendaProdutoVisibilidade(productSnapshot.duvidasChatVisibilidade) === "desativado") {
    throw new Error("O vendedor desativou duvidas por chat para este produto.");
  }

  const contatoId = montarContatoProdutoVendaId({
    ownerUserId: ownerUid,
    produtoId,
    clienteUid: buyerUid,
  });
  const conversaId = "principal";
  const clienteLabel =
    normalizeText(clienteSkin) ||
    normalizeText(clienteNome) ||
    normalizeText(clienteEmail) ||
    buyerUid;
  const assunto = `Duvida sobre ${productSnapshot.nome || "produto"}`;
  const participantUids = uniqueTextList([ownerUid, buyerUid]);
  const textoInicial = normalizeText(mensagemInicial);
  let chatMensagensCriptografadas = DEFAULT_SISTEMA_CONFIG.chatMensagensCriptografadas;
  try {
    const config = await obterConfigSistema();
    chatMensagensCriptografadas = config?.chatMensagensCriptografadas === true;
  } catch {
    chatMensagensCriptografadas = DEFAULT_SISTEMA_CONFIG.chatMensagensCriptografadas;
  }
  const criptografarMensagemInicial = Boolean(chatMensagensCriptografadas && textoInicial);
  const mensagemCriptografia =
    criptografarMensagemInicial
      ? await encryptChatMessageText(textoInicial, {
          contactId: contatoId,
          conversationId: conversaId,
        })
      : null;

  const payloadContato = {
    idContato: contatoId,
    conversaId,
    tipo: "venda_produto",
    tipoOrigem: "venda_produto",
    assunto,
    ownerUserId: ownerUid,
    compradorUid: buyerUid,
    clienteUid: buyerUid,
    skinRemetente: clienteLabel,
    skinDestinatario: "Vendedor",
    participantUids: arrayUnion(...participantUids),
    espacoId: normalizeText(espacoId),
    blocoId: normalizeText(bloco?.id),
    produtoId,
    produtoSnapshot: productSnapshot,
    ultimaConversaData: serverTimestamp(),
  };

  const payloadConversa = {
    idContato: contatoId,
    idConversa: conversaId,
    assunto,
    tipoOrigem: "venda_produto",
    ownerUserId: ownerUid,
    compradorUid: buyerUid,
    clienteUid: buyerUid,
    participantUids,
    espacoId: normalizeText(espacoId),
    blocoId: normalizeText(bloco?.id),
    produtoId,
    produtoSnapshot: productSnapshot,
    data: serverTimestamp(),
    dataUltimaMensagem: serverTimestamp(),
    ultimaMensagem: criptografarMensagemInicial ? "" : textoInicial || "Conversa iniciada.",
    ultimaMensagemCriptografada: criptografarMensagemInicial,
    ultimaMensagemCriptografia: mensagemCriptografia,
    ultimaMensagemPreview: criptografarMensagemInicial ? "Mensagem criptografada" : "",
  };

  for (const contatoRef of getContatoVendaRefs(contatoId)) {
    await setDoc(contatoRef, payloadContato, { merge: true });
  }

  for (const conversaRef of getConversaVendaRefs(contatoId, conversaId)) {
    await setDoc(conversaRef, payloadConversa, { merge: true });
  }

  if (textoInicial) {
    const chatRef = getChatVendaRefs(contatoId, conversaId)[0];
    if (chatRef) {
      await addDoc(chatRef, {
        mensagem: criptografarMensagemInicial ? "" : textoInicial,
        mensagemCriptografada: criptografarMensagemInicial,
        mensagemCriptografia,
        mensagemPreview: criptografarMensagemInicial ? "Mensagem criptografada" : "",
        data: serverTimestamp(),
        userRemetente: clienteLabel,
        userUid: buyerUid,
        idConversa: conversaId,
        produtoId,
        tipoOrigem: "venda_produto",
      });
    }
  }

  return {
    contactId: contatoId,
    conversationId: conversaId,
    assunto,
  };
}
