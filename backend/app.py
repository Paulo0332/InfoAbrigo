# app.py
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from dotenv import load_dotenv
from flasgger import Swagger
from flask import Flask, Response, g, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mysqldb import MySQL
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# A hospedagem fica atrás de um proxy: sem isto, o limite de tentativas veria
# todo mundo vindo do mesmo endereço.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# Configuração do MySQL
app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST', 'mysqldb')
app.config['MYSQL_PORT'] = int(os.getenv('MYSQL_PORT', '3306'))
app.config['MYSQL_USER'] = os.getenv('MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD', 'root')
app.config['MYSQL_DB'] = os.getenv('MYSQL_DB', 'infoabrigo')
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'
app.config['MYSQL_CHARSET'] = 'utf8mb4'

# O envio de foto é o único pedido grande: os outros são recusados bem antes.
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024
LIMITE_DE_CORPO = 256 * 1024

# Configuração Swagger
app.config['SWAGGER'] = {
    'title': 'API do InfoAbrigo',
    'uiversion': 3,
    'description': 'Serviço de API para abrigos, necessidades, doações e agenda',
    'version': '1.0.0',
    'securityDefinitions': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header',
            'description': 'Digite: Bearer seguido do token recebido ao entrar',
        }
    },
}
swagger = Swagger(app)

mysql = MySQL(app)

limiter = Limiter(get_remote_address, app=app, storage_uri='memory://')
LIMITE_DE_LOGIN = os.getenv('LIMITE_LOGIN', '30') + ' per 15 minutes'

SEGREDO = os.getenv('JWT_SEGREDO')

if not SEGREDO:
    raise RuntimeError('Defina JWT_SEGREDO no ambiente ou no arquivo .env do backend.')

VALIDADE_DA_SESSAO = timedelta(days=180)
PERFIS = ('gestor', 'voluntario', 'doador', 'visitante')

# As mesmas perguntas de src/data/perguntas.js do aplicativo.
PERGUNTAS = (
    'Qual era o nome do seu primeiro animal de estimação?',
    'Em que cidade a sua mãe nasceu?',
    'Qual foi o nome da sua primeira escola?',
    'Qual é o seu prato preferido?',
)

EMAIL = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
RESUMO = re.compile(r'^[0-9a-fA-F]{64}$')


# ---------------- Apoio ----------------

class Recusado(Exception):
    def __init__(self, status, mensagem):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


@app.errorhandler(Recusado)
def tratar_recusa(erro):
    return jsonify({'erro': erro.mensagem}), erro.status


# Erro inesperado responde 500 sem detalhes: mensagem interna do banco não deve
# chegar a quem usa o aplicativo.
@app.errorhandler(Exception)
def tratar_erro(erro):
    if isinstance(erro, HTTPException):
        return jsonify({'erro': erro.description}), erro.code

    app.logger.exception(erro)

    return jsonify({'erro': 'Erro interno do servidor.'}), 500


@app.before_request
def limitar_corpo():
    grande = request.method == 'POST' and request.path == '/arquivos'

    if not grande and (request.content_length or 0) > LIMITE_DE_CORPO:
        raise Recusado(413, 'Pedido grande demais.')


@app.after_request
def cabecalhos_de_seguranca(resposta):
    resposta.headers['X-Content-Type-Options'] = 'nosniff'

    return resposta


def corpo():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        raise Recusado(400, 'Envie um objeto JSON.')

    return dados


def consultar(sql, parametros=()):
    cur = mysql.connection.cursor()
    cur.execute(sql, parametros)

    return cur.fetchall()


def consultar_um(sql, parametros=()):
    cur = mysql.connection.cursor()
    cur.execute(sql, parametros)

    return cur.fetchone()


def executar(sql, parametros=()):
    cur = mysql.connection.cursor()
    cur.execute(sql, parametros)


def salvar():
    mysql.connection.commit()


def como_json(valor):
    return json.dumps(valor, ensure_ascii=False)


def de_json(valor):
    return json.loads(valor) if isinstance(valor, (str, bytes)) else valor


def ler_email(dados):
    email = dados.get('email')

    if not isinstance(email, str) or len(email) > 200 or not EMAIL.match(email.strip()):
        raise Recusado(400, 'Informe um e-mail válido.')

    return email.strip().lower()


