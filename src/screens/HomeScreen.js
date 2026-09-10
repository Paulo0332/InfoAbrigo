import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalStyles } from '../theme/styles';

export default function HomeScreen() {
  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Text style={globalStyles.title}>Início</Text>
        <Text style={globalStyles.text}>Bem-vindo ao InfoAbrigo!</Text>
      </View>
    </SafeAreaView>
  );
}
