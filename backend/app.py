# app.py
import truststore

# Usa os certificados do sistema nas conexões https. Sem isto, o Python só confia na
# lista própria do pacote certifi, e falha em redes que inspecionam o tráfego, como
# as de empresas e faculdades: a API não conseguia baixar os certificados do Google
# para conferir o login. Precisa vir antes de qualquer conexão.
truststore.inject_into_ssl()

import base64
import binascii
import csv
import io
import json
import math
import os
import re
import secrets
import urllib.error
import urllib.request
from functools import wraps

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from firebase_admin import db as firebase_db
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
LIMITE_DE_CORPO = 16 * 1024

# Configuração Swagger
app.config['SWAGGER'] = {
    'title': 'API do InfoAbrigo',
    'uiversion': 3,
    'description': 'O que o aplicativo não pode decidir sozinho: fotos, selo de '
                   'instituição verificada, recomendações, relatórios e denúncias. '
                   'Os dados do dia a dia ficam no Firebase.',
    'version': '2.0.0',
    'securityDefinitions': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header',
            'description': 'Digite: Bearer seguido do token de login do Firebase',
        }
    },
}
swagger = Swagger(app)

mysql = MySQL(app)

limiter = Limiter(get_remote_address, app=app, storage_uri='memory://')
LIMITE_DE_ESCRITA = os.getenv('LIMITE_ESCRITA', '30') + ' per 15 minutes'

# Configuração do Firebase. FIREBASE_CREDENCIAIS é o arquivo da conta de serviço, que
# é secreto e nunca entra no repositório. No emulador, ele não é necessário.
opcoes_do_firebase = {
    'projectId': os.getenv('FIREBASE_PROJECT_ID', 'demo-infoabrigo'),
    'databaseURL': os.getenv(
        'FIREBASE_DATABASE_URL',
        'http://127.0.0.1:9000/?ns=demo-infoabrigo-default-rtdb',
    ),
}
arquivo_de_credenciais = os.getenv('FIREBASE_CREDENCIAIS')

firebase_admin.initialize_app(
    credentials.Certificate(arquivo_de_credenciais) if arquivo_de_credenciais else None,
    opcoes_do_firebase,
)

# Quantas pessoas diferentes precisam denunciar para o abrigo ganhar o aviso. Uma só
# não basta: seria fácil demais prejudicar um abrigo de verdade.
DENUNCIAS_PARA_ALERTA = 3
MOTIVOS_DE_DENUNCIA = ('chave-pix-suspeita', 'abrigo-inexistente', 'dados-errados', 'outro')
URL_DO_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1/'


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


def ler_id(valor):
    if not isinstance(valor, str) or not re.fullmatch(r'[^.#$/\[\]]{1,64}', valor):
        raise Recusado(400, 'Identificador inválido.')

    return valor


def ler_abrigo(abrigo_id):
    abrigo = firebase_db.reference('abrigos/' + ler_id(abrigo_id)).get()

    if not abrigo:
        raise Recusado(404, 'Abrigo não encontrado.')

    return abrigo


def exigir_dono(abrigo_id):
    abrigo = ler_abrigo(abrigo_id)

    if abrigo.get('donoUid') != g.uid:
        raise Recusado(403, 'Só quem cadastrou o abrigo pode fazer isso.')

    return abrigo


# O login é do Firebase: a API só confere o token que o aplicativo recebeu dele.
def exigir_login(funcao):
    @wraps(funcao)
    def conferida(*args, **kwargs):
        tipo, _, token = request.headers.get('Authorization', '').partition(' ')

        if tipo != 'Bearer' or not token:
            raise Recusado(401, 'Faça login para continuar.')

        try:
            dados = firebase_auth.verify_id_token(token)
        except (ValueError, firebase_auth.InvalidIdTokenError, firebase_auth.ExpiredIdTokenError,
                firebase_auth.RevokedIdTokenError, firebase_auth.UserDisabledError,
                firebase_auth.CertificateFetchError):
            raise Recusado(401, 'Sessão expirada. Entre de novo.')

        g.uid = dados['uid']
        g.email = dados.get('email', '')

        return funcao(*args, **kwargs)

    return conferida