def ler_resumo(dados, campo):
    valor = dados.get(campo)

    if not isinstance(valor, str) or not RESUMO.match(valor):
        raise Recusado(400, 'O campo ' + campo + ' é inválido.')

    return valor


def ler_texto(dados, campo, minimo=0, maximo=200):
    valor = dados.get(campo)

    if not isinstance(valor, str) or not minimo <= len(valor.strip()) <= maximo:
        raise Recusado(400, 'O campo ' + campo + ' é inválido.')

    return valor.strip()


def ler_numero(dados, campo, minimo, maximo):
    valor = dados.get(campo)

    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not minimo <= valor <= maximo:
        raise Recusado(400, 'O campo ' + campo + ' é inválido.')

    return valor


def ler_id(valor):
    if len(valor) > 64:
        raise Recusado(400, 'Identificador grande demais.')

    return valor


# ---------------- Senhas e sessão ----------------

def derivar(resumo, sal):
    return hashlib.scrypt(resumo.encode(), salt=sal.encode(), n=16384, r=8, p=1, dklen=32)


# A senha chega já resumida pelo aplicativo (sal + SHA-256) e aqui ganha uma
# segunda camada, com scrypt. O resumo do aplicativo sozinho seria o mesmo que
# guardar a senha: quem o lesse do banco conseguiria entrar enviando-o.
def proteger(resumo):
    sal = secrets.token_hex(16)

    return sal + ':' + derivar(resumo, sal).hex()


def confere(resumo, protegida):
    if not resumo or not protegida:
        return False

    sal, guardada = protegida.split(':')

    return hmac.compare_digest(derivar(resumo, sal).hex(), guardada)


def criar_token(conta):
    agora = datetime.now(timezone.utc)

    return jwt.encode(
        {
            'sub': conta['email'],
            'versao': conta['versao_sessao'],
            'iat': agora,
            'exp': agora + VALIDADE_DA_SESSAO,
        },
        SEGREDO,
        algorithm='HS256',
    )


# Além da assinatura, confere a versão da sessão na conta: trocar a senha precisa
# derrubar quem estava entrando com a senha antiga.
def exigir_login(funcao):
    @wraps(funcao)
    def conferida(*args, **kwargs):
        tipo, _, token = request.headers.get('Authorization', '').partition(' ')

        if tipo != 'Bearer' or not token:
            raise Recusado(401, 'Faça login para continuar.')

        try:
            dados = jwt.decode(token, SEGREDO, algorithms=['HS256'])
        except jwt.InvalidTokenError:
            raise Recusado(401, 'Sessão expirada. Entre de novo.')

        conta = consultar_um('SELECT versao_sessao FROM contas WHERE email = %s', (dados['sub'],))

        if not conta or conta['versao_sessao'] != dados.get('versao'):
            raise Recusado(401, 'Sessão expirada. Entre de novo.')

        g.email = dados['sub']

        return funcao(*args, **kwargs)

    return conferida


# O que o aplicativo pode saber da conta. A resposta da pergunta nunca sai daqui,
# nem protegida.
def sessao(conta):
    return {
        'token': criar_token(conta),
        'conta': {
            'email': conta['email'],
            'nome': conta['nome'],
            'perfil': conta['perfil'],
            'instituicao': de_json(conta['instituicao']),
            'telefone': conta['telefone'],
            'sal': conta['sal'],
            'pergunta': conta['pergunta'],
        },
    }


def buscar_conta(email):
    return consultar_um('SELECT * FROM contas WHERE email = %s', (email,))


# Para e-mail que não existe, responde sal e pergunta falsos, porém sempre os
# mesmos. Responder 404 entregaria quem tem conta para qualquer um que perguntasse.
def falso_estavel(email):
    return hmac.new(SEGREDO.encode(), email.encode(), hashlib.sha256).hexdigest()


def pergunta_falsa(email):
    return PERGUNTAS[int(falso_estavel(email)[36:44], 16) % len(PERGUNTAS)]


# ---------------- Rotas: saúde e contas ----------------

@app.route('/saude', methods=['GET'])
def saude():
    """
    Confere se a API está no ar
    ---
    tags: [Apoio]
    responses:
      200:
        description: API no ar
    """
    return jsonify({'ok': True}), 200


