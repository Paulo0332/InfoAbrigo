import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalStyles } from '../theme/styles';

export default function DonationsScreen() {
  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Text style={globalStyles.title}>Doações</Text>
        <Text style={globalStyles.text}>Necessidades do abrigo</Text>
      </View>
    </SafeAreaView>
  );
}
