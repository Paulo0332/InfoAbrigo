import base64
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ['MYSQL_HOST'] = os.getenv('MYSQL_HOST', '127.0.0.1')
os.environ['MYSQL_DB'] = 'infoabrigo_pytest'
os.environ['JWT_SEGREDO'] = 'segredo-de-teste'
os.environ['LIMITE_LOGIN'] = '1000'

from servidor_teste import preparar_banco  # noqa: E402

preparar_banco('infoabrigo_pytest')

from app import app, juntar_contribuicoes  # noqa: E402


def R(letra):
    return letra * 64


ABRIGO = {'nome': 'Casa Lar', 'latitude': -22.4, 'longitude': -43.6, 'dono': 'golpe@teste.com'}
NEED = {'title': 'Fraldas', 'abrigoId': '1', 'alvo': 10, 'unidade': 'pacotes', 'done': False}
QUANDO = '2030-01-10T13:00:00.000Z'


class Pessoa:
    def __init__(self, token):
        self.token = token
        self.cliente = app.test_client()

    def _cabecalho(self):
        return {'Authorization': 'Bearer ' + self.token}

    def get(self, url):
        return self.cliente.get(url, headers=self._cabecalho())

    def put(self, url, dados):
        return self.cliente.put(url, json=dados, headers=self._cabecalho())

    def post(self, url, dados):
        return self.cliente.post(url, json=dados, headers=self._cabecalho())

    def patch(self, url, dados):
        return self.cliente.patch(url, json=dados, headers=self._cabecalho())

    def delete(self, url):
        return self.cliente.delete(url, headers=self._cabecalho())


def publico():
    return app.test_client()


def criar_conta(email, perfil, senha):
    resposta = publico().post('/auth/cadastro', json={
        'email': email,
        'nome': 'Pessoa ' + perfil,
        'perfil': perfil,
        'sal': 'sal-da-conta-' + perfil,
        'senhaResumo': R(senha),
        'pergunta': 'Qual é o seu prato preferido?',
        'respostaResumo': R('f'),
    })

    assert resposta.status_code == 201

    return Pessoa(resposta.json['token'])


@pytest.fixture(scope='module')
def gestor():
    return criar_conta('gestor@teste.com', 'gestor', 'a')


@pytest.fixture(scope='module')
def doador():
    return criar_conta('doador@teste.com', 'doador', 'b')


def test_rota_de_dados_exige_login():
    assert publico().get('/abrigos').status_code == 401
    assert publico().get('/abrigos', headers={'Authorization': 'Bearer invalido'}).status_code == 401


def test_conta_nao_e_duplicada_nem_com_maiuscula_diferente(gestor):
    resposta = publico().post('/auth/cadastro', json={
        'email': 'GESTOR@teste.com',
        'nome': 'Outra',
        'perfil': 'doador',
        'sal': 'outro-sal-qualquer',
        'senhaResumo': R('c'),
    })

    assert resposta.status_code == 409


def test_cadastro_recusa_dados_invalidos():
    base = {'email': 'novo@teste.com', 'nome': 'Nova', 'perfil': 'doador', 'sal': 'sal-qualquer', 'senhaResumo': R('c')}

    assert publico().post('/auth/cadastro', json={**base, 'email': 'sem-arroba'}).status_code == 400
    assert publico().post('/auth/cadastro', json={**base, 'perfil': 'rei'}).status_code == 400
    assert publico().post('/auth/cadastro', json={**base, 'senhaResumo': 'curta'}).status_code == 400


def test_login_confere_a_senha_e_nunca_devolve_credencial(gestor):
    certa = publico().post('/auth/entrar', json={'email': 'gestor@teste.com', 'senhaResumo': R('a')})

    assert certa.status_code == 200
    assert certa.json['token']
    assert 'senha_protegida' not in certa.json['conta']
    assert 'resposta_protegida' not in certa.json['conta']

    errada = publico().post('/auth/entrar', json={'email': 'gestor@teste.com', 'senhaResumo': R('9')})

    assert errada.status_code == 401


def test_email_inexistente_tem_sal_e_pergunta_estaveis(gestor):
    def pedir(email):
        return publico().post('/auth/sal', json={'email': email})

    um = pedir('ninguem@teste.com')

    assert um.status_code == 200
    assert um.json['sal']
    assert um.json['pergunta']
    assert um.json == pedir('ninguem@teste.com').json
    assert pedir('gestor@teste.com').json['sal'] == 'sal-da-conta-gestor'


