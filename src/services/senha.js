import * as Crypto from 'expo-crypto';

// A senha não precisa ficar guardada no aparelho. O que precisa ficar é
// algo que permita conferir se a senha digitada é a certa — e o resumo
// (hash) faz exatamente isso: vai só num sentido, então de dentro dele
// não se volta para a senha.
//
// Cada conta recebe um sal próprio, um texto aleatório misturado à senha
// antes do resumo. Sem ele, duas pessoas com a mesma senha teriam o mesmo
// resumo, e quem olhasse o arquivo saberia disso.
//
// O limite honesto: isto não transforma o aparelho num cofre. Quem tiver
// o aparelho desbloqueado nas mãos entra no aplicativo de qualquer jeito.
// O que muda é que a senha em si deixa de estar escrita em lugar nenhum —
// e senha costuma ser reaproveitada em outros serviços.

export function novoSal() {
  return Crypto.randomUUID();
}

export async function resumir(texto, sal) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    sal + '|' + texto,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

// A resposta da pergunta de recuperação é comparada sem diferenciar
// maiúscula nem espaço nas pontas: ninguém lembra de acentuação meses
// depois, e exigir isso seria travar a recuperação por nada.
export function limparResposta(texto) {
  return (texto || '').trim().toLowerCase();
}

export async function resumirResposta(texto, sal) {
  return resumir(limparResposta(texto), sal);
}

// Contas criadas antes desta mudança guardavam a senha como texto. Elas
// continuam entrando, e a conferência devolve o aviso de que o resumo
// ainda precisa ser gravado — é assim que a conta antiga é convertida no
// primeiro login, sem pedir nada a quem usa.
export async function conferirSenha(conta, digitada) {
  if (conta == null) {
    return { confere: false, precisaConverter: false };
  }

  if (conta.senhaResumo && conta.sal) {
    const resumo = await resumir(digitada, conta.sal);

    return { confere: resumo === conta.senhaResumo, precisaConverter: false };
  }

  return {
    confere: conta.senha != null && digitada === conta.senha,
    precisaConverter: true,
  };
}

export async function conferirResposta(conta, digitada) {
  if (conta == null || !conta.respostaResumo || !conta.sal) {
    return false;
  }

  const resumo = await resumirResposta(digitada, conta.sal);

  return resumo === conta.respostaResumo;
}
