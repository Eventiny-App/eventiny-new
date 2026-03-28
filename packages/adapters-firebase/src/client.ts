import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function createFirestoreClient(config: FirebaseEnvConfig) {
  const app = getApps()[0] ?? initializeApp(config);
  return getFirestore(app);
}
