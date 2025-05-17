import React, { useEffect, useState } from 'react';
import firebase from "firebase/app";
import 'firebase/firestore';
import { db } from '../../Banco/init-firebase'; // Firestore
import { idGoogleCap } from '../../../App';
import { seforAdm } from '../verificações/verificaAdm';

function Acesso({ valorEmail }) {
  const [dados, setDados] = useState(null);
  const [jaEnviado, setJaEnviado] = useState(false);

  

  const [ip, setIp] = useState("");

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((response) => response.json())
      .then((data) => setIp(data.ip))
      .catch((error) => console.error("Erro ao obter IP:", error));
  }, []);

  useEffect(() => {

    localStorage.setItem('ip',ip);  
    console.log("IP:", ip);

  }, [ip]);

  const enviarDadosParaBanco = async (
    hash,
    ip,
    country_name,
    region,
    city,
    org,
  ) => {
    try {
      const docRef = await db.collection('acessos').add({
        hash,
        ip,
        country_name,
        region,
        city,
        org,
        data: firebase.firestore.FieldValue.serverTimestamp(),
        visto: false,
      });
      console.log("Dados enviados com sucesso para o banco de dados:", docRef.id);
    } catch (error) {
      console.error("Erro ao enviar dados para o banco de dados:", error);
    }
};


useEffect(() => {
  if (!seforAdm(idGoogleCap)) {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setDados(data))
      .catch(err => console.error('Erro ao obter dados do IP:', err));
    }
  }, [idGoogleCap]); 

  useEffect(() => {
    if (dados) {
      localStorage.setItem('ip', dados.ip);
      localStorage.setItem('country_name', dados.country_name);
      localStorage.setItem('region', dados.region);
      localStorage.setItem('city', dados.city);
      localStorage.setItem('org', dados.org);


      const hash = localStorage.getItem('navegacaoHash');
      const { ip, country_name, region, city, org } = dados;


  if (!jaEnviado) {
        enviarDadosParaBanco( hash, ip, country_name, region, city, org);
    setJaEnviado(true);
  }

}

    
  }, [dados, valorEmail]);

  return null; // Não renderiza nada visível
}

export default Acesso;
