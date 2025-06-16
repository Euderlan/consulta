import React, { useState } from 'react';
import { 
  Shield, 
  LogOut, 
  FileText, 
  Upload, 
  Settings, 
  Download, 
  AlertTriangle,
  Eye
} from 'lucide-react';
import './AdminView.css';

const AdminView = ({
  user,
  setCurrentView,
  handleLogout
}) => {
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

export default AdminView;