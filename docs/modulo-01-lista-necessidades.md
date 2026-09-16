# Módulo 1: Lista de Necessidades

1. **O que este módulo faz**
Permite que o abrigo cadastre o que está precisando, marque um item como já atendido e remova o que não faz mais sentido. É a mesma mecânica do App ToDo visto em aula, aplicada a uma necessidade real do projeto.

2. **Onde fica no app**
Na aba **Doações** da barra inferior. Antes deste módulo a aba era só um placeholder com o título.

3. **Conceito da aula aplicado**
Vem direto do **App ToDo** (`ToDo-Aula`): `useState` para guardar a lista, `FlatList` para exibir, e componentes filhos que recebem dados e funções por `props`. A estrutura do formulário e do estado vazio segue o exemplo mais recente do professor, o `FUSVE/async-storage`.

4. **Código comentado**

### 4.1 O formato de uma necessidade

```javascript
const newNeed = {
  id: Date.now().toString(), // identificador único, sem precisar de biblioteca
  title: cleanTitle,         // o texto digitado, já sem espaços nas pontas
  done: false,               // toda necessidade nasce como "não atendida"
};
```
Usamos `Date.now()` porque ele devolve os milissegundos desde 1970 — como duas necessidades nunca são criadas no mesmo milissegundo, o valor serve como identificador. É a mesma escolha do professor no exemplo de async-storage, que abandonou a biblioteca `uuid` do ToDo antigo.

### 4.2 O estado da lista (`DonationsScreen.js`)

```javascript
const [needs, setNeeds] = useState([]);
```
`needs` é a lista de necessidades e `setNeeds` é a única forma de alterá-la. Em React nunca modificamos a lista diretamente (com `push`, por exemplo): sempre criamos uma lista nova e entregamos para o `setNeeds`. É isso que faz a tela se redesenhar sozinha.

### 4.3 Adicionar (com validação)

```javascript
function addNeed(title) {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    Alert.alert('Atenção', 'Digite o nome da necessidade.');
    return;
  }

  const newNeed = { id: Date.now().toString(), title: cleanTitle, done: false };

  setNeeds([newNeed, ...needs]);
}
```
O `trim()` remove espaços no começo e no fim, então digitar só espaço conta como vazio. O `return` interrompe a função e impede o cadastro.

O `[newNeed, ...needs]` é o **spread operator**: ele cria uma lista nova com o item novo na frente e todos os antigos depois. Por isso a necessidade recém-cadastrada aparece no topo.

### 4.4 Marcar como atendida

```javascript
function toggleNeed(id) {
  const newList = needs.map((need) => {
    if (need.id === id) {
      return { ...need, done: !need.done };
    }
    return need;
  });

  setNeeds(newList);
}
```
O `map` percorre a lista inteira e devolve uma lista nova do mesmo tamanho. Quando encontra o item do `id` procurado, devolve uma **cópia** dele (`...need`) com o `done` invertido (`!need.done`). Os outros itens são devolvidos sem alteração.

### 4.5 Excluir com confirmação

```javascript
function confirmDelete(id) {
  Alert.alert(
    'Excluir necessidade',
    'Deseja realmente excluir esta necessidade da lista?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteNeed(id) },
    ]
  );
}

function deleteNeed(id) {
  const newList = needs.filter((need) => need.id !== id);
  setNeeds(newList);
}
```
Separamos em duas funções de propósito: `confirmDelete` só pergunta, `deleteNeed` só executa. A exclusão só acontece se a pessoa tocar em "Excluir", porque é aí que o `onPress` dispara.

O `filter` devolve uma lista nova contendo apenas os itens em que a condição é verdadeira — ou seja, todos **menos** o que tem o `id` informado.

### 4.6 A lista na tela

```javascript
<FlatList
  data={needs}
  keyExtractor={(item) => item.id}
  renderItem={renderNeed}
  ListEmptyComponent={ /* ... */ }
/>
```
- `data`: de onde vêm os itens.
- `keyExtractor`: diz ao React como identificar cada linha, para ele saber o que mudou e redesenhar só o necessário.
- `renderItem`: a função que transforma um item em componente visual.
- `ListEmptyComponent`: o que aparece quando a lista está vazia.

Usamos `FlatList` em vez de `map` porque ela só renderiza o que está visível na tela. Com 500 necessidades cadastradas, ela continua rápida.

### 4.7 Os componentes filhos

`NeedItem` e `NeedForm` recebem tudo por `props`, exatamente como o `list.js` e o `add.js` do repositório do professor:

```javascript
// NeedItem.js
export default function NeedItem(props) {
  // ...
  <Pressable onPress={() => props.onToggle(props.need.id)}>
```

O componente filho **não sabe** o que acontece quando é tocado — ele só avisa o pai. Quem decide o que fazer é a `DonationsScreen`. Isso se chama *elevar o estado* (lifting state up), e é o que permite que o Módulo 2 adicione a persistência mexendo em um arquivo só.

O `NeedForm` guarda apenas o texto que está sendo digitado, porque isso ninguém mais precisa saber:

```javascript
const [text, setText] = useState('');

function handleAdd() {
  props.onAdd(text);   // entrega para a tela
  setText('');         // limpa o campo
  Keyboard.dismiss();  // fecha o teclado
}
```
O `Keyboard.dismiss()` veio do `add.js` do professor.

5. **Como testar**
- Rode `npx expo start` e abra no Expo Go.
- Vá até a aba **Doações**.
- Toque em **+** com o campo vazio → deve aparecer o alerta "Digite o nome da necessidade".
- Cadastre "Fraldas P" → o item aparece no topo e o contador vira "1 necessidade(s) • 0 atendida(s)".
- Cadastre "Leite em pó" → ele entra acima de "Fraldas P".
- Toque no círculo de "Fraldas P" → fica riscado e o contador vira "1 atendida(s)".
- Toque na lixeira → aparece a confirmação; em "Cancelar" nada acontece, em "Excluir" o item some.
- Exclua todos → aparece o estado vazio com o ícone de presente.

6. **Possíveis perguntas**

- *Por que a lista some quando fecho o app?*
Porque neste módulo ela vive só na memória, dentro do `useState`. A persistência é justamente o assunto do Módulo 2, que usa o AsyncStorage.

- *Por que `Date.now()` e não `uuid`?*
Porque o professor trocou `uuid` por `Date.now()` no exemplo mais recente. Além de evitar duas dependências (`uuid` e `react-native-get-random-values`), é suficiente aqui: não dá para criar duas necessidades no mesmo milissegundo.

- *Por que criar uma lista nova em vez de alterar a existente?*
O React compara a referência da lista para decidir se precisa redesenhar. Se alterássemos a lista original, a referência seria a mesma e a tela não atualizaria.

- *Qual a diferença entre `map`, `filter` e o spread?*
`map` transforma e devolve a mesma quantidade de itens; `filter` devolve só os que passam na condição; o spread (`...`) copia o conteúdo para dentro de uma lista ou objeto novo.

- *Por que separar em três arquivos?*
Cada arquivo tem uma responsabilidade: `NeedItem` desenha uma linha, `NeedForm` cuida da digitação e `DonationsScreen` guarda os dados e as regras. Assim o Módulo 2 mexe só na tela, sem tocar nos componentes.

- *Por que o filho não altera a lista sozinho?*
Porque a lista pertence à tela. Se cada componente pudesse alterá-la, ficaria impossível saber quem mudou o quê. O filho avisa e o pai decide.

**Autor:** Dev B (Josué) — Módulo 1