def test_trocar_a_senha_exige_a_atual_e_derruba_a_sessao_antiga():
    conta = criar_conta('troca@teste.com', 'doador', 'c')

    assert conta.put('/contas/eu', {'senhaResumo': R('d')}).status_code == 403

    com_prova = conta.put('/contas/eu', {'senhaResumo': R('d'), 'senhaAtualResumo': R('c')})

    assert com_prova.status_code == 200
    assert conta.get('/abrigos').status_code == 401
    assert Pessoa(com_prova.json['token']).get('/abrigos').status_code == 200

    nova = publico().post('/auth/entrar', json={'email': 'troca@teste.com', 'senhaResumo': R('d')})

    assert nova.status_code == 200


def test_mudar_o_nome_nao_exige_senha():
    conta = criar_conta('nome@teste.com', 'doador', 'c')
    resposta = conta.put('/contas/eu', {'nome': 'Nome Novo'})

    assert resposta.status_code == 200
    assert resposta.json['conta']['nome'] == 'Nome Novo'


def test_recuperar_troca_a_senha_so_com_a_resposta_certa():
    criar_conta('esqueci@teste.com', 'doador', 'c')

    errada = publico().post('/auth/recuperar', json={
        'email': 'esqueci@teste.com', 'respostaResumo': R('0'), 'senhaResumoNova': R('e'),
    })

    assert errada.status_code == 401

    certa = publico().post('/auth/recuperar', json={
        'email': 'esqueci@teste.com', 'respostaResumo': R('f'), 'senhaResumoNova': R('e'),
    })

    assert certa.status_code == 200


def test_abrigo_o_dono_vem_da_sessao_e_outra_conta_nao_altera(gestor, doador):
    criado = gestor.put('/abrigos/1', ABRIGO)

    assert criado.status_code == 200
    assert criado.json['dono'] == 'gestor@teste.com'

    assert doador.put('/abrigos/1', ABRIGO).status_code == 403
    assert doador.delete('/abrigos/1').status_code == 403

    lista = doador.get('/abrigos')

    assert len(lista.json) == 1
    assert lista.json[0]['nome'] == 'Casa Lar'


def test_abrigo_sem_coordenadas_e_recusado(gestor):
    assert gestor.put('/abrigos/2', {'nome': 'Sem mapa'}).status_code == 400


def test_campo_removido_some_do_banco(gestor):
    gestor.put('/abrigos/3', {**ABRIGO, 'foto': 'x'})

    assert 'foto' not in gestor.put('/abrigos/3', ABRIGO).json

    gestor.delete('/abrigos/3')


def test_abrigo_excluido_some_da_lista_e_pode_voltar(gestor):
    gestor.put('/abrigos/4', ABRIGO)
    gestor.delete('/abrigos/4')

    assert not any(item['id'] == '4' for item in gestor.get('/abrigos').json)

    gestor.put('/abrigos/4', ABRIGO)

    assert any(item['id'] == '4' for item in gestor.get('/abrigos').json)

    gestor.delete('/abrigos/4')


def test_necessidade_so_quem_administra_cria_e_quem_doa_nao_muda_titulo(gestor, doador):
    gestor.put('/abrigos/1', ABRIGO)

    assert doador.put('/necessidades/n1', NEED).status_code == 403
    assert gestor.put('/necessidades/n1', NEED).status_code == 200

    promessa = doador.put('/necessidades/n1', {
        **NEED,
        'title': 'Título trocado',
        'done': True,
        'contribuicoes': [
            {'id': 'c1', 'por': 'doador@teste.com', 'quantidade': 3, 'doacaoId': 'd1', 'entregue': True},
        ],
    })

    assert promessa.status_code == 200
    assert promessa.json['title'] == 'Fraldas'
    assert promessa.json['done'] is False
    assert len(promessa.json['contribuicoes']) == 1
    assert promessa.json['contribuicoes'][0]['entregue'] is False


