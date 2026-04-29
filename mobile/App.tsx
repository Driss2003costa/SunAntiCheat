import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider, useApp } from './src/context/AppContext'
import { C } from './src/theme'

import ConnectScreen      from './src/screens/ConnectScreen'
import LoginScreen        from './src/screens/LoginScreen'
import HomeScreen         from './src/screens/HomeScreen'
import AlertsScreen       from './src/screens/AlertsScreen'
import PlayersScreen      from './src/screens/PlayersScreen'
import ConsoleScreen      from './src/screens/ConsoleScreen'
import MoreScreen         from './src/screens/MoreScreen'
import PlayerProfileScreen from './src/screens/PlayerProfileScreen'
import ViolationsScreen   from './src/screens/ViolationsScreen'
import SanctionsScreen    from './src/screens/SanctionsScreen'
import HoneypotScreen     from './src/screens/HoneypotScreen'

const RootStack = createNativeStackNavigator()
const Tab       = createBottomTabNavigator()
const MoreStack = createNativeStackNavigator()

const HEADER_OPTS = {
  headerStyle:      { backgroundColor: C.surface },
  headerTintColor:  C.text,
  headerTitleStyle: { fontWeight: '700' as any },
  headerShadowVisible: false,
  contentStyle:     { backgroundColor: C.bg },
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={HEADER_OPTS}>
      <MoreStack.Screen name="MoreHub"    component={MoreScreen} options={{ title: 'Plus', headerShown: false }} />
      <MoreStack.Screen name="Violations" component={ViolationsScreen} options={{ title: 'Violations' }} />
      <MoreStack.Screen name="Sanctions"  component={SanctionsScreen}  options={{ title: 'Sanctions' }} />
      <MoreStack.Screen name="Honeypot"   component={HoneypotScreen}   options={{ title: 'Honeypot X-Ray' }} />
    </MoreStack.Navigator>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor:  C.border,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          56,
        },
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as any, marginBottom: 2 },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, [string, string]> = {
            Home:    ['home',           'home-outline'],
            Alerts:  ['notifications',  'notifications-outline'],
            Players: ['people',         'people-outline'],
            Console: ['terminal',       'terminal-outline'],
            More:    ['ellipsis-horizontal', 'ellipsis-horizontal-outline'],
          }
          const [filled, outline] = icons[route.name] ?? ['apps', 'apps-outline']
          return <Ionicons name={(focused ? filled : outline) as any} size={size} color={color} />
        },
      })}>
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ title: 'Accueil' }} />
      <Tab.Screen name="Alerts"  component={AlertsScreen}  options={{ title: 'Alertes' }} />
      <Tab.Screen name="Players" component={PlayersScreen} options={{ title: 'Joueurs' }} />
      <Tab.Screen name="Console" component={ConsoleScreen} options={{ title: 'Console' }} />
      <Tab.Screen name="More"    component={MoreNavigator} options={{ title: 'Plus' }} />
    </Tab.Navigator>
  )
}

function RootNavigator() {
  const { serverUrl, jwt, ready } = useApp()

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    )
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      {!serverUrl ? (
        <RootStack.Screen name="Connect" component={ConnectScreen} />
      ) : !jwt ? (
        <RootStack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen
            name="PlayerProfile"
            component={PlayerProfileScreen}
            options={({ route }: any) => ({ ...HEADER_OPTS, title: route.params?.name ?? 'Profil', headerShown: true })}
          />
        </>
      )}
    </RootStack.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary:    C.primary,
              background: C.bg,
              card:       C.surface,
              text:       C.text,
              border:     C.border,
              notification: C.danger,
            },
          }}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  )
}
