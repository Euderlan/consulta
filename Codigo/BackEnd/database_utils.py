# database_utils.py - Utilitários para gerenciamento do banco de dados
import sqlite3
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path='users.db'):
        self.db_path = db_path
    
    def get_connection(self):
        """Retorna uma conexão com o banco de dados"""
        return sqlite3.connect(self.db_path)
    
    def create_tables(self):
        """Cria as tabelas necessárias no banco de dados"""
        try:
            conn = self.get_connection()
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
                    is_active BOOLEAN DEFAULT TRUE,
                    login_count INTEGER DEFAULT 0
                )
            ''')
            
            # Tabela de sessões (para gerenciar tokens ativos)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            # Tabela de logs de autenticação
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS auth_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    email TEXT,
                    action TEXT NOT NULL,
                    success BOOLEAN NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            # Tabela de documentos (para rastrear uploads)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    file_size INTEGER,
                    file_hash TEXT,
                    uploaded_by INTEGER NOT NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE,
                    chunk_count INTEGER DEFAULT 0,
                    description TEXT,
                    FOREIGN KEY (uploaded_by) REFERENCES users (id)
                )
            ''')
            
            conn.commit()
            conn.close()
            logger.info("Tabelas do banco de dados criadas/verificadas com sucesso")
            
        except Exception as e:
            logger.error(f"Erro ao criar tabelas: {e}")
            raise
    
    def log_auth_attempt(self, email, action, success, user_id=None, ip_address=None, user_agent=None, error_message=None):
        """Registra tentativa de autenticação no log"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO auth_logs (user_id, email, action, success, ip_address, user_agent, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, email, action, success, ip_address, user_agent, error_message))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Erro ao registrar log de autenticação: {e}")
    
    def create_session(self, user_id, token_hash, expires_at, ip_address=None, user_agent=None):
        """Cria uma nova sessão de usuário"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, token_hash, expires_at, ip_address, user_agent))
            
            session_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return session_id
            
        except Exception as e:
            logger.error(f"Erro ao criar sessão: {e}")
            return None
    
    def invalidate_session(self, token_hash):
        """Invalida uma sessão específica"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE user_sessions SET is_active = FALSE 
                WHERE token_hash = ? AND is_active = TRUE
            ''', (token_hash,))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Erro ao invalidar sessão: {e}")
    
    def cleanup_expired_sessions(self):
        """Remove sessões expiradas do banco"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE user_sessions SET is_active = FALSE 
                WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE
            ''')
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted_count > 0:
                logger.info(f"Limpeza: {deleted_count} sessões expiradas removidas")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Erro na limpeza de sessões: {e}")
            return 0
    
    def get_user_stats(self, user_id):
        """Obtém estatísticas de um usuário"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Informações básicas do usuário
            cursor.execute('''
                SELECT name, email, created_at, last_login, login_count
                FROM users WHERE id = ?
            ''', (user_id,))
            user_info = cursor.fetchone()
            
            # Contagem de sessões ativas
            cursor.execute('''
                SELECT COUNT(*) FROM user_sessions 
                WHERE user_id = ? AND is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
            ''', (user_id,))
            active_sessions = cursor.fetchone()[0]
            
            # Contagem de documentos enviados
            cursor.execute('''
                SELECT COUNT(*) FROM documents 
                WHERE uploaded_by = ? AND is_active = TRUE
            ''', (user_id,))
            documents_uploaded = cursor.fetchone()[0]
            
            # Últimas tentativas de login
            cursor.execute('''
                SELECT action, success, created_at, ip_address
                FROM auth_logs WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 10
            ''', (user_id,))
            recent_activity = cursor.fetchall()
            
            conn.close()
            
            if not user_info:
                return None
            
            return {
                'user_info': {
                    'name': user_info[0],
                    'email': user_info[1],
                    'created_at': user_info[2],
                    'last_login': user_info[3],
                    'login_count': user_info[4] or 0
                },
                'active_sessions': active_sessions,
                'documents_uploaded': documents_uploaded,
                'recent_activity': [
                    {
                        'action': activity[0],
                        'success': bool(activity[1]),
                        'timestamp': activity[2],
                        'ip_address': activity[3]
                    } for activity in recent_activity
                ]
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas do usuário: {e}")
            return None
    
    def get_system_stats(self):
        """Obtém estatísticas gerais do sistema"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Total de usuários
            cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = TRUE')
            total_users = cursor.fetchone()[0]
            
            # Total de administradores
            cursor.execute('SELECT COUNT(*) FROM users WHERE is_admin = TRUE AND is_active = TRUE')
            total_admins = cursor.fetchone()[0]
            
            # Usuários ativos (logaram nos últimos 30 dias)
            cursor.execute('''
                SELECT COUNT(*) FROM users 
                WHERE last_login > datetime('now', '-30 days') AND is_active = TRUE
            ''')
            active_users = cursor.fetchone()[0]
            
            # Total de documentos
            cursor.execute('SELECT COUNT(*) FROM documents WHERE is_active = TRUE')
            total_documents = cursor.fetchone()[0]
            
            # Sessões ativas
            cursor.execute('''
                SELECT COUNT(*) FROM user_sessions 
                WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
            ''')
            active_sessions = cursor.fetchone()[0]
            
            # Últimos registros de usuários
            cursor.execute('''
                SELECT name, email, created_at FROM users 
                WHERE is_active = TRUE 
                ORDER BY created_at DESC LIMIT 5
            ''')
            recent_users = cursor.fetchall()
            
            conn.close()
            
            return {
                'total_users': total_users,
                'total_admins': total_admins,
                'active_users': active_users,
                'total_documents': total_documents,
                'active_sessions': active_sessions,
                'recent_users': [
                    {
                        'name': user[0],
                        'email': user[1],
                        'created_at': user[2]
                    } for user in recent_users
                ]
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas do sistema: {e}")
            return None
    
    def backup_database(self, backup_path=None):
        """Cria um backup do banco de dados"""
        try:
            if not backup_path:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_path = f'backup_users_{timestamp}.db'
            
            import shutil
            shutil.copy2(self.db_path, backup_path)
            
            logger.info(f"Backup do banco criado: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Erro ao criar backup: {e}")
            return None