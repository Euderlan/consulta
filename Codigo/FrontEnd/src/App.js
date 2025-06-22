import React, { useState, useCallback, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import LoginView from './components/LoginView/LoginView';
import ChatView from './components/ChatView/ChatView';
import HistoryView from './components/HistoryView/HistoryView';
import AdminView from './components/AdminView/AdminView';
import authService from './services/authService';
import './App.css';

const UFMAConsultaSystem = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userHistory, setUserHistory] = useState([]);
  const [documentVersion] = useState('RESOLUÇÃO Nº 1892-CONSEPE - v1.0 (28/06/2019)');
  const [suggestions, setSuggestions] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Sugestões interativas
  const quickSuggestions = [
    "Quais são os requisitos para transferência de curso?",
    "Como funciona o sistema de avaliação?",
    "Qual a carga horária mínima dos cursos?",
    "Normas sobre estágio supervisionado",
    "Procedimentos para colação de grau"
  ];

  // Verificar se usuário já está logado ao carregar a página
  useEffect(() => {
    const checkAuthStatus = async () => {
      setAuthLoading(true);
      
      try {
        if (authService.isAuthenticated()) {
          const verifyResult = await authService.verifyToken();
          
          if (verifyResult.success) {
            const userData = authService.getCurrentUser();
            setUser(userData);
            setCurrentView('chat');
          } else {
            // Token inválido, fazer logout
            authService.logout();
            setUser(null);
            setCurrentView('login');
          }
        } else {
          setCurrentView('login');
        }
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        authService.logout();
        setCurrentView('login');
      }
      
      setAuthLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Login com Google (simulado por enquanto)
  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Por enquanto simular login do Google
      // Quando integrar com Google OAuth, usar authService.loginWithGoogle(token)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const userData = {
        id: Date.now(),
        name: 'Usuário Google',
        email: 'usuario.google@discente.ufma.br',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=google${Date.now()}`,
        isAdmin: false,
        loginTime: new Date().toISOString(),
        loginMethod: 'google'
      };
      
      setUser(userData);
      setCurrentView('chat');
      
    } catch (error) {
      console.error('Erro no login Google:', error);
      alert('Erro no login com Google. Tente novamente.');
    }
    
    setIsLoading(false);
  }, []);

  // Login tradicional com backend real
  const handleLogin = useCallback(async (username, password, isAdmin = false) => {
    setIsLoading(true);
    
    try {
      const result = await authService.loginTraditional(username, password);
      
      if (result.success) {
        setUser(result.user);
        setCurrentView('chat');
      } else {
        alert(result.message || 'Erro no login');
      }
      
    } catch (error) {
      console.error('Erro no login:', error);
      alert('Erro de conexão. Verifique sua internet.');
    }
    
    setIsLoading(false);
  }, []);

  // Cadastro com backend real
  const handleRegister = useCallback(async (formData) => {
    setIsLoading(true);
    
    try {
      const result = await authService.register(
        formData.name,
        formData.email,
        formData.password
      );
      
      if (result.success) {
        alert(result.message || 'Usuário cadastrado com sucesso! Agora você pode fazer login.');
        // Não fazer login automático, usuário deve fazer login manual
      } else {
        alert(result.message || 'Erro no cadastro');
      }
      
    } catch (error) {
      console.error('Erro no cadastro:', error);
      alert('Erro de conexão. Verifique sua internet.');
    }
    
    setIsLoading(false);
  }, []);

  const handleLogout = useCallback(() => {
    authService.logout();
    setUser(null);
    setCurrentView('login');
    setChatMessages([]);
    setCurrentMessage('');
    setUserHistory([]);
  }, []);

  // Sistema de digitação
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setCurrentMessage(value);
    
    if (value.length > 2) {
      const filtered = quickSuggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  }, []);

  // Função para enviar mensagem usando o backend real
// Substituir a lógica atual por esta:
const handleSendMessage = useCallback(async () => {
  if (!currentMessage.trim() || isLoading) return;

  const messageToSend = currentMessage.trim();
  const userMessage = {
    id: Date.now(),
    type: 'user',
    content: messageToSend,
    timestamp: new Date()
  };

  setChatMessages(prev => [...prev, userMessage]);
  setCurrentMessage('');
  setSuggestions([]);
  setIsLoading(true);

  try {
    let response;
    
    // SEMPRE usar chat público primeiro (não precisa de token)
    console.log('📤 Usando chat público...');
    response = await authService.sendPublicMessage(messageToSend);
    
    if (response.success) {
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response.data.answer,
        source: response.data.sources && response.data.sources.length > 0 
          ? response.data.sources.map(s => s['nome do arquivo']).join(', ')
          : "Documentos da UFMA",
        timestamp: new Date(),
        feedback: null,
        authenticated: false // Sempre público por enquanto
      };

      setChatMessages(prev => [...prev, botMessage]);
      
      // Atualizar histórico do usuário
      setUserHistory(prev => [...prev, {
        question: messageToSend,
        answer: response.data.answer,
        source: botMessage.source,
        timestamp: new Date()
      }]);
    } else {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Erro: ${response.message}`,
        source: "Sistema - Erro",
        timestamp: new Date(),
        feedback: null
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    const errorMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: "Ocorreu um erro inesperado. Verifique sua conexão e tente novamente.",
      source: "Sistema - Erro de Conexão",
      timestamp: new Date(),
      feedback: null
    };
    setChatMessages(prev => [...prev, errorMessage]);
  }
  
  setIsLoading(false);
}, [currentMessage, isLoading]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleFeedback = useCallback((messageId, feedback) => {
    setChatMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
    
    // Aqui você pode enviar o feedback para o backend se necessário
    console.log(`Feedback ${feedback} para mensagem ${messageId}`);
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Opcional: mostrar notificação de sucesso
      console.log('Texto copiado para a área de transferência');
    }).catch(err => {
      console.error('Erro ao copiar texto:', err);
    });
  }, []);

  const reportError = useCallback((messageId) => {
    setChatMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, reported: true } : msg
      )
    );
    
    // Aqui você pode enviar o relatório de erro para o backend
    console.log(`Erro reportado para mensagem ${messageId}`);
  }, []);

  // Props compartilhadas
  const sharedProps = {
    user,
    setUser,
    currentView,
    setCurrentView,
    chatMessages,
    setChatMessages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    setIsLoading,
    userHistory,
    setUserHistory,
    documentVersion,
    suggestions,
    setSuggestions,
    quickSuggestions,
    handleGoogleLogin,
    handleLogin,
    handleRegister,
    handleLogout,
    handleInputChange,
    handleSendMessage,
    handleKeyDown,
    handleFeedback,
    copyToClipboard,
    reportError,
    authService // Passar o serviço de auth para os componentes
  };

  // Mostrar loading inicial enquanto verifica autenticação
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #9333ea)',
            color: 'white',
            borderRadius: '50%',
            width: '4rem',
            height: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <MessageSquare size={32} />
          </div>
          <div className="spinner-dark"></div>
          <p style={{ color: '#4b5563', fontWeight: '500' }}>
            Carregando Sistema UFMA...
          </p>
        </div>
      </div>
    );
  }

  // Main render logic
  if (!user) return <LoginView {...sharedProps} />;
  
  switch (currentView) {
    case 'chat':
      return <ChatView {...sharedProps} />;
    case 'history':
      return <HistoryView {...sharedProps} />;
    case 'admin':
      return user.isAdmin ? <AdminView {...sharedProps} /> : <ChatView {...sharedProps} />;
    default:
      return <ChatView {...sharedProps} />;
  }
};

export default UFMAConsultaSystem;