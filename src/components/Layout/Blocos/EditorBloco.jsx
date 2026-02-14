import { useEffect, useState } from "react";

const OPCOES_VISIBILIDADE = [
  { value: "publico", label: "Publico" },
  { value: "publico_restritivo", label: "Publico restritivo" },
  { value: "privado", label: "Privado (autenticado)" },
  { value: "exclusivo_assinante", label: "Exclusivo assinante" },
  { value: "exclusivo_comprador", label: "Exclusivo comprador" },
];

export default function EditorBloco({
  bloco,
  onSalvar,
  onExcluir,
  salvando = false,
  excluindo = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [visibilidade, setVisibilidade] = useState(bloco?.visibilidade || "publico");

  useEffect(() => {
    setVisibilidade(bloco?.visibilidade || "publico");
  }, [bloco?.id, bloco?.visibilidade]);

  const handleSalvar = async () => {
    await onSalvar({ visibilidade });
    setAberto(false);
  };

  const bloqueado = salvando || excluindo;

  return (
    <div style={{ marginTop: 8, borderTop: "1px solid #ddd", paddingTop: 8 }}>
      {!aberto ? (
        <button onClick={() => setAberto(true)} disabled={bloqueado}>
          Editar bloco
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={visibilidade}
            onChange={(event) => setVisibilidade(event.target.value)}
            disabled={bloqueado}
          >
            {OPCOES_VISIBILIDADE.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          <button onClick={handleSalvar} disabled={bloqueado}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={() => {
              setVisibilidade(bloco?.visibilidade || "publico");
              setAberto(false);
            }}
            disabled={bloqueado}
          >
            Cancelar
          </button>
          <button onClick={onExcluir} disabled={bloqueado} style={{ color: "red" }}>
            {excluindo ? "Excluindo..." : "Excluir bloco"}
          </button>
        </div>
      )}
    </div>
  );
}
