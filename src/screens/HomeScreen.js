import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Cabeçalho */}
        <LinearGradient
          colors={[colors.primary, colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Olá,</Text>
              <Text style={styles.userName}>Voluntário(a)!</Text>
            </View>
            <Pressable style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={24} color="#FFF" />
              <View style={styles.badge} />
            </Pressable>
          </View>

          {/* Indicadores Rápidos */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>12h</Text>
              <Text style={styles.statLabel}>este mês</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>atividades</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue} numberOfLines={1}>Lar Esperança</Text>
              <Text style={styles.statLabel}>abrigo atual</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Ações Rápidas */}
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          <View style={styles.quickActions}>
            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: colors.supportGreen }]}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Check-in</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: colors.supportBlue }]}>
                <Ionicons name="business" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Abrigos</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: colors.supportPink }]}>
                <Ionicons name="chatbubbles" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Mensagens</Text>
            </Pressable>
          </View>

          {/* Avisos do Abrigo */}
          <Text style={styles.sectionTitle}>Avisos do Abrigo</Text>
          <View style={[globalStyles.card, styles.warningCard]}>
            <Ionicons name="alert-circle" size={28} color={colors.primary} />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Necessidade Urgente</Text>
              <Text style={styles.warningDesc}>Precisamos de leite em pó (Aptamil 1) até amanhã.</Text>
            </View>
          </View>

          {/* Próximas Atividades */}
          <Text style={styles.sectionTitle}>Próximas Atividades</Text>
          <View style={globalStyles.card}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityDate}>Hoje, 14:00</Text>
              <View style={styles.badgeTag}>
                <Text style={styles.badgeText}>Confirmado</Text>
              </View>
            </View>
            <Text style={styles.activityTitle}>Recreação Infantil</Text>
            <View style={styles.activityLocation}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.activityLocationText}>Lar Esperança</Text>
            </View>
          </View>
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary, // Para a cor de fundo do notch/status bar acompanhar o header
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.supportPink,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    padding: 20,
    marginTop: -20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 16,
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    color: colors.textMain,
    fontWeight: '500',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  warningTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 14,
    color: '#666',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  badgeTag: {
    backgroundColor: 'rgba(78, 158, 114, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    color: colors.supportGreen,
    fontWeight: 'bold',
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 8,
  },
  activityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityLocationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
});
