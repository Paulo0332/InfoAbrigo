import { View } from 'react-native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvisoConexao from '../components/AvisoConexao';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import DonationsScreen from '../screens/DonationsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Altura da barra sem contar a área reservada do sistema. Precisa caber o ícone, o
// nome da aba e as folgas de cima e de baixo: com 60 o nome ficava espremido e
// cortado, e com o texto do sistema maior isso piorava.
const ALTURA_BARRA = 68;

export default function AppNavigator() {

  // Quanto o sistema reserva na base da tela: a barra de gestos do Android
  // moderno e do iPhone sem botão. Sem somar isso, a altura fixa
  // esmaga os ícones em alguns aparelhos e não em outros.
  const areaSegura = useSafeAreaInsets();

  return (
    <Tab.Navigator
      // A faixa de "aguardando conexão" mora junto da barra, logo acima dela. Assim o
      // conteúdo sobe para abrir espaço, em vez de a faixa cobrir o botão de baixo.
      tabBar={(propsDaBarra) => (
        <View>
          <AvisoConexao />

          <BottomTabBar {...propsDaBarra} />
        </View>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMain,
        tabBarStyle: {
          backgroundColor: colors.backgroundLight,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          height: ALTURA_BARRA + areaSegura.bottom,
          paddingBottom: 8 + areaSegura.bottom,
          paddingTop: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Mapa') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Doações') {
            iconName = focused ? 'gift' : 'gift-outline';
          } else if (route.name === 'Agenda') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Início" component={HomeScreen} />
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Doações" component={DonationsScreen} />
      <Tab.Screen name="Agenda" component={ScheduleScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
