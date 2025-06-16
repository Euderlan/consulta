import React, { useState, useCallback } from 'react';
import { Send, History, Upload, LogOut, ThumbsUp, ThumbsDown, AlertTriangle, User, Shield, MessageSquare, FileText, Clock, Copy, Share2, Download, Eye, Zap, Star, TrendingUp, Settings } from 'lucide-react';
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
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Email do administrador responsável
  const ADMIN_EMAIL = 'admin.consepe@ufma.br';

  // Sugestões interativas
  const quickSuggestions = [
    "Quais são os requisitos para transferência de curso?",
    "Como funciona o sistema de avaliação?",
    "Qual a carga horária mínima dos cursos?",
    "Normas sobre estágio supervisionado",
    "Procedimentos para colação de grau"
  ];

  // Simulação de login via Google
  const handleGoogleLogin = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      // Simula login do Google sempre como usuário comum
      const userData = {
        id: Date.now(),
        username: 'João Silva',
        email: 'joao.silva@discente.ufma.br',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${Date.now()}`,
        isAdmin: false,
        loginTime: new Date().toISOString(),
        loginMethod: 'google'
      };
      setUser(userData);
      setCurrentView('chat');
      setIsLoading(false);
    }, 2000);
  }, []);

  // Login tradicional
  const handleLogin = useCallback((username, password, isAdmin = false) => {
    setIsLoading(true);
    setTimeout(() => {
      // Verificar se as credenciais são do administrador
      const isAdminLogin = username.toLowerCase() === 'admin.consepe' || username.toLowerCase() === 'admin';
      const email = isAdminLogin ? ADMIN_EMAIL : `${username.toLowerCase().replace(' ', '.')}@discente.ufma.br`;
      
      const userData = {
        id: Date.now(),
        username: isAdminLogin ? 'Administrador CONSEPE' : username,
        email: email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        isAdmin: isAdminLogin,
        loginTime: new Date().toISOString(),
        loginMethod: 'traditional'
      };
      setUser(userData);
      setCurrentView('chat');
      setIsLoading(false);
    }, 1500);
  }, []);

  // Cadastro
  const handleRegister = useCallback((formData) => {
    setIsLoading(true);
    setTimeout(() => {
      // Cadastro sempre cria usuários comuns (nunca admin)
      const userData = {
        id: Date.now(),
        username: formData.name,
        email: formData.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`,
        isAdmin: false, // Cadastro sempre para usuários comuns
        loginTime: new Date().toISOString(),
        loginMethod: 'register'
      };
      setUser(userData);
      setCurrentView('chat');
      setIsLoading(false);
    }, 2000);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setCurrentView('login');
    setChatMessages([]);
    setCurrentMessage('');
  }, []);

  // Sistema de digitação
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setCurrentMessage(value);
    
    // Sugestões dinâmicas
    if (value.length > 2) {
      const filtered = quickSuggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  }, []);

  // Resposta LLM
  const simulateLLMResponse = useCallback((question) => {
    const responses = [
      {
        answer: "📋 **Transferência de Curso na UFMA**\n\nDe acordo com a RESOLUÇÃO Nº 1892-CONSEPE, para transferência entre cursos você deve:\n\n• Ter compatibilidade curricular mínima de 30%\n• Disponibilidade de vagas no curso desejado\n• Estar regularmente matriculado\n• Não ter pendências acadêmicas\n\nO processo ocorre semestralmente conforme cronograma acadêmico.",
        source: "Art. 8º, incisos I-III da RESOLUÇÃO Nº 1892-CONSEPE"
      },
      {
        answer: "📊 **Sistema de Avaliação dos Cursos**\n\nA avaliação segue critérios rigorosos estabelecidos pela resolução:\n\n• **Avaliação periódica** do projeto pedagógico\n• **Análise de desempenho** acadêmico dos estudantes\n• **Acompanhamento** de indicadores de qualidade\n• **Revisão curricular** quando necessário\n\nTodos os cursos passam por avaliação a cada 3 anos.",
        source: "Capítulo IV, Art. 22 da RESOLUÇÃO Nº 1892-CONSEPE"
      },
      {
        answer: "⏱️ **Carga Horária dos Cursos de Graduação**\n\nAs cargas horárias são definidas conforme as diretrizes nacionais:\n\n• **Bacharelados**: Mínimo estabelecido pelo CNE\n• **Licenciaturas**: Incluem 400h de prática pedagógica\n• **Tecnólogos**: Conforme catálogo nacional\n• **Estágios**: Carga horária específica por área\n\nCada curso tem sua matriz curricular aprovada pelo CONSEPE.",
        source: "Art. 15, § 2º da RESOLUÇÃO Nº 1892-CONSEPE"
      }
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }, []);

  const handleSendMessage = useCallback(() => {
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

    const delay = Math.random() * 2000 + 1000;
    
    setTimeout(() => {
      const response = simulateLLMResponse(messageToSend);
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response.answer,
        source: response.source,
        timestamp: new Date(),
        feedback: null
      };

      setChatMessages(prev => [...prev, botMessage]);
      
      setUserHistory(prev => [...prev, {
        question: messageToSend,
        answer: response.answer,
        source: response.source,
        timestamp: new Date()
      }]);
      
      setIsLoading(false);
    }, delay);
  }, [currentMessage, isLoading, simulateLLMResponse]);

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
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
  }, []);

  const reportError = useCallback((messageId) => {
    setChatMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, reported: true } : msg
      )
    );
  }, []);

  // Login View
  const LoginView = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [registerData, setRegisterData] = useState({ 
      name: '', 
      email: '', 
      password: '', 
      confirmPassword: '' 
    });
    const [loginMode, setLoginMode] = useState('traditional');

    const handleRegisterSubmit = () => {
      if (registerData.password !== registerData.confirmPassword) {
        alert('As senhas não coincidem!');
        return;
      }
      if (!registerData.name || !registerData.email || !registerData.password) {
        alert('Preencha todos os campos!');
        return;
      }
      handleRegister(registerData);
    };

    return (
      <div className="login-container">
        {/* Background Animation */}
        <div className="background-animation">
          <div className="floating-element element-1"></div>
          <div className="floating-element element-2"></div>
          <div className="floating-element element-3"></div>
          <div className="floating-element element-4"></div>
        </div>

        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <MessageSquare size={40} />
            </div>
            <h1 className="system-title">Sistema UFMA</h1>
            <p className="system-subtitle">Consultas Inteligentes via LLM</p>
            <p className="document-version">RESOLUÇÃO Nº 1892-CONSEPE</p>
          </div>

          <div className="login-content">
            <div className="tab-buttons">
              <button
                onClick={() => setLoginMode('traditional')}
                className={`tab-button ${loginMode === 'traditional' ? 'active-tab-blue' : 'inactive-tab'}`}
              >
                Login
              </button>
              <button
                onClick={() => setLoginMode('register')}
                className={`tab-button ${loginMode === 'register' ? 'active-tab-green' : 'inactive-tab'}`}
              >
                Cadastro
              </button>
            </div>

            {loginMode === 'traditional' ? (
              <div className="form-container">
                <div className="form-group">
                  <label className="form-label">Usuário</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Digite seu usuário (admin para área administrativa)"
                    value={credentials.username}
                    onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Digite sua senha"
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  />
                </div>
                
                <div className="button-group">
                  <button
                    onClick={() => handleLogin(credentials.username || 'Usuário Demo', credentials.password, false)}
                    disabled={isLoading}
                    className="primary-button"
                  >
                    {isLoading ? (
                      <div className="loading-content">
                        <div className="spinner"></div>
                        Entrando...
                      </div>
                    ) : (
                      <>
                        <User className="button-icon" />
                        Entrar
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="google-button"
                  >
                    {isLoading ? (
                      <>
                        <div className="spinner-dark"></div>
                        Autenticando com Google...
                      </>
                    ) : (
                      <>
                        <svg className="google-icon" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Entrar com Google
                      </>
                    )}
                  </button>
                  <div className="info-box info-box-blue">
                    <p className="info-text">
                      <Shield className="info-icon" />
                      <strong>Acesso Administrativo:</strong>
                    </p>
                    <div className="admin-credentials">
                      <div>• <strong>Usuário:</strong> admin</div>
                      <div>• <strong>Senha:</strong> Qualquer senha</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-container">
                <div className="form-group">
                  <label className="form-label">Nome Completo</label>
                  <input
                    type="text"
                    className="form-input-green"
                    placeholder="Digite seu nome completo"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input-green"
                    placeholder="Digite seu email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha</label>
                  <input
                    type="password"
                    className="form-input-green"
                    placeholder="Digite sua senha"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar Senha</label>
                  <input
                    type="password"
                    className="form-input-green"
                    placeholder="Confirme sua senha"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                  />
                </div>
                
                <button
                  onClick={handleRegisterSubmit}
                  disabled={isLoading}
                  className="register-button"
                >
                  {isLoading ? (
                    <div className="loading-content">
                      <div className="spinner"></div>
                      Criando conta...
                    </div>
                  ) : (
                    <>
                      <User className="button-icon" />
                      Criar Conta
                    </>
                  )}
                </button>
                
                <div className="info-box info-box-green">
                  <p className="info-text">
                    <User className="info-icon" />
                    <strong>Cadastro para usuários do sistema</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="terms-text">
            <p>Ao fazer login, você concorda com nossos termos de uso</p>
          </div>
        </div>
      </div>
    );
  };

  // Chat Interface
  const ChatView = () => (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-logo">
              <MessageSquare size={24} />
            </div>
            <div className="header-text">
              <h1 className="header-title">Sistema de Consultas UFMA</h1>
              <p className="header-subtitle">{documentVersion}</p>
            </div>
          </div>
          
          <div className="header-right">
            <button
              onClick={() => setCurrentView('history')}
              className="header-button"
              title="Ver Histórico"
            >
              <History size={20} />
            </button>
            
            {user?.isAdmin && (
              <button
                onClick={() => setCurrentView('admin')}
                className="header-button admin-button"
                title="Painel Admin"
              >
                <Shield size={20} />
              </button>
            )}
            
            <div className="user-info">
              <img 
                src={user?.avatar} 
                alt="Avatar" 
                className="user-avatar"
              />
              <div className="user-details">
                <div className="user-name">{user?.username}</div>
                <div className="user-role">
                  {user?.isAdmin ? 'Administrador' : 'Usuário'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="header-button"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="chat-messages">
        {chatMessages.length === 0 && (
          <div className="welcome-container">
            <div className="welcome-icon">
              <Zap size={32} />
            </div>
            <h3 className="welcome-title">Bem-vindo ao Sistema de Consultas</h3>
            <p className="welcome-text">
              Faça perguntas sobre a RESOLUÇÃO Nº 1892-CONSEPE das Normas Regulamentadoras dos Cursos de Graduação da UFMA. 
              Nossa IA está pronta para ajudar com informações precisas e atualizadas.
            </p>
            
            {/* Sugestões rápidas */}
            <div className="suggestions-container">
              <h4 className="suggestions-title">💡 Perguntas populares:</h4>
              <div className="suggestions-grid">
                {quickSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMessage(suggestion)}
                    className="suggestion-button"
                  >
                    <span className="suggestion-text">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <div key={message.id} className={`message ${message.type === 'user' ? 'message-user' : 'message-bot'}`}>
            <div className={`message-content ${message.type === 'user' ? 'message-content-user' : 'message-content-bot'}`}>
              {message.type === 'user' ? (
                <div>
                  <div className="user-message-header">
                    <img src={user?.avatar} alt="User" className="message-avatar" />
                    <span className="message-sender">Você</span>
                  </div>
                  <div className="message-text">{message.content}</div>
                </div>
              ) : (
                <div>
                  <div className="bot-message-header">
                    <div className="bot-avatar">
                      <Zap size={16} />
                    </div>
                    <span className="bot-name">UFMA Assistant</span>
                    
                    <div className="message-actions">
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="action-button"
                        title="Copiar resposta"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bot-message-body">
                    <div className="bot-message-text">
                      {message.content}
                    </div>
                  </div>
                  
                  <div className="message-footer">
                    <div className="message-info">
                      <div className="message-source">
                        <FileText className="source-icon" />
                        <span>Fonte: {message.source}</span>
                      </div>
                      <div className="message-time">
                        <Clock className="time-icon" />
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="feedback-section">
                      <div className="feedback-buttons">
                        <span className="feedback-label">Esta resposta foi útil?</span>
                        <button
                          onClick={() => handleFeedback(message.id, 'positive')}
                          className={`feedback-button ${message.feedback === 'positive' ? 'feedback-positive' : 'feedback-neutral'}`}
                          title="Resposta útil"
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, 'negative')}
                          className={`feedback-button ${message.feedback === 'negative' ? 'feedback-negative' : 'feedback-neutral'}`}
                          title="Resposta não útil"
                        >
                          <ThumbsDown size={16} />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => reportError(message.id)}
                        className={`report-button ${message.reported ? 'report-active' : 'report-inactive'}`}
                      >
                        <AlertTriangle size={12} className="report-icon" />
                        {message.reported ? 'Erro reportado' : 'Reportar erro'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message message-bot">
            <div className="loading-message">
              <div className="loading-message-content">
                <div className="bot-avatar">
                  <div className="spinner-white"></div>
                </div>
                <div>
                  <div className="bot-name">UFMA Assistant</div>
                  <div className="loading-text">Analisando sua consulta...</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {/* Sugestões dinâmicas */}
        {suggestions.length > 0 && (
          <div className="suggestions-popup">
            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentMessage(suggestion);
                    setSuggestions([]);
                  }}
                  className="suggestion-item"
                >
                  <span className="suggestion-item-text">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="text"
              value={currentMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta sobre a RESOLUÇÃO Nº 1892-CONSEPE..."
              className="chat-input"
              disabled={isLoading}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !currentMessage.trim()}
            className="send-button"
          >
            {isLoading ? (
              <div className="spinner-white"></div>
            ) : (
              <Send size={24} />
            )}
          </button>
        </div>

        <div className="input-tip">
          <span>💡 Dica: Use perguntas específicas para obter melhores respostas</span>
        </div>
      </div>
    </div>
  );

  // History View
  const HistoryView = () => {
    const [expandedItems, setExpandedItems] = useState(new Set());

    const toggleExpanded = (index) => {
      const newExpanded = new Set(expandedItems);
      if (newExpanded.has(index)) {
        newExpanded.delete(index);
      } else {
        newExpanded.add(index);
      }
      setExpandedItems(newExpanded);
    };

    return (
      <div className="history-container">
        <header className="history-header">
          <div className="history-header-content">
            <div className="history-header-left">
              <button
                onClick={() => setCurrentView('chat')}
                className="back-button"
              >
                ← Voltar ao Chat
              </button>
              <h1 className="history-title">
                <History className="history-icon" />
                Histórico de Consultas
              </h1>
            </div>
            
            <button
              onClick={handleLogout}
              className="header-button"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="history-content">
          {userHistory.length === 0 ? (
            <div className="empty-history">
              <Clock className="empty-history-icon" />
              <h3 className="empty-history-title">Nenhuma consulta realizada</h3>
              <p className="empty-history-text">
                Suas consultas anteriores aparecerão aqui para fácil acesso e referência.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {userHistory.map((item, index) => (
                <div key={index} className="history-item">
                  <div 
                    className="history-item-header"
                    onClick={() => toggleExpanded(index)}
                  >
                    <div className="history-item-content">
                      <div className="history-item-meta">
                        <div className="history-item-icon">
                          <MessageSquare size={16} />
                        </div>
                        <h3 className="history-item-label">Pergunta:</h3>
                        <div className="history-item-time">
                          {item.timestamp.toLocaleString()}
                        </div>
                      </div>
                      <p className="history-item-question">{item.question}</p>
                    </div>
                    <div className="expand-icon">
                      {expandedItems.has(index) ? '−' : '+'}
                    </div>
                  </div>
                  
                  {expandedItems.has(index) && (
                    <div className="history-item-expanded">
                      <div className="history-answer">
                        <div className="history-answer-header">
                          <div className="history-answer-icon">
                            <Zap size={16} />
                          </div>
                          <h3 className="history-answer-label">Resposta:</h3>
                        </div>
                        <div className="history-answer-text">
                          {item.answer}
                        </div>
                        
                        <div className="history-answer-footer">
                          <div className="history-source">
                            <FileText className="source-icon" />
                            <span>{item.source}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(item.answer)}
                            className="copy-button"
                          >
                            <Copy className="copy-icon" />
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Admin Panel
  const AdminView = () => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const simulateUpload = () => {
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    };

    return (
      <div className="admin-container">
        <header className="admin-header">
          <div className="admin-header-content">
            <div className="admin-header-left">
              <button
                onClick={() => setCurrentView('chat')}
                className="back-button"
              >
                ← Voltar ao Chat
              </button>
              <h1 className="admin-title">
                <Shield className="admin-icon" />
                Painel Administrativo
              </h1>
            </div>
            
            <button
              onClick={handleLogout}
              className="header-button"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="admin-content">
          {/* Document Management */}
          <div className="admin-section">
            <h2 className="admin-section-title">
              <FileText className="admin-section-icon" />
              Gerenciar Documentos
              <div className="admin-badge">
                👤 Administrador Responsável: {user?.email}
              </div>
            </h2>
            
            <div className="admin-documents">
              <div className="document-card">
                <div className="document-info">
                  <div className="document-icon">
                    <FileText size={24} />
                  </div>
                  <div className="document-details">
                    <h3 className="document-title">RESOLUÇÃO Nº 1892-CONSEPE</h3>
                    <p className="document-version">Versão atual: v1.0 (28/06/2019)</p>
                    <p className="document-updated">Última atualização: {new Date().toLocaleDateString()}</p>
                    <div className="document-status">
                      <Eye className="status-icon" />
                      <span className="status-text">Ativo</span>
                    </div>
                  </div>
                </div>
                <div className="document-actions">
                  <button className="action-button edit-button">
                    <Settings className="action-icon" />
                    Editar
                  </button>
                  <button className="action-button download-button">
                    <Download className="action-icon" />
                    Baixar
                  </button>
                  <button className="action-button remove-button">
                    <AlertTriangle className="action-icon" />
                    Remover
                  </button>
                </div>
              </div>

              {/* Upload Area */}
              <div className="upload-area">
                <Upload className="upload-icon" />
                <h3 className="upload-title">Upload Nova Resolução</h3>
                <p className="upload-description">Arraste arquivos PDF ou clique para selecionar</p>
                
                {isUploading ? (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">Processando... {uploadProgress}%</p>
                  </div>
                ) : (
                  <button 
                    onClick={simulateUpload}
                    className="upload-button"
                  >
                    <Upload className="upload-button-icon" />
                    Selecionar Arquivo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main render logic
  if (!user) return <LoginView />;
  
  switch (currentView) {
    case 'chat':
      return <ChatView />;
    case 'history':
      return <HistoryView />;
    case 'admin':
      return user.isAdmin ? <AdminView /> : <ChatView />;
    default:
      return <ChatView />;
  }
};

export default UFMAConsultaSystem;