@app.route('/auth/sal', methods=['POST'])
@limiter.limit(LIMITE_DE_LOGIN)
def pedir_sal():
    """
    Devolve o sal e a pergunta de segurança de um e-mail
    ---
    tags: [Contas]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [email]
          properties:
            email: {type: string}
    responses:
      200:
        description: Sal e pergunta. Para e-mail desconhecido, valores falsos e estáveis
    """
    email = ler_email(corpo())
    conta = buscar_conta(email)

    return jsonify({
        'sal': conta['sal'] if conta else falso_estavel(email)[:36],
        'pergunta': conta['pergunta'] if conta else pergunta_falsa(email),
    }), 200


@app.route('/auth/cadastro', methods=['POST'])
@limiter.limit(LIMITE_DE_LOGIN)
def cadastrar():
    """
    Cria a conta
    ---
    tags: [Contas]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [email, nome, perfil, sal, senhaResumo]
          properties:
            email: {type: string}
            nome: {type: string}
            perfil: {type: string, enum: [gestor, voluntario, doador, visitante]}
            instituicao: {type: object}
            telefone: {type: string}
            sal: {type: string}
            senhaResumo: {type: string}
            pergunta: {type: string}
            respostaResumo: {type: string}
    responses:
      201:
        description: Conta criada, com o token da sessão
      400:
        description: Dados inválidos
      409:
        description: E-mail já cadastrado
    """
    dados = corpo()
    email = ler_email(dados)
    nome = ler_texto(dados, 'nome', 2, 120)
    sal = ler_texto(dados, 'sal', 8, 100)
    senha = ler_resumo(dados, 'senhaResumo')
    perfil = dados.get('perfil')

    if perfil not in PERFIS:
        raise Recusado(400, 'O campo perfil é inválido.')

    resposta = ler_resumo(dados, 'respostaResumo') if dados.get('respostaResumo') else None

    if buscar_conta(email):
        raise Recusado(409, 'Já existe uma conta com este e-mail.')

    executar(
        'INSERT INTO contas (email, nome, perfil, instituicao, telefone, sal, senha_protegida, '
        'pergunta, resposta_protegida) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)',
        (
            email,
            nome,
            perfil,
            como_json(dados.get('instituicao')),
            str(dados.get('telefone') or '')[:40],
            sal,
            proteger(senha),
            str(dados.get('pergunta') or '')[:200],
            proteger(resposta) if resposta else '',
        ),
    )
    salvar()

    return jsonify(sessao(buscar_conta(email))), 201


@app.route('/auth/entrar', methods=['POST'])
@limiter.limit(LIMITE_DE_LOGIN)
def entrar():
    """
    Entra na conta
    ---
    tags: [Contas]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [email, senhaResumo]
          properties:
            email: {type: string}
            senhaResumo: {type: string}
    responses:
      200:
        description: Token da sessão e dados da conta
      401:
        description: E-mail ou senha incorretos
    """
    dados = corpo()
    conta = buscar_conta(ler_email(dados))

    if not conta or not confere(ler_resumo(dados, 'senhaResumo'), conta['senha_protegida']):
        raise Recusado(401, 'E-mail ou senha incorretos.')

    return jsonify(sessao(conta)), 200


@app.route('/auth/recuperar', methods=['POST'])
@limiter.limit(LIMITE_DE_LOGIN)
def recuperar():
    """
    Troca a senha pela resposta da pergunta de segurança
    ---
    tags: [Contas]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [email, respostaResumo, senhaResumoNova]
          properties:
            email: {type: string}
            respostaResumo: {type: string}
            senhaResumoNova: {type: string}
    responses:
      200:
        description: Senha trocada, com o novo token
      401:
        description: A resposta não confere
    """
    dados = corpo()
    email = ler_email(dados)
    conta = buscar_conta(email)

    if not conta or not confere(ler_resumo(dados, 'respostaResumo'), conta['resposta_protegida']):
        raise Recusado(401, 'A resposta não confere com a do cadastro.')

    executar(
        'UPDATE contas SET senha_protegida = %s, versao_sessao = versao_sessao + 1 WHERE email = %s',
        (proteger(ler_resumo(dados, 'senhaResumoNova')), email),
    )
    salvar()

    return jsonify(sessao(buscar_conta(email))), 200


