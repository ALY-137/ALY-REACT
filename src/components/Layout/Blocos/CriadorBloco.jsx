import { useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth";

export default function CriadorBloco({ onCreate }) {
  const [tipo, setTipo] = useState("card");
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return null;

  function criarBloco() {
    const novoBloco = {
      id: crypto.randomUUID(),
      tipo,
      dados: {},
      ordem: Date.now()
    };

    onCreate(novoBloco);
  }

  return (
    <div className="bloco-creator">
      <h3>Criar Bloco</h3>

      <select value={tipo} onChange={e => setTipo(e.target.value)}>
        <option value="card">Card</option>
        <option value="texto">Texto</option>
        <option value="imagem">Imagem</option>
      </select>

      <button onClick={criarBloco}>
        Criar
      </button>
    </div>
  );
}
