# Módulo 11: Firebase e Sincronização

1. **O que este módulo faz**
Faz os dados deixarem de existir num celular só. O abrigo cadastrado num aparelho aparece nos outros, a promessa de um doador chega ao gestor em tempo real, e a conta pode ser aberta em outro celular. Sem internet, o aplicativo continua funcionando e envia tudo depois.

2. **Onde fica no app**
Em todas as telas, sem mudar a forma de usar. O Perfil mostra o status Online ou Offline, o estado da sincronização e o botão "Sincronizar agora", como no exemplo da disciplina. Uma faixa acima das abas avisa o que está aguardando conexão, a tela de entrada ganhou "Já tenho conta em outro celular", e "Esqueci a senha" envia um e-mail.

3. **Conceito da aula aplicado**
- **`LPAH-2024-Firebase`:** o Realtime Database, em `src/services/bancoRemoto.js`.
- **`LPAH-2026-SQLITE-FIREBASE`:** a fila de sincronização e o `NetInfo`, em `src/services/sincronizacao.js`.
- **`LPAH-2024-SQLITE`:** o banco do celular com `expo-sqlite`, em `src/services/bancoLocal.js`.

4. **Código comentado**

### 4.1 Os bancos

| Onde | O que guarda | Para quê |
|---|---|---|
| SQLite, no celular | `registros`, `fila` e `anotacoes` | Funcionar sem internet |
| Firebase Realtime Database | `contas`, `abrigos`, `necessidades`, `doacoes`, `compromissos`, `verificacoes`, `cnpjs` e `denuncias` | Compartilhar entre aparelhos, em tempo real |

Não há servidor próprio: tudo o que é compartilhado mora no Firebase, que já está na internet. Por isso o aplicativo funciona em qualquer lugar.

### 4.2 A fila

As telas gravam no aparelho. O que mudou entra na fila, e a sincronização envia na ordem em que aconteceu:

```javascript
try {
  await executar(op, conta, usuario);
} catch (error) {
  // Sem conexão: para e tenta depois. Recusa do banco: descarta só este pedido,
  // senão um registro inválido seguraria todos os outros para sempre.
}
```

O `NetInfo` avisa quando a conexão volta, e a fila é enviada na mesma hora.

**Por que ter fila, se o Firebase já guarda o que foi gravado sem internet?** A gravação do Firebase só termina quando chega ao servidor, e esse momento pode nunca vir. Com a fila própria, o aplicativo sabe o que falta enviar e consegue mostrar isso na faixa. Além disso, o que está gravado no SQLite sobrevive se o aplicativo for fechado.

### 4.3 Promessas simultâneas

Se duas pessoas prometem o mesmo item ao mesmo tempo, regravar a necessidade inteira apagaria uma das promessas. Por isso cada promessa é gravada no próprio caminho, em `necessidades/{id}/contribuicoes/{idDaPromessa}`, e `gravarNecessidade` só escreve o que aquela pessoa pode mudar.

### 4.4 As regras de segurança

Ficam em `database.rules.json`, e valem mesmo que alguém altere o aplicativo:

- só o dono altera ou exclui o abrigo;
- só quem administra o abrigo cria necessidades nele, muda os dados delas e marca uma entrega;
- cada pessoa só mexe na própria promessa;
- doações, agenda e perfil só podem ser lidos pela própria conta;
- o selo só entra pelo dono do abrigo, e com um CNPJ que nenhuma outra conta usou;
- cada pessoa denuncia um abrigo uma vez só, em nome próprio, e o dono não denuncia o próprio abrigo.

### 4.5 A entrega de uma doação

A doação é privada, então o abrigo não pode gravar nela. Quando o gestor marca a entrega, ele escreve na promessa, dentro da necessidade. O celular de quem doou lê essa marca e atualiza a própria cópia, em `aplicarEntregas`.

5. **Como testar**
- Siga a seção "Com o Firebase" do `README.md`.
- No primeiro celular, crie uma conta de gestor e cadastre um abrigo.
- No segundo, use uma conta de doador: o abrigo aparece.
- Deixe o gestor na aba Doações e prometa um item no outro celular: a promessa aparece sem tocar na tela.
- Ligue o modo avião, faça um compromisso e confira a faixa "Aguardando conexão" acima das abas.
- Desligue o modo avião: a faixa some sozinha. O fluxo `maestro/infoabrigo-offline.yaml` faz esse teste sozinho.

