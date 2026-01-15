import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Firebase setup
const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// Supabase setup
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function migrateSales() {
  console.log('Migrating sales data from Firebase to Supabase...');
  
  try {
    let totalMigrated = 0;
    let lastDoc = null;
    const batchSize = 100;
    
    while (true) {
      let query = firestore.collection('sales').limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      const salesData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        salesData.push({
          item_id: data.itemId,
          quantity: data.quantity,
          actual_price: data.actualPrice,
          original_price: data.originalPrice,
          item_discount: data.itemDiscount || 0,
          bill_discount: data.billDiscount || 0,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          invoice_no: data.invoiceNo,
          date: data.date,
          user_id: data.userId || data.user_id
        });
      });
      
      // Insert batch to Supabase
      const { error } = await supabase.from('sales').insert(salesData);
      
      if (error) {
        console.error('Error inserting sales batch:', error);
        break;
      }
      
      totalMigrated += salesData.length;
      console.log(`✅ Migrated ${salesData.length} sales records (Total: ${totalMigrated})`);
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    console.log(`🎉 Successfully migrated ${totalMigrated} sales records!`);
    
  } catch (error) {
    console.error('❌ Sales migration failed:', error);
  }
}

migrateSales().then(() => process.exit(0));