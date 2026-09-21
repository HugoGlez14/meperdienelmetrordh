import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/app-state';

export default function RootLayout() {
  return <AppProvider><RootNavigator/></AppProvider>;
}
function RootNavigator(){
  const {mode}=useApp();
  return (
    <SafeAreaProvider>
      <StatusBar style={mode==='dark'?'light':'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </SafeAreaProvider>
  );
}
