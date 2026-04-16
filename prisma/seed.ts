import 'dotenv/config';
import prisma from '../apps/api/src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding BhojAI database...');

  // Create restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { id: 'default-restaurant' },
    update: {},
    create: {
      id: 'default-restaurant',
      name: 'BhojAI Demo Restaurant',
      address: '123 MG Road, Bengaluru',
      phone: '+91-9876543210',
      email: 'demo@bhojai.in',
      theme: 'default',
      taxRate: 5.0,
      serviceChargeRate: 5.0,
    },
  });

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminHash,
      name: 'Admin User',
      role: 'ADMIN',
      pin: '0000',
      restaurantId: restaurant.id,
    },
    create: {
      username: 'admin',
      passwordHash: adminHash,
      name: 'Admin User',
      role: 'ADMIN',
      pin: '0000',
      restaurantId: restaurant.id,
    },
  });

  // Create waiter
  const waiterHash = await bcrypt.hash('waiter123', 10);
  await prisma.user.upsert({
    where: { username: 'waiter1' },
    update: {
      passwordHash: waiterHash,
      name: 'Ravi Kumar',
      role: 'WAITER',
      pin: '1234',
      restaurantId: restaurant.id,
    },
    create: {
      username: 'waiter1',
      passwordHash: waiterHash,
      name: 'Ravi Kumar',
      role: 'WAITER',
      pin: '1234',
      restaurantId: restaurant.id,
    },
  });

  const managerHash = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { username: 'manager1' },
    update: {
      passwordHash: managerHash,
      name: 'Priya Singh',
      role: 'MANAGER',
      pin: '5678',
      restaurantId: restaurant.id,
    },
    create: {
      username: 'manager1',
      passwordHash: managerHash,
      name: 'Priya Singh',
      role: 'MANAGER',
      pin: '5678',
      restaurantId: restaurant.id,
    },
  });

  const chefHash = await bcrypt.hash('chef123', 10);
  await prisma.user.upsert({
    where: { username: 'chef1' },
    update: {
      passwordHash: chefHash,
      name: 'Chef Arjun',
      role: 'CHEF',
      pin: '9012',
      restaurantId: restaurant.id,
    },
    create: {
      username: 'chef1',
      passwordHash: chefHash,
      name: 'Chef Arjun',
      role: 'CHEF',
      pin: '9012',
      restaurantId: restaurant.id,
    },
  });

  // Create categories
  const starters = await prisma.category.upsert({
    where: { id: 'cat-starters' },
    update: {},
    create: { id: 'cat-starters', name: 'Starters', sortOrder: 1, restaurantId: restaurant.id },
  });
  const mains = await prisma.category.upsert({
    where: { id: 'cat-mains' },
    update: {},
    create: { id: 'cat-mains', name: 'Main Course', sortOrder: 2, restaurantId: restaurant.id },
  });
  const beverages = await prisma.category.upsert({
    where: { id: 'cat-beverages' },
    update: {},
    create: { id: 'cat-beverages', name: 'Beverages', sortOrder: 3, restaurantId: restaurant.id },
  });
  const desserts = await prisma.category.upsert({
    where: { id: 'cat-desserts' },
    update: {},
    create: { id: 'cat-desserts', name: 'Desserts', sortOrder: 4, restaurantId: restaurant.id },
  });

  // Create menu items
  const menuItems = [
    { id: 'item-1', name: 'Paneer Tikka', price: 220, categoryId: starters.id, dietaryLabel: 'Veg', aiTags: 'popular,starter,combo', prepTime: 15 },
    { id: 'item-2', name: 'Chicken Wings', price: 280, categoryId: starters.id, dietaryLabel: 'Non-Veg', aiTags: 'popular,starter', prepTime: 20 },
    { id: 'item-3', name: 'Dal Makhani', price: 180, categoryId: mains.id, dietaryLabel: 'Veg', aiTags: 'bestseller,combo', prepTime: 25 },
    { id: 'item-4', name: 'Butter Chicken', price: 320, categoryId: mains.id, dietaryLabel: 'Non-Veg', aiTags: 'bestseller,popular', prepTime: 25 },
    { id: 'item-5', name: 'Garlic Naan', price: 50, categoryId: mains.id, dietaryLabel: 'Veg', aiTags: 'combo,bread', prepTime: 8 },
    { id: 'item-6', name: 'Steamed Rice', price: 80, categoryId: mains.id, dietaryLabel: 'Veg', aiTags: 'combo', prepTime: 10 },
    { id: 'item-7', name: 'Mango Lassi', price: 120, categoryId: beverages.id, dietaryLabel: 'Veg', aiTags: 'popular,beverage,combo', prepTime: 5 },
    { id: 'item-8', name: 'Masala Chai', price: 60, categoryId: beverages.id, dietaryLabel: 'Veg', aiTags: 'beverage', prepTime: 5 },
    { id: 'item-9', name: 'Cold Coffee', price: 130, categoryId: beverages.id, dietaryLabel: 'Veg', aiTags: 'beverage,popular', prepTime: 5 },
    { id: 'item-10', name: 'Gulab Jamun', price: 90, categoryId: desserts.id, dietaryLabel: 'Veg', aiTags: 'dessert,combo', prepTime: 5 },
    { id: 'item-11', name: 'Kulfi', price: 110, categoryId: desserts.id, dietaryLabel: 'Veg', aiTags: 'dessert', prepTime: 3 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, isAvailable: true },
    });
  }

  // Create tables
  const tables = [
    { id: 'table-1', number: 'T1', label: 'Window Table', seatCapacity: 2, area: 'Main Hall', posX: 50, posY: 50 },
    { id: 'table-2', number: 'T2', label: 'Centre Table', seatCapacity: 4, area: 'Main Hall', posX: 200, posY: 50 },
    { id: 'table-3', number: 'T3', seatCapacity: 4, area: 'Main Hall', posX: 350, posY: 50 },
    { id: 'table-4', number: 'T4', label: 'VIP Booth', seatCapacity: 6, area: 'VIP', posX: 50, posY: 200 },
    { id: 'table-5', number: 'T5', seatCapacity: 2, area: 'Rooftop', posX: 200, posY: 200 },
  ];

  for (const table of tables) {
    await prisma.restaurantTable.upsert({
      where: { id: table.id },
      update: {},
      create: { ...table, status: 'AVAILABLE', restaurantId: restaurant.id },
    });
  }

  // Create inventory items
  const inventory = [
    { id: 'inv-1', name: 'Paneer', quantity: 5, unit: 'kg', minThreshold: 1, costPrice: 200 },
    { id: 'inv-2', name: 'Chicken', quantity: 10, unit: 'kg', minThreshold: 2, costPrice: 180 },
    { id: 'inv-3', name: 'Tomatoes', quantity: 8, unit: 'kg', minThreshold: 2, costPrice: 30 },
    { id: 'inv-4', name: 'Onions', quantity: 15, unit: 'kg', minThreshold: 3, costPrice: 20 },
    { id: 'inv-5', name: 'Mango Pulp', quantity: 2, unit: 'liters', minThreshold: 1, costPrice: 80 },
    { id: 'inv-6', name: 'Milk', quantity: 10, unit: 'liters', minThreshold: 2, costPrice: 60 },
  ];

  for (const item of inventory) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, restaurantId: restaurant.id },
    });
  }

  console.log('✅ Seed complete!');
  console.log(`\n📋 Demo credentials:`);
  console.log(`   Admin:  username=admin  password=admin123  PIN=0000`);
  console.log(`   Waiter: username=waiter1 password=waiter123 PIN=1234`);
  console.log(`   Manager: username=manager1 password=manager123 PIN=5678`);
  console.log(`   Chef: username=chef1 password=chef123 PIN=9012`);
  console.log(`   Restaurant ID: ${restaurant.id}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
