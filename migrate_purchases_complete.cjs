const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Firebase setup
const serviceAccount = {
  "type": "service_account",
  "project_id": "managify608",
  "private_key_id": "8d80ba854b086f4366b8a5d7526b3e65e784b1f5",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDcuankmGan8DPd\nZ+obC8byZIRqfYcfDTz4sT8BBsEGCyPwGd4oTrFfjH1SXbcceZ4fCHbwk2YuqGNn\nzwQW58H8vJ1TSzPsAmnWDSCQ94bIkBneP5zRy87MLpTAAjPj6ypxi0bX5jj0rwIP\nYo8FSFHHoQC7ohp6c/VQSGunAWfoDcc4zasD/ESgQdRU1NKeGcoBhPV/8ahtWDxP\n7Zs7eT3Qm0IAMef0WlE03uMeuw9ae1F1GAa2vboPqoQtvr69hFCKFevybJBwg6yx\nTegZrVUUcqDFca8uQuBOE5cYAmkU/P7mpJJACV2KcK4OiYTESwbTd4h/MDJrpYws\nKDHUTJADAgMBAAECggEAbbX/QzeZNvpG3VMsYtscvRjHVKMmSYHr/3UiauEvilB5\nQXuqGADdWy/ajtk0DfxJYwVzEStCzAg4uL2GO9hgbL5XuLIVkca1Uobd3BCctw4h\nPX4C9ajHFmhE2Zd+sVgPlbZztRai0sQ2Uu1bR3Xl6EMXuSve22TN12TX1X/2ZLmg\nELpErDM8RJm8po5kK9oI4Qz5Drc1/x8/5edqdsrh+SuuHw8IFn8LbV37tEgUnfNB\n4WlGqS4w/Xeb1oo+qL1RQfW0s8Q/ZF8U4BRnJbP50o1d7Qea2rtSfokRbBOdzZNY\naBNmDgMNlAfP5H7kPC/EEodMjz8C356Ar8EXCQcgmQKBgQD1iFxM/pQNfg6DLLQW\no0BBx+VfDKY4pAkW5g659gbkExjTy8dTuz7dAPTNXK9iVCKxcx8qRhXxWVI1Yp5C\nvkb3B34BIH2EZgatRhttkLKskTeqFxm2BxPwJEWH1LKCDFvhdY4e5WtwCEBCjVKI\nbTJwbJwmQ0wojjxRDfOLnwOTLwKBgQDmIpDGlB+WsJwIjA9USAF09miJOfp6Snts\nIjIuIu2cD2aZqHU+Ag4uV8FOIIKKdChztdfCYnSrTK3JETH39i+/ARKyoEI/LFka\nzisnCN09Gjg/oYudP+/orMxy60kZA5s+oEf/zZEI404SXjKeSyKM5/NKGmpsQH/i\nqlJdb1IrbQKBgQCV896zIzOWfestD6s4vCEtS4D5KMeHhh8K/hv2VJxmxIcAKs8k\ngxHkdYYMudNfERVTHITnE4CpMqzzb7RJ/N1oVwoMdCRULN9dCZkMtDd7DwFY/tyz\n/+ScX/qa9zrCE/w1WM8gbWrNNCzSuG60ZURNxvcioy0rA5swwX2BQu8y/wKBgGYz\nE3gcb6rL438oM+aJ05vNkb7fMIz+ZrEuvnoeqMaVUEsMtIRFBWcvMXkwlshFrXE1\nYAvDDWzFMKgKKtajTbDVGSiaYtELMMbmp+M93II2EqSvaQD8U95QXrrqIhwprdex\n9kdzUuVPjGw7yN7jHwTUPQa7lGdefWx7lvhHZ4ZBAoGBAMBS/KJmAU/6Nfk9d4I0\ncuNiilwUhXQj0q8zQEYfm5NgBuAJrlToyEitZ8qp6Y65GwfUffOL8WKMgPcSQJdk\nw3i0Q7gSYPFJna9ZoV1LooM8L5aCWVxTCXeC9HgMma0+bJltgR6cZjmlL18Fcd2D\nXvDTVPOkC0CFfdAEu+Bt6mqN\n-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk-fbsvc@managify608.iam.gserviceaccount.com",
  "client_id": "105043392653478418673",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40managify608.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// Supabase setup
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function getItemMapping(userId) {
  console.log(`Getting item ID mappings for user ${userId}...`);
  
  const { data: items, error } = await supabase
    .from('items')
    .select('id, sku, name')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error fetching items:', error);
    return new Map();
  }
  
  // Create a mapping from Firebase item properties to Supabase UUIDs
  const itemMap = new Map();
  
  // Get Firebase items for this user
  const fbSnapshot = await firestore.collection('users').doc(userId).collection('items').get();
  const fbItems = [];
  fbSnapshot.forEach(doc => {
    fbItems.push({ id: doc.id, ...doc.data() });
  });
  
  // Match items by SKU or name
  for (const fbItem of fbItems) {
    const supabaseItem = items.find(item => 
      item.sku === fbItem.sku || 
      item.name === fbItem.name
    );
    
    if (supabaseItem) {
      itemMap.set(fbItem.id, supabaseItem.id);
    }
  }
  
  console.log(`Created mapping for ${itemMap.size} items for user ${userId}`);
  return itemMap;
}

async function migratePurchases() {
  console.log('Migrating purchases from Firebase to Supabase...');
  
  try {
    // Get all users
    const usersSnapshot = await admin.auth().listUsers();
    
    for (const user of usersSnapshot.users) {
      const userId = user.uid;
      console.log(`\nMigrating purchases for user: ${userId}`);
      
      // Get item ID mappings for this user
      const itemMap = await getItemMapping(userId);
      
      const snapshot = await firestore.collection('users').doc(userId).collection('purchases').get();
      const purchases = [];
      let skippedCount = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Skip if essential fields are missing
        if (!data.quantity && !data.qty) {
          console.log('Skipping purchase with missing quantity:', doc.id);
          skippedCount++;
          return;
        }
        
        // Get mapped item ID
        const mappedItemId = itemMap.get(data.itemId);
        if (!mappedItemId) {
          console.log('Skipping purchase - no item mapping found for:', data.itemId);
          skippedCount++;
          return;
        }
        
        purchases.push({
          item_id: mappedItemId,
          quantity: data.quantity || data.qty,
          cost_price: data.costPrice || 0,
          supplier: data.supplier || '',
          supplier_phone: data.supplierPhone || '',
          note: data.note || '',
          date: data.date || data.purchasedAt || new Date().toISOString(),
          user_id: userId
        });
      });
      
      if (purchases.length === 0) {
        console.log(`No purchases to migrate for user ${userId}`);
        continue;
      }
      
      console.log(`Found ${purchases.length} purchases to migrate for user ${userId} (skipped ${skippedCount})`);
      
      // Insert in batches of 50
      for (let i = 0; i < purchases.length; i += 50) {
        const batch = purchases.slice(i, i + 50);
        const { error } = await supabase.from('purchases').upsert(batch);
        
        if (error) {
          console.error(`Error inserting purchases for user ${userId}:`, error);
        } else {
          console.log(`Inserted ${batch.length} purchases for user ${userId} (${i + batch.length}/${purchases.length})`);
        }
      }
    }
    
    console.log('\n✅ Purchases migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migratePurchases();