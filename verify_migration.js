import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function verifyMigration() {
  try {
    // Count items
    const { count: itemCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });
    
    // Count sales
    const { count: salesCount } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });
    
    // Get sample data
    const { data: sampleItems } = await supabase
      .from('items')
      .select('*')
      .limit(3);
      
    const { data: sampleSales } = await supabase
      .from('sales')
      .select('*')
      .limit(3);
    
    console.log('🎉 Migration Verification Results:');
    console.log(`📦 Items migrated: ${itemCount}`);
    console.log(`💰 Sales migrated: ${salesCount}`);
    console.log('\n📋 Sample Items:');
    console.log(sampleItems);
    console.log('\n💳 Sample Sales:');
    console.log(sampleSales);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration().then(() => process.exit(0));