# Módulo 8: Doações e Rota

1. **O que este módulo faz**
Mostra o que cada abrigo precisa e quanto ainda falta, registra quem se ofereceu para levar cada item, gera o código Pix das doações em dinheiro e traça a rota até o abrigo dentro do aplicativo.

2. **Onde fica no app**
Na aba **Doações**, na tela **Doar**, em **Histórico** e no cartão do abrigo na aba **Mapa**.

3. **Conceito da aula aplicado**
Listas com `FlatList`, estado e props (aulas 7 e 8), HTTP (aula 10) e WebView (aula 11), usada para desenhar o QR Code do Pix e o mapa.

4. **Onde está o código**
- `src/services/necessidades.js`: as contas de quanto foi prometido, recebido e quanto falta.
- `src/services/donations.js`: o histórico de doações e a situação de cada uma.
- `src/services/doacao.js`: as formas de doar de cada abrigo.
- `src/services/pix.js` e `src/components/PixQrCode.js`: o código Pix, montado no próprio celular.
- `src/services/rota.js`: a rota a pé, de bicicleta ou de carro, pelo serviço Valhalla.

```javascript
// O prometido e o recebido são coisas diferentes: misturar as duas diria que
// a doação chegou enquanto ela ainda está no carro de alguém.
export function faltam(need) {
  const alvo = alvoDaNecessidade(need);

  return alvo == null ? null : Math.max(0, alvo - prometido(need));
}
```

5. **Como testar**
- Como gestor, crie uma necessidade com meta de 10 unidades.
- Como doador, ofereça 3 e confira "Faltam 7 de 10".
- Como gestor, confirme o recebimento e veja a barra avançar.
- Faça uma doação em dinheiro e confira o Pix gerado.
- No mapa, trace a rota a pé e de carro até um abrigo.

6. **Possíveis perguntas**
- *O aplicativo sabe se o Pix foi pago?*
Não. Ele só monta o código. A marcação de pago é uma anotação da própria pessoa, e a tela diz isso.
- *Por que confirmar com a biometria antes de mostrar o Pix?*
Para confirmar quem está pedindo. Essa confirmação não é um pagamento.