@app.route('/contas/eu', methods=['PUT'])
@exigir_login
def atualizar_conta():
    """
    Altera a própria conta
    ---
    tags: [Contas]
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            nome: {type: string}
            perfil: {type: string}
            instituicao: {type: object}
            telefone: {type: string}
            senhaAtualResumo: {type: string, description: Obrigatória para trocar senha ou pergunta}
            sal: {type: string}
            senhaResumo: {type: string}
            pergunta: {type: string}
            respostaResumo: {type: string}
    responses:
      200:
        description: Conta alterada, com o token atual
      403:
        description: A senha atual não confere
    """
    dados = corpo()
    conta = buscar_conta(g.email)
    credenciais = ('senhaResumo', 'respostaResumo', 'sal', 'pergunta')

    # Trocar credencial exige provar a senha atual: sem isso, uma sessão esquecida
    # num celular bastaria para tomar a conta.
    if any(dados.get(campo) is not None for campo in credenciais):
        atual = dados.get('senhaAtualResumo')

        if not isinstance(atual, str) or not confere(atual, conta['senha_protegida']):
            raise Recusado(403, 'A senha atual não confere.')

    trocas = {}

    if 'nome' in dados:
        trocas['nome'] = ler_texto(dados, 'nome', 2, 120)

    if 'perfil' in dados:
        if dados['perfil'] not in PERFIS:
            raise Recusado(400, 'O campo perfil é inválido.')

        trocas['perfil'] = dados['perfil']

    if 'instituicao' in dados:
        trocas['instituicao'] = como_json(dados['instituicao'])

    if 'telefone' in dados:
        trocas['telefone'] = str(dados['telefone'] or '')[:40]

    if dados.get('sal') is not None:
        trocas['sal'] = ler_texto(dados, 'sal', 8, 100)

    if dados.get('pergunta') is not None:
        trocas['pergunta'] = ler_texto(dados, 'pergunta', 0, 200)

    if dados.get('respostaResumo'):
        trocas['resposta_protegida'] = proteger(ler_resumo(dados, 'respostaResumo'))

    versao = ''

    if dados.get('senhaResumo') and dados['senhaResumo'] != dados.get('senhaAtualResumo'):
        trocas['senha_protegida'] = proteger(ler_resumo(dados, 'senhaResumo'))
        versao = ', versao_sessao = versao_sessao + 1'

    if trocas:
        colunas = ', '.join(coluna + ' = %s' for coluna in trocas)

        executar(
            'UPDATE contas SET ' + colunas + versao + ' WHERE email = %s',
            (*trocas.values(), g.email),
        )
        salvar()

    return jsonify(sessao(buscar_conta(g.email))), 200


# Apagar a conta leva o que é dela de verdade, sem exclusão lógica: dado pessoal
# não pode ficar guardado depois de a pessoa pedir para sair. Inclui os abrigos,
# porque abrigo sem dono ficaria no mapa sem ninguém que possa corrigir ou retirar.
@app.route('/contas/eu', methods=['DELETE'])
@exigir_login
def apagar_conta():
    """
    Apaga a conta e tudo que é dela
    ---
    tags: [Contas]
    security:
      - Bearer: []
    responses:
      204:
        description: Conta apagada
    """
    email = g.email

    executar(
        'DELETE FROM necessidades WHERE abrigo_id IN (SELECT id FROM abrigos WHERE dono = %s) '
        "OR (criado_por = %s AND (abrigo_id IS NULL OR abrigo_id = ''))",
        (email, email),
    )

    for linha in consultar(
        "SELECT id, dados FROM necessidades WHERE JSON_CONTAINS(dados, JSON_OBJECT('por', %s), '$.contribuicoes')",
        (email,),
    ):
        dados = de_json(linha['dados'])

        dados['contribuicoes'] = [
            uma for uma in dados.get('contribuicoes', []) if uma.get('por') != email
        ]
        executar('UPDATE necessidades SET dados = %s WHERE id = %s', (como_json(dados), linha['id']))

    executar('DELETE FROM abrigos WHERE dono = %s', (email,))
    executar('DELETE FROM doacoes WHERE conta = %s', (email,))
    executar('DELETE FROM compromissos WHERE conta = %s', (email,))
    executar('DELETE FROM arquivos WHERE dono = %s', (email,))
    executar('DELETE FROM contas WHERE email = %s', (email,))
    salvar()

    return '', 204


