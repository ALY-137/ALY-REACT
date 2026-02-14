// App.jsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { auth, db } from './components/Banco/init-firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs } from 'firebase/firestore';

import SkinsManager from './components/Layout/Skins/SkinsManager';
import Estrutura from './components/Layout/Espacos/Estrutura';
import LoginGoogle from './components/Layout/Geral/LoginGoogle.jsx';
import Navegacoes from './components/Scripts/navegacoes/Navegacoes.jsx';
import AnoAtualizado from './components/Scripts/data/AnoAtualizado';

import './App.css';

// Variáveis globais exportadas
let primeiroNomeCap = null;
let emailCap = null;
let picGoogleCap = null;
let fullnameCap = null;

const App = () => {


  const [user, setUser] = useState(null);
  const [skins, setSkins] = useState([]);
  const [username, setUsername] = useState('');
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [skinsLoading, setSkinsLoading] = useState(false); // inicia falso
  const location = useLocation();

  // onAuthStateChanged já atualiza o user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.uid) {
        localStorage.setItem('userId', firebaseUser.uid);
      } else {
        localStorage.removeItem('userId');
      }

      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca skins só quando user existir
  useEffect(() => {
    if (!user?.uid) return;

    setSkinsLoading(true);

    const fetchSkins = async () => {
      try {
        await user.getIdToken();
        const userRef = doc(db, 'users', user.uid);
        const skinsCol = collection(userRef, 'skins');
        const skinsSnapshot = await getDocs(skinsCol);
        const skinsList = skinsSnapshot.docs.map(doc => doc.data());

        setSkins(skinsList);

        if (skinsList.length === 1) {
          const skin = skinsList[0];
          setUsername(skin.username);
          localStorage.setItem('targetUsername', skin.username);
          localStorage.setItem('skinLogadoUser', skin.username);
          localStorage.setItem('selectedTheme', skin.theme);
        }
      } catch (error) {
        console.error('Erro ao buscar skins:', error);
      } finally {
        setSkinsLoading(false);
      }
    };

    fetchSkins();
  }, [user]);

  // Delay da animação de login
  useEffect(() => {
    const timeout = setTimeout(() => setMostrarLogin(true), 1000);
    return () => clearTimeout(timeout);
  }, []);

  // Loader apenas quando user logado e skins ainda carregando
  if (!authLoading && user && skinsLoading) return <div className="loader">Carregando skins...</div>;

  const isPublicProfileRoute =
  location.pathname.split("/").length >= 2 &&
  location.pathname !== "/";

return (
  <div>
    {/* 🔓 ROTAS PÚBLICAS (skins públicas) */}
    {isPublicProfileRoute ? (
      <Estrutura />
    ) : !user && !authLoading ? (
      // LOGIN
      <div id="login" className={`containerLogin ${mostrarLogin ? 'fadeIn' : ''}`}>
        <Navegacoes />
        <div id="iconsLogin">
          <img src="/logoNeon.png" id="logoLogin" alt="Logo" />
          <p id="logoTxt">ALY-137</p>
          <p id="textoLogin">EMBARQUE COM O GOOGLE</p>
          <LoginGoogle />
        </div>
        <p id="rodapeLogin">ALY-137© <AnoAtualizado /></p>
      </div>
    ) : skins.length === 1 ? (
      <Estrutura username={username} skins={skins} />
    ) : (
      <SkinsManager user={user} />
    )}
  </div>
);

};


// Mantém as exportações para outros componentes
export { primeiroNomeCap, emailCap, picGoogleCap, fullnameCap };
export default App;