# ---------------- Rotas: saúde ----------------

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
        'INSERT INTO arquivos (id, uid, mime, dados) VALUES (%s, %s, %s, %s)',
        (id, g.uid, mime, dados),
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
        consultar_um('SELECT mime, dados FROM arquivos WHERE id = %s AND deleted_at IS NULL', (id,))
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


# ---------------- Rotas: selo de instituição verificada ----------------

def cnpj_tem_digitos_validos(cnpj):
    if not re.fullmatch(r'\d{14}', cnpj) or len(set(cnpj)) == 1:
        return False

    def digito(parte):
        pesos = list(range(len(parte) - 7, 1, -1)) + list(range(9, 1, -1))
        resto = sum(int(n) * p for n, p in zip(parte, pesos)) % 11

        return '0' if resto < 2 else str(11 - resto)

    return cnpj[12] == digito(cnpj[:12]) and cnpj[13] == digito(cnpj[:13])


# Separada para os testes conseguirem simular a Receita. Devolve None se o CNPJ não
# existir, e dispara erro de rede se o serviço estiver fora do ar.
def consultar_cnpj(cnpj):
    pedido = urllib.request.Request(URL_DO_CNPJ + cnpj, headers={'User-Agent': 'InfoAbrigo'})

    try:
        with urllib.request.urlopen(pedido, timeout=10) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as erro:
        if erro.code in (400, 404):
            return None

        raise


# Se a conferência estivesse no celular, bastaria alterar o aplicativo para ganhar o
# selo. Aqui, quem confere é o servidor, e o selo vai para um lugar do Firebase que
# só a API pode escrever.
#
# O limite é o de sempre: o selo prova que a instituição existe e está ativa, não que
# a pessoa trabalha lá. O que dá para evitar é outra conta usar o mesmo CNPJ.
@app.route('/verificacoes', methods=['POST'])
@exigir_login
@limiter.limit(LIMITE_DE_ESCRITA)
def verificar_instituicao():
    """
    Confere o CNPJ na Receita e concede o selo ao abrigo
    ---
    tags: [Verificação]
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [abrigoId, cnpj]
          properties:
            abrigoId: {type: string}
            cnpj: {type: string}
    responses:
      200:
        description: Resultado da conferência
      400:
        description: CNPJ inválido
      403:
        description: O abrigo é de outra conta
      409:
        description: O CNPJ já é usado por outra conta
      503:
        description: A consulta à Receita está fora do ar
    """
    dados = corpo()
    abrigo_id = ler_id(dados.get('abrigoId'))
    cnpj = re.sub(r'\D', '', str(dados.get('cnpj') or ''))

    if not cnpj_tem_digitos_validos(cnpj):
        raise Recusado(400, 'CNPJ inválido.')

    exigir_dono(abrigo_id)

    de_outra_conta = consultar_um(
        'SELECT uid FROM verificacoes WHERE cnpj = %s AND uid <> %s AND verificado = 1 AND deleted_at IS NULL',
        (cnpj, g.uid),
    )

    if de_outra_conta:
        raise Recusado(409, 'Este CNPJ já está vinculado a outra conta.')

    try:
        receita = consultar_cnpj(cnpj)
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise Recusado(503, 'A consulta à Receita está fora do ar. Tente mais tarde.')

    situacao = str((receita or {}).get('descricao_situacao_cadastral') or 'INEXISTENTE').upper()
    razao_social = str((receita or {}).get('razao_social') or '')[:200]
    verificado = situacao == 'ATIVA'

    executar(
        'INSERT INTO verificacoes (abrigo_id, uid, cnpj, razao_social, situacao, verificado) '
        'VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE uid = VALUES(uid), cnpj = VALUES(cnpj), '
        'razao_social = VALUES(razao_social), situacao = VALUES(situacao), '
        'verificado = VALUES(verificado), deleted_at = NULL',
        (abrigo_id, g.uid, cnpj, razao_social, situacao, verificado),
    )
    salvar()

    selo = firebase_db.reference('verificacoes/' + abrigo_id)

    if verificado:
        selo.set({'verificado': True, 'razaoSocial': razao_social})
    else:
        selo.delete()

    return jsonify({'verificado': verificado, 'situacao': situacao, 'razaoSocial': razao_social}), 200


