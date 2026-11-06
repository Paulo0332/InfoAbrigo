# Módulo 7: Abrigos e Perfis

1. **O que este módulo faz**
Transforma as telas soltas num aplicativo com papéis: a pessoa escolhe um perfil (gestor, voluntário, doador ou visitante), o gestor comprova a instituição pelo CNPJ e cadastra abrigos com endereço, contatos e foto.

2. **Onde fica no app**
Na escolha de perfil do **cadastro**, em **Cadastrar abrigo** e nos atalhos da aba **Início**, que mudam conforme o perfil.

3. **Conceito da aula aplicado**
Consumo de APIs por HTTP, assunto da aula 10: o cliente axios de `src/services/api.js` consulta a BrasilAPI para conferir o CNPJ e o CEP. Navegação com Stack por fora das abas (`src/navigation/RootNavigator.js`) e formulários com estado controlado.

4. **Onde está o código**
- `src/data/perfis.js`: os quatro perfis e o que cada um oferece.
- `src/services/cnpj.js`: confere os dígitos do CNPJ sem internet e depois consulta a BrasilAPI.
- `src/services/endereco.js`: CEP e localização do endereço no mapa.
- `src/services/contato.js`: formata e monta os links de telefone, WhatsApp, e-mail e Instagram.
- `src/screens/RegisterShelterScreen.js`: o formulário do abrigo.

5. **Como testar**
- Crie uma conta de gestor e use "Verificar" com um CNPJ.
- Cadastre um abrigo com CEP e confira o ponto no mapa.
- Entre com uma conta de doador e confirme que ela vê o abrigo, mas não pode editá-lo.

6. **Possíveis perguntas**
- *O CNPJ prova que a pessoa administra o abrigo?*
Não. Prova que a instituição existe e está ativa. O vínculo da pessoa com ela exigiria documento e revisão humana.
- *Por que conferir os dígitos antes de chamar a API?*
Isso elimina erro de digitação na hora e funciona sem internet.
