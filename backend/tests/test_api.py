# Precisa do MySQL e do emulador do Firebase no ar.
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

PROJETO = 'demo-infoabrigo'
AUTH = '127.0.0.1:9099'
BANCO = '127.0.0.1:9000'

os.environ['MYSQL_HOST'] = os.getenv('MYSQL_HOST', '127.0.0.1')
os.environ['MYSQL_DB'] = 'infoabrigo_pytest'
os.environ['LIMITE_ESCRITA'] = '1000'
os.environ['FIREBASE_PROJECT_ID'] = PROJETO
os.environ['FIREBASE_DATABASE_URL'] = f'http://{BANCO}/?ns={PROJETO}-api-teste'
os.environ['FIREBASE_AUTH_EMULATOR_HOST'] = AUTH
os.environ['FIREBASE_DATABASE_EMULATOR_HOST'] = BANCO
os.environ.pop('FIREBASE_CREDENCIAIS', None)

from servidor_teste import preparar_banco  # noqa: E402

preparar_banco('infoabrigo_pytest')

import app as modulo  # noqa: E402
from app import app, nota_da_necessidade  # noqa: E402
from firebase_admin import db  # noqa: E402

# CNPJs com dígitos válidos, inventados para os testes.
CNPJ_ATIVO = '11222333000181'
CNPJ_BAIXADO = '11444777000161'


def pedir_ao_emulador(caminho, dados, cabecalhos=None):
    pedido = urllib.request.Request(
        f'http://{AUTH}{caminho}',
        data=json.dumps(dados).encode() if dados is not None else None,
        headers={'Content-Type': 'application/json', **(cabecalhos or {})},
    )

    with urllib.request.urlopen(pedido) as resposta:
        return json.load(resposta)


class Pessoa:
    def __init__(self, email):
        resposta = pedir_ao_emulador(
            '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=falsa',
            {'email': email, 'password': 'senha-de-teste', 'returnSecureToken': True},
        )

        self.uid = resposta['localId']
        self.token = resposta['idToken']
        self.cliente = app.test_client()

    def _cabecalho(self):
        return {'Authorization': 'Bearer ' + self.token}

    def get(self, url):
        return self.cliente.get(url, headers=self._cabecalho())

    def post(self, url, dados):
        return self.cliente.post(url, json=dados, headers=self._cabecalho())

    def delete(self, url):
        return self.cliente.delete(url, headers=self._cabecalho())


def publico():
    return app.test_client()


def criar_abrigo(id, dono, **extras):
    db.reference('abrigos/' + id).set({
        'id': id,
        'nome': 'Abrigo ' + id,
        'latitude': -22.4,
        'longitude': -43.66,
        'dono': 'dono@teste.com',
        'donoUid': dono.uid,
        **extras,
    })


@pytest.fixture(scope='module', autouse=True)
def limpar():
    pedido = urllib.request.Request(
        f'http://{AUTH}/emulator/v1/projects/{PROJETO}/accounts',
        method='DELETE',
        headers={'Authorization': 'Bearer owner'},
    )

    urllib.request.urlopen(pedido)
    db.reference('/').delete()


@pytest.fixture(scope='module')
def gestor():
    return Pessoa('gestor@teste.com')


@pytest.fixture(scope='module')
def doador():
    return Pessoa('doador@teste.com')


@pytest.fixture()
def receita(monkeypatch):
    def simular(cnpj):
        if cnpj == CNPJ_ATIVO:
            return {'razao_social': 'Casa Lar Ltda', 'descricao_situacao_cadastral': 'ATIVA'}

        if cnpj == CNPJ_BAIXADO:
            return {'razao_social': 'Fechada', 'descricao_situacao_cadastral': 'BAIXADA'}

        return None

    monkeypatch.setattr(modulo, 'consultar_cnpj', simular)


def test_saude_nao_exige_login():
    assert publico().get('/saude').json == {'ok': True}


def test_rotas_exigem_login_do_firebase():
    assert publico().get('/recomendacoes').status_code == 401
    assert publico().get('/recomendacoes', headers={'Authorization': 'Bearer invalido'}).status_code == 401


def test_foto_aceita_imagem_real_recusa_o_resto_e_serve_sem_login(gestor):
    jpeg = base64.b64encode(bytes([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])).decode()
    texto = base64.b64encode(b'<script>alert(1)</script>').decode()

    assert gestor.post('/arquivos', {'base64': texto}).status_code == 400
    assert gestor.post('/arquivos', {'base64': 'nao e base64!'}).status_code == 400

    enviada = gestor.post('/arquivos', {'base64': jpeg})

    assert enviada.status_code == 201

    aberta = publico().get(enviada.json['caminho'])

    assert aberta.status_code == 200
    assert aberta.mimetype == 'image/jpeg'
    assert len(aberta.data) == 7
    assert publico().get('/arquivos/abc').status_code == 404