# ---------------- Rotas: abrigos ----------------

def listar(tabela, onde='', parametros=()):
    filtro = ' AND ' + onde if onde else ''
    linhas = consultar(
        'SELECT dados FROM ' + tabela + ' WHERE deleted_at IS NULL' + filtro
        + ' ORDER BY created_at DESC, id DESC',
        parametros,
    )

    return jsonify([de_json(linha['dados']) for linha in linhas]), 200


@app.route('/abrigos', methods=['GET'])
@exigir_login
def listar_abrigos():
    """
    Lista todos os abrigos
    ---
    tags: [Abrigos]
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de abrigos
    """
    return listar('abrigos')


@app.route('/abrigos/<id>', methods=['PUT'])
@exigir_login
def gravar_abrigo(id):
    """
    Cria ou altera um abrigo. O dono vem da sessão, e só ele altera
    ---
    tags: [Abrigos]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [nome, latitude, longitude]
          properties:
            nome: {type: string}
            latitude: {type: number}
            longitude: {type: number}
    responses:
      200:
        description: Abrigo gravado
      400:
        description: Dados inválidos
      403:
        description: O abrigo é de outra conta
    """
    ler_id(id)
    dados = corpo()
    nome = ler_texto(dados, 'nome', 1, 200)
    latitude = ler_numero(dados, 'latitude', -90, 90)
    longitude = ler_numero(dados, 'longitude', -180, 180)
    atual = consultar_um('SELECT dono FROM abrigos WHERE id = %s', (id,))

    if atual and atual['dono'] != g.email:
        raise Recusado(403, 'Só quem cadastrou o abrigo pode alterá-lo.')

    registro = {**dados, 'id': id, 'dono': g.email}

    executar(
        'INSERT INTO abrigos (id, dono, nome, latitude, longitude, dados) VALUES (%s, %s, %s, %s, %s, %s) '
        'ON DUPLICATE KEY UPDATE nome = VALUES(nome), latitude = VALUES(latitude), '
        'longitude = VALUES(longitude), dados = VALUES(dados), deleted_at = NULL',
        (id, g.email, nome, latitude, longitude, como_json(registro)),
    )
    salvar()

    return jsonify(registro), 200


@app.route('/abrigos/<id>', methods=['DELETE'])
@exigir_login
def apagar_abrigo(id):
    """
    Exclui logicamente um abrigo e as necessidades dele. Só o dono exclui
    ---
    tags: [Abrigos]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
    responses:
      204:
        description: Abrigo excluído
      403:
        description: O abrigo é de outra conta
    """
    atual = consultar_um('SELECT dono FROM abrigos WHERE id = %s', (id,))

    if atual and atual['dono'] != g.email:
        raise Recusado(403, 'Só quem cadastrou o abrigo pode excluí-lo.')

    executar('UPDATE necessidades SET deleted_at = NOW() WHERE abrigo_id = %s', (id,))
    executar('UPDATE abrigos SET deleted_at = NOW() WHERE id = %s', (id,))
    salvar()

    return '', 204


# ---------------- Rotas: necessidades ----------------

def administra(abrigo_id, criado_por, email):
    if abrigo_id:
        abrigo = consultar_um('SELECT dono FROM abrigos WHERE id = %s AND deleted_at IS NULL', (abrigo_id,))

        if abrigo:
            return abrigo['dono'] == email

    return (criado_por or email) == email


