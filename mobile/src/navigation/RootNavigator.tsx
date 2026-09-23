import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {useAuthStore} from '../store/authStore';
import {useI18n} from '../i18n/useI18n';
import {colors} from '../theme';
import {RootStackParamList, AuthStackParamList, MainTabParamList} from './types';
import {GlassTabBar} from './GlassTabBar';
import {LoginScreen} from '../screens/auth/LoginScreen';
import {RegisterScreen} from '../screens/auth/RegisterScreen';
import {HomeScreen} from '../screens/main/HomeScreen';
import {NearbyScreen} from '../screens/main/NearbyScreen';
import {ReportHubScreen} from '../screens/main/ReportHubScreen';
import {MyPetsScreen} from '../screens/main/MyPetsScreen';
import {ProfileScreen} from '../screens/main/ProfileScreen';
import {CreatePetScreen} from '../screens/pets/CreatePetScreen';
import {PetDetailScreen} from '../screens/pets/PetDetailScreen';
import {PetQRScreen} from '../screens/pets/PetQRScreen';
import {QRScannerScreen} from '../screens/pets/QRScannerScreen';
import {ReportLostScreen} from '../screens/reports/ReportLostScreen';
import {ReportFoundScreen} from '../screens/reports/ReportFoundScreen';
import {SightingScreen} from '../screens/reports/SightingScreen';
import {EditPetScreen} from '../screens/pets/EditPetScreen';
import {PetHealthScreen} from '../screens/pets/PetHealthScreen';
import {EmergencyInfoScreen} from '../screens/pets/EmergencyInfoScreen';
import {GuardianScreen} from '../screens/pets/GuardianScreen';
import {OwnershipVerificationScreen} from '../screens/pets/OwnershipVerificationScreen';
import {PublicPetScreen} from '../screens/pets/PublicPetScreen';
import {LostPostDetailScreen} from '../screens/reports/LostPostDetailScreen';
import {FoundPostDetailScreen} from '../screens/reports/FoundPostDetailScreen';
import {NotificationsScreen} from '../screens/main/NotificationsScreen';
import {LostAlertsScreen} from '../screens/main/LostAlertsScreen';
import {SponsoredAdsScreen} from '../screens/main/SponsoredAdsScreen';
import {EditProfileScreen} from '../screens/main/EditProfileScreen';
import {MyPostsScreen} from '../screens/main/MyPostsScreen';
import {PrivacyScreen} from '../screens/main/PrivacyScreen';
import {ChatListScreen} from '../screens/chat/ChatListScreen';
import {ChatThreadScreen} from '../screens/chat/ChatThreadScreen';
import {AdminScreen} from '../screens/main/AdminScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Report" component={ReportHubScreen} />
      <Tab.Screen name="MyPets" component={MyPetsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const t = useI18n(s => s.t);
  const locale = useI18n(s => s.locale);

  return (
    <RootStack.Navigator
      key={locale}
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: {backgroundColor: colors.background},
        headerShadowVisible: false,
        headerTitleStyle: {fontWeight: '800'},
        contentStyle: {backgroundColor: colors.background},
      }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{headerShown: false}} />
      <RootStack.Screen name="CreatePet" component={CreatePetScreen} options={{title: t('screen_createPet')}} />
      <RootStack.Screen name="PetDetail" component={PetDetailScreen} options={{title: t('screen_petDetail')}} />
      <RootStack.Screen name="PetQR" component={PetQRScreen} options={{title: t('screen_petQr')}} />
      <RootStack.Screen name="QRScanner" component={QRScannerScreen} options={{title: t('screen_qrScanner')}} />
      <RootStack.Screen name="ReportLost" component={ReportLostScreen} options={{title: t('screen_reportLost')}} />
      <RootStack.Screen name="ReportFound" component={ReportFoundScreen} options={{title: t('screen_reportFound')}} />
      <RootStack.Screen name="Sighting" component={SightingScreen} options={{title: t('screen_sighting')}} />
      <RootStack.Screen name="EditPet" component={EditPetScreen} options={{title: t('screen_editPet')}} />
      <RootStack.Screen name="PetHealth" component={PetHealthScreen} options={{title: t('screen_petHealth')}} />
      <RootStack.Screen name="EmergencyInfo" component={EmergencyInfoScreen} options={{title: t('screen_emergency')}} />
      <RootStack.Screen name="PetGuardians" component={GuardianScreen} options={{title: t('screen_guardians')}} />
      <RootStack.Screen name="OwnershipVerification" component={OwnershipVerificationScreen} options={{title: t('screen_ownership')}} />
      <RootStack.Screen name="PublicPet" component={PublicPetScreen} options={{title: t('screen_publicPet')}} />
      <RootStack.Screen name="LostPostDetail" component={LostPostDetailScreen} options={{title: t('screen_lostDetail')}} />
      <RootStack.Screen name="FoundPostDetail" component={FoundPostDetailScreen} options={{title: t('screen_foundDetail')}} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{title: t('screen_notifications')}} />
      <RootStack.Screen name="LostAlerts" component={LostAlertsScreen} options={{title: t('screen_lostAlerts')}} />
      <RootStack.Screen name="SponsoredAds" component={SponsoredAdsScreen} options={{title: t('screen_sponsored')}} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{title: t('screen_editProfile')}} />
      <RootStack.Screen name="MyPosts" component={MyPostsScreen} options={{title: t('screen_myPosts')}} />
      <RootStack.Screen name="Privacy" component={PrivacyScreen} options={{title: t('screen_privacy')}} />
      <RootStack.Screen name="ChatList" component={ChatListScreen} options={{title: t('screen_chat')}} />
      <RootStack.Screen name="ChatThread" component={ChatThreadScreen} options={{title: t('screen_chatThread')}} />
      <RootStack.Screen name="Admin" component={AdminScreen} options={{title: t('screen_admin')}} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const status = useAuthStore(s => s.status);
  const bootstrap = useAuthStore(s => s.bootstrap);
  const hydrateI18n = useI18n(s => s.hydrate);
  const hydrated = useI18n(s => s.hydrated);

  useEffect(() => {
    void bootstrap();
    void hydrateI18n();
  }, [bootstrap, hydrateI18n]);

  if (status === 'loading' || !hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return status === 'authenticated' ? <AppNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background},
});