@app.route('/verificacoes/<abrigo_id>', methods=['GET'])
@exigir_login
def ver_verificacao(abrigo_id):
    """
    Mostra a última conferência de um abrigo
    ---
    tags: [Verificação]
    security:
      - Bearer: []
    parameters:
      - {name: abrigo_id, in: path, type: string, required: true}
    responses:
      200:
        description: A conferência
      404:
        description: O abrigo ainda não foi conferido
    """
    linha = consultar_um(
        'SELECT razao_social, situacao, verificado, updated_at FROM verificacoes '
        'WHERE abrigo_id = %s AND deleted_at IS NULL',
        (ler_id(abrigo_id),),
    )

    if not linha:
        raise Recusado(404, 'Este abrigo ainda não foi conferido.')

    return jsonify({
        'razaoSocial': linha['razao_social'],
        'situacao': linha['situacao'],
        'verificado': bool(linha['verificado']),
        'conferidoEm': linha['updated_at'].isoformat(),
    }), 200


# ---------------- Rotas: denúncias ----------------

@app.route('/denuncias', methods=['POST'])
@exigir_login
@limiter.limit(LIMITE_DE_ESCRITA)
def denunciar():
    """
    Denuncia um abrigo suspeito. Com 3 pessoas diferentes, o abrigo ganha um aviso
    ---
    tags: [Denúncias]
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [abrigoId, motivo]
          properties:
            abrigoId: {type: string}
            motivo: {type: string, enum: [chave-pix-suspeita, abrigo-inexistente, dados-errados, outro]}
            detalhe: {type: string}
    responses:
      201:
        description: Denúncia registrada
      400:
        description: Dados inválidos, ou o abrigo é da própria conta
    """
    dados = corpo()
    abrigo_id = ler_id(dados.get('abrigoId'))
    motivo = dados.get('motivo')

    if motivo not in MOTIVOS_DE_DENUNCIA:
        raise Recusado(400, 'Escolha um dos motivos da lista.')

    if ler_abrigo(abrigo_id).get('donoUid') == g.uid:
        raise Recusado(400, 'Não é possível denunciar o próprio abrigo.')

    executar(
        'INSERT INTO denuncias (abrigo_id, uid, motivo, detalhe) VALUES (%s, %s, %s, %s) '
        'ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), detalhe = VALUES(detalhe), deleted_at = NULL',
        (abrigo_id, g.uid, motivo, str(dados.get('detalhe') or '')[:500]),
    )
    salvar()

    atualizar_alerta(abrigo_id)

    return jsonify({'ok': True}), 201


def atualizar_alerta(abrigo_id):
    total = consultar_um(
        'SELECT COUNT(*) AS total FROM denuncias WHERE abrigo_id = %s AND deleted_at IS NULL',
        (abrigo_id,),
    )['total']
    alerta = firebase_db.reference('alertas/' + abrigo_id)

    if total >= DENUNCIAS_PARA_ALERTA:
        alerta.set({'denuncias': total})
    else:
        alerta.delete()


@app.route('/abrigos/<abrigo_id>/denuncias', methods=['GET'])
@exigir_login
def ver_denuncias(abrigo_id):
    """
    Lista as denúncias do próprio abrigo, sem identificar quem denunciou
    ---
    tags: [Denúncias]
    security:
      - Bearer: []
    parameters:
      - {name: abrigo_id, in: path, type: string, required: true}
    responses:
      200:
        description: Lista de denúncias
      403:
        description: O abrigo é de outra conta
    """
    exigir_dono(abrigo_id)

    linhas = consultar(
        'SELECT motivo, detalhe, created_at FROM denuncias WHERE abrigo_id = %s AND deleted_at IS NULL '
        'ORDER BY created_at DESC',
        (abrigo_id,),
    )

    return jsonify([
        {'motivo': linha['motivo'], 'detalhe': linha['detalhe'], 'em': linha['created_at'].isoformat()}
        for linha in linhas
    ]), 200