# Junta as contribuições do que está gravado com o que chegou.
#
# O celular envia a necessidade inteira, com a lista como ele a conhecia. Se isso
# substituísse o que está no banco, quem doou enquanto o outro estava sem internet
# teria a promessa apagada sem saber. A regra: cada pessoa só mexe na própria
# contribuição, e só quem administra marca que algo foi entregue.
def juntar_contribuicoes(gravadas, recebidas, email, eh_gestor):
    por_id = {str(item.get('id')): item for item in recebidas}
    ids_gravados = {str(item.get('id')) for item in gravadas}
    lista = []

    for gravada in gravadas:
        nova = por_id.get(str(gravada.get('id')))

        if gravada.get('por') == email:
            if nova:
                entregue = nova.get('entregue') is True if eh_gestor else gravada.get('entregue') is True

                lista.append({**nova, 'por': email, 'entregue': entregue})

            continue

        lista.append(
            {**gravada, 'entregue': nova.get('entregue') is True} if eh_gestor and nova else gravada
        )

    for nova in recebidas:
        if str(nova.get('id')) not in ids_gravados and nova.get('por') == email:
            lista.append({**nova, 'entregue': eh_gestor and nova.get('entregue') is True})

    return lista


def ler_contribuicoes(dados):
    recebidas = dados.get('contribuicoes') or []

    if not isinstance(recebidas, list):
        raise Recusado(400, 'O campo contribuicoes é inválido.')

    lista = []

    for item in recebidas:
        if not isinstance(item, dict) or item.get('id') is None or not isinstance(item.get('por'), str):
            raise Recusado(400, 'O campo contribuicoes é inválido.')

        ler_numero(item, 'quantidade', 0, 10 ** 9)

        # O id da doação sempre como texto: é por ele que o abrigo a encontra depois.
        lista.append({**item, 'doacaoId': str(item['doacaoId'])} if item.get('doacaoId') is not None else item)

    return lista


@app.route('/necessidades', methods=['GET'])
@exigir_login
def listar_necessidades():
    """
    Lista todas as necessidades
    ---
    tags: [Necessidades]
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de necessidades
    """
    return listar('necessidades')


@app.route('/necessidades/<id>', methods=['PUT'])
@exigir_login
def gravar_necessidade(id):
    """
    Cria ou altera uma necessidade. Quem não administra só altera a própria contribuição
    ---
    tags: [Necessidades]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            title: {type: string}
            abrigoId: {type: string}
            alvo: {type: number}
            unidade: {type: string}
            done: {type: boolean}
            contribuicoes: {type: array, items: {type: object}}
    responses:
      200:
        description: Necessidade gravada
      403:
        description: Só quem administra o abrigo pode criar necessidades nele
    """
    ler_id(id)
    dados = corpo()
    recebidas = ler_contribuicoes(dados)
    atual = consultar_um('SELECT * FROM necessidades WHERE id = %s AND deleted_at IS NULL', (id,))

    if not atual:
        if not administra(dados.get('abrigoId'), None, g.email):
            raise Recusado(403, 'Só quem administra o abrigo pode criar necessidades nele.')

        registro = {
            **dados,
            'id': id,
            'criadoPor': g.email,
            'contribuicoes': juntar_contribuicoes([], recebidas, g.email, True),
        }
        criado_por = g.email
        abrigo_id = dados.get('abrigoId') or None
    else:
        gravado = de_json(atual['dados'])
        eh_gestor = administra(atual['abrigo_id'], atual['criado_por'], g.email)
        contribuicoes = juntar_contribuicoes(
            gravado.get('contribuicoes') or [], recebidas, g.email, eh_gestor
        )
        criado_por = atual['criado_por']
        abrigo_id = atual['abrigo_id'] or dados.get('abrigoId') or None

        # Quem não administra só altera a própria contribuição: título, meta e
        # situação da necessidade continuam como estão no banco.
        base = {**dados, 'abrigoId': abrigo_id} if eh_gestor else gravado
        registro = {**base, 'id': id, 'criadoPor': criado_por, 'contribuicoes': contribuicoes}

    executar(
        'INSERT INTO necessidades (id, criado_por, abrigo_id, dados) VALUES (%s, %s, %s, %s) '
        'ON DUPLICATE KEY UPDATE abrigo_id = VALUES(abrigo_id), dados = VALUES(dados), deleted_at = NULL',
        (id, criado_por, abrigo_id, como_json(registro)),
    )
    salvar()

    return jsonify(registro), 200


