import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalStyles } from '../theme/styles';

export default function MapScreen() {
  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Text style={globalStyles.title}>Mapa</Text>
        <Text style={globalStyles.text}>Mapa de abrigos parceiros</Text>
      </View>
    </SafeAreaView>
  );
}
