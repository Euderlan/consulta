# app.py - RAG Simplificado com Sistema de Autenticação Completo
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
import logging

# Configuração do sistema de logging para monitoramento da aplicação
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# Configuração de CORS para permitir requisições dos domínios autorizados
# Incluindo tanto a URL de produção quanto ambientes de desenvolvimento
CORS(app, origins=[
    "https://consulta-documento.vercel.app",  # URL de produção principal
    "https://consulta-delta-nine.vercel.app",  # URL alternativa para compatibilidade
    "http://localhost:3000",  # Ambiente de desenvolvimento React
    "http://localhost:3001"   # Ambiente de desenvolvimento alternativo
])

# Inicialização do cliente Groq para processamento de linguagem natural
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Imports do sistema de autenticação
try:
    from auth import AuthManager, token_required, admin_required
    from auth_routes import init_auth_routes
    from admin_routes import init_admin_routes
    from database_utils import DatabaseManager
    
    # Inicialização do sistema de autenticação e banco de dados
    auth_manager = AuthManager(app)
    db_manager = DatabaseManager()
    
    # Criar tabelas no banco de dados
    db_manager.create_tables()
    
    # Inicializar rotas de autenticação
    init_auth_routes(app, auth_manager)
    
    # Inicializar rotas administrativas
    init_admin_routes(app, auth_manager, db_manager)
    
    AUTH_ENABLED = True
    logger.info("Sistema de autenticação inicializado com sucesso")
    
except ImportError as e:
    logger.warning(f"Sistema de autenticação não disponível: {e}")
    AUTH_ENABLED = False
    auth_manager = None
    db_manager = None

# Armazenamento em memória para documentos processados
# Em produção, considera-se migrar para banco de dados persistente
document_store = []

def simple_text_splitter(text, chunk_size=1000, overlap=200):
    """
    Implementação de divisor de texto para otimizar processamento de documentos grandes
    Divide texto em chunks com sobreposição para manter contexto entre segmentos
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        if chunk:
            chunks.append(chunk)
        
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks

def simple_search(query, documents, max_results=3):
    """
    Sistema de busca por relevância baseado em contagem de palavras-chave
    Implementa scoring simples mas eficaz para recuperação de informações
    """
    query_words = query.lower().split()
    results = []
    
    for doc in documents:
        score = 0
        content_lower = doc['content'].lower()
        
        for word in query_words:
            score += content_lower.count(word)
        
        if score > 0:
            results.append({
                'content': doc['content'],
                'filename': doc['filename'],
                'score': score
            })
    
    # Ordenação por relevância para retornar os resultados mais pertinentes
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:max_results]

@app.route('/', methods=['GET'])
def home():
    """Endpoint de status para verificação de saúde da API"""
    features = [
        'RAG com LLM',
        'Processamento de PDF',
        'Sistema de busca inteligente'
    ]
    
    if AUTH_ENABLED:
        features.extend([
            'Autenticação JWT',
            'Login com Google',
            'Sistema de usuários',
            'Controle de acesso admin'
        ])
    
    return jsonify({
        'status': 'OK',
        'message': 'UFMA RAG API funcionando!',
        'documents_loaded': len(document_store),
        'version': '3.0.0',
        'auth_enabled': AUTH_ENABLED,
        'features': features
    })

@app.route('/chat', methods=['POST'])
def chat():
    """
    Endpoint principal para processamento de perguntas dos usuários
    Implementa pipeline completo: busca de contexto → geração de resposta → formatação
    """
    try:
        data = request.json
        question = data.get('question')
        
        if not question:
            return jsonify({'error': 'Pergunta não fornecida'}), 400
        
        logger.info(f"Pergunta recebida: {question}")
        
        # Verificação de disponibilidade de documentos no sistema
        if not document_store:
            return jsonify({
                'answer': 'Ainda não há documentos carregados no sistema. Por favor, faça upload de documentos da UFMA para começar a fazer perguntas.',
                'sources': [],
                'context': ''
            })
        
        # Execução da busca por documentos relevantes à pergunta
        search_results = simple_search(question, document_store)
        
        if not search_results:
            return jsonify({
                'answer': 'Não encontrei informações relevantes nos documentos carregados para responder sua pergunta.',
                'sources': [],
                'context': ''
            })
        
        # Preparação do contexto agregado para o modelo de linguagem
        context_parts = []
        sources = []
        
        for result in search_results:
            context_parts.append(result['content'])
            sources.append({
                'nome do arquivo': result['filename'],
                'score': result['score'],
                'conteudo': result['content'][:200] + "..." if len(result['content']) > 200 else result['content']
            })
        
        context = "\n\n".join(context_parts)
        
        # Construção do prompt especializado para documentos da UFMA
        prompt = f"""Você é um assistente especializado em documentos da UFMA (Universidade Federal do Maranhão).

