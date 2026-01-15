import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function checkData() {
  try {
    // Check sales structure
    const salesSnapshot = await firestore.collection('sales').limit(1).get();
    if (!salesSnapshot.empty) {
      console.log('Sales sample:', salesSnapshot.docs[0].data());
    }
    
    // Check items structure  
    const itemsSnapshot = await firestore.collection('items').limit(1).get();
    if (!itemsSnapshot.empty) {
      console.log('Items sample:', itemsSnapshot.docs[0].data());
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData().then(() => process.exit(0));