6. **Possíveis perguntas**
- *Por que dois bancos?*
O do celular garante o uso sem internet, e o Firebase compartilha os dados entre os aparelhos.
- *E se duas pessoas alterarem o mesmo abrigo?*
Só o dono altera. Entre dois celulares do mesmo dono, vale a última gravação que chegar.
- *O aplicativo funciona sem o Firebase?*
Sim. Sem as chaves no `.env`, tudo fica só no celular.
- *A senha fica no Firebase?*
Fica no Firebase Authentication, que cuida dela. O banco de dados não guarda senha. O celular guarda só um resumo, para entrar sem internet.

---

# Módulo 13: APIs, selo, denúncias e painel

1. **O que este módulo faz**
Confere o CNPJ das instituições, deixa a comunidade avisar sobre abrigos suspeitos, mostra onde a ajuda vale mais e dá ao gestor um painel de prestação de contas. Nada disso depende de servidor próprio ligado.

2. **Onde fica no app**
- **Início:** "Onde sua ajuda vale mais".
- **Mapa e Doar:** o selo "CNPJ ativo na Receita Federal" e o aviso de abrigo denunciado.
- **Cartão do abrigo no mapa:** "Denunciar este abrigo".
- **Perfil do gestor:** "Painel de impacto".

3. **Conceito da aula aplicado**
- **`Task-Manager-API`:** o consumo de API com axios, em `src/services/api.js`. O cliente atende as três APIs públicas que o aplicativo usa: BrasilAPI (CEP e CNPJ), Nominatim (endereço) e Valhalla (rota).
- **`API-Tasks`:** a pasta `backend/`, com Flask, MySQL, Swagger, Docker e exclusão lógica por `deleted_at`. Ela fica no repositório como exemplo do conteúdo, mas o aplicativo não depende dela: uma API própria só funciona com um servidor ligado.

4. **Como cada recurso funciona**

| Recurso | Onde | Como |
|---|---|---|
| **Selo verificado** | `conferirSelo`, em `src/services/sincronizacao.js` | A cada gravação do abrigo, o CNPJ da conta é consultado na BrasilAPI. Ativo, o selo é gravado em `verificacoes`, e o CNPJ fica reservado para a conta em `cnpjs`. |
| **Denúncias** | `src/services/comunidade.js` | Cada denúncia é gravada em `denuncias/{abrigo}/{conta}`. Com três pessoas diferentes, o abrigo ganha o aviso e sai das recomendações. |
| **Recomendações** | `recomendar`, em `comunidade.js` | O celular junta urgência, o que falta e distância, com os abrigos que já tem. |
| **Painel e planilha** | `montarRelatorio` e `montarPlanilha` | Os totais do abrigo, e a planilha separada por ponto e vírgula, enviada pelo compartilhar do celular. |
| **Fotos** | `prepararAbrigo`, em `sincronizacao.js` | A foto é reduzida e segue junto do abrigo, em base64. O Storage do Firebase exige o plano pago. |

5. **Como testar**
- Cadastre um abrigo com uma conta de gestor com CNPJ ativo: o selo aparece.
- Denuncie um abrigo com três contas diferentes: o aviso aparece, e ele sai das recomendações.
- Com a conta do gestor, abra "Painel de impacto" no Perfil.
- Os cálculos têm testes em `__tests__/regras.test.js`, e as regras do selo e das denúncias, em `__tests__/sincronizacao.test.js`.

6. **Possíveis perguntas**
- *O selo prova que a pessoa trabalha no abrigo?*
Não. Prova que a instituição existe e está ativa na Receita, e impede que outra conta use o mesmo CNPJ.
- *O selo pode ser falsificado?*
As regras impedem dar selo a abrigo de outra pessoa e usar o CNPJ de outra conta. Quem alterasse o próprio aplicativo ainda poderia gravar um selo com um CNPJ inativo. Para impedir isso de vez, a conferência teria de rodar num servidor, como faz a pasta `backend/`.
- *Por que três denúncias?*
Uma só seria fácil de usar para prejudicar um abrigo de verdade. Cada pessoa conta uma vez.
- *Por que não usar a API da pasta `backend/` no aplicativo?*
Ela precisaria de um servidor ligado o tempo todo. Sem ele, selo, denúncias e painel parariam fora da rede de quem roda a API. Com o Firebase e as APIs públicas, o aplicativo funciona em qualquer lugar.
