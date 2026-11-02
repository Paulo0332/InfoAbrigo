# API do InfoAbrigo

Node, Express e MongoDB, na mesma organização do exemplo da disciplina (`config`, `controllers`, `middlewares`, `models`, `routes` e `validators`).

## Rodar

Com um banco temporário, sem instalar nada:

```bash
npm install
npm run dev:memoria
```

Com banco de verdade, copie `.env.example` para `.env`, preencha os valores e rode:

```bash
npm start
```

## Testar

```bash
npm test
```

## Rotas

Todas respondem em JSON. Com exceção de `/saude`, `/auth/*` e `GET /arquivos/:id`, exigem o cabeçalho `Authorization: Bearer <token>`.

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
| DELETE | `/abrigos/:id` | Apaga um abrigo e as necessidades dele (só o dono) |
| GET | `/necessidades` | Lista todas as necessidades |
| PUT | `/necessidades/:id` | Cria ou altera uma necessidade |
| DELETE | `/necessidades/:id` | Apaga uma necessidade (só quem administra) |
| GET | `/doacoes` | Lista as doações da própria conta |
| PUT | `/doacoes/:id` | Cria ou altera uma doação própria |
| PATCH | `/doacoes/:id/situacao` | Muda a situação (quem doou ou o abrigo que recebeu) |
| DELETE | `/doacoes/:id` | Apaga uma doação própria |
| GET | `/compromissos` | Lista a agenda da própria conta |
| PUT | `/compromissos/:id` | Cria ou altera um compromisso próprio |
| DELETE | `/compromissos/:id` | Apaga um compromisso próprio |
| POST | `/arquivos` | Envia uma foto em base64 (JPEG ou PNG, até cerca de 2 MB) |
| GET | `/arquivos/:id` | Abre a foto |

Em `PUT /necessidades/:id`, quem não administra o abrigo só altera a própria contribuição. Título, meta e situação continuam como estão no banco.
