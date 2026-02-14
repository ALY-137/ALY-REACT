import { useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../../Banco/init-firebase";

async function gerarPreviewDesfocado(file) {
  try {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    const ctx = canvas.getContext("2d");
    ctx.filter = "blur(30px)";
    ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    if (typeof imageBitmap.close === "function") {
      imageBitmap.close();
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.75)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview desfocado.");
    }

    return new File([blob], `preview-${Date.now()}.webp`, {
      type: "image/webp",
    });
  } catch (err) {
    // Fallback seguro: nunca reutiliza arquivo original como preview.
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 48, 48);
      gradient.addColorStop(0, "#2a2a2a");
      gradient.addColorStop(1, "#5a5a5a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 48, 48);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, 20, 48, 8);
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.7)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview seguro.");
    }

    return new File([blob], `preview-seguro-${Date.now()}.webp`, {
      type: "image/webp",
    });
  }
}


export default function CriadorBloco({ espacoAtual, skinIdAtual, onCreate }) {
  const { user, loading } = useAuth();
  const [files, setFiles] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [visibilidade, setVisibilidade] = useState("publico");
  const [valorCompra, setValorCompra] = useState("");

  if (loading || !user || !espacoAtual) return null;

  const espacoId = espacoAtual.id || espacoAtual.id_espaco;
  const ownerUserId = espacoAtual.ownerUserId || null;
  const activeSkinId = skinIdAtual || localStorage.getItem("skinIdAtual");
  const isOwner = espacoAtual.ownerUserId === user.uid;
  const isCoCriador =
    Array.isArray(espacoAtual.coCriadoresUids) &&
    espacoAtual.coCriadoresUids.includes(user.uid);
  const isCoCriadorPorSkin =
    activeSkinId &&
    Array.isArray(espacoAtual.coCriadoresSkins) &&
    espacoAtual.coCriadoresSkins.includes(activeSkinId);
  const fallbackSkinOwner =
    !!activeSkinId && espacoAtual.skinOwner === activeSkinId;

  const podeCriar = isOwner || isCoCriador || isCoCriadorPorSkin || fallbackSkinOwner;

  if (!podeCriar) return null;

  const isExclusivoComprador = visibilidade === "exclusivo_comprador";

  const parseValorCompraEmCentavos = (valorTexto) => {
    const normalizado = String(valorTexto || "").replace(",", ".").trim();
    if (!normalizado) return null;
    const valorNumerico = Number(normalizado);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    return Math.round(valorNumerico * 100);
  };

  async function criarBloco() {
    if (!files.length) return alert("Selecione ao menos uma imagem");
    if (!espacoId) return alert("Espaco sem id valido.");
    if (!ownerUserId) return alert("Espaco sem ownerUserId valido.");

    const precoCentavos = isExclusivoComprador
      ? parseValorCompraEmCentavos(valorCompra)
      : null;

    if (isExclusivoComprador && !precoCentavos) {
      alert("Informe um valor valido para bloco exclusivo de comprador.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const blocoRef = doc(
        collection(db, "users", ownerUserId, "espacos", espacoId, "blocos")
      );
      const blocoId = blocoRef.id;

      // 1) Upload das imagens
      const previewUrlsPersistidas = [];
      const previewUrlsParaUI = [];
      const previewPaths = [];
      const originaisPaths = [];
      const originaisPublicasPersistidas = [];
      const originaisPublicasParaUI = [];

      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;
        const originalPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/original/${fileName}`;
        const previewPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/preview/${fileName}`;

        const originalRef = ref(
          storage,
          originalPath
        );
        const previewRef = ref(storage, previewPath);

        await uploadBytes(originalRef, file);
        if (visibilidade === "publico") {
          try {
            const originalUrlPublica = await getDownloadURL(originalRef);
            originaisPublicasPersistidas.push(originalUrlPublica);
            originaisPublicasParaUI.push(originalUrlPublica);
          } catch (originalUrlErr) {
            console.warn(
              "Falha ao obter URL publica do original:",
              originalUrlErr?.code,
              originalUrlErr?.message
            );
          }
        } else {
          const previewFile = await gerarPreviewDesfocado(file);
          await uploadBytes(previewRef, previewFile);

          previewPaths.push(previewPath);
          try {
            const previewUrl = await getDownloadURL(previewRef);
            previewUrlsPersistidas.push(previewUrl);
            previewUrlsParaUI.push(previewUrl);
          } catch (previewUrlErr) {
            if (previewUrlErr?.code !== "storage/unauthorized") {
              throw previewUrlErr;
            }
            // Mantem preview imediato no cliente mesmo sem URL remoto.
            previewUrlsParaUI.push(URL.createObjectURL(previewFile));
          }
        }
        originaisPaths.push(originalPath);

      }

      // 2) Criar bloco no Firestore
      const blocoPayload = {
        id: blocoId,
        tipo: "imagem",
        imagensPreview: previewUrlsPersistidas,
        imagensPreviewPaths: previewPaths,
        imagensOriginaisPaths: originaisPaths,
        imagensOriginaisPublicas: originaisPublicasPersistidas,
        imagens:
          visibilidade === "publico"
            ? originaisPublicasPersistidas
            : previewUrlsPersistidas, // compatibilidade legado
        criadoPor: user.uid,
        criadoEm: serverTimestamp(),
        ordem: Date.now(),
        espacoId,
        ownerUserId,
        skinOwner: espacoAtual.skinOwner || activeSkinId || null,
        visibilidade,
        precoCentavos: precoCentavos || null,
        moeda: precoCentavos ? "BRL" : null,
      };

      await setDoc(blocoRef, blocoPayload);

      if (onCreate) {
        onCreate({
          criadoEm: new Date().toISOString(),
          ...blocoPayload,
          imagensPreview: previewUrlsParaUI,
          imagensOriginaisPublicas: originaisPublicasParaUI,
          imagens:
            visibilidade === "publico"
              ? originaisPublicasParaUI
              : previewUrlsParaUI,
        });
      }

      setFiles([]);
      setValorCompra("");
      alert("Bloco criado com sucesso!");

    } catch (err) {
      console.error("Erro ao criar bloco:", err);
      setErro(`${err?.code || "erro"}: ${err?.message || "Falha ao criar bloco"}`);
      alert("Erro ao criar bloco. Veja o console para detalhes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bloco-creator">
      <h3>Criar bloco de imagens</h3>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles([...e.target.files])}
      />

      <select
        value={visibilidade}
        onChange={(e) => setVisibilidade(e.target.value)}
      >
        <option value="publico">Publico</option>
        <option value="publico_restritivo">Publico restritivo</option>
        <option value="privado">Privado (autenticado)</option>
        <option value="exclusivo_assinante">Exclusivo assinante</option>
        <option value="exclusivo_comprador">Exclusivo comprador</option>
      </select>

      {isExclusivoComprador && (
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Valor (R$)"
          value={valorCompra}
          onChange={(e) => setValorCompra(e.target.value)}
        />
      )}

      <button onClick={criarBloco} disabled={enviando}>
        {enviando ? "Enviando..." : "Criar bloco"}
      </button>

      {!!erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}
