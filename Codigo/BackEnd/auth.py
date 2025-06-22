# auth.py - Sistema de Autenticação
import os
import jwt
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from google.oauth2 import id_token
from google.auth.transport import requests
import logging

logger = logging.getLogger(__name__)

class AuthManager:
    def __init__(self, app=None):
        self.app = app
        self.jwt_secret = os.getenv('JWT_SECRET_KEY', 'ufma-jwt-secret-key-2024')
        self.google_client_id = os.getenv('GOOGLE_CLIENT_ID', '')
        self.admin_email = 'admin.consepe@ufma.br'
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Inicializa o sistema de autenticação com a aplicação Flask"""
        self.app = app
        self.init_database()
    
    def init_database(self):
        """Inicializa o banco de dados SQLite para usuários"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Tabela de usuários
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    is_admin BOOLEAN DEFAULT FALSE,
                    google_id TEXT,
                    avatar_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ''')
            
            # Criar usuário administrador padrão se não existir
            cursor.execute('SELECT id FROM users WHERE email = ?', (self.admin_email,))
            if not cursor.fetchone():
                admin_password_hash = generate_password_hash('admin123')
                cursor.execute('''
                    INSERT INTO users (name, email, password_hash, is_admin, avatar_url)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    'Administrador CONSEPE',
                    self.admin_email,
                    admin_password_hash,
                    True,
                    'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
                ))
                logger.info(f"Usuário administrador criado: {self.admin_email}")
            
            conn.commit()
            conn.close()
            logger.info("Banco de dados de usuários inicializado com sucesso")
            
        except Exception as e:
            logger.error(f"Erro ao inicializar banco de dados: {e}")
            raise
    
    def generate_token(self, user_data):
        """Gera um token JWT para o usuário"""
        try:
            payload = {
                'user_id': user_data['id'],
                'email': user_data['email'],
                'is_admin': user_data['is_admin'],
                'exp': datetime.utcnow() + timedelta(days=7),  # Token válido por 7 dias
                'iat': datetime.utcnow()
            }
            
            token = jwt.encode(payload, self.jwt_secret, algorithm='HS256')
            return token
            
        except Exception as e:
            logger.error(f"Erro ao gerar token: {e}")
            return None
    
    def verify_token(self, token):
        """Verifica e decodifica um token JWT"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def create_user(self, name, email, password, google_id=None, avatar_url=None):
        """Cria um novo usuário no sistema"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se o email já existe
            cursor.execute('SELECT id FROM users WHERE email = ?', (email.lower(),))
            if cursor.fetchone():
                conn.close()
                return {'success': False, 'message': 'Este email já está cadastrado no sistema'}
            
            # Hash da senha se fornecida
            password_hash = None
            if password:
                password_hash = generate_password_hash(password)
            
            # Gerar avatar padrão se não fornecido
            if not avatar_url:
                avatar_url = f'https://api.dicebear.com/7.x/avataaars/svg?seed={name}'
            
            # Inserir novo usuário
            cursor.execute('''
                INSERT INTO users (name, email, password_hash, google_id, avatar_url)
                VALUES (?, ?, ?, ?, ?)
            ''', (name, email.lower(), password_hash, google_id, avatar_url))
            
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"Usuário criado com sucesso: {email}")
            return {
                'success': True, 
                'message': 'Usuário cadastrado com sucesso',
                'user_id': user_id
            }
            
        except Exception as e:
            logger.error(f"Erro ao criar usuário: {e}")
            return {'success': False, 'message': 'Erro interno ao criar usuário'}
    
    def authenticate_user(self, email, password):
        """Autentica um usuário com email e senha"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, name, email, password_hash, is_admin, avatar_url, is_active
                FROM users WHERE email = ?
            ''', (email.lower(),))
            
            user = cursor.fetchone()
            conn.close()
            
            if not user:
                return {'success': False, 'message': 'Email não encontrado'}
            
            if not user[6]:  # is_active
                return {'success': False, 'message': 'Conta desativada'}
            
            if not user[3]:  # password_hash - conta criada via Google
                return {'success': False, 'message': 'Esta conta foi criada com Google. Use "Entrar com Google"'}
            
            if not check_password_hash(user[3], password):
                return {'success': False, 'message': 'Senha incorreta'}
            
            # Atualizar último login
            self._update_last_login(user[0])
            
            user_data = {
                'id': user[0],
                'name': user[1],
                'email': user[2],
                'is_admin': bool(user[4]),
                'avatar_url': user[5]
            }
            
            token = self.generate_token(user_data)
            if not token:
                return {'success': False, 'message': 'Erro ao gerar token de autenticação'}
            
            return {
                'success': True,
                'message': 'Login realizado com sucesso',
                'token': token,
                'user': user_data
            }
            
        except Exception as e:
            logger.error(f"Erro ao autenticar usuário: {e}")
            return {'success': False, 'message': 'Erro interno de autenticação'}
    
    def authenticate_google_user(self, google_token):
        """Autentica um usuário via Google OAuth2"""
        try:
            # Verificar token do Google
            idinfo = id_token.verify_oauth2_token(
                google_token, 
                requests.Request(), 
                self.google_client_id
            )
            
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Token inválido')
            
            google_id = idinfo['sub']
            email = idinfo['email']
            name = idinfo['name']
            avatar_url = idinfo.get('picture', '')
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se usuário já existe por Google ID ou email
            cursor.execute('''
                SELECT id, name, email, is_admin, avatar_url, is_active, google_id
                FROM users WHERE google_id = ? OR email = ?
            ''', (google_id, email.lower()))
            
            user = cursor.fetchone()
            
            if user:
                if not user[5]:  # is_active
                    conn.close()
                    return {'success': False, 'message': 'Conta desativada'}
                
                # Atualizar Google ID se necessário
                if not user[6]:  # google_id
                    cursor.execute('UPDATE users SET google_id = ? WHERE id = ?', (google_id, user[0]))
                    conn.commit()
                
                user_id = user[0]
            else:
                # Criar novo usuário
                cursor.execute('''
                    INSERT INTO users (name, email, google_id, avatar_url)
                    VALUES (?, ?, ?, ?)
                ''', (name, email.lower(), google_id, avatar_url))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                # Buscar usuário recém-criado
                cursor.execute('''
                    SELECT id, name, email, is_admin, avatar_url, is_active
                    FROM users WHERE id = ?
                ''', (user_id,))
                user = cursor.fetchone()
            
            conn.close()
            
            # Atualizar último login
            self._update_last_login(user_id)
            
            user_data = {
                'id': user[0],
                'name': user[1],
                'email': user[2],
                'is_admin': bool(user[3]),
                'avatar_url': user[4]
            }
            
            token = self.generate_token(user_data)
            if not token:
                return {'success': False, 'message': 'Erro ao gerar token de autenticação'}
            
            return {
                'success': True,
                'message': 'Login com Google realizado com sucesso',
                'token': token,
                'user': user_data
            }
            
        except ValueError as e:
            logger.error(f"Token Google inválido: {e}")
            return {'success': False, 'message': 'Token do Google inválido'}
        except Exception as e:
            logger.error(f"Erro na autenticação Google: {e}")
            return {'success': False, 'message': 'Erro interno na autenticação Google'}
    
    def get_user_by_token(self, token):
        """Obtém dados do usuário através do token"""
        try:
            payload = self.verify_token(token)
            if not payload:
                return None
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, name, email, is_admin, avatar_url, is_active
                FROM users WHERE id = ? AND is_active = TRUE
            ''', (payload['user_id'],))
            
            user = cursor.fetchone()
            conn.close()
            
            if not user:
                return None
            
            return {
                'id': user[0],
                'name': user[1],
                'email': user[2],
                'is_admin': bool(user[3]),
                'avatar_url': user[4]
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter usuário por token: {e}")
            return None
    
    def _update_last_login(self, user_id):
        """Atualiza o timestamp do último login do usuário"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                (user_id,)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Erro ao atualizar último login: {e}")

def token_required(f):
    """Decorator para rotas que requerem autenticação"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Token inválido'}), 401
        
        if not token:
            return jsonify({'error': 'Token de autenticação necessário'}), 401
        
        try:
            from app import auth_manager
            current_user = auth_manager.get_user_by_token(token)
            if not current_user:
                return jsonify({'error': 'Token inválido ou expirado'}), 401
            
        except Exception:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator para rotas que requerem privilégios de administrador"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Token inválido'}), 401
        
        if not token:
            return jsonify({'error': 'Token de autenticação necessário'}), 401
        
        try:
            from app import auth_manager
            current_user = auth_manager.get_user_by_token(token)
            if not current_user:
                return jsonify({'error': 'Token inválido ou expirado'}), 401
            
            if not current_user['is_admin']:
                return jsonify({'error': 'Acesso negado. Privilégios de administrador necessários'}), 403
            
        except Exception:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated