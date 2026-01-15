import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function checkPurchasesData() {
  try {
    const snapshot = await firestore.collection('purchases').limit(3).get();
    
    console.log('Purchases sample data:');
    snapshot.forEach(doc => {
      console.log('ID:', doc.id);
      console.log('Data:', doc.data());
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPurchasesData().then(() => process.exit(0));