def test_selo_vai_para_o_firebase_quando_o_cnpj_esta_ativo(gestor, receita):
    criar_abrigo('a1', gestor)

    resposta = gestor.post('/verificacoes', {'abrigoId': 'a1', 'cnpj': '11.222.333/0001-81'})

    assert resposta.status_code == 200
    assert resposta.json['verificado'] is True
    assert db.reference('verificacoes/a1').get()['razaoSocial'] == 'Casa Lar Ltda'

    guardada = gestor.get('/verificacoes/a1')

    assert guardada.json['verificado'] is True
    assert guardada.json['situacao'] == 'ATIVA'


def test_cnpj_baixado_ou_inexistente_nao_ganha_selo(gestor, receita):
    criar_abrigo('a2', gestor)

    assert gestor.post('/verificacoes', {'abrigoId': 'a2', 'cnpj': CNPJ_BAIXADO}).json['verificado'] is False
    assert db.reference('verificacoes/a2').get() is None


def test_cnpj_com_digitos_errados_e_recusado_sem_consultar(gestor, monkeypatch):
    def nao_deveria(cnpj):
        raise AssertionError('consultou a Receita')

    monkeypatch.setattr(modulo, 'consultar_cnpj', nao_deveria)
    criar_abrigo('a3', gestor)

    assert gestor.post('/verificacoes', {'abrigoId': 'a3', 'cnpj': '11222333000100'}).status_code == 400
    assert gestor.post('/verificacoes', {'abrigoId': 'a3', 'cnpj': '11111111111111'}).status_code == 400


def test_so_o_dono_pede_o_selo_e_o_cnpj_nao_serve_a_duas_contas(gestor, doador, receita):
    criar_abrigo('a4', doador)

    assert doador.post('/verificacoes', {'abrigoId': 'a1', 'cnpj': CNPJ_ATIVO}).status_code == 403
    assert doador.post('/verificacoes', {'abrigoId': 'a4', 'cnpj': CNPJ_ATIVO}).status_code == 409
    assert gestor.post('/verificacoes', {'abrigoId': 'nao-existe', 'cnpj': CNPJ_ATIVO}).status_code == 404


def test_receita_fora_do_ar_responde_503(gestor, monkeypatch):
    def fora_do_ar(cnpj):
        raise TimeoutError()

    monkeypatch.setattr(modulo, 'consultar_cnpj', fora_do_ar)

    assert gestor.post('/verificacoes', {'abrigoId': 'a1', 'cnpj': CNPJ_ATIVO}).status_code == 503


def test_aviso_so_aparece_com_tres_pessoas_diferentes(gestor):
    criar_abrigo('d1', gestor)

    pessoas = [Pessoa(f'denuncia{n}@teste.com') for n in range(3)]
    denuncia = {'abrigoId': 'd1', 'motivo': 'chave-pix-suspeita', 'detalhe': 'A chave é de outro nome'}

    assert pessoas[0].post('/denuncias', denuncia).status_code == 201
    assert pessoas[0].post('/denuncias', denuncia).status_code == 201
    assert pessoas[1].post('/denuncias', denuncia).status_code == 201
    assert db.reference('alertas/d1').get() is None

    assert pessoas[2].post('/denuncias', denuncia).status_code == 201
    assert db.reference('alertas/d1').get() == {'denuncias': 3}

    # Quem denunciou saiu do aplicativo: a denúncia sai junto, e o aviso também.
    assert pessoas[2].delete('/contas/eu').status_code == 204
    assert db.reference('alertas/d1').get() is None


def test_denuncia_invalida_e_recusada(gestor, doador):
    assert doador.post('/denuncias', {'abrigoId': 'd1', 'motivo': 'nao gostei'}).status_code == 400
    assert gestor.post('/denuncias', {'abrigoId': 'd1', 'motivo': 'outro'}).status_code == 400
    assert doador.post('/denuncias', {'abrigoId': 'nao-existe', 'motivo': 'outro'}).status_code == 404


def test_o_dono_ve_as_denuncias_sem_saber_quem_fez(gestor, doador):
    lista = gestor.get('/abrigos/d1/denuncias')

    assert lista.status_code == 200
    assert lista.json[0]['motivo'] == 'chave-pix-suspeita'
    assert 'uid' not in lista.json[0]
    assert doador.get('/abrigos/d1/denuncias').status_code == 403


def test_nota_valoriza_urgencia_o_que_falta_e_a_distancia():
    base = {'alvo': 10}

    assert nota_da_necessidade({**base, 'urgente': True}, 5)[0] > nota_da_necessidade(base, 5)[0]
    assert nota_da_necessidade(base, 1)[0] > nota_da_necessidade(base, 100)[0]

    metade = {**base, 'contribuicoes': {'c': {'quantidade': 5}}}

    assert nota_da_necessidade(base, 5)[0] > nota_da_necessidade(metade, 5)[0]

    completa = {**base, 'contribuicoes': {'c': {'quantidade': 10}}}

    assert nota_da_necessidade(completa, 5) is None