@app.route('/necessidades/<id>', methods=['DELETE'])
@exigir_login
def apagar_necessidade(id):
    """
    Exclui logicamente uma necessidade. Só quem administra exclui
    ---
    tags: [Necessidades]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
    responses:
      204:
        description: Necessidade excluída
      403:
        description: Só quem administra o abrigo pode excluir
    """
    atual = consultar_um('SELECT * FROM necessidades WHERE id = %s', (id,))

    if atual and not administra(atual['abrigo_id'], atual['criado_por'], g.email):
        raise Recusado(403, 'Só quem administra o abrigo pode excluir a necessidade.')

    executar('UPDATE necessidades SET deleted_at = NOW() WHERE id = %s', (id,))
    salvar()

    return '', 204


# ---------------- Rotas: registros privados (doações e compromissos) ----------------

def gravar_privado(tabela, id, dados, mensagem):
    ler_id(id)
    atual = consultar_um('SELECT conta FROM ' + tabela + ' WHERE id = %s', (id,))

    if atual and atual['conta'] != g.email:
        raise Recusado(403, mensagem)

    registro = {**dados, 'id': id, 'conta': g.email}

    executar(
        'INSERT INTO ' + tabela + ' (id, conta, dados) VALUES (%s, %s, %s) '
        'ON DUPLICATE KEY UPDATE dados = VALUES(dados), deleted_at = NULL',
        (id, g.email, como_json(registro)),
    )
    salvar()

    return jsonify(registro), 200


def apagar_privado(tabela, id, mensagem):
    atual = consultar_um('SELECT conta FROM ' + tabela + ' WHERE id = %s', (id,))

    if atual and atual['conta'] != g.email:
        raise Recusado(403, mensagem)

    executar('UPDATE ' + tabela + ' SET deleted_at = NOW() WHERE id = %s', (id,))
    salvar()

    return '', 204


@app.route('/doacoes', methods=['GET'])
@exigir_login
def listar_doacoes():
    """
    Lista as doações da própria conta
    ---
    tags: [Doações]
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de doações
    """
    return listar('doacoes', 'conta = %s', (g.email,))


@app.route('/doacoes/<id>', methods=['PUT'])
@exigir_login
def gravar_doacao(id):
    """
    Cria ou altera uma doação própria
    ---
    tags: [Doações]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            tipo: {type: string}
            valor: {type: number}
            situacao: {type: string}
    responses:
      200:
        description: Doação gravada
      403:
        description: A doação é de outra pessoa
    """
    dados = corpo()

    if 'valor' in dados:
        ler_numero(dados, 'valor', 0, 10 ** 12)

    return gravar_privado('doacoes', id, dados, 'Esta doação é de outra pessoa.')


@app.route('/doacoes/<id>', methods=['DELETE'])
@exigir_login
def apagar_doacao(id):
    """
    Exclui logicamente uma doação própria
    ---
    tags: [Doações]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
    responses:
      204:
        description: Doação excluída
      403:
        description: A doação é de outra pessoa
    """
    return apagar_privado('doacoes', id, 'Esta doação é de outra pessoa.')


# A situação pode ser mudada por quem doou ou por quem recebeu: é o abrigo que sabe
# que o item chegou. Quem recebeu é descoberto pela necessidade que tem aquela
# doação como contribuição.
@app.route('/doacoes/<id>/situacao', methods=['PATCH'])
@exigir_login
def mudar_situacao(id):
    """
    Muda a situação de uma doação. Quem doou ou o abrigo que recebeu
    ---
    tags: [Doações]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [situacao]
          properties:
            situacao: {type: string, enum: [pendente, confirmada]}
    responses:
      204:
        description: Situação alterada
      403:
        description: Sem permissão
    """
    situacao = corpo().get('situacao')

    if situacao not in ('pendente', 'confirmada'):
        raise Recusado(400, 'O campo situacao é inválido.')

    atual = consultar_um('SELECT * FROM doacoes WHERE id = %s AND deleted_at IS NULL', (id,))

    if not atual:
        return '', 204

    if atual['conta'] != g.email:
        necessidade = consultar_um(
            "SELECT abrigo_id, criado_por FROM necessidades WHERE deleted_at IS NULL "
            "AND JSON_CONTAINS(dados, JSON_OBJECT('doacaoId', %s), '$.contribuicoes')",
            (id,),
        )

        if not necessidade or not administra(necessidade['abrigo_id'], necessidade['criado_por'], g.email):
            raise Recusado(403, 'Só quem doou ou o abrigo podem mudar esta situação.')

    dados = de_json(atual['dados'])

    dados['situacao'] = situacao

    if situacao == 'confirmada':
        dados['recebidaEm'] = datetime.now(timezone.utc).isoformat()
    else:
        dados.pop('recebidaEm', None)

    executar('UPDATE doacoes SET dados = %s WHERE id = %s', (como_json(dados), id))
    salvar()

    return '', 204


