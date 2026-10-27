import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'studio.vantalab.cashflow',
  appName: 'CashFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0A0A0C',
    },
    LocalNotifications: {
      iconColor: '#C6FF4D',
    },
  },
}

export default config
