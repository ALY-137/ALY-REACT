import axios from 'axios';

// Função para obter o IP do cliente
const getIp = async () => {
  try {
    const response = await axios.get('https://us-central1-teste-aa015.cloudfunctions.net/addmessage');
    const ip = response.data.ip;
    console.log('IP:', ip);
    return ip;
  } catch (error) {
    console.error('Error fetching IP:', error);
    return null;
  }
};

export default getIp;