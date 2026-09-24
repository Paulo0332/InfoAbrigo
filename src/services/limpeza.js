import { carregarDoacoes, salvarDoacoes } from './donations';
import { carregarAgenda, salvarAgenda } from './agenda';
import { loadNeeds, saveNeeds } from './storage';

// Apagar a conta apagava só o cadastro, e deixava para trás tudo que ela
// tinha feito: doações, compromissos e as promessas de levar item. O
// aparelho guarda tudo num arquivo só por assunto, então esses restos
// continuavam ali — e reapareciam na conta seguinte.
//
// Havia uma segunda porta para o mesmo problema: registros gravados antes
// de existir o campo de dono apareciam para todas as contas, porque a
// regra era "sem dono, de todos". Era a regra que não deixava ninguém
// perder histórico na atualização, e virou vazamento assim que passou a
// existir mais de uma conta no aparelho.
//
// As duas portas se fecham aqui: quem entra adota o que estava sem dono,
// e quem apaga a conta leva junto o que era dela.

function ehDe(registro, email) {
  return (registro.conta || '').trim().toLowerCase() === email.trim().toLowerCase();
}

// Roda toda vez que alguém entra. Só encosta no que não tem dono, então
// repetir não muda nada.
export async function adotarDadosSemDono(conta) {
  if (conta == null) {
    return;
  }

  try {
    const doacoes = await carregarDoacoes();
    const semDonoDoacoes = doacoes.filter((item) => item.conta == null);

    if (semDonoDoacoes.length > 0) {
      await salvarDoacoes(
        doacoes.map((item) => (item.conta == null ? { ...item, conta: conta.email } : item))
      );
    }

    const agenda = await carregarAgenda();
    const semDonoAgenda = agenda.filter((item) => item.conta == null);

    if (semDonoAgenda.length > 0) {
      await salvarAgenda(
        agenda.map((item) => (item.conta == null ? { ...item, conta: conta.email } : item))
      );
    }
  } catch (error) {
    console.log('Erro ao adotar os dados sem dono:', error);
  }
}

// Chamado ao apagar a conta do aparelho. Tira as doações, os compromissos
// e as promessas daquela pessoa de dentro das necessidades — que são do
// abrigo e continuam existindo, só sem a reserva de quem saiu.
export async function apagarDadosDaConta(email) {
  if (!email) {
    return;
  }

  try {
    const doacoes = await carregarDoacoes();

    await salvarDoacoes(doacoes.filter((item) => !ehDe(item, email)));

    const agenda = await carregarAgenda();

    await salvarAgenda(agenda.filter((item) => !ehDe(item, email)));

    const needs = await loadNeeds();

    if (needs != null) {
      await saveNeeds(
        needs.map((need) => {
          const contribuicoes = need.contribuicoes;

          if (!Array.isArray(contribuicoes)) {
            // Necessidade do formato antigo, com uma reserva só.
            if (need.reserva && ehDe(need.reserva, email)) {
              const semReserva = { ...need };

              delete semReserva.reserva;

              return semReserva;
            }

            return need;
          }

          return {
            ...need,
            contribuicoes: contribuicoes.filter((uma) => !ehDe({ conta: uma.por }, email)),
          };
        })
      );
    }
  } catch (error) {
    console.log('Erro ao apagar os dados da conta:', error);

    throw error;
  }
}