@app.route('/compromissos', methods=['GET'])
@exigir_login
def listar_compromissos():
    """
    Lista a agenda da própria conta
    ---
    tags: [Agenda]
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de compromissos
    """
    return listar('compromissos', 'conta = %s', (g.email,))


@app.route('/compromissos/<id>', methods=['PUT'])
@exigir_login
def gravar_compromisso(id):
    """
    Cria ou altera um compromisso próprio
    ---
    tags: [Agenda]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [quando]
          properties:
            quando: {type: string, format: date-time}
            tipo: {type: string}
    responses:
      200:
        description: Compromisso gravado
      400:
        description: Data inválida
      403:
        description: O compromisso é de outra pessoa
    """
    dados = corpo()

    try:
        datetime.fromisoformat(str(dados.get('quando')))
    except ValueError:
        raise Recusado(400, 'O campo quando é inválido.')

    return gravar_privado('compromissos', id, dados, 'Este compromisso é de outra pessoa.')


@app.route('/compromissos/<id>', methods=['DELETE'])
@exigir_login
def apagar_compromisso(id):
    """
    Exclui logicamente um compromisso próprio
    ---
    tags: [Agenda]
    security:
      - Bearer: []
    parameters:
      - {name: id, in: path, type: string, required: true}
    responses:
      204:
        description: Compromisso excluído
      403:
        description: O compromisso é de outra pessoa
    """
    return apagar_privado('compromissos', id, 'Este compromisso é de outra pessoa.')


# ---------------- Rotas: fotos ----------------

# O tipo vem dos primeiros bytes, e não do que o aplicativo declara: é o que impede
# guardar outra coisa disfarçada de imagem num endereço público.
def tipo_da_imagem(dados):
    if dados[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'

    if dados[:4] == b'\x89PNG':
        return 'image/png'

    return None


@app.route('/arquivos', methods=['POST'])
@exigir_login
def enviar_arquivo():
    """
    Envia uma foto em base64 (JPEG ou PNG)
    ---
    tags: [Fotos]
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [base64]
          properties:
            base64: {type: string}
    responses:
      201:
        description: Foto guardada, com o caminho público
      400:
        description: Não é uma imagem JPEG ou PNG
    """
    try:
        dados = base64.b64decode(corpo().get('base64', ''), validate=True)
    except (binascii.Error, ValueError, TypeError):
        raise Recusado(400, 'Envie a imagem em base64.')

    mime = tipo_da_imagem(dados)

    if not mime:
        raise Recusado(400, 'Envie uma imagem JPEG ou PNG.')

    id = secrets.token_hex(16)

    executar(
        'INSERT INTO arquivos (id, dono, mime, dados) VALUES (%s, %s, %s, %s)',
        (id, g.email, mime, dados),
    )
    salvar()

    return jsonify({'caminho': '/arquivos/' + id}), 201


@app.route('/arquivos/<id>', methods=['GET'])
def ver_arquivo(id):
    """
    Abre uma foto
    ---
    tags: [Fotos]
    parameters:
      - {name: id, in: path, type: string, required: true}
    produces: [image/jpeg, image/png]
    responses:
      200:
        description: A imagem
      404:
        description: Imagem não encontrada
    """
    arquivo = (
        consultar_um('SELECT mime, dados FROM arquivos WHERE id = %s', (id,))
        if re.fullmatch(r'[0-9a-f]{32}', id)
        else None
    )

    if not arquivo:
        raise Recusado(404, 'Imagem não encontrada.')

    return Response(
        bytes(arquivo['dados']),
        mimetype=arquivo['mime'],
        headers={'Cache-Control': 'public, max-age=86400'},
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=os.getenv('FLASK_DEBUG') == '1')
