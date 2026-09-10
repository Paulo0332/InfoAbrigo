import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalStyles } from '../theme/styles';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Text style={globalStyles.title}>Perfil</Text>
        <Text style={globalStyles.text}>Suas informações</Text>
      </View>
    </SafeAreaView>
  );
}
