import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../../../../Banco/init-firebase";
import {
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../../../Banco/sharedBucketApi";
import {
  obterStatusPixManual,
  salvarPixManualConfig,
} from "../../../Pagamentos/mercadoPagoApi";

const MAX_QRS = 20;

function parseErroPixManual(err) {
  const details = err?.details || err?.customData?.details || "";
  const message = err?.message || "";
  return details || message || "Falha ao comunicar com PIX manual.";
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function formatarValorInput(valorCentavos = 0) {
  if (!valorCentavos) return "";
  return (Number(valorCentavos) / 100).toFixed(2);
}

function parseValorInputToCentavos(value) {
  const normalizado = String(value || "").replace(",", ".").trim();
  if (!normalizado) return 0;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.round(numero * 100);
}

function criarQrVazio() {
  return {
    id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    valorInput: "",
    valorCentavos: 0,
    imagemUrl: "",
    imagemPath: "",
    imagemArquivo: null,
    imagemPreviewUrl: "",
    titulo: "",
  };
}

function normalizarQrsStatus(qrs = []) {
  const lista = Array.isArray(qrs) ? qrs : [];
  return lista.slice(0, MAX_QRS).map((item, index) => ({
    id: String(item?.id || `qr_${Date.now()}_${index}`),
    valorInput: formatarValorInput(toPositiveInteger(item?.valorCentavos)),
    valorCentavos: toPositiveInteger(item?.valorCentavos),
    imagemUrl: String(item?.imagemUrl || "").trim(),
    imagemPath: String(item?.imagemPath || "").trim(),
    imagemArquivo: null,
    imagemPreviewUrl: "",
    titulo: String(item?.titulo || "").trim(),
  }));
}

function nomeArquivoSeguro(nome = "qr.png") {
  return String(nome || "qr.png")
    .trim()
    .replace(/[^\w.\-]/g, "_");
}

async function subirImagemQr({ uid, qrId, arquivo }) {
  const nome = `${Date.now()}-${nomeArquivoSeguro(arquivo?.name || "qr.png")}`;
  const path = `users/${uid}/integracoes/pixManual/qrs/${qrId}/${nome}`;

  if (usandoBucketCompartilhadoCrossProject()) {
    const upload = await uploadArquivoNoBucketCompartilhado({
      user: auth.currentUser,
      path,
      file: arquivo,
    });
    return {
      imagemPath: path,
      imagemUrl: String(upload?.url || ""),
    };
  }

  const qrRef = ref(storage, path);
  await uploadBytes(qrRef, arquivo);
  const url = await getDownloadURL(qrRef);
  return {
    imagemPath: path,
    imagemUrl: url,
  };
}

export default function PixManualConfig() {
  const [enabled, setEnabled] = useState(false);
  const [chavePix, setChavePix] = useState("");
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [cidadeRecebedor, setCidadeRecebedor] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [pixCopiaECola, setPixCopiaECola] = useState("");
  const [qrs, setQrs] = useState([]);
  const [carregandoStatus, setCarregandoStatus] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const podeAdicionarQr = qrs.length < MAX_QRS;

  const qrsOrdenados = useMemo(
    () =>
      [...qrs].sort(
        (a, b) =>
          toPositiveInteger(a?.valorCentavos || parseValorInputToCentavos(a?.valorInput)) -
          toPositiveInteger(b?.valorCentavos || parseValorInputToCentavos(b?.valorInput))
      ),
    [qrs]
  );

  const carregarStatus = async () => {
    setCarregandoStatus(true);
    setMensagem("");
    try {
      const data = await obterStatusPixManual();
      setEnabled(Boolean(data?.enabled));
      setChavePix(String(data?.chavePix || ""));
      setNomeRecebedor(String(data?.nomeRecebedor || ""));
      setCidadeRecebedor(String(data?.cidadeRecebedor || ""));
      setInstrucoes(String(data?.instrucoes || ""));
      setPixCopiaECola(String(data?.pixCopiaECola || ""));
      setQrs(normalizarQrsStatus(data?.qrs));
    } catch (err) {
      setMensagem(parseErroPixManual(err));
    } finally {
      setCarregandoStatus(false);
    }
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const atualizarQr = (id, patch) => {
    setQrs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const adicionarQr = () => {
    if (!podeAdicionarQr) return;
    setQrs((prev) => [...prev, criarQrVazio()]);
  };

  const removerQr = (id) => {
    setQrs((prev) => prev.filter((item) => item.id !== id));
  };

  const salvar = async () => {
    if (enabled && !String(chavePix || "").trim()) {
      alert("Informe a chave PIX para ativar pagamento manual.");
      return;
    }

    const uid = String(auth?.currentUser?.uid || "").trim();
    if (!uid) {
      setMensagem("Usuario nao autenticado para salvar PIX manual.");
      return;
    }

    setSalvando(true);
    setMensagem("");

    try {
      const qrsProcessados = [];
      for (const qr of qrsOrdenados) {
        const valorCentavos =
          toPositiveInteger(qr?.valorCentavos) || parseValorInputToCentavos(qr?.valorInput);
        if (valorCentavos <= 0) {
          throw new Error("Todos os QRs devem ter valor valido.");
        }

        let imagemUrl = String(qr?.imagemUrl || "").trim();
        let imagemPath = String(qr?.imagemPath || "").trim();

        if (qr?.imagemArquivo instanceof File) {
          const upload = await subirImagemQr({
            uid,
            qrId: qr.id,
            arquivo: qr.imagemArquivo,
          });
          imagemUrl = upload.imagemUrl;
          imagemPath = upload.imagemPath;
        }

        if (!imagemUrl) {
          throw new Error("Todos os QRs devem ter imagem.");
        }

        qrsProcessados.push({
          id: qr.id,
          valorCentavos,
          imagemUrl,
          imagemPath,
          titulo: String(qr?.titulo || "").trim(),
        });
      }

      await salvarPixManualConfig({
        enabled: Boolean(enabled),
        chavePix: String(chavePix || "").trim(),
        nomeRecebedor: String(nomeRecebedor || "").trim(),
        cidadeRecebedor: String(cidadeRecebedor || "").trim(),
        instrucoes: String(instrucoes || "").trim(),
        pixCopiaECola: String(pixCopiaECola || "").trim(),
        qrs: qrsProcessados,
      });

      setMensagem("Configuracao de PIX manual salva com sucesso.");
      await carregarStatus();
    } catch (err) {
      setMensagem(parseErroPixManual(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ marginBottom: 20, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>PIX Manual</h3>
      <p style={{ margin: "4px 0 10px" }}>
        Exibe chave PIX e QR por valor para pagamento manual.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={salvando || carregandoStatus}
        />
        Ativar pagamento manual por PIX
      </label>

      <input
        type="text"
        placeholder="Chave PIX (obrigatoria quando ativo)"
        value={chavePix}
        onChange={(event) => setChavePix(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
      />
      <input
        type="text"
        placeholder="Nome do recebedor (opcional)"
        value={nomeRecebedor}
        onChange={(event) => setNomeRecebedor(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
      />
      <input
        type="text"
        placeholder="Cidade do recebedor (opcional)"
        value={cidadeRecebedor}
        onChange={(event) => setCidadeRecebedor(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
      />
      <textarea
        placeholder="Instrucoes para o comprador (opcional)"
        value={instrucoes}
        onChange={(event) => setInstrucoes(event.target.value)}
        style={{ width: "100%", marginTop: 8, minHeight: 70 }}
      />
      <textarea
        placeholder="PIX copia e cola (opcional)"
        value={pixCopiaECola}
        onChange={(event) => setPixCopiaECola(event.target.value)}
        style={{ width: "100%", marginTop: 8, minHeight: 70 }}
      />

      <div style={{ marginTop: 12, borderTop: "1px solid #ddd", paddingTop: 10 }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>
          QR Codes por valor ({qrs.length}/{MAX_QRS})
        </h4>
        <p style={{ margin: "0 0 8px" }}>
          Configure ate 20 valores. O bloco pago usa automaticamente o QR do valor selecionado.
        </p>

        {qrsOrdenados.map((qr) => (
          <div
            key={qr.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
              display: "grid",
              gap: 8,
            }}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Valor (R$)"
              value={qr.valorInput}
              onChange={(event) => {
                const valorInput = event.target.value;
                atualizarQr(qr.id, {
                  valorInput,
                  valorCentavos: parseValorInputToCentavos(valorInput),
                });
              }}
              disabled={salvando || carregandoStatus}
            />
            <input
              type="text"
              placeholder="Titulo opcional (ex: Plano Basico)"
              value={qr.titulo}
              onChange={(event) => atualizarQr(qr.id, { titulo: event.target.value })}
              disabled={salvando || carregandoStatus}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const arquivo = event.target.files?.[0] || null;
                atualizarQr(qr.id, {
                  imagemArquivo: arquivo,
                  imagemPreviewUrl: arquivo ? URL.createObjectURL(arquivo) : "",
                });
                event.target.value = "";
              }}
              disabled={salvando || carregandoStatus}
            />
            {(qr.imagemPreviewUrl || qr.imagemUrl) ? (
              <img
                src={qr.imagemPreviewUrl || qr.imagemUrl}
                alt="QR PIX"
                style={{ width: 150, height: 150, objectFit: "cover", border: "1px solid #ddd" }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => removerQr(qr.id)}
              disabled={salvando || carregandoStatus}
              style={{ color: "red" }}
            >
              Remover QR
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionarQr}
          disabled={!podeAdicionarQr || salvando || carregandoStatus}
        >
          Adicionar QR
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={salvando || carregandoStatus}>
          {salvando ? "Salvando..." : "Salvar PIX manual"}
        </button>
        <button onClick={carregarStatus} disabled={carregandoStatus || salvando}>
          Atualizar status
        </button>
      </div>

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
    </div>
  );
}