# ---------------- Rotas: recomendações ----------------

def como_lista(valor):
    if not valor:
        return []

    return [item for item in (valor.values() if isinstance(valor, dict) else valor) if item]


def distancia_km(lat_a, lng_a, lat_b, lng_b):
    fi_a, fi_b = math.radians(lat_a), math.radians(lat_b)
    delta_fi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lng_b - lng_a)
    a = math.sin(delta_fi / 2) ** 2 + math.cos(fi_a) * math.cos(fi_b) * math.sin(delta_lambda / 2) ** 2

    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def contribuicoes_de(necessidade):
    return como_lista(necessidade.get('contribuicoes'))


def numero(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


# A nota junta três coisas: o abrigo marcou como urgente, falta muito do que foi
# pedido e o abrigo está perto. O peso maior é da urgência, porque é o próprio abrigo
# dizendo o que não pode esperar. Separada das rotas para ser fácil de testar.
def nota_da_necessidade(necessidade, km):
    alvo = numero(necessidade.get('alvo'))
    prometido = sum(numero(uma.get('quantidade')) for uma in contribuicoes_de(necessidade))
    falta = max(0.0, alvo - prometido) if alvo > 0 else None

    if falta == 0:
        return None

    nota = 50 if necessidade.get('urgente') else 0
    nota += 30 * (falta / alvo) if alvo > 0 else 15

    if km is not None:
        nota += 20 / (1 + km / 10)

    return nota, falta


def explicar(necessidade, km):
    partes = []

    if necessidade.get('urgente'):
        partes.append('urgente')

    if km is not None:
        partes.append('a %.1f km de você' % km if km >= 1 else 'muito perto de você')

    if not contribuicoes_de(necessidade):
        partes.append('ninguém se ofereceu ainda')

    return ', '.join(partes)


@app.route('/recomendacoes', methods=['GET'])
@exigir_login
def recomendar():
    """
    Mostra onde a ajuda vale mais agora, juntando urgência, o que falta e distância
    ---
    tags: [Recomendações]
    security:
      - Bearer: []
    parameters:
      - {name: lat, in: query, type: number, required: false}
      - {name: lng, in: query, type: number, required: false}
      - {name: limite, in: query, type: integer, required: false, default: 5}
    responses:
      200:
        description: Necessidades em ordem de prioridade
    """
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    limite = min(max(request.args.get('limite', default=5, type=int), 1), 20)

    abrigos = {str(item.get('id')): item for item in como_lista(firebase_db.reference('abrigos').get())}
    alertas = firebase_db.reference('alertas').get() or {}
    lista = []

    for necessidade in como_lista(firebase_db.reference('necessidades').get()):
        abrigo = abrigos.get(str(necessidade.get('abrigoId')))

        # Abrigo com aviso de denúncia não é recomendado: continua no mapa, mas o
        # aplicativo não deve empurrar doação para ele.
        if necessidade.get('done') or not abrigo or abrigo.get('id') in alertas:
            continue

        km = None

        if lat is not None and lng is not None:
            km = distancia_km(lat, lng, numero(abrigo.get('latitude')), numero(abrigo.get('longitude')))

        avaliada = nota_da_necessidade(necessidade, km)

        if avaliada is None:
            continue

        nota, falta = avaliada

        lista.append({
            'necessidadeId': necessidade.get('id'),
            'abrigoId': abrigo.get('id'),
            'abrigoNome': abrigo.get('nome'),
            'titulo': necessidade.get('title'),
            'faltam': falta,
            'unidade': necessidade.get('unidade') or '',
            'urgente': bool(necessidade.get('urgente')),
            'distanciaKm': round(km, 1) if km is not None else None,
            'motivo': explicar(necessidade, km),
            'nota': round(nota, 1),
        })

    lista.sort(key=lambda item: item['nota'], reverse=True)

    return jsonify(lista[:limite]), 200


# ---------------- Rotas: relatório do gestor ----------------

def montar_relatorio(abrigo_id):
    necessidades = [
        item for item in como_lista(firebase_db.reference('necessidades').get())
        if str(item.get('abrigoId')) == str(abrigo_id)
    ]
    itens = []
    doadores = set()

    for necessidade in necessidades:
        contribuicoes = contribuicoes_de(necessidade)
        prometido = sum(numero(uma.get('quantidade')) for uma in contribuicoes)
        recebido = sum(numero(uma.get('quantidade')) for uma in contribuicoes if uma.get('entregue'))

        doadores.update(uma.get('porUid') for uma in contribuicoes)
        itens.append({
            'titulo': necessidade.get('title') or '',
            'unidade': necessidade.get('unidade') or '',
            'meta': numero(necessidade.get('alvo')),
            'prometido': prometido,
            'recebido': recebido,
            'atendida': bool(necessidade.get('done')),
        })

    return {
        'necessidades': len(itens),
        'atendidas': sum(1 for item in itens if item['atendida']),
        'doadores': len(doadores),
        'prometido': sum(item['prometido'] for item in itens),
        'recebido': sum(item['recebido'] for item in itens),
        'itens': itens,
    }


@app.route('/abrigos/<abrigo_id>/relatorio', methods=['GET'])
@exigir_login
def relatorio(abrigo_id):
    """
    Mostra o impacto do abrigo, para o gestor. Com formato=csv, devolve a planilha
    ---
    tags: [Relatórios]
    security:
      - Bearer: []
    parameters:
      - {name: abrigo_id, in: path, type: string, required: true}
      - {name: formato, in: query, type: string, required: false, enum: [json, csv]}
    responses:
      200:
        description: Totais e itens do abrigo
      403:
        description: O abrigo é de outra conta
    """
    exigir_dono(abrigo_id)

    dados = montar_relatorio(abrigo_id)

    if request.args.get('formato') != 'csv':
        return jsonify(dados), 200

    saida = io.StringIO()
    escritor = csv.writer(saida, delimiter=';')

    escritor.writerow(['Necessidade', 'Unidade', 'Meta', 'Prometido', 'Recebido', 'Atendida'])

    for item in dados['itens']:
        escritor.writerow([
            item['titulo'], item['unidade'], item['meta'], item['prometido'], item['recebido'],
            'sim' if item['atendida'] else 'não',
        ])

    # O BOM faz o Excel abrir com os acentos certos.
    return Response('﻿' + saida.getvalue(), mimetype='text/csv; charset=utf-8'), 200


# ---------------- Rotas: conta ----------------

# Apagar a conta remove de verdade o que a API guarda dela, sem exclusão lógica: dado
# pessoal não pode ficar guardado depois de a pessoa pedir para sair.
@app.route('/contas/eu', methods=['DELETE'])
@exigir_login
def apagar_dados_da_conta():
    """
    Apaga o que a API guarda desta conta
    ---
    tags: [Conta]
    security:
      - Bearer: []
    responses:
      204:
        description: Dados apagados
    """
    denunciados = consultar('SELECT abrigo_id FROM denuncias WHERE uid = %s', (g.uid,))
    meus = consultar('SELECT abrigo_id FROM verificacoes WHERE uid = %s', (g.uid,))

    executar('DELETE FROM arquivos WHERE uid = %s', (g.uid,))
    executar('DELETE FROM denuncias WHERE uid = %s', (g.uid,))
    executar('DELETE FROM verificacoes WHERE uid = %s', (g.uid,))
    salvar()

    for linha in meus:
        firebase_db.reference('verificacoes/' + linha['abrigo_id']).delete()

    for linha in denunciados:
        atualizar_alerta(linha['abrigo_id'])

    return '', 204


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=os.getenv('FLASK_DEBUG') == '1')
