import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stormbrew.game',
  appName: 'Stormbrew',
  webDir: 'dist',
  // Night blue behind the game while it loads (no white flash).
  backgroundColor: '#1b2233',
};

export default config;
