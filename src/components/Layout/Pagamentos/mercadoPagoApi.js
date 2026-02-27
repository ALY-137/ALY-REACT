import { httpsCallable } from "firebase/functions";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, functions } from "../../Banco/init-firebase";

const callSalvarCredenciais = httpsCallable(functions, "salvarMercadoPagoCredenciais");
const callStatusCredenciais = httpsCallable(functions, "obterStatusMercadoPago");
const callDesconectarCredenciais = httpsCallable(functions, "desconectarMercadoPago");
const callCriarCheckout = httpsCallable(functions, "criarCheckoutBlocoMercadoPago");
const callConfirmarPagamento = httpsCallable(functions, "confirmarPagamentoBlocoMercadoPago");

const MAX_PIX_QRS = 20;

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function sanitizeString(value) {
  return String(value || "").trim();
}

function normalizePixQr(raw, index = 0) {
  const valorCentavos = toPositiveInteger(raw?.valorCentavos);
  const imagemUrl = sanitizeString(raw?.imagemUrl);
  const imagemPath = sanitizeString(raw?.imagemPath);
  const titulo = sanitizeString(raw?.titulo);
  const id = sanitizeString(raw?.id) || `pix_qr_${Date.now()}_${index}`;

  if (valorCentavos <= 0 || !imagemUrl) return null;
  return {
    id,
    valorCentavos,
    imagemUrl,
    imagemPath: imagemPath || "",
    titulo: titulo || "",
  };
}

function normalizePixQrs(rawList = []) {
  const list = Array.isArray(rawList) ? rawList : [];
  const normalized = [];
  const byValue = new Map();

  for (let index = 0; index < list.length; index += 1) {
    const qr = normalizePixQr(list[index], index);
    if (!qr) continue;
    byValue.set(qr.valorCentavos, qr);
  }

  for (const qr of byValue.values()) {
    normalized.push(qr);
    if (normalized.length >= MAX_PIX_QRS) break;
  }

  normalized.sort((a, b) => a.valorCentavos - b.valorCentavos);
  return normalized;
}

function findPixQrByValue(qrs = [], valorCentavos = 0) {
  const target = toPositiveInteger(valorCentavos);
  if (target <= 0) return null;
  return qrs.find((item) => toPositiveInteger(item?.valorCentavos) === target) || null;
}

function getPixManualRef(uid) {
  return doc(db, "users", sanitizeString(uid), "integracoes", "pixManual");
}

function getPedidoRef(ownerUid, pedidoId) {
  return doc(db, "users", sanitizeString(ownerUid), "pedidos", sanitizeString(pedidoId));
}

function buildPedidoId(blocoId, compradorUid) {
  return `${sanitizeString(blocoId)}__${sanitizeString(compradorUid)}`;
}

async function getBuyerContext(compradorUid) {
  const buyerUserSnap = await getDoc(doc(db, "users", compradorUid));
  return {
    skinAtivaId: sanitizeString(buyerUserSnap.data()?.skinAtivaId),
  };
}

async function buyerAlreadyHasAccess({
  ownerUserId,
  espacoId,
  blocoId,
  compradorUid,
  skinAtivaId = "",
}) {
  const compradorUidRef = doc(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "compradores",
    compradorUid
  );
  const compradorUidSnap = await getDoc(compradorUidRef);
  if (compradorUidSnap.exists()) return true;

  if (!skinAtivaId) return false;
  const compradorSkinRef = doc(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "compradores",
    skinAtivaId
  );
  try {
    const compradorSkinSnap = await getDoc(compradorSkinRef);
    return compradorSkinSnap.exists();
  } catch (err) {
    // Em alguns fluxos onepage, skinAtivaId pode nao ser uma skin propria do comprador.
    // Nesses casos, a leitura pode ser negada pelas rules e devemos tratar como "nao comprado".
    if (String(err?.code || "") === "permission-denied") {
      return false;
    }
    throw err;
  }
}

async function carregarBlocoCompravel(ownerUserId, espacoId, blocoId) {
  const blocoRef = doc(db, "users", ownerUserId, "espacos", espacoId, "blocos", blocoId);
  const blocoSnap = await getDoc(blocoRef);
  if (!blocoSnap.exists()) {
    throw new Error("Bloco nao encontrado.");
  }

  const blocoData = blocoSnap.data() || {};
  const visibilidade = sanitizeString(blocoData?.visibilidade).toLowerCase();
  const precoCentavos = toPositiveInteger(blocoData?.precoCentavos);
  const moeda = sanitizeString(blocoData?.moeda || "BRL").toUpperCase() || "BRL";
  const requerCompra = visibilidade === "exclusivo_comprador" || visibilidade === "comprado";

  if (!requerCompra || precoCentavos <= 0) {
    throw new Error("Esse bloco nao esta configurado para compra por PIX.");
  }

  return {
    ref: blocoRef,
    data: blocoData,
    visibilidade,
    precoCentavos,
    moeda,
  };
}

