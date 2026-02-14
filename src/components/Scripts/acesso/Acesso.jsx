import React, { useEffect, useState } from 'react';
import { seforAdm } from '../verificacoes/verificaAdm';
import { db, auth } from '../../Banco/init-firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function Acesso() {
  const [dados, setDados] = useState(null);
  const [endereco, setEndereco] = useState(null);
  const [jaEnviado, setJaEnviado] = useState(false);
  const [user, setUser] = useState(null);

  // 1️⃣ Aguarda autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsubscribe();
  }, []);

  // 2️⃣ Buscar IP (somente se user existir e NÃO for admin)
  useEffect(() => {
    if (!user) return;

    if (!seforAdm(user)) {
      fetch("https://ipwho.is/")
        .then(res => res.json())
        .then(data => {
          setDados(data);

          if (data.postal) {
            const cep = data.postal.replace(/\D/g, "");
            buscarEnderecoViaCEP(cep);
          }
        })
        .catch(err => console.error("Erro ipwho.is:", err));
    }
  }, [user]);

  // 3️⃣ ViaCEP
  const buscarEnderecoViaCEP = (cep) => {
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        if (!data.erro) setEndereco(data);
      })
      .catch(err => console.error("Erro ViaCEP:", err));
  };

  // 4️⃣ Enviar UMA vez
  useEffect(() => {
    if (dados && endereco && user && !jaEnviado) {
      enviarDadosParaBanco(dados, endereco);
      setJaEnviado(true);
    }
  }, [dados, endereco, user, jaEnviado]);

  const enviarDadosParaBanco = async (dadosIP, dadosEndereco) => {
    try {
      await addDoc(collection(db, 'acessos'), {
        uid: user.uid,
        hash: localStorage.getItem('navegacaoHash') || null,

        ip: dadosIP.ip,
        country: dadosIP.country,
        region: dadosIP.region,
        city: dadosIP.city,
        org: dadosIP.connection?.org || "",

        cep: dadosEndereco?.cep || "",
        logradouro: dadosEndereco?.logradouro || "",
        bairro: dadosEndereco?.bairro || "",
        cidade: dadosEndereco?.localidade || "",
        uf: dadosEndereco?.uf || "",

        data: serverTimestamp(),
        visto: false,
      });

    } catch (error) {
      console.error("Erro ao enviar acesso:", error);
    }
  };

  return null;
}

export default Acesso;

