import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function migratePurchases() {
  console.log('Starting purchases migration...');
  
  try {
    // Create Firebase itemId to Supabase UUID mapping from sales data
    const { data: salesData } = await supabase
      .from('sales')
      .select('item_id')
      .limit(1000);
    
    // Get Firebase sales to create reverse mapping
    const fbSalesSnapshot = await firestore.collection('sales').limit(1000).get();
    const itemMapping = new Map();
    
    let salesIndex = 0;
    fbSalesSnapshot.forEach(doc => {
      if (salesIndex < salesData.length) {
        const fbData = doc.data();
        const sbData = salesData[salesIndex];
        if (fbData.itemId) {
          itemMapping.set(fbData.itemId, sbData.item_id);
        }
        salesIndex++;
      }
    });
    
    console.log(`Created mapping for ${itemMapping.size} items`);
    
    // Migrate purchases
    let totalMigrated = 0;
    let lastDoc = null;
    const batchSize = 50;
    
    while (true) {
      let query = firestore.collection('purchases').limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      const purchasesData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const supabaseItemId = itemMapping.get(data.itemId);
        
        if (supabaseItemId) {
          purchasesData.push({
            item_id: supabaseItemId,
            quantity: data.quantity,
            cost_price: data.costPrice,
            supplier: data.supplier || '',
            supplier_phone: data.supplierPhone || '',
            date: data.date,
            user_id: data.userId,
            note: data.note || '',
            payment_type: data.paymentType || 'cash',
            credit_deadline: data.creditDeadline || null
          });
        } else {
          console.warn(`Item ID ${data.itemId} not found in mapping`);
        }
      });
      
      if (purchasesData.length > 0) {
        const { error } = await supabase.from('purchases').insert(purchasesData);
        
        if (error) {
          console.error('Error inserting purchases batch:', error);
          break;
        }
        
        totalMigrated += purchasesData.length;
        console.log(`✅ Migrated ${purchasesData.length} purchases (Total: ${totalMigrated})`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    console.log(`🎉 Successfully migrated ${totalMigrated} purchase records!`);
    
  } catch (error) {
    console.error('❌ Purchases migration failed:', error);
  }
}

migratePurchases().then(() => process.exit(0));