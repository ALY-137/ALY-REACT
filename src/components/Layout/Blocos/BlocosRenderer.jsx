export default function BlocosRenderer({ blocos }) {

return ( <div style={{ display: “flex”, flexDirection: “column”, gap: 16
}}>

      {blocos.map((bloco) => (
        <div key={bloco.id} style={{ border: "1px solid #ccc", padding: 12 }}>

          <h3>{bloco.titulo}</h3>

          {bloco.cards?.map((card) => (
            <div key={card.id} style={{ marginBottom: 8 }}>
              <img src={card.imagem} style={{ width: 120 }} />
              <p>{card.nome}</p>
            </div>
          ))}

        </div>
      ))}

    </div>

);

}