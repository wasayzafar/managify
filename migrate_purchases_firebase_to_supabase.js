const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Supabase
const supabaseUrl = 'https://eooulfvbllitlhjzilit.supabase.co';
const supabaseKey = 'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePurchases() {
  try {
    const db = admin.firestore();
    
    // Get all users
    const usersSnapshot = await admin.auth().listUsers();
    
    for (const user of usersSnapshot.users) {
      const userId = user.uid;
      console.log(`Migrating purchases for user: ${userId}`);
      
      // Get user's items from Supabase to create mapping
      const { data: supabaseItems } = await supabase
        .from('items')
        .select('id, sku')
        .eq('user_id', userId);
      
      const skuToIdMap = {};
      supabaseItems?.forEach(item => {
        skuToIdMap[item.sku] = item.id;
      });
      
      // Get purchases from Firebase
      const purchasesRef = db.collection('users').doc(userId).collection('purchases');
      const purchasesSnapshot = await purchasesRef.get();
      
      const purchasesToInsert = [];
      
      for (const doc of purchasesSnapshot.docs) {
        const purchase = doc.data();
        
        // Find corresponding item in Supabase by SKU
        let itemId = null;
        if (purchase.itemSku && skuToIdMap[purchase.itemSku]) {
          itemId = skuToIdMap[purchase.itemSku];
        } else if (purchase.itemId) {
          // Try to find by Firebase itemId (less reliable)
          const itemRef = db.collection('users').doc(userId).collection('items').doc(purchase.itemId);
          const itemDoc = await itemRef.get();
          if (itemDoc.exists) {
            const item = itemDoc.data();
            if (item.sku && skuToIdMap[item.sku]) {
              itemId = skuToIdMap[item.sku];
            }
          }
        }
        
        if (itemId) {
          purchasesToInsert.push({
            id: doc.id,
            user_id: userId,
            item_id: itemId,
            quantity: purchase.qty || purchase.quantity || 1,
            cost_price: purchase.costPrice || 0,
            supplier: purchase.supplier || '',
            supplier_phone: purchase.supplierPhone || '',
            note: purchase.note || '',
            date: purchase.purchasedAt || purchase.date || new Date().toISOString()
          });
        } else {
          console.log(`Skipping purchase ${doc.id} - no matching item found`);
        }
      }
      
      // Insert purchases in batches
      if (purchasesToInsert.length > 0) {
        const { error } = await supabase
          .from('purchases')
          .upsert(purchasesToInsert);
        
        if (error) {
          console.error(`Error inserting purchases for user ${userId}:`, error);
        } else {
          console.log(`Migrated ${purchasesToInsert.length} purchases for user ${userId}`);
        }
      }
    }
    
    console.log('Purchase migration completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

migratePurchases();