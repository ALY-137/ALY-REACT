import { httpsCallable } from "firebase/functions";
import { functions } from "../../Banco/init-firebase";

const callSalvarCredenciais = httpsCallable(functions, "salvarMercadoPagoCredenciais");
const callStatusCredenciais = httpsCallable(functions, "obterStatusMercadoPago");
const callCriarCheckout = httpsCallable(functions, "criarCheckoutBlocoMercadoPago");
const callConfirmarPagamento = httpsCallable(functions, "confirmarPagamentoBlocoMercadoPago");

export async function salvarMercadoPagoCredenciais({ accessToken, publicKey = "" }) {
  const response = await callSalvarCredenciais({ accessToken, publicKey });
  return response?.data || { ok: false };
}

export async function obterStatusMercadoPago() {
  const response = await callStatusCredenciais({});
  return response?.data || { conectado: false };
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
