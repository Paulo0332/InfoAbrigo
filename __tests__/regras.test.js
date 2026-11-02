import {
  faltam,
  percentualRecebido,
  prometido,
  quantidadeValida,
  recebido,
  textoDoQueFalta,
} from '../src/services/necessidades';
import { formatarReais, totalEmDinheiro, doacoesDaConta } from '../src/services/donations';
import { montarQuando, ordenarAgenda } from '../src/services/agenda';
import { calcularDistancia, ehDono } from '../src/services/shelters';
import { conferirResposta, conferirSenha, resumir, resumirResposta } from '../src/services/senha';
import { mudancasDaConta } from '../src/services/auth';
import { linkDoCalendario } from '../src/services/recursosNativos';

const NEED = {
  alvo: 10,
  unidade: 'pacotes',
  contribuicoes: [
    { id: 1, quantidade: 3, entregue: true },
    { id: 2, quantidade: 4, entregue: false },
  ],
};

describe('compatibilidade com o React Native', () => {
  test('nenhuma tela usa o estilo removido na versão 0.88', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    function arquivos(pasta) {
      return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
        const caminho = path.join(pasta, item.name);

        return item.isDirectory() ? arquivos(caminho) : [caminho];
      });
    }

    const comProblema = arquivos(path.join(__dirname, '..', 'src')).filter(
      (arquivo) =>
        !arquivo.endsWith(path.join('mapa', 'leaflet.js')) &&
        fs.readFileSync(arquivo, 'utf8').includes('absoluteFillObject')
    );

    expect(comProblema).toEqual([]);
  });
});

describe('necessidades', () => {
  test('separa o prometido do recebido', () => {
    expect(prometido(NEED)).toBe(7);
    expect(recebido(NEED)).toBe(3);
    expect(faltam(NEED)).toBe(3);
    expect(percentualRecebido(NEED)).toBe(30);
    expect(textoDoQueFalta(NEED)).toBe('Faltam 3 de 10 pacotes');
  });

  test('nunca falta menos que nada', () => {
    expect(faltam({ alvo: 2, contribuicoes: [{ quantidade: 5 }] })).toBe(0);
  });

  test('não aceita prometer mais do que falta', () => {
    expect(quantidadeValida('3', NEED)).toBe(true);
    expect(quantidadeValida('4', NEED)).toBe(false);
    expect(quantidadeValida('0', NEED)).toBe(false);
  });

  test('lê a necessidade antiga, com a quantidade em texto', () => {
    expect(faltam({ quantidade: '10 pacotes' })).toBe(10);
  });
});

describe('doações', () => {
  test('escreve o real como as pessoas leem', () => {
    expect(formatarReais(1234.5)).toBe('1.234,50');
    expect(formatarReais(0)).toBe('0,00');
  });

  test('só soma o que a pessoa marcou como pago', () => {
    const lista = [
      { tipo: 'dinheiro', valor: 10, situacao: 'confirmada' },
      { tipo: 'dinheiro', valor: 99, situacao: 'pendente' },
      { tipo: 'item', valor: 0, situacao: 'confirmada' },
    ];

    expect(totalEmDinheiro(lista)).toBe(10);
  });

  test('o histórico é de quem doou', () => {
    const lista = [{ id: 1, conta: 'A@x.com' }, { id: 2, conta: 'b@x.com' }, { id: 3 }];

    expect(doacoesDaConta(lista, { email: 'a@x.com' }).map((d) => d.id)).toEqual([1]);
    expect(doacoesDaConta(lista, null)).toEqual([]);
  });
});

describe('agenda', () => {
  test('recusa data que não existe', () => {
    expect(montarQuando('31/02/2030', '10:00')).toBeNull();
    expect(montarQuando('10/10/2030', '25:00')).toBeNull();
    expect(montarQuando('10/10/2030', '10:00')).not.toBeNull();
  });

  test('próximos do mais perto ao mais longe, passados do mais recente', () => {
    const dia = 24 * 60 * 60 * 1000;
    const em = (n) => new Date(Date.now() + n * dia).toISOString();
    const { futuros, passados } = ordenarAgenda([
      { id: 'a', quando: em(5) },
      { id: 'b', quando: em(1) },
      { id: 'c', quando: em(-5) },
      { id: 'd', quando: em(-1) },
    ]);

    expect(futuros.map((i) => i.id)).toEqual(['b', 'a']);
    expect(passados.map((i) => i.id)).toEqual(['d', 'c']);
  });

  test('o link do calendário leva título e horário', () => {
    const link = linkDoCalendario('Visita ao abrigo', '2030-01-10T13:00:00.000Z', 'Rua A', '');

    expect(link).toContain('text=Visita%20ao%20abrigo');
    expect(link).toContain('dates=20300110T130000Z/20300110T140000Z');
  });
});

describe('abrigos', () => {
  test('distância entre Vassouras e o Rio, em linha reta', () => {
    const km = calcularDistancia(-22.4, -43.66, -22.9, -43.2);

    expect(km).toBeGreaterThan(70);
    expect(km).toBeLessThan(80);
  });

  test('o dono ignora maiúscula, e abrigo sem dono é de ninguém', () => {
    expect(ehDono({ dono: 'Josue@x.com ' }, { email: 'josue@x.com' })).toBe(true);
    expect(ehDono({ dono: '' }, { email: '' })).toBe(false);
  });
});

describe('senha', () => {
  test('confere pelo resumo e recusa a errada', async () => {
    const conta = { sal: 'abc', senhaResumo: await resumir('segredo', 'abc') };

    expect((await conferirSenha(conta, 'segredo')).confere).toBe(true);
    expect((await conferirSenha(conta, 'outra')).confere).toBe(false);
  });

  test('conta antiga, com senha em texto, pede conversão', async () => {
    const resultado = await conferirSenha({ senha: 'velha' }, 'velha');

    expect(resultado).toEqual({ confere: true, precisaConverter: true });
  });

  test('a resposta ignora maiúscula e espaço', async () => {
    const conta = { sal: 'abc', respostaResumo: await resumirResposta(' Rex ', 'abc') };

    expect(await conferirResposta(conta, 'rex')).toBe(true);
    expect(await conferirResposta(conta, 'bob')).toBe(false);
  });
});

describe('mudanças da conta', () => {
  const base = { nome: 'A', perfil: 'doador', sal: 's', senhaResumo: 'r1', biometriaAtiva: false };

  test('preferência deste aparelho não vai ao servidor', () => {
    expect(mudancasDaConta(base, { ...base, biometriaAtiva: true, foto: 'x' })).toEqual({});
  });

  test('troca de senha leva a prova da senha atual', () => {
    expect(mudancasDaConta(base, { ...base, senhaResumo: 'r2' })).toEqual({
      senhaResumo: 'r2',
      senhaAtualResumo: 'r1',
    });
  });

  test('troca de nome não leva credencial', () => {
    expect(mudancasDaConta(base, { ...base, nome: 'B' })).toEqual({ nome: 'B' });
  });
});
