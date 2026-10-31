import { ItemCategory, MedicineFor, Unit, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/db.js'

type SeedItem = {
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  notes?: string
  medicineFor?: MedicineFor
}

const seedItems: SeedItem[] = [
  { name: 'Jeera', category: 'GROCERY', unit: 'GRAM', quantity: 500, threshold: 250 },
  { name: 'Mustard', category: 'GROCERY', unit: 'GRAM', quantity: 500, threshold: 250 },
  { name: 'Fenugreek', category: 'GROCERY', unit: 'GRAM', quantity: 350, threshold: 200 },
  { name: 'Fennel seeds', category: 'GROCERY', unit: 'GRAM', quantity: 250, threshold: 150 },
  { name: 'Asafoetida', category: 'GROCERY', unit: 'GRAM', quantity: 100, threshold: 80 },
  { name: 'Cinnamon', category: 'GROCERY', unit: 'GRAM', quantity: 100, threshold: 60 },
  { name: 'Jaggery round India', category: 'GROCERY', unit: 'GRAM', quantity: 600, threshold: 700 },
  {
    name: 'Jaggery cubes Sweden',
    category: 'GROCERY',
    unit: 'GRAM',
    quantity: 300,
    threshold: 500,
  },
  { name: 'Tamarind', category: 'GROCERY', unit: 'KILOGRAM', quantity: 1.5, threshold: 2 },
  { name: 'Pootukadalai', category: 'GROCERY', unit: 'KILOGRAM', quantity: 1, threshold: 2 },
  { name: 'Green moong dall', category: 'GROCERY', unit: 'KILOGRAM', quantity: 1, threshold: 1.5 },
  { name: 'Moong dall 2026', category: 'GROCERY', unit: 'KILOGRAM', quantity: 2.2, threshold: 2 },
  { name: 'Coconut oil', category: 'GROCERY', unit: 'LITER', quantity: 2, threshold: 1.5 },
  { name: 'Gingelly oil', category: 'GROCERY', unit: 'LITER', quantity: 2.5, threshold: 2 },
  { name: 'Pickle', category: 'GROCERY', unit: 'GRAM', quantity: 300, threshold: 500 },

  {
    name: 'Primolut N',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 80,
    threshold: 30,
    medicineFor: 'WIFE',
  },
  {
    name: 'Iron India',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 90,
    threshold: 40,
    medicineFor: 'WIFE',
  },
  {
    name: 'Iron Swed',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 100,
    threshold: 50,
    medicineFor: 'WIFE',
  },
  {
    name: 'Provera 5mg',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 42,
    threshold: 20,
    medicineFor: 'WIFE',
  },
  {
    name: 'Cyclopron 1g',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 15,
    threshold: 8,
    medicineFor: 'WIFE',
  },
  {
    name: 'Albendazole adult',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 3,
    threshold: 6,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Cetirizine',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 75,
    threshold: 20,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Dolo 650',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 90,
    threshold: 30,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Paracetamol',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 120,
    threshold: 40,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Pan 40',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 74,
    threshold: 30,
    medicineFor: 'ME',
  },
  {
    name: 'Cefixime',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 40,
    threshold: 20,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Clavam 625',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 50,
    threshold: 20,
    medicineFor: 'FAMILY',
  },
  {
    name: 'Vitamin D',
    category: 'MEDICINE',
    unit: 'TABLET',
    quantity: 12,
    threshold: 12,
    medicineFor: 'FAMILY',
  },

  {
    name: 'Cetirizine syrup',
    category: 'MEDICINE',
    unit: 'BOTTLE',
    quantity: 3,
    threshold: 2,
    medicineFor: 'CHILD',
  },
  {
    name: 'Paracetamol syrup',
    category: 'MEDICINE',
    unit: 'BOTTLE',
    quantity: 4,
    threshold: 2,
    medicineFor: 'CHILD',
  },
  {
    name: 'Alvedon syrup 200ml',
    category: 'MEDICINE',
    unit: 'BOTTLE',
    quantity: 1,
    threshold: 1,
    medicineFor: 'CHILD',
  },
  {
    name: 'Ipren syrup 100ml',
    category: 'MEDICINE',
    unit: 'BOTTLE',
    quantity: 1,
    threshold: 1,
    medicineFor: 'CHILD',
  },
  {
    name: 'Caladryl lotion',
    category: 'MEDICINE',
    unit: 'BOTTLE',
    quantity: 1,
    threshold: 1,
    medicineFor: 'CHILD',
  },

  {
    name: 'Volini big tube',
    category: 'HOUSEHOLD',
    unit: 'COUNT',
    quantity: 0,
    threshold: 4,
    notes: 'Need to buy',
  },
  { name: 'Small spoons 11cm', category: 'HOUSEHOLD', unit: 'COUNT', quantity: 6, threshold: 6 },
]

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Demo seeding is disabled in production. Use admin:create to create your own account.',
    )
  }
  console.log('Adding missing demo records only; existing accounts and stock will not be reset.')

  const adminHash = await bcrypt.hash('Admin@1234', 12)
  const familyHash = await bcrypt.hash('Family@1234', 12)

  const users = [
    {
      name: 'Admin User',
      email: 'admin@homestock.local',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
    {
      name: 'Family User',
      email: 'family@homestock.local',
      passwordHash: familyHash,
      role: UserRole.FAMILY,
    },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: user,
      update: {},
    })
  }

  for (const item of seedItems) {
    await prisma.stockItem.upsert({
      where: { name_category: { name: item.name, category: item.category } },
      create: item,
      update: {},
    })
  }

  console.log('Seed completed')
  console.log('Admin login: admin@homestock.local / Admin@1234')
  console.log('Family login: family@homestock.local / Family@1234')
}

seed()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
