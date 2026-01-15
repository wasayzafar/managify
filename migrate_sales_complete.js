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

async function migrateSalesWithMapping() {
  console.log('Starting complete sales migration...');
  
  try {
    // Step 1: Get all items from Firebase and create mapping
    console.log('Creating item ID mapping...');
    const itemsSnapshot = await firestore.collection('items').get();
    const itemMapping = new Map();
    
    for (const doc of itemsSnapshot.docs) {
      const data = doc.data();
      const itemData = {
        sku: data.sku,
        name: data.name,
        price: data.price,
        created_at: data.createdAt,
        user_id: data.userId
      };
      
      // Insert item to Supabase and get UUID
      const { data: insertedItem, error } = await supabase
        .from('items')
        .insert(itemData)
        .select('id')
        .single();
        
      if (error) {
        console.error('Error inserting item:', error);
        continue;
      }
      
      itemMapping.set(doc.id, insertedItem.id);
      console.log(`Mapped item ${doc.id} -> ${insertedItem.id}`);
    }
    
    // Step 2: Migrate sales using the item mapping
    console.log('Migrating sales data...');
    let totalMigrated = 0;
    let lastDoc = null;
    const batchSize = 50;
    
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
        } else {
          console.warn(`Item ID ${data.itemId} not found in mapping`);
        }
      });
      
      if (salesData.length > 0) {
        const { error } = await supabase.from('sales').insert(salesData);
        
        if (error) {
          console.error('Error inserting sales batch:', error);
          break;
        }
        
        totalMigrated += salesData.length;
        console.log(`✅ Migrated ${salesData.length} sales records (Total: ${totalMigrated})`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    console.log(`🎉 Successfully migrated ${totalMigrated} sales records!`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateSalesWithMapping().then(() => process.exit(0));