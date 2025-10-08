import { db } from '../storage';

export const seedTestData = async () => {
  console.log('🌱 Seeding test data...');
  
  try {
    // Create sample items
    const items = [
      { sku: 'LAPTOP001', name: 'Dell Laptop', price: 1200, costPrice: 900 },
      { sku: 'MOUSE001', name: 'Wireless Mouse', price: 25, costPrice: 15 },
      { sku: 'KEYBOARD001', name: 'Mechanical Keyboard', price: 80, costPrice: 50 },
      { sku: 'MONITOR001', name: '24" Monitor', price: 300, costPrice: 200 },
      { sku: 'HEADPHONE001', name: 'Gaming Headphones', price: 150, costPrice: 100 }
    ];

    console.log('📦 Creating items...');
    const createdItems = [];
    for (const item of items) {
      const createdItem = await db.createItem(item);
      createdItems.push({ ...item, id: createdItem.id });
      console.log(`✅ Created item: ${item.name}`);
    }

    // Create sample purchases
    console.log('🛒 Creating purchases...');
    for (let i = 0; i < 3; i++) {
      const item = createdItems[i];
      if (item) {
        await db.createPurchase({
          itemId: item.id,
          qty: Math.floor(Math.random() * 10) + 5, // 5-15 quantity
          costPrice: item.costPrice,
          supplier: `Supplier ${i + 1}`,
          supplierPhone: `+123456789${i}`,
          note: `Bulk purchase of ${item.name}`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 30 days
        });
        console.log(`✅ Created purchase for: ${item.name}`);
      }
    }

    // Create sample sales
    console.log('💰 Creating sales...');
    for (let i = 0; i < 5; i++) {
      const item = createdItems[Math.floor(Math.random() * createdItems.length)];
      if (item) {
        await db.createSale({
          itemId: item.id,
          quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
          actualPrice: item.price * (0.9 + Math.random() * 0.2), // 90-110% of price
          originalPrice: item.price,
          customerName: `Customer ${i + 1}`,
          customerPhone: `+987654321${i}`,
          date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 7 days
        });
        console.log(`✅ Created sale for: ${item.name}`);
      }
    }

    // Create sample expenses
    console.log('💸 Creating expenses...');
    const expenses = [
      { type: 'Rent', amount: 2000, description: 'Monthly office rent' },
      { type: 'Utilities', amount: 300, description: 'Electricity and water bills' },
      { type: 'Marketing', amount: 500, description: 'Online advertising' },
      { type: 'Equipment', amount: 150, description: 'Office supplies' }
    ];

    for (const expense of expenses) {
      await db.createExpense({
        ...expense,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      console.log(`✅ Created expense: ${expense.type}`);
    }

    // Create sample employees
    console.log('👥 Creating employees...');
    const employees = [
      { name: 'John Smith', salary: 3000, firstMonthPay: 3000, phone: '+1234567890', address: '123 Main St', email: 'john@company.com', position: 'Manager' },
      { name: 'Sarah Johnson', salary: 2500, firstMonthPay: 2500, phone: '+1234567891', address: '456 Oak Ave', email: 'sarah@company.com', position: 'Sales Associate' },
      { name: 'Mike Wilson', salary: 2200, firstMonthPay: 2200, phone: '+1234567892', address: '789 Pine Rd', email: 'mike@company.com', position: 'Cashier' }
    ];

    for (const employee of employees) {
      await db.createEmployee({
        ...employee,
        joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // Random date within last year
      });
      console.log(`✅ Created employee: ${employee.name}`);
    }

    // Create sample suppliers
    console.log('🏢 Creating suppliers...');
    const suppliers = [
      { name: 'Tech Supply Co', phone: '+1987654321', address: '100 Tech Street, Tech City' },
      { name: 'Electronics Plus', phone: '+1987654322', address: '200 Electronic Ave, Gadget Town' },
      { name: 'Office Solutions', phone: '+1987654323', address: '300 Office Blvd, Business District' }
    ];

    for (const supplier of suppliers) {
      await db.createSupplier(supplier);
      console.log(`✅ Created supplier: ${supplier.name}`);
    }

    console.log('🎉 Test data seeding completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    return false;
  }
};