async function carregarPixManualOwner(ownerUserId) {
  const pixSnap = await getDoc(getPixManualRef(ownerUserId));
  const pixData = pixSnap.exists() ? pixSnap.data() : {};
  const enabled = Boolean(pixData?.enabled);
  const chavePix = sanitizeString(pixData?.chavePix);
  const qrs = normalizePixQrs(pixData?.qrs);

  return {
    enabled,
    chavePix,
    nomeRecebedor: sanitizeString(pixData?.nomeRecebedor),
    cidadeRecebedor: sanitizeString(pixData?.cidadeRecebedor),
    instrucoes: sanitizeString(pixData?.instrucoes),
    pixCopiaECola: sanitizeString(pixData?.pixCopiaECola),
    qrs,
  };
}

export async function salvarMercadoPagoCredenciais({ accessToken, publicKey = "" }) {
  const response = await callSalvarCredenciais({ accessToken, publicKey });
  return response?.data || { ok: false };
}

export async function obterStatusMercadoPago() {
  const response = await callStatusCredenciais({});
  return response?.data || { conectado: false };
}

export async function desconectarMercadoPago() {
  const response = await callDesconectarCredenciais({});
  return response?.data || { ok: true, conectado: false };
}

export async function criarCheckoutBlocoMercadoPago({
  ownerUserId,
  espacoId,
  blocoId,
  skinUsername,
  returnTo = "",
  baseUrl,
}) {
  const response = await callCriarCheckout({
    ownerUserId,
    espacoId,
    blocoId,
    skinUsername,
    returnTo,
    baseUrl,
  });
  return response?.data || {};
}

export async function confirmarPagamentoBlocoMercadoPago({
  ownerUserId,
  espacoId,
  blocoId,
  paymentId,
}) {
  const response = await callConfirmarPagamento({
    ownerUserId,
    espacoId,
    blocoId,
    paymentId,
  });
  return response?.data || {};
}

export async function salvarPixManualConfig({
  enabled = false,
  chavePix = "",
  nomeRecebedor = "",
  cidadeRecebedor = "",
  instrucoes = "",
  pixCopiaECola = "",
  qrs = [],
}) {
  const uid = sanitizeString(auth?.currentUser?.uid);
  if (!uid) {
    throw new Error("Usuario nao autenticado para salvar PIX manual.");
  }

  const chavePixLimpa = sanitizeString(chavePix);
  if (enabled && !chavePixLimpa) {
    throw new Error("Informe a chave PIX para ativar pagamento manual.");
  }

  const qrsNormalizados = normalizePixQrs(qrs);

  await setDoc(
    getPixManualRef(uid),
    {
      enabled: Boolean(enabled),
      chavePix: chavePixLimpa || null,
      nomeRecebedor: sanitizeString(nomeRecebedor) || null,
      cidadeRecebedor: sanitizeString(cidadeRecebedor) || null,
      instrucoes: sanitizeString(instrucoes) || null,
      pixCopiaECola: sanitizeString(pixCopiaECola) || null,
      qrs: qrsNormalizados,
      updatedAt: serverTimestamp(),
      connectedAt: enabled ? serverTimestamp() : null,
    },
    { merge: true }
  );

  return {
    ok: true,
    enabled: Boolean(enabled),
    conectado: Boolean(enabled && chavePixLimpa),
    qrs: qrsNormalizados,
    maxQrs: MAX_PIX_QRS,
  };
}

export async function obterStatusPixManual() {
  const uid = sanitizeString(auth?.currentUser?.uid);
  if (!uid) {
    return { conectado: false, enabled: false, qrs: [], maxQrs: MAX_PIX_QRS };
  }

  const pix = await carregarPixManualOwner(uid);
  return {
    conectado: Boolean(pix.enabled && pix.chavePix),
    enabled: pix.enabled,
    chavePix: pix.chavePix,
    nomeRecebedor: pix.nomeRecebedor,
    cidadeRecebedor: pix.cidadeRecebedor,
    instrucoes: pix.instrucoes,
    pixCopiaECola: pix.pixCopiaECola,
    qrs: pix.qrs,
    maxQrs: MAX_PIX_QRS,
  };
}