Pergunta: {question}

Contexto dos documentos da UFMA:
{context}

Responda de forma clara e precisa baseando-se apenas nas informações fornecidas dos documentos da UFMA:"""
        
        # Processamento da resposta através do modelo Groq LLM
        try:
            response = client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.3
            )
            
            answer = response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Erro no Groq: {e}")
            answer = f"Erro ao processar resposta: {str(e)}"
        
        return jsonify({
            'answer': answer,
            'sources': sources,
            'context': context[:500] + "..." if len(context) > 500 else context
        })
        
    except Exception as e:
        logger.error(f"Erro no chat: {e}")
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

# Endpoint de chat protegido (apenas se autenticação estiver habilitada)
if AUTH_ENABLED:
    @app.route('/protected-chat', methods=['POST'])
    @token_required
    def protected_chat(current_user):
        """
        Endpoint de chat protegido por autenticação
        Oferece funcionalidades extras para usuários autenticados
        """
        try:
            data = request.json
            question = data.get('question')
            
            if not question:
                return jsonify({'error': 'Pergunta não fornecida'}), 400
            
            logger.info(f"Pergunta de usuário autenticado {current_user['email']}: {question}")
            
            if not document_store:
                return jsonify({
                    'answer': 'Ainda não há documentos carregados no sistema.',
                    'sources': [],
                    'context': '',
                    'user': current_user['name']
                })
            
            search_results = simple_search(question, document_store)
            
            if not search_results:
                return jsonify({
                    'answer': 'Não encontrei informações relevantes nos documentos carregados.',
                    'sources': [],
                    'context': '',
                    'user': current_user['name']
                })
            
            context_parts = []
            sources = []
            
            for result in search_results:
                context_parts.append(result['content'])
                sources.append({
                    'nome do arquivo': result['filename'],
                    'score': result['score'],
                    'conteudo': result['content'][:200] + "..." if len(result['content']) > 200 else result['content']
                })
            
            context = "\n\n".join(context_parts)
            
            prompt = f"""Você é um assistente especializado em documentos da UFMA (Universidade Federal do Maranhão).
            
Usuário autenticado: {current_user['name']} ({current_user['email']})
Pergunta: {question}

Contexto dos documentos da UFMA:
{context}

