import React, { useState, useEffect } from "react";

const LedControl = () => {
  const [connectionStatus, setConnectionStatus] = useState("Conectando...");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Inicializar conexão WebSocket
    const ws = new WebSocket("wss://aly137.vercel.app/ledcontrol:443");

    ws.onopen = () => {
      setConnectionStatus("Conectado!");
      console.log("Conexão estabelecida com o servidor WebSocket.");
    };

    ws.onmessage = (message) => {
      console.log("Mensagem recebida:", message.data);
    };

    ws.onerror = (error) => {
      console.error("Erro no WebSocket:", error);
      setConnectionStatus("Erro na conexão");
    };
 
    ws.onclose = () => {
      console.log("Conexão encerrada, tentando reconectar...");
      setConnectionStatus("Reconectando...");
      // Tentar reconectar após 2 segundos
      setTimeout(() => {
        const newWs = new WebSocket("wss://aly137.vercel.app/ledcontrol:443");
        setSocket(newWs);
      }, 2000);
    };

    setSocket(ws);

    // Limpar conexão ao desmontar o componente
    return () => {
      ws.close();
    };
  }, []);

  const handleLedControl = (ledCommand) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(ledCommand);
      console.log(`Comando enviado: ${ledCommand}`);
    } else {
      console.error("Conexão WebSocket não está aberta.");
    }
  };

  return (
    <div style={{ textAlign: "center", margin: "20px" }}>
      <h2>Controle de LEDs</h2>
      <p>Status da conexão: {connectionStatus}</p>
      <div>
        <button
          onClick={() => handleLedControl("ledEsq_on")}
          style={{ margin: "10px", padding: "10px 20px" }}
        >
          ESQUERDA
        </button>
        <button
          onClick={() => handleLedControl("leds_off")}
          style={{ margin: "10px", padding: "10px 20px" }}
        >
          DESLIGAR
        </button>
        <button
          onClick={() => handleLedControl("ledDir_on")}
          style={{ margin: "10px", padding: "10px 20px" }}
        >
          DIREITA
        </button>
      </div>
    </div>
  );
};

export default LedControl;
