# Módulo 9: Contas

1. **O que este módulo faz**
Permite ter mais de uma conta no mesmo celular, guarda a senha como resumo em vez de texto, recupera o acesso pela pergunta de segurança e mantém os dados de cada conta separados.

2. **Onde fica no app**
Na **tela de entrada**, no **cadastro** e na aba **Perfil**.

3. **Conceito da aula aplicado**
Armazenamento local e biometria, dos exemplos **App async-storage** e **App Biometria**. O `expo-crypto` calcula o resumo da senha.

4. **Onde está o código**
- `src/services/auth.js`: a lista de contas do aparelho e a conta em uso.
- `src/services/senha.js`: o resumo da senha e da resposta, com um sal por conta.
- `src/services/limpeza.js`: o que acontece com os dados ao entrar e ao apagar a conta.
- `src/screens/LoginScreen.js`, `SignUpScreen.js` e `ProfileScreen.js`: as telas.

5. **Como testar**
- Crie duas contas e alterne entre elas na tela de entrada.
- Faça uma doação na primeira e confirme que ela não aparece na segunda.
- Use "Esqueci a senha" e responda à pergunta de segurança.
- Apague uma conta e confirme que os dados dela somem.

6. **Possíveis perguntas**
- *O que é o sal?*
Um texto aleatório misturado à senha antes do resumo. Sem ele, duas pessoas com a mesma senha teriam o mesmo resumo.
- *A digital é guardada pelo aplicativo?*
Não. O sistema do celular faz a conferência e só responde se deu certo.
