import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Consolidated connection test
async function testConnection() {
  console.log("🛠️ Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId || "(default)");
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("✅ Firestore connection successful");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
        console.warn("🔐 Firestore: Permission denied on test read. This is fine if /test/ isn't public, but check if rules are deployed.");
    } else {
        console.error("❌ Firestore check error:", error.code, error.message);
    }
  }
}
testConnection();

export default app;
