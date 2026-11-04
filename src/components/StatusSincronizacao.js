import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { carregarConta } from '../services/contaAtual';
import {
  estaSincronizando,
  estadoDaSincronizacao,
  esquecerUltimaSincronizacao,
  ouvirSincronizacao,
  sincronizar,
} from '../services/sincronizacao';
import { colors } from '../theme/colors';

// O mesmo painel do exemplo LPAH-2026-SQLITE-FIREBASE: se há conexão, se está
// sincronizando, e o botão para não depender de esperar a próxima tentativa.
export default function StatusSincronizacao() {
  const [online, setOnline] = useState(false);
  const [sincronizando, setSincronizando] = useState(estaSincronizando());
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      const estado = await estadoDaSincronizacao(await carregarConta());

      if (ativo) {
        setSincronizando(estaSincronizando());
        setPendentes(estado.pendentes);
      }
    }

    function aoMudar() {
      atualizar().catch((error) => console.log('Erro ao ler a sincronização:', error));
    }

    aoMudar();

    const pararSincronizacao = ouvirSincronizacao(aoMudar);
    const pararConexao = NetInfo.addEventListener((estado) => {
      setOnline(Boolean(estado.isConnected));
    });

    return () => {
      ativo = false;
      pararSincronizacao();
      pararConexao();
    };
  }, []);

  function sincronizarAgora() {
    esquecerUltimaSincronizacao();
    sincronizar();
  }

  return (
    <View style={styles.cartao}>
      <Text style={styles.linha}>Status: {online ? 'Online' : 'Offline'}</Text>

      <Text style={styles.linha}>
        Sincronização: {sincronizando ? 'Sincronizando...' : 'Parada'}
      </Text>

      <Text style={styles.linha}>Aguardando envio: {pendentes}</Text>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
        onPress={sincronizarAgora}
        disabled={sincronizando}
      >
        <Text style={styles.textoBotao}>Sincronizar agora</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  linha: {
    fontSize: 14,
    color: colors.textMain,
    marginBottom: 4,
  },

  botao: {
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  textoBotao: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  pressionado: {
    opacity: 0.6,
  },
});