Responda de forma clara e precisa baseando-se apenas nas informações fornecidas dos documentos da UFMA:"""
            
            try:
                response = client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1000,
                    temperature=0.3
                )
                
                answer = response.choices[0].message.content
                
            except Exception as e:
                logger.error(f"Erro no Groq: {e}")
                answer = f"Erro ao processar resposta: {str(e)}"
            
            return jsonify({
                'answer': answer,
                'sources': sources,
                'context': context[:500] + "..." if len(context) > 500 else context,
                'user': current_user['name'],
                'authenticated': True
            })
            
        except Exception as e:
            logger.error(f"Erro no chat protegido: {e}")
            return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@app.route('/upload', methods=['POST'])
def upload_document():
    """
    Sistema de upload e processamento de documentos PDF
    Se autenticação estiver habilitada, requer privilégios de admin
    """
    # Se autenticação estiver habilitada, verificar se é admin
    current_user = None
    if AUTH_ENABLED:
        # Verificar se tem header de autorização
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
                current_user = auth_manager.get_user_by_token(token)
                if not current_user or not current_user['is_admin']:
                    return jsonify({'error': 'Acesso negado. Privilégios de administrador necessários'}), 403
            except:
                return jsonify({'error': 'Token inválido'}), 401
        else:
            return jsonify({'error': 'Autenticação necessária para upload'}), 401
    
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Apenas arquivos PDF são aceitos'}), 400
        
        # Pipeline de processamento de documentos PDF
        try:
            from PyPDF2 import PdfReader
            import io
            
            # Leitura e parsing do arquivo PDF
            pdf_bytes = file.read()
            pdf_file = io.BytesIO(pdf_bytes)
            pdf_reader = PdfReader(pdf_file)
            
            # Extração de texto de todas as páginas do documento
            full_text = ""
            for page in pdf_reader.pages:
                full_text += page.extract_text() + "\n"
            
            if not full_text.strip():
                return jsonify({'error': 'PDF não contém texto legível'}), 400
            
        except Exception as e:
            return jsonify({'error': f'Erro ao processar PDF: {str(e)}'}), 400
        
        # Segmentação do texto em chunks para otimizar busca e processamento
        chunks = simple_text_splitter(full_text)
        
        # Armazenamento dos chunks processados no sistema
        for chunk in chunks:
            doc_data = {
                'content': chunk,
                'filename': file.filename
            }
            # Adicionar informações do usuário se autenticado
            if current_user:
                doc_data.update({
                    'uploaded_by': current_user['email'],
                    'uploaded_at': str(datetime.now())
                })
            
            document_store.append(doc_data)
        
        upload_info = f"PDF {file.filename} processado: {len(chunks)} chunks"
        if current_user:
            upload_info += f" por {current_user['email']}"
        logger.info(upload_info)
        
        response_data = {
            'message': f'PDF {file.filename} carregado com sucesso!',
            'filename': file.filename,
            'chunks': len(chunks),
            'total_documents': len(document_store)
        }
        
        if current_user:
            response_data['uploaded_by'] = current_user['name']
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Erro no upload: {e}")
        return jsonify({'error': f'Erro no upload: {str(e)}'}), 500

@app.route('/documents', methods=['GET'])
def list_documents():
    """Endpoint para listagem e monitoramento de documentos carregados no sistema"""
    try:
        # Verificar se usuário está autenticado (opcional)
        current_user = None
        if AUTH_ENABLED:
            auth_header = request.headers.get('Authorization')
            if auth_header:
                try:
                    token = auth_header.split(' ')[1]
                    current_user = auth_manager.get_user_by_token(token)
                except:
                    pass  # Continuar sem autenticação
        
        # Agregação de estatísticas dos documentos únicos
        filenames = set()
        for doc in document_store:
            filenames.add(doc['filename'])
        
        documents = []
        for filename in filenames:
            chunks = sum(1 for doc in document_store if doc['filename'] == filename)
            
            doc_info = {
                'filename': filename,
                'chunks': chunks,
                'status': 'processed'
            }
            
            # Adicionar informações de upload se disponível
            for doc in document_store:
                if doc['filename'] == filename:
                    if 'uploaded_by' in doc:
                        doc_info['uploaded_by'] = doc['uploaded_by']
                    if 'uploaded_at' in doc:
                        doc_info['upload_date'] = doc['uploaded_at']
                    break
            
            documents.append(doc_info)
        
        response_data = {
            'documents': documents,
            'total': len(documents),
            'total_chunks': len(document_store)
        }
        
        if current_user:
            response_data['user'] = current_user['name']
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Endpoints administrativos (apenas se autenticação estiver habilitada)
if AUTH_ENABLED:
    @app.route('/admin/users', methods=['GET'])
    @admin_required
    def list_users(current_user):
        """Endpoint administrativo para listar usuários"""
        try:
            import sqlite3
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, name, email, is_admin, created_at, last_login, is_active
                FROM users ORDER BY created_at DESC
            ''')
            
            users = []
            for row in cursor.fetchall():
                users.append({
                    'id': row[0],
                    'name': row[1],
                    'email': row[2],
                    'is_admin': bool(row[3]),
                    'created_at': row[4],
                    'last_login': row[5],
                    'is_active': bool(row[6])
                })
            
            conn.close()
            
            return jsonify({
                'users': users,
                'total': len(users),
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao listar usuários: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @app.route('/admin/stats', methods=['GET'])
    @admin_required
    def admin_stats(current_user):
        """Endpoint para estatísticas administrativas"""
        try:
            stats = db_manager.get_system_stats()
            
            if not stats:
                return jsonify({'error': 'Erro ao obter estatísticas'}), 500
            
            # Adicionar informações do document store
            stats['document_store'] = {
                'total_chunks': len(document_store),
                'unique_documents': len(set(doc['filename'] for doc in document_store))
            }
            
            return jsonify({
                'stats': stats,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de monitoramento para verificação de status da aplicação"""
    try:
        # Limpeza automática de sessões expiradas (se autenticação estiver habilitada)
        if AUTH_ENABLED and db_manager:
            db_manager.cleanup_expired_sessions()
        
        health_data = {
            'status': 'OK',
            'message': 'API funcionando',
            'documents_loaded': len(document_store),
            'groq_configured': bool(os.getenv("GROQ_API_KEY")),
            'auth_enabled': AUTH_ENABLED
        }
        
        if AUTH_ENABLED:
            health_data.update({
                'auth_configured': bool(auth_manager and auth_manager.jwt_secret),
                'database_connected': os.path.exists('users.db')
            })
        
        return jsonify(health_data)
        
    except Exception as e:
        logger.error(f"Erro no health check: {e}")
        return jsonify({
            'status': 'ERROR',
            'message': f'Erro interno: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Configuração para deploy em ambiente de produção
    port = int(os.environ.get('PORT', 8000))
    
    if AUTH_ENABLED:
        logger.info("🔐 Servidor iniciado com sistema de autenticação habilitado")
        logger.info("👤 Admin padrão: admin.consepe@ufma.br / admin123")
    else:
        logger.info("🔓 Servidor iniciado sem sistema de autenticação")
    
    logger.info(f"🚀 Servidor rodando na porta {port}")
    app.run(debug=False, port=port, host='0.0.0.0')