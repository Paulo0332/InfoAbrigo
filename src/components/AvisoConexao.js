import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { carregarConta } from '../services/auth';
import {
  acompanharMudancas,
  estadoDaSincronizacao,
  ouvirSincronizacao,
  sincronizar,
} from '../services/sincronizacao';
import { colors } from '../theme/colors';

const TENTAR_DE_NOVO = 20000;

export function textoDoAviso(estado) {
  if (estado == null || estado.pendentes === 0) {
    return null;
  }

  const quantidade =
    estado.pendentes === 1
      ? '1 alteração aguardando envio'
      : estado.pendentes + ' alterações aguardando envio';

  if (estado.situacao === 'sem-sessao') {
    return quantidade + '. Entre com a senha para enviar.';
  }

  return estado.semConexao ? 'Aguardando conexão: ' + quantidade + '.' : null;
}

// A faixa que diz que algo ainda não chegou ao servidor. Sem ela, quem grava sem
// internet não tem como saber que os outros ainda não estão vendo aquilo.
export default function AvisoConexao(props) {
  const [texto, setTexto] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      const estado = await estadoDaSincronizacao(await carregarConta());

      if (ativo) {
        setTexto(textoDoAviso(estado));
      }
    }

    atualizar().catch((error) => console.log('Erro ao ler a sincronização:', error));

    const parar = ouvirSincronizacao(() => {
      atualizar().catch((error) => console.log('Erro ao ler a sincronização:', error));
    });

    const pararAcompanhamento = acompanharMudancas();

    return () => {
      ativo = false;
      parar();
      pararAcompanhamento();
    };
  }, []);

  // Enquanto há o que enviar, continua tentando: a conexão pode voltar sem a
  // pessoa mexer em nada, e a faixa some sozinha.
  useEffect(() => {
    if (texto == null) {
      return undefined;
    }

    const relogio = setInterval(sincronizar, TENTAR_DE_NOVO);

    return () => clearInterval(relogio);
  }, [texto]);

  if (texto == null) {
    return null;
  }

  return (
    <View
      style={[styles.faixa, { bottom: props.distanciaDaBase }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />

      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.textMain,
  },

  texto: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
});