export async function obterCheckoutPixManualBloco({ ownerUserId, espacoId, blocoId }) {
  const compradorUid = sanitizeString(auth?.currentUser?.uid);
  if (!compradorUid) {
    throw new Error("Usuario precisa estar autenticado para comprar.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const espaco = sanitizeString(espacoId);
  const bloco = sanitizeString(blocoId);
  if (!ownerUid || !espaco || !bloco) {
    throw new Error("Parametros obrigatorios ausentes para checkout PIX manual.");
  }
  if (ownerUid === compradorUid) {
    throw new Error("O criador nao pode comprar o proprio bloco.");
  }

  const blocoInfo = await carregarBlocoCompravel(ownerUid, espaco, bloco);
  const buyerContext = await getBuyerContext(compradorUid);
  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId: ownerUid,
    espacoId: espaco,
    blocoId: bloco,
    compradorUid,
    skinAtivaId: buyerContext.skinAtivaId,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const pix = await carregarPixManualOwner(ownerUid);
  if (!pix.enabled || !pix.chavePix) {
    throw new Error("Pagamento manual por PIX indisponivel para este criador.");
  }

  const qrSelecionado = findPixQrByValue(pix.qrs, blocoInfo.precoCentavos);
  if (!qrSelecionado) {
    throw new Error("Nao existe QR configurado para este valor no PIX manual.");
  }

  return {
    ok: true,
    alreadyPurchased: false,
    bloco: {
      blocoId: bloco,
      espacoId: espaco,
      ownerUserId: ownerUid,
      precoCentavos: blocoInfo.precoCentavos,
      moeda: blocoInfo.moeda,
    },
    pagamento: {
      tipo: "pix_manual",
      chavePix: pix.chavePix,
      nomeRecebedor: pix.nomeRecebedor,
      cidadeRecebedor: pix.cidadeRecebedor,
      instrucoes: pix.instrucoes,
      pixCopiaECola: pix.pixCopiaECola,
      qrSelecionado,
    },
  };
}

export async function solicitarPedidoPixManualBloco({
  ownerUserId,
  espacoId,
  blocoId,
  observacaoComprador = "",
}) {
  const compradorUid = sanitizeString(auth?.currentUser?.uid);
  if (!compradorUid) {
    throw new Error("Usuario precisa estar autenticado para solicitar o pedido.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const espaco = sanitizeString(espacoId);
  const bloco = sanitizeString(blocoId);
  if (!ownerUid || !espaco || !bloco) {
    throw new Error("Parametros obrigatorios ausentes para criar pedido.");
  }
  if (ownerUid === compradorUid) {
    throw new Error("O criador nao pode solicitar pedido do proprio bloco.");
  }

  const blocoInfo = await carregarBlocoCompravel(ownerUid, espaco, bloco);
  const buyerContext = await getBuyerContext(compradorUid);
  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId: ownerUid,
    espacoId: espaco,
    blocoId: bloco,
    compradorUid,
    skinAtivaId: buyerContext.skinAtivaId,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const pix = await carregarPixManualOwner(ownerUid);
  const qrSelecionado = findPixQrByValue(pix.qrs, blocoInfo.precoCentavos);
  if (!pix.enabled || !pix.chavePix || !qrSelecionado) {
    throw new Error("PIX manual indisponivel para este bloco no momento.");
  }

  const pedidoId = buildPedidoId(bloco, compradorUid);
  const pedidoRef = getPedidoRef(ownerUid, pedidoId);
  const compradorAtual = auth.currentUser;
  const pedidoExistenteSnap = await getDoc(pedidoRef);
  if (pedidoExistenteSnap.exists()) {
    const pedidoExistente = pedidoExistenteSnap.data() || {};
    const mesmoComprador = sanitizeString(pedidoExistente?.compradorUid) === compradorUid;
    const mesmoOwner = sanitizeString(pedidoExistente?.ownerUserId) === ownerUid;
    if (mesmoComprador && mesmoOwner) {
      return {
        ok: true,
        alreadyPurchased: false,
        alreadyRequested: true,
        pedidoId,
        status: sanitizeString(pedidoExistente?.status) || "pedido_solicitado",
      };
    }
  }

  await setDoc(
    pedidoRef,
    {
      pedidoId,
      ownerUserId: ownerUid,
      espacoId: espaco,
      blocoId: bloco,
      compradorUid,
      compradorSkinId: buyerContext.skinAtivaId || null,
      compradorEmail: sanitizeString(compradorAtual?.email) || null,
      compradorNome: sanitizeString(compradorAtual?.displayName) || null,
      observacaoComprador: sanitizeString(observacaoComprador) || null,
      precoCentavos: blocoInfo.precoCentavos,
      moeda: blocoInfo.moeda,
      qrSelecionado,
      status: "pedido_solicitado",
      atualizadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
      confirmadoEm: null,
      confirmadoPorUid: null,
    },
    { merge: true }
  );

  return {
    ok: true,
    alreadyPurchased: false,
    pedidoId,
    status: "pedido_solicitado",
  };
}

export async function listarPedidosPixManual({ ownerUserId = "" } = {}) {
  const currentUid = sanitizeString(auth?.currentUser?.uid);
  if (!currentUid) {
    throw new Error("Usuario nao autenticado.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const parseDocs = (docs = []) =>
    docs.map((item) => {
      const data = item.data() || {};
      const criadoEm = data?.criadoEm?.toMillis ? data.criadoEm.toMillis() : 0;
      const atualizadoEm = data?.atualizadoEm?.toMillis ? data.atualizadoEm.toMillis() : 0;
      return {
        id: item.id,
        ...data,
        __createdAtMs: criadoEm,
        __updatedAtMs: atualizadoEm,
      };
    });

  const pedidos = [];
  if (ownerUid) {
    const isOwnerView = ownerUid === currentUid;
    const pedidosSnap = isOwnerView
      ? await getDocs(collection(db, "users", currentUid, "pedidos"))
      : await getDocs(
          query(
            collection(db, "users", ownerUid, "pedidos"),
            where("compradorUid", "==", currentUid)
          )
        );
    pedidos.push(...parseDocs(pedidosSnap.docs));
  } else {
    const ownerSnap = await getDocs(collection(db, "users", currentUid, "pedidos"));
    pedidos.push(...parseDocs(ownerSnap.docs));

    try {
      const buyerSnap = await getDocs(
        query(collectionGroup(db, "pedidos"), where("compradorUid", "==", currentUid))
      );
      pedidos.push(...parseDocs(buyerSnap.docs));
    } catch (err) {
      if (String(err?.code || "") !== "permission-denied") {
        throw err;
      }
      // Em alguns projetos/regras, collectionGroup de pedidos pode ser bloqueado.
      // Nesses casos, seguimos com a colecao local do usuario autenticado.
    }
  }

  const dedupe = new Map();
  for (const pedido of pedidos) {
    const key = `${sanitizeString(pedido?.ownerUserId)}::${sanitizeString(
      pedido?.pedidoId || pedido?.id
    )}`;
    dedupe.set(key, pedido);
  }

  const merged = [...dedupe.values()].map((item) => {
    return {
      ...item,
      __isOwner: sanitizeString(item?.ownerUserId) === currentUid,
    };
  });

  merged.sort(
    (a, b) => (b.__updatedAtMs || b.__createdAtMs || 0) - (a.__updatedAtMs || a.__createdAtMs || 0)
  );
  return merged;
}

export async function confirmarPedidoPixManual({ ownerUserId = "", pedidoId = "" }) {
  const currentUid = sanitizeString(auth?.currentUser?.uid);
  if (!currentUid) {
    throw new Error("Usuario nao autenticado.");
  }

  const ownerUid = sanitizeString(ownerUserId) || currentUid;
  if (ownerUid !== currentUid) {
    throw new Error("Apenas o administrador pode confirmar solicitacoes.");
  }

  const pedidoRef = getPedidoRef(ownerUid, pedidoId);
  const pedidoSnap = await getDoc(pedidoRef);
  if (!pedidoSnap.exists()) {
    throw new Error("Pedido nao encontrado.");
  }

  const pedido = pedidoSnap.data() || {};
  if (sanitizeString(pedido?.status) === "pagamento_confirmado") {
    return { ok: true, alreadyConfirmed: true };
  }

  const blocoId = sanitizeString(pedido?.blocoId);
  const espacoId = sanitizeString(pedido?.espacoId);
  const compradorUid = sanitizeString(pedido?.compradorUid);
  const compradorSkinId = sanitizeString(pedido?.compradorSkinId);

  if (!blocoId || !espacoId || !compradorUid) {
    throw new Error("Pedido invalido para confirmacao.");
  }

  const compradorRef = doc(
    db,
    "users",
    ownerUid,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "compradores",
    compradorUid
  );

  const batch = writeBatch(db);
  batch.set(
    compradorRef,
    {
      liberadoPorPedidoId: sanitizeString(pedidoId),
      liberadoEm: serverTimestamp(),
      confirmadoPorUid: currentUid,
      compradorUid,
      espacoId,
      blocoId,
    },
    { merge: true }
  );

  if (compradorSkinId) {
    const compradorSkinRef = doc(
      db,
      "users",
      ownerUid,
      "espacos",
      espacoId,
      "blocos",
      blocoId,
      "compradores",
      compradorSkinId
    );
    batch.set(
      compradorSkinRef,
      {
        liberadoPorPedidoId: sanitizeString(pedidoId),
        liberadoEm: serverTimestamp(),
        confirmadoPorUid: currentUid,
        compradorUid,
        compradorSkinId,
        espacoId,
        blocoId,
      },
      { merge: true }
    );
  }

  batch.set(
    pedidoRef,
    {
      status: "pagamento_confirmado",
      confirmadoEm: serverTimestamp(),
      confirmadoPorUid: currentUid,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  return { ok: true, alreadyConfirmed: false };
}
