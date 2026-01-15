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

async function migrateSales() {
  // Get item mapping
  const { data: supabaseItems } = await supabase.from('items').select('id, sku, name');
  const fbItemsSnapshot = await firestore.collection('items').get();
  const itemMapping = new Map();
  
  fbItemsSnapshot.forEach(doc => {
    const fbItem = doc.data();
    const matchingItem = supabaseItems.find(item => 
      item.sku === fbItem.sku && item.name === fbItem.name
    );
    if (matchingItem) {
      itemMapping.set(doc.id, matchingItem.id);
    }
  });
  
  console.log(`Item mapping: ${itemMapping.size}`);
  
  // Migrate sales with pagination
  let totalMigrated = 0;
  let lastDoc = null;
  
  while (true) {
    let query = firestore.collection('sales').limit(50);
    if (lastDoc) query = query.startAfter(lastDoc);
    
    const snapshot = await query.get();
    if (snapshot.empty) break;
    
    const salesData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const supabaseItemId = itemMapping.get(data.itemId);
      
      if (supabaseItemId) {
        salesData.push({
          item_id: supabaseItemId,
          quantity: data.quantity,
          actual_price: data.actualPrice,
          original_price: data.originalPrice,
          item_discount: data.itemDiscount || 0,
          bill_discount: data.billDiscount || 0,
          customer_name: data.customerName || '',
          customer_phone: data.customerPhone || '',
          invoice_no: data.invoiceNo,
          date: data.date,
          user_id: data.userId
        });
      }
    });
    
    if (salesData.length > 0) {
      const { error } = await supabase.from('sales').insert(salesData);
      if (error) {
        console.error('Error:', error);
        break;
      }
      totalMigrated += salesData.length;
      console.log(`✅ Migrated ${salesData.length} sales (Total: ${totalMigrated})`);
    }
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
  
  console.log(`🎉 Complete: ${totalMigrated} sales migrated`);
}

migrateSales().then(() => process.exit(0));