def test_recomendacoes_seguem_a_prioridade_e_escondem_o_que_nao_serve(gestor, doador):
    criar_abrigo('r1', gestor, latitude=-22.40, longitude=-43.66)
    criar_abrigo('r2', gestor, latitude=-23.00, longitude=-43.00)
    criar_abrigo('r3', gestor)
    db.reference('alertas/r3').set({'denuncias': 3})
    db.reference('necessidades').update({
        'n1': {'id': 'n1', 'title': 'Arroz', 'abrigoId': 'r1', 'alvo': 10, 'unidade': 'kg', 'urgente': True},
        'n2': {'id': 'n2', 'title': 'Leite', 'abrigoId': 'r2', 'alvo': 10, 'unidade': 'l'},
        'n3': {'id': 'n3', 'title': 'Pronta', 'abrigoId': 'r1', 'alvo': 5, 'done': True},
        'n4': {'id': 'n4', 'title': 'Suspeita', 'abrigoId': 'r3', 'alvo': 5, 'urgente': True},
        'n5': {'id': 'n5', 'title': 'Cheia', 'abrigoId': 'r1', 'alvo': 2,
               'contribuicoes': {'c': {'quantidade': 2, 'porUid': doador.uid}}},
    })

    lista = doador.get('/recomendacoes?lat=-22.4&lng=-43.66').json

    assert [item['titulo'] for item in lista] == ['Arroz', 'Leite']
    assert lista[0]['faltam'] == 10
    assert lista[0]['distanciaKm'] == 0
    assert 'urgente' in lista[0]['motivo']
    assert lista[1]['distanciaKm'] > 50

    sem_posicao = doador.get('/recomendacoes?limite=1').json

    assert len(sem_posicao) == 1
    assert sem_posicao[0]['distanciaKm'] is None


def test_relatorio_soma_o_prometido_e_o_recebido_so_para_o_dono(gestor, doador):
    criar_abrigo('p1', gestor)
    db.reference('necessidades').update({
        'x1': {
            'id': 'x1', 'title': 'Fraldas', 'abrigoId': 'p1', 'alvo': 10, 'unidade': 'pacotes',
            'contribuicoes': {
                'a': {'quantidade': 3, 'entregue': True, 'porUid': 'u1'},
                'b': {'quantidade': 4, 'entregue': False, 'porUid': 'u2'},
            },
        },
        'x2': {'id': 'x2', 'title': 'Leite', 'abrigoId': 'p1', 'alvo': 2, 'done': True,
               'contribuicoes': {'c': {'quantidade': 2, 'entregue': True, 'porUid': 'u1'}}},
    })

    dados = gestor.get('/abrigos/p1/relatorio').json

    assert dados['necessidades'] == 2
    assert dados['atendidas'] == 1
    assert dados['doadores'] == 2
    assert dados['prometido'] == 9
    assert dados['recebido'] == 5
    assert doador.get('/abrigos/p1/relatorio').status_code == 403

    planilha = gestor.get('/abrigos/p1/relatorio?formato=csv')

    assert planilha.mimetype == 'text/csv'
    assert 'Fraldas;pacotes;10.0;7.0;3.0;não' in planilha.get_data(as_text=True)


def test_apagar_os_dados_da_conta_remove_o_selo_e_as_fotos():
    pessoa = Pessoa('sai@teste.com')
    jpeg = base64.b64encode(bytes([0xff, 0xd8, 0xff, 0xe0])).decode()
    foto = pessoa.post('/arquivos', {'base64': jpeg}).json['caminho']

    criar_abrigo('s1', pessoa)

    with app.app_context():
        modulo.executar(
            'INSERT INTO verificacoes (abrigo_id, uid, cnpj, verificado) VALUES (%s, %s, %s, 1)',
            ('s1', pessoa.uid, '11222333000181'),
        )
        modulo.salvar()

    db.reference('verificacoes/s1').set({'verificado': True})

    assert pessoa.delete('/contas/eu').status_code == 204
    assert publico().get(foto).status_code == 404
    assert db.reference('verificacoes/s1').get() is None


def test_rota_inexistente_responde_em_json(gestor):
    resposta = gestor.get('/nao-existe')

    assert resposta.status_code == 404
    assert resposta.json['erro']


def test_corpo_grande_demais_e_recusado(gestor):
    assert gestor.post('/denuncias', {'abrigoId': 'd1', 'motivo': 'outro', 'detalhe': 'x' * 20000}).status_code == 413


def test_swagger_documenta_as_rotas():
    resposta = publico().get('/apispec_1.json')

    assert resposta.status_code == 200
    assert '/recomendacoes' in resposta.json['paths']
    assert publico().get('/apidocs/').status_code == 200
