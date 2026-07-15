import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kisi.app",
  appName: "KISI",
  webDir: "out",
  server: {
    url: "https://kisi-virid.vercel.app",
    cleartext: true,
  },
};

export default config;