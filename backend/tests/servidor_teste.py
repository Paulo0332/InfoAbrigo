# Sobe a API num banco MySQL limpo, usado pelos testes de sincronização do aplicativo
# e para demonstrar. Precisa de um MySQL no ar; o banco é refeito a cada execução.
import os
import re
import sys
from pathlib import Path

import MySQLdb

PASTA = Path(__file__).resolve().parent.parent


def preparar_banco(nome):
    conexao = MySQLdb.connect(
        host=os.getenv('MYSQL_HOST', '127.0.0.1'),
        port=int(os.getenv('MYSQL_PORT', '3306')),
        user=os.getenv('MYSQL_USER', 'root'),
        passwd=os.getenv('MYSQL_PASSWORD', 'root'),
        charset='utf8mb4',
    )
    cursor = conexao.cursor()

    cursor.execute('DROP DATABASE IF EXISTS ' + nome)

    script = (PASTA / 'banco.sql').read_text(encoding='utf-8')
    script = re.sub(r'--.*', '', script).replace('infoabrigo', nome)

    for comando in script.split(';'):
        if comando.strip():
            cursor.execute(comando)

    conexao.commit()
    conexao.close()


if __name__ == '__main__':
    from werkzeug.serving import make_server

    nome = os.getenv('MYSQL_DB', 'infoabrigo_teste')

    os.environ.setdefault('MYSQL_HOST', '127.0.0.1')
    os.environ['MYSQL_DB'] = nome
    os.environ.setdefault('JWT_SEGREDO', 'segredo-so-para-teste')

    preparar_banco(nome)

    sys.path.insert(0, str(PASTA))

    from app import app

    servidor = make_server('0.0.0.0', int(os.getenv('PORT', '5000')), app, threaded=True)

    print('PRONTO', servidor.server_port, flush=True)

    servidor.serve_forever()
