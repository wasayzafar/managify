const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function addCostPriceColumn() {
  console.log('Adding cost_price column to items table...');
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;'
    });
    
    if (error) {
      console.error('Error adding column:', error);
    } else {
      console.log('✅ Successfully added cost_price column to items table');
    }
  } catch (error) {
    console.error('❌ Failed to add column:', error);
  }
}

addCostPriceColumn();