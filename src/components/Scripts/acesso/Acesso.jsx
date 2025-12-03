import React, { useEffect, useState } from 'react';
import firebase from "firebase/app";
import 'firebase/firestore';
import { db } from '../../Banco/init-firebase';
import { idGoogleCap } from '../../../App';
import { seforAdm } from '../verificações/verificaAdm';

function Acesso({ valorEmail }) {
  const [dados, setDados] = useState(null);
  const [endereco, setEndereco] = useState(null);
  const [jaEnviado, setJaEnviado] = useState(false);

  // --------------------------
  // 1) BUSCAR IP E LOCALIZAÇÃO
  // --------------------------
  useEffect(() => {
    if (!seforAdm(idGoogleCap)) {
      fetch("https://ipwho.is/")
        .then(res => res.json())
        .then(data => {
          console.log("Dados IP whois:", data);

          setDados(data); // salva tudo

          // se tiver postal (CEP)
          if (data.postal) {
            const cep = data.postal.replace(/\D/g, "");
            buscarEnderecoViaCEP(cep);
          }
        })
        .catch(err => console.error("Erro ao consultar ipwho.is:", err));
    }
  }, [idGoogleCap]);


  // --------------------------------
  // 2) BUSCAR ENDEREÇO VIA VIA CEP
  // --------------------------------
  const buscarEnderecoViaCEP = (cep) => {
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        console.log("Endereço via CEP:", data);

        if (!data.erro) {
          setEndereco(data);
        }
      })
      .catch(err => console.error("Erro ao consultar ViaCEP:", err));
  };


  // ---------------------------------------------------------
  // 3) ENVIAR PARA O FIREBASE: IP + LOCALIZAÇÃO + ENDEREÇO
  // ---------------------------------------------------------
  const enviarDadosParaBanco = async (dadosIP, dadosEndereco) => {
    try {
      const docRef = await db.collection('acessos').add({
        hash: localStorage.getItem('navegacaoHash'),

        // IP who.is
        ip: dadosIP.ip,
        country: dadosIP.country,
        region: dadosIP.region,
        city: dadosIP.city,
        org: dadosIP.connection?.org || "",

        // Endereço ViaCEP
        cep: dadosEndereco?.cep || "",
        logradouro: dadosEndereco?.logradouro || "",
        bairro: dadosEndereco?.bairro || "",
        cidade: dadosEndereco?.localidade || "",
        uf: dadosEndereco?.uf || "",

        data: firebase.firestore.FieldValue.serverTimestamp(),
        visto: false,
      });

      console.log("Dados enviados para o banco:", docRef.id);

    } catch (error) {
      console.error("Erro ao enviar ao banco:", error);
    }
  };


  // --------------------------------------------------------------
  // 4) QUANDO TIVER DADOS DO IP + ENDEREÇO, ENVIA UMA ÚNICA VEZ
  // --------------------------------------------------------------
useEffect(() => {
  if (dados && endereco && !jaEnviado) {
    enviarDadosParaBanco(dados, endereco);
    setJaEnviado(true);
  }
}, [dados, endereco]);



  return null;
}

export default Acesso;
