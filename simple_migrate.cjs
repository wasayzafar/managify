const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const serviceAccount = {
  "type": "service_account",
  "project_id": "managify608",
  "private_key_id": "4c52d05e13783a5568e31ed73cc829c6d073be5e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC+SfiLgwHvVnj1\ntDYnmuRESzvuGMndipBTensdqhJD97prwLBj4ukL9JbLixx+KRZ5rR4TUV4sGb9H\nb46/f5NKdVpDIxkW1yHnYI82U0inRqYw35dHVv22xlgCiSGGF7eyQSVzq7/9Lyup\nqj/OpPbMZAC+lJ7IDm5UGPbZxo7t4SR3VW8cR4+AJHOmDbNJTDBzGZgY0kMMg6vT\n+sj/PlLi2oegwm1a+Xbhk+/HJ0DFvEL74uaVGc/foje/HSPzJ+A2Sy0rOVC9e2zv\nkfFvgPsRID5nh9hpiVyTnifWl8pA67SEWyjiG3GZoq2cHJheJD1bz+Od8+2sAIx2\n9IT2L2ivAgMBAAECggEAPaXZT9lxlwh8x51KrioQKc/16n09aPirKWBU4pdms35e\ndupGOxYYSjdDY03+PSEyltjvFXMW/1KYFZyesouyPD0osPd9+VhZM4yk2QTCVO8e\niFbnu8UDDWPUv32NztOAP8+7Qm4yFORjUORHJ7tp+W2skBG2HzoNpFEyJ/ub8pSf\nHxTP9XvXTfVJmE+U8MBFgg5+XiH7gxcWtnpidytvPs/7Jq9V7B5deaX8SLJBKw14\nq2SyjG6/vTFFMvFEXegQRkcpu8EGQTwhuiK4KkgYlyZF/kIsOUolORxJs79tLHhw\nAs1+tuvdt/l0fD8FDj4fcNtxPpN5vm1Wiw7dhzG/gQKBgQDh8PX8PKn1PkRJaWnW\n1LpjG5ueIcIoe3eqrcgegGHBk16+qbTRZcsIfzvllaDvll6rP7Nd+sewqjcVBWkd\nwyeVu/AKSGdP2LkTFhAkp0ceQQbGk5dch2iRWrNt+9GvOr758wz2xPHJeVDmFQOV\nd7xPzM1q4Hc2Ngb6mSQc66PbhQKBgQDXmsZI4vIjfuDYeCP9ogjy7rC1U9n4jVmh\nr1kkNP/8pC7iWYHJJ6x7mUiI9JSquw2uMw3MTYZBZ18lYBywiuhkJ+QbU71WVAsL\nczUvNKRRV+0hu4iRi26Om3qbkPhAsTlPjnEYZx1ycv57cy9fuc3Q046A6i/V6y7B\nOP+RQJIHowKBgHUOxEL0oxFeOz7VkHIvMIncadmZn+AdZ7hT5NR4qy0BTxr1DatX\nU8OJN90QkprOiymqDSHppb/P0E3hyb4Tt9SJ1Clfrbbej7Rlv+NdjykLg5kqKkdU\nGEcGeOPIjbB9fSg+Vj8bdjFt2w35YSv1JukpMFvpA5pgj2kSInWhV/mJAoGAauEm\n+mrGbiIvhB/Kd6kjlooMv1bZ7wTjMeui3PgJDky1kS+dzwID1yGde4cDS79+gKR+\napDjxPhhij2i+0FhAoVj5sgUS/9Nmld6PfRyoIBd5SL6CGx+WeNpXET5S9iO+Ik8\nN0SmrF2lGb139pQ9GxBEzFNLc1gqzU5cIr1HptECgYAd6WlKUjeTMmt0H1GOXXf9\nlZrDb2ioq0xt/VUr0duZgKc5A8QcoDWsGA+U7vJuAlA2o2nruzcQaEhQYJs59SMx\nvGOGCYikc7OzyeVWpVdZhh/1tUHmJJuw8KnMjDav22dFGjkecSXK3FI0YirpVMI5\nuGEu164LzOuLKTrQvoJXTw==\n-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk-fbsvc@managify608.iam.gserviceaccount.com",
  "client_id": "105043392653478418673",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40managify608.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();
const supabase = createClient('https://eooulfvbllitlhjzilit.supabase.co', 'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx');

async function cleanMigrate() {
  console.log('Starting clean migration...');
  
  // Items - only basic fields
  console.log('Migrating items...');
  const itemsSnapshot = await firestore.collection('items').get();
  const items = [];
  itemsSnapshot.forEach(doc => {
    const data = doc.data();
    items.push({
      sku: data.sku || '',
      name: data.name || '',
      price: data.price || 0,
      user_id: data.userId || 'default_user',
      created_at: new Date().toISOString()
    });
  });
  
  if (items.length > 0) {
    const { error } = await supabase.from('items').insert(items);
    if (error) console.error('Items error:', error);
    else console.log(`✅ Migrated ${items.length} items`);
  }
  
  // Get item mapping for foreign keys
  const { data: supabaseItems } = await supabase.from('items').select('*');
  const itemMap = {};
  items.forEach((item, i) => {
    if (supabaseItems[i]) itemMap[item.sku] = supabaseItems[i].id;
  });
  
  // Purchases - basic fields only
  console.log('Migrating purchases...');
  const purchasesSnapshot = await firestore.collection('purchases').get();
  const purchases = [];
  purchasesSnapshot.forEach(doc => {
    const data = doc.data();
    const itemSku = data.itemSku || data.sku;
    if (itemMap[itemSku]) {
      purchases.push({
        item_id: itemMap[itemSku],
        quantity: data.qty || data.quantity || 0,
        date: data.date || new Date().toISOString(),
        user_id: data.userId || 'default_user',
        cost_price: data.costPrice || 0,
        supplier: data.supplier || '',
        note: data.note || ''
      });
    }
  });
  
  if (purchases.length > 0) {
    const { error } = await supabase.from('purchases').insert(purchases);
    if (error) console.error('Purchases error:', error);
    else console.log(`✅ Migrated ${purchases.length} purchases`);
  }
  
  // Sales - basic fields only
  console.log('Migrating sales...');
  const salesSnapshot = await firestore.collection('sales').get();
  const sales = [];
  salesSnapshot.forEach(doc => {
    const data = doc.data();
    const itemSku = data.itemSku || data.sku;
    if (itemMap[itemSku]) {
      sales.push({
        item_id: itemMap[itemSku],
        quantity: data.quantity || 0,
        date: data.date || new Date().toISOString(),
        user_id: data.userId || 'default_user',
        actual_price: data.actualPrice || 0,
        original_price: data.originalPrice || 0
      });
    }
  });
  
  if (sales.length > 0) {
    const { error } = await supabase.from('sales').insert(sales);
    if (error) console.error('Sales error:', error);
    else console.log(`✅ Migrated ${sales.length} sales`);
  }
  
  console.log('✅ Migration completed!');
}

cleanMigrate().catch(console.error);