// services/authService.js - Versão Corrigida
import axios from 'axios';

// Configuração da URL base da API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Criar instância do axios com configurações padrão
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente nas requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor CORRIGIDO - não força logout automático
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // LOG para debug
    console.warn('Erro na requisição:', error.response?.status, error.response?.data);
    
    // NÃO fazer logout automático - deixar o componente decidir
    // if (error.response?.status === 401) {
    //   localStorage.removeItem('authToken');
    //   localStorage.removeItem('user');
    //   window.location.href = '/';
    // }
    
    return Promise.reject(error);
  }
);

// Classe para gerenciar autenticação
class AuthService {
  
  // Fazer login com email e senha
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', {
        email: email.toLowerCase().trim(),
        password
      });

      if (response.data.success && response.data.token) {
        // Armazenar token e dados do usuário
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          message: response.data.message
        };
      }

      return {
        success: false,
        message: response.data.message || 'Erro no login'
      };
      
    } catch (error) {
      console.error('Erro no login:', error);
      
      let errorMessage = 'Erro de conexão com o servidor';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  // Login tradicional (compatibilidade)
  async loginTraditional(username, password) {
    try {
      const response = await api.post('/auth/traditional', {
        username: username.trim(),
        password
      });

      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          message: response.data.message
        };
      }

      return {
        success: false,
        message: response.data.message || 'Erro no login'
      };
      
    } catch (error) {
      console.error('Erro no login tradicional:', error);
      
      let errorMessage = 'Erro de conexão com o servidor';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  // Registrar novo usuário
  async register(name, email, password) {
    try {
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password
      });

      if (response.data.success) {
        return {
          success: true,
          message: response.data.message || 'Usuário cadastrado com sucesso'
        };
      }

      return {
        success: false,
        message: response.data.message || 'Erro no cadastro'
      };
      
    } catch (error) {
      console.error('Erro no registro:', error);
      
      let errorMessage = 'Erro de conexão com o servidor';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  // Login com Google (futuro)
  async loginWithGoogle(googleToken) {
    try {
      const response = await api.post('/auth/google', {
        token: googleToken
      });

      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          message: response.data.message
        };
      }

      return {
        success: false,
        message: response.data.message || 'Erro no login com Google'
      };
      
    } catch (error) {
      console.error('Erro no login Google:', error);
      return {
        success: false,
        message: 'Erro no login com Google'
      };
    }
  }

  // Verificar se token é válido
  async verifyToken() {
    try {
      const response = await api.get('/auth/verify');
      
      if (response.data.valid) {
        return {
          success: true,
          user: response.data.user
        };
      }
      
      return { success: false };
      
    } catch (error) {
      console.error('Erro na verificação do token:', error);
      return { success: false };
    }
  }

  // Renovar token
  async refreshToken() {
    try {
      const response = await api.post('/auth/refresh');
      
      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        return {
          success: true,
          token: response.data.token,
          user: response.data.user
        };
      }
      
      return { success: false };
      
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return { success: false };
    }
  }

  // Obter usuário atual do localStorage
  getCurrentUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      return null;
    }
  }

  // Obter token atual
  getToken() {
    return localStorage.getItem('authToken');
  }

  // Verificar se usuário está logado
  isAuthenticated() {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  // Verificar se usuário é admin
  isAdmin() {
    const user = this.getCurrentUser();
    return user?.isAdmin || false;
  }

  // Fazer logout MANUAL (só quando usuário quiser)
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    return true;
  }

  // Enviar mensagem para chat protegido
  async sendProtectedMessage(question) {
    try {
      const response = await api.post('/protected-chat', {
        question
      });

      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Erro no chat protegido:', error);
      
      // Se erro 401, pode ser token inválido - mas não força logout
      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Sessão expirada. Faça login novamente.',
          needsLogin: true  // Flag para o App.js decidir
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.error || 'Erro ao enviar mensagem'
      };
    }
  }

  // Enviar mensagem para chat público
  async sendPublicMessage(question) {
    try {
      // Chat público não precisa de autenticação
      const response = await axios.post(`${API_BASE_URL}/chat`, {
        question
      });

      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Erro no chat público:', error);
      return {
        success: false,
        message: error.response?.data?.error || 'Erro ao enviar mensagem'
      };
    }
  }

  // Listar documentos (com ou sem auth)
  async getDocuments() {
    try {
      const response = await api.get('/documents');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao listar documentos:', error);
      return {
        success: false,
        message: 'Erro ao obter documentos'
      };
    }
  }

  // Upload de documento (apenas admin)
  async uploadDocument(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Erro no upload:', error);
      return {
        success: false,
        message: error.response?.data?.error || 'Erro no upload'
      };
    }
  }

  // Obter lista de usuários (apenas admin)
  async getUsers() {
    try {
      const response = await api.get('/admin/users');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao obter usuários:', error);
      return {
        success: false,
        message: 'Erro ao obter usuários'
      };
    }
  }

  // Obter estatísticas do sistema (apenas admin)
  async getSystemStats() {
    try {
      const response = await api.get('/admin/stats');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        success: false,
        message: 'Erro ao obter estatísticas'
      };
    }
  }
}

// Criar e exportar instância única
const authService = new AuthService();
export default authService;