import React, { useEffect, useState } from 'react';
import firebase from "firebase/app";
import 'firebase/firestore';
import { db } from '../../Banco/init-firebase'; // Firestore

function Acesso({ valorEmail }) {
  const [dados, setDados] = useState(null);
  const [jaEnviado, setJaEnviado] = useState(false);

  const enviarDadosParaBanco = async (idGoogleCap, skinLogadoUser, ip, country_name, region, city, org, valorEmail) => {
    try {
      const docRef = await db.collection('acessos').add({
        idGoogleCap,
        skinLogadoUser,
        ip,
        country_name,
        region,
        city,
        org,
        valorEmail,
        data: firebase.firestore.FieldValue.serverTimestamp(),
        visto: false,
      });
      console.log("Dados enviados com sucesso para o banco de dados:", docRef.id);
    } catch (error) {
      console.error("Erro ao enviar dados para o banco de dados:", error);
    }
  };

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setDados(data))
      .catch(err => console.error('Erro ao obter dados do IP:', err));
  }, []);

  useEffect(() => {
    if (dados) {
      localStorage.setItem('ip', dados.ip);
      localStorage.setItem('country_name', dados.country_name);
      localStorage.setItem('region', dados.region);
      localStorage.setItem('city', dados.city);
      localStorage.setItem('org', dados.org);

      const idGoogleCap = localStorage.getItem('idGoogleCap');
      const skinLogadoUser = localStorage.getItem('skinLogadoUser');
      const { ip, country_name, region, city, org } = dados;


if (!jaEnviado) {
      enviarDadosParaBanco(idGoogleCap, skinLogadoUser, ip, country_name, region, city, org, valorEmail);
  setJaEnviado(true);
}

    }

    
  }, [dados, valorEmail]);

  return null; // Não renderiza nada visível
}

export default Acesso;
