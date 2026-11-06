# API do InfoAbrigo

Python, Flask e MySQL, na mesma organização do exemplo `API-Tasks` da disciplina: `app.py`, `banco.sql`, Swagger e Docker.

Esta pasta é o exemplo `API-Tasks` aplicado ao InfoAbrigo, e o aplicativo **não depende dela**. Uma API própria só funciona com um servidor ligado. Por isso o aplicativo faz o mesmo sem ela: o selo é conferido na BrasilAPI, as denúncias ficam no Firebase, e recomendações e painel são calculados no celular (veja `docs/modulo-11-servidor-e-banco.md`).

Ela continua aqui, com os testes, para mostrar o conteúdo da disciplina: rotas REST, MySQL, Swagger, Docker, exclusão lógica e login conferido pelo token do Firebase. Para usá-la, é preciso hospedá-la, com o `render.yaml` da raiz do projeto, por exemplo.

## Configurar o Firebase

No console do Firebase, em **Configurações do projeto > Contas de serviço**, gere uma chave privada e salve o arquivo nesta pasta com o nome `conta-de-servico.json`.

**Esse arquivo é secreto.** Ele dá acesso total ao banco, já está no `.gitignore` e nunca deve ser enviado a ninguém.

## Rodar com Docker

Defina `FIREBASE_PROJECT_ID` e `FIREBASE_DATABASE_URL` no ambiente e rode:

```bash
docker compose -f docker-compose-mysql.yml up --build
```

A API fica em `http://localhost:5001`, e a documentação das rotas em `http://localhost:5001/apidocs`.

## Rodar sem Docker

São precisos o Python 3.13 e um MySQL 8 no ar. Crie as tabelas com `banco.sql`, copie `.env.example` para `.env`, preencha os valores e rode:

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements-dev.txt
```

```bash
.venv/Scripts/python app.py
```

A API fica em `http://localhost:5000`, e a documentação em `http://localhost:5000/apidocs`.

## Testar

Com o MySQL e o emulador do Firebase no ar. Os testes criam um banco próprio (`infoabrigo_pytest`), sem tocar no banco `infoabrigo`:

```bash
.venv/Scripts/python -m pytest tests
```

## Rotas

Com exceção de `/saude` e `GET /arquivos/:id`, todas exigem o cabeçalho `Authorization: Bearer <token>`, com o token de login do Firebase. Os detalhes de cada rota estão no Swagger, em `/apidocs`.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere se a API está no ar |
| POST | `/arquivos` | Envia uma foto em base64 (JPEG ou PNG) |
| GET | `/arquivos/:id` | Abre a foto |
| POST | `/verificacoes` | Confere o CNPJ na Receita e concede o selo ao abrigo |
| GET | `/verificacoes/:abrigoId` | Mostra a última conferência |
| POST | `/denuncias` | Denuncia um abrigo; com 3 pessoas diferentes, ele ganha um aviso |
| GET | `/abrigos/:id/denuncias` | Lista as denúncias do próprio abrigo, sem dizer quem fez |
| GET | `/recomendacoes` | Mostra onde a ajuda vale mais, por urgência, falta e distância |
| GET | `/abrigos/:id/relatorio` | Mostra o impacto do abrigo; com `?formato=csv`, gera a planilha |
| DELETE | `/contas/eu` | Apaga o que a API guarda da conta |

Apagar a conta remove os dados de verdade, porque dado pessoal não pode continuar guardado depois de a pessoa pedir para sair.