def test_lista_velha_nao_apaga_a_promessa_de_outra_pessoa(gestor):
    velha = gestor.put('/necessidades/n1', {**NEED, 'title': 'Fraldas P', 'contribuicoes': []})

    assert velha.json['title'] == 'Fraldas P'
    assert len(velha.json['contribuicoes']) == 1


def test_gestor_marca_a_entrega_e_a_situacao_da_doacao_acompanha(gestor, doador):
    doador.put('/doacoes/d1', {'tipo': 'item', 'situacao': 'pendente', 'valor': 0, 'conta': 'golpe@teste.com'})

    marcada = gestor.put('/necessidades/n1', {
        **NEED,
        'contribuicoes': [
            {'id': 'c1', 'por': 'doador@teste.com', 'quantidade': 3, 'doacaoId': 'd1', 'entregue': True},
        ],
    })

    assert marcada.json['contribuicoes'][0]['entregue'] is True
    assert gestor.patch('/doacoes/d1/situacao', {'situacao': 'confirmada'}).status_code == 204

    doacao = doador.get('/doacoes').json[0]

    assert doacao['conta'] == 'doador@teste.com'
    assert doacao['situacao'] == 'confirmada'
    assert doacao['recebidaEm']


def test_doacao_e_compromisso_sao_privados(gestor, doador):
    assert gestor.get('/doacoes').json == []
    assert gestor.put('/doacoes/d1', {'tipo': 'item'}).status_code == 403
    assert gestor.delete('/doacoes/d1').status_code == 403

    doador.put('/compromissos/a1', {'quando': QUANDO, 'tipo': 'visita'})

    assert gestor.get('/compromissos').json == []
    assert len(doador.get('/compromissos').json) == 1
    assert gestor.put('/compromissos/a1', {'quando': QUANDO}).status_code == 403


def test_compromisso_com_data_invalida_e_recusado(doador):
    assert doador.put('/compromissos/a2', {'quando': 'amanhã'}).status_code == 400


def test_terceiro_nao_muda_a_situacao_de_doacao_alheia(doador):
    outro = criar_conta('outro@teste.com', 'visitante', 'c')

    assert outro.patch('/doacoes/d1/situacao', {'situacao': 'pendente'}).status_code == 403


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


def test_apagar_a_conta_leva_abrigos_necessidades_e_promessas(gestor):
    dono = criar_conta('sai@teste.com', 'gestor', 'c')

    dono.put('/abrigos/s1', ABRIGO)
    dono.put('/necessidades/ns1', {'title': 'Leite', 'abrigoId': 's1'})
    dono.put('/necessidades/n1', {
        'title': 'x',
        'contribuicoes': [{'id': 'c9', 'por': 'sai@teste.com', 'quantidade': 1}],
    })

    assert dono.delete('/contas/eu').status_code == 204

    necessidades = gestor.get('/necessidades').json

    assert not any(item['id'] == 'ns1' for item in necessidades)
    assert not any(
        uma['id'] == 'c9'
        for item in necessidades if item['id'] == 'n1'
        for uma in item['contribuicoes']
    )
    assert not any(item['id'] == 's1' for item in gestor.get('/abrigos').json)
    assert publico().post('/auth/entrar', json={'email': 'sai@teste.com', 'senhaResumo': R('c')}).status_code == 401


def test_juntar_contribuicoes_quem_doa_desiste_sem_mexer_nas_outras():
    gravadas = [
        {'id': 1, 'por': 'a@x', 'quantidade': 1, 'entregue': False},
        {'id': 2, 'por': 'b@x', 'quantidade': 2, 'entregue': True},
    ]

    resultado = juntar_contribuicoes(gravadas, [], 'a@x', False)

    assert [item['id'] for item in resultado] == [2]
    assert resultado[0]['entregue'] is True


def test_rota_inexistente_responde_em_json(gestor):
    resposta = gestor.get('/nao-existe')

    assert resposta.status_code == 404
    assert resposta.json['erro']


def test_corpo_grande_demais_e_recusado(gestor):
    grande = gestor.put('/doacoes/d9', {'observacao': 'x' * 300000})

    assert grande.status_code == 413


def test_swagger_documenta_as_rotas():
    resposta = publico().get('/apispec_1.json')

    assert resposta.status_code == 200
    assert '/abrigos/{id}' in resposta.json['paths']
    assert publico().get('/apidocs/').status_code == 200
