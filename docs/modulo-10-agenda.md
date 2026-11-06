# Módulo 10: Agenda

1. **O que este módulo faz**
Guarda compromissos com data e hora: visitar um abrigo, entregar uma doação, trabalhar como voluntário ou conversar sobre adoção. Depois que o compromisso acontece, ele pode receber um registro com foto.

2. **Onde fica no app**
Na aba **Agenda**, separada em próximos e já acontecidos.

3. **Conceito da aula aplicado**
Recursos nativos: a câmera e a galeria do Módulo 5, além de listas e estado. O calendário do celular está no Módulo 12.

4. **Onde está o código**
- `src/services/agenda.js`: os tipos de compromisso, as contas de data e a ordenação.
- `src/screens/ScheduleScreen.js`: a tela.

```javascript
// 31 de fevereiro entra no campo, mas não no calendário. O Date do JavaScript
// aceita calado, virando 3 de março, e por isso a data é conferida de volta.
if (quando.getDate() !== dia || quando.getMonth() !== mes - 1) {
  return null;
}
```

5. **Como testar**
- Crie um compromisso para amanhã e confira "Amanhã às...".
- Tente a data 31/02 e confirme que ela é recusada.
- Prometa um item na aba Doações e transforme a promessa em compromisso.
- Registre com foto um compromisso de hoje.

6. **Possíveis perguntas**
- *Por que o compromisso que já passou não pode ser remarcado?*
Remarcar seria reescrever o que aconteceu. O registro com foto continua editável, e o compromisso lançado errado pode ser excluído.
