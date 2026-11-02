# API do InfoAbrigo

Python, Flask e MySQL, na mesma organização do exemplo `API-Tasks` da disciplina: `app.py`, `banco.sql`, Swagger e Docker.

## Rodar com Docker

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

Com o MySQL no ar, os testes criam um banco próprio (`infoabrigo_pytest`), sem tocar no banco `infoabrigo`:

```bash
.venv/Scripts/python -m pytest tests
```

## Rotas

Com exceção de `/saude`, `/auth/*` e `GET /arquivos/:id`, todas exigem o cabeçalho `Authorization: Bearer <token>`. Os detalhes de cada rota estão no Swagger, em `/apidocs`.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere se a API está no ar |
| POST | `/auth/sal` | Devolve o sal e a pergunta de segurança de um e-mail |
| POST | `/auth/cadastro` | Cria a conta |
| POST | `/auth/entrar` | Entra na conta |
| POST | `/auth/recuperar` | Troca a senha pela resposta da pergunta de segurança |
| PUT | `/contas/eu` | Altera a própria conta |
| DELETE | `/contas/eu` | Apaga a conta e o que é dela |
| GET | `/abrigos` | Lista todos os abrigos |
| PUT | `/abrigos/:id` | Cria ou altera um abrigo (só o dono altera) |
| DELETE | `/abrigos/:id` | Exclui um abrigo e as necessidades dele (só o dono) |
| GET | `/necessidades` | Lista todas as necessidades |
| PUT | `/necessidades/:id` | Cria ou altera uma necessidade |
| DELETE | `/necessidades/:id` | Exclui uma necessidade (só quem administra) |
| GET | `/doacoes` | Lista as doações da própria conta |
| PUT | `/doacoes/:id` | Cria ou altera uma doação própria |
| PATCH | `/doacoes/:id/situacao` | Muda a situação (quem doou ou o abrigo que recebeu) |
| DELETE | `/doacoes/:id` | Exclui uma doação própria |
| GET | `/compromissos` | Lista a agenda da própria conta |
| PUT | `/compromissos/:id` | Cria ou altera um compromisso próprio |
| DELETE | `/compromissos/:id` | Exclui um compromisso próprio |
| POST | `/arquivos` | Envia uma foto em base64 (JPEG ou PNG) |
| GET | `/arquivos/:id` | Abre a foto |

Como no `API-Tasks`, excluir é lógico: a linha ganha `deleted_at` e deixa de aparecer nas listas. A exceção é apagar a conta, que remove os dados de verdade, porque dado pessoal não pode continuar guardado depois de a pessoa pedir para sair.

Em `PUT /necessidades/:id`, quem não administra o abrigo só altera a própria contribuição. Título, meta e situação continuam como estão no banco.
