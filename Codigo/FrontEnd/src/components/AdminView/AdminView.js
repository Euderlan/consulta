import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LogOut, 
  FileText, 
  Settings, 
  Download, 
  Eye,
  Edit,
  Trash2,
  Plus,
  X,
  Save,
  Users,
  BarChart3
} from 'lucide-react';
import './AdminView.css';

const AdminView = ({
  user,
  setCurrentView,
  handleLogout,
  authService
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    version: '',
    file: null
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDocuments(),
        loadUsers(),
        loadSystemStats()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const loadDocuments = async () => {
    try {
      const result = await authService.getDocuments();
      if (result.success) {
        // Converter dados dos documentos para formato compatível
        const docs = result.data.documents.map((doc, index) => ({
          id: index + 1,
          title: doc.filename.replace('.pdf', ''),
          version: 'v1.0',
          lastUpdated: doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : new Date().toLocaleDateString(),
          isActive: true,
          size: `${(doc.chunks * 1000 / (1024)).toFixed(1)} KB`,
          chunks: doc.chunks,
          uploadedBy: doc.uploaded_by || 'Sistema',
          downloadUrl: '#'
        }));
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await authService.getUsers();
      if (result.success) {
        setUsers(result.data.users);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      const result = await authService.getSystemStats();
      if (result.success) {
        setSystemStats(result.data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Upload real de arquivo
  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Parar em 90% até a resposta do servidor
          }
          return prev + 10;
        });
      }, 200);

      const result = await authService.uploadDocument(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result.success) {
        // Adicionar documento à lista
        const newDoc = {
          id: Date.now(),
          title: result.data.filename.replace('.pdf', ''),
          version: 'v1.0',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true,
          size: `${(result.data.chunks * 1000 / 1024).toFixed(1)} KB`,
          chunks: result.data.chunks,
          uploadedBy: user.email,
          downloadUrl: '#'
        };
        
        setDocuments(prev => [...prev, newDoc]);
        setNewDocument({ title: '', version: '', file: null });
        setShowAddModal(false);
        
        alert(`✅ ${result.data.message}`);
        
        // Recarregar documentos para ter dados atualizados
        await loadDocuments();
      } else {
        alert(`❌ ${result.message}`);
      }
      
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('❌ Erro no upload. Verifique sua conexão.');
    }
    
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Lidar com seleção de arquivo no modal
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setNewDocument(prev => ({ ...prev, file }));
    } else {
      alert('Por favor, selecione apenas arquivos PDF.');
    }
  };

  // Adicionar novo documento
  const handleAddDocument = () => {
    if (!newDocument.file) {
      alert('Por favor, selecione um arquivo PDF.');
      return;
    }
    handleFileUpload(newDocument.file);
  };

  // Editar documento (apenas metadados locais)
  const handleEditDocument = (docId) => {
    const doc = documents.find(d => d.id === docId);
    setEditingDocument({ ...doc });
  };

  // Salvar edições
  const handleSaveEdit = () => {
    setDocuments(prev => 
      prev.map(doc => 
        doc.id === editingDocument.id 
          ? { ...editingDocument, lastUpdated: new Date().toLocaleDateString() }
          : doc
      )
    );
    setEditingDocument(null);
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingDocument(null);
  };

  // Remover documento (apenas da lista local)
  const handleRemoveDocument = (docId) => {
    if (window.confirm('Tem certeza que deseja remover este documento da lista?')) {
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
    }
  };

  // Download documento
  const handleDownloadDocument = (doc) => {
    // Como não temos storage de arquivos, simular download
    alert(`Download de ${doc.title}.pdf iniciado (simulado)`);
  };

  // Toggle status ativo/inativo
  const toggleDocumentStatus = (docId) => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === docId
          ? { ...doc, isActive: !doc.isActive, lastUpdated: new Date().toLocaleDateString() }
          : doc
      )
    );
  };

  // Renderizar estatísticas do sistema
  const renderSystemStats = () => {
    if (!systemStats) return <div className="loading-content">Carregando estatísticas...</div>;

    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">
            <BarChart3 className="admin-section-icon" />
            Estatísticas do Sistema
          </h2>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <h3>Total de Usuários</h3>
            <p className="stat-number">{systemStats.total_users}</p>
          </div>
          
          <div className="stat-card stat-card-green">
            <h3>Usuários Ativos</h3>
            <p className="stat-number">{systemStats.active_users}</p>
          </div>
          
          <div className="stat-card stat-card-yellow">
            <h3>Documentos</h3>
            <p className="stat-number">{systemStats.document_store?.unique_documents || 0}</p>
          </div>
          
          <div className="stat-card stat-card-purple">
            <h3>Sessões Ativas</h3>
            <p className="stat-number">{systemStats.active_sessions}</p>
          </div>
        </div>

        {systemStats.recent_users && systemStats.recent_users.length > 0 && (
          <div className="recent-users-section">
            <h3>Usuários Recentes</h3>
            <div className="recent-users-list">
              {systemStats.recent_users.map((userData, index) => (
                <div key={index} className="recent-user-item">
                  <div className="recent-user-info">
                    <p className="recent-user-name">{userData.name}</p>
                    <p className="recent-user-email">{userData.email}</p>
                  </div>
                  <p className="recent-user-date">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar lista de usuários
  const renderUsers = () => (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">
          <Users className="admin-section-icon" />
          Gerenciar Usuários
          <div className="admin-badge">
            Total: {users.length}
          </div>
        </h2>
      </div>
      
      <div className="users-list">
        {users.map((userData, index) => (
          <div key={userData.id} className="user-card">
            <div className="user-info">
              <div className="user-header">
                <h3 className="user-name">{userData.name}</h3>
                {userData.is_admin && (
                  <span className="admin-badge-small">ADMIN</span>
                )}
                {!userData.is_active && (
                  <span className="inactive-badge">INATIVO</span>
                )}
              </div>
              <p className="user-email">{userData.email}</p>
              <div className="user-dates">
                <p className="user-date">
                  Criado: {new Date(userData.created_at).toLocaleDateString()}
                </p>
                {userData.last_login && (
                  <p className="user-date">
                    Último login: {new Date(userData.last_login).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            
            <div className="user-status">
              <span className={`status-badge ${userData.is_active ? 'status-active' : 'status-inactive'}`}>
                {userData.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
        
        {users.length === 0 && (
          <div className="empty-state">
            Nenhum usuário encontrado
          </div>
        )}
      </div>
    </div>
  );

  // Renderizar documentos
  const renderDocuments = () => (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">
          <FileText className="admin-section-icon" />
          Gerenciar Documentos
          <div className="admin-badge">
            👤 Administrador: {user?.email}
          </div>
        </h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="add-document-button"
        >
          <Plus size={16} />
          Adicionar Documento
        </button>
      </div>
      
      <div className="admin-documents">
        {documents.map((doc) => (
          <div key={doc.id} className="document-card">
            <div className="document-info">
              <div className="document-icon">
                <FileText size={24} />
              </div>
              <div className="document-details">
                {editingDocument?.id === doc.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editingDocument.title}
                      onChange={(e) => setEditingDocument({...editingDocument, title: e.target.value})}
                      className="edit-input"
                      placeholder="Título do documento"
                    />
                    <input
                      type="text"
                      value={editingDocument.version}
                      onChange={(e) => setEditingDocument({...editingDocument, version: e.target.value})}
                      className="edit-input"
                      placeholder="Versão"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="document-title">{doc.title}</h3>
                    <p className="document-version">Versão: {doc.version}</p>
                  </>
                )}
                <p className="document-updated">Última atualização: {doc.lastUpdated}</p>
                <p className="document-size">Tamanho: {doc.size} • Chunks: {doc.chunks}</p>
                {doc.uploadedBy && (
                  <p className="document-size">Enviado por: {doc.uploadedBy}</p>
                )}
                <div className="document-status">
                  <button 
                    onClick={() => toggleDocumentStatus(doc.id)}
                    className={`status-toggle ${doc.isActive ? 'status-active' : 'status-inactive'}`}
                  >
                    <Eye className="status-icon" />
                    <span className="status-text">
                      {doc.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="document-actions">
              {editingDocument?.id === doc.id ? (
                <>
                  <button 
                    onClick={handleSaveEdit}
                    className="action-button save-button"
                  >
                    <Save className="action-icon" />
                    Salvar
                  </button>
                  <button 
                    onClick={handleCancelEdit}
                    className="action-button cancel-button"
                  >
                    <X className="action-icon" />
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleEditDocument(doc.id)}
                    className="action-button edit-button"
                  >
                    <Edit className="action-icon" />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDownloadDocument(doc)}
                    className="action-button download-button"
                  >
                    <Download className="action-icon" />
                    Baixar
                  </button>
                  <button 
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="action-button remove-button"
                  >
                    <Trash2 className="action-icon" />
                    Remover
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        
        {documents.length === 0 && !loading && (
          <div className="empty-document-state">
            <FileText size={48} className="empty-icon" />
            <h3>Nenhum documento encontrado</h3>
            <p>Faça upload do primeiro documento PDF para começar.</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
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
          <div className="loading-center">
            <div className="spinner-dark"></div>
            <p>Carregando dados administrativos...</p>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Tabs de navegação */}
      <div className="admin-tabs">
        <div className="tabs-container">
          <button
            onClick={() => setActiveTab('documents')}
            className={`tab-button ${activeTab === 'documents' ? 'tab-active' : 'tab-inactive'}`}
          >
            <FileText size={16} />
            Documentos
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`tab-button ${activeTab === 'users' ? 'tab-active' : 'tab-inactive'}`}
          >
            <Users size={16} />
            Usuários ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`tab-button ${activeTab === 'stats' ? 'tab-active' : 'tab-inactive'}`}
          >
            <BarChart3 size={16} />
            Estatísticas
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'stats' && renderSystemStats()}
      </div>

      {/* Modal para adicionar documento */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Adicionar Novo Documento</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="modal-close"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Arquivo PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="file-input"
                  disabled={isUploading}
                />
                {newDocument.file && (
                  <p className="file-selected">
                    Arquivo selecionado: {newDocument.file.name}
                  </p>
                )}
              </div>

              {isUploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    {uploadProgress < 100 ? `Enviando... ${uploadProgress}%` : 'Processando documento...'}
                  </p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowAddModal(false)}
                className="cancel-button"
                disabled={isUploading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddDocument}
                className="primary-button"
                disabled={!newDocument.file || isUploading}
              >
                <Plus className="button-icon" />
                {isUploading ? 'Enviando...' : 'Adicionar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;