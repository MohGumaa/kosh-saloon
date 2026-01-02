import { randomUUID } from 'crypto';

// ========== ADMIN USERS ==========
export const users = [
  {
    id: randomUUID(),
    name: 'Admin',
    email: 'admin@kosh-saloon.com',
    password: '123456',
    role: 'ADMIN',
  },
  {
    id: randomUUID(),
    name: 'Supervisor',
    email: 'supervisor@kosh-saloon.com',
    password: '123456',
    role: 'SUPERVISOR',
  },
  {
    id: randomUUID(),
    name: 'Mohamed Ahmed',
    email: 'staff1@kosh-saloon.com',
    password: '123456',
    role: 'STAFF',
  },
  {
    id: randomUUID(),
    name: 'Tamir Abdelrahman',
    email: 'staff2@kosh-saloon.com',
    password: '123456',
    role: 'STAFF',
  },
  {
    id: randomUUID(),
    name: 'Ahmed Ali',
    email: 'staff3@kosh-saloon.com',
    password: '123456',
    role: 'STAFF',
  },
];

// ========== SALON SERVICES ==========
// These are main service categories that staff select when creating invoices
// Price and duration are added during invoice creation per customer/transaction
export const services = [
  {
    id: randomUUID(),
    nameEN: 'Haircut',
    nameAR: 'حلاقة شعر',
    isActive: true,
    createdById: users[0].id,
  },
  {
    id: randomUUID(),
    nameEN: 'Haircut with beard',
    nameAR: 'حلاقة شعر مع دقن',
    isActive: true,
    createdById: users[0].id,
  },
  {
    id: randomUUID(),
    nameEN: 'Haircut with beard and hair color',
    nameAR: 'حلاقة شعر مع دقن و صبغة',
    isActive: true,
    createdById: users[0].id,
  },
  {
    id: randomUUID(),
    nameEN: 'Beard',
    nameAR: 'دقن',
    isActive: true,
    createdById: users[0].id,
  },
  {
    id: randomUUID(),
    nameEN: 'Hair Styling',
    nameAR: 'قطعية',
    isActive: true,
    createdById: users[0].id,
  },
  {
    id: randomUUID(),
    nameEN: 'Hair Color',
    nameAR: 'صبغة',
    isActive: true,
    createdById: users[0].id,
  },
];

// ========== INVOICES / TRANSACTIONS ==========
// Creating invoices for all weeks in January 2024
export const invoices = [
  // Week 1 (Jan 1-7): 580 SAR
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[2].id,
    price: 40,
    date: new Date('2024-01-01'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    serviceId: services[1].id,
    staffId: users[3].id,
    price: 30,
    date: new Date('2024-01-02'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[3].id,
    staffId: users[2].id,
    price: 40,
    date: new Date('2024-01-03'),
    notes: 'Quick service',
  },
  {
    id: randomUUID(),
    serviceId: services[4].id,
    staffId: users[4].id,
    price: 40,
    date: new Date('2024-01-04'),
    notes: 'Styling for event',
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-05'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    serviceId: services[5].id,
    staffId: users[3].id,
    price: 40,
    date: new Date('2024-01-06'),
    notes: 'Color treatment',
  },
  {
    id: randomUUID(),
    serviceId: services[2].id,
    staffId: users[4].id,
    price: 40,
    date: new Date('2024-01-07'),
    notes: 'Full package service',
  },

  // Week 2 (Jan 8-14): 620 SAR
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-08'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[1].id,
    staffId: users[3].id,
    price: 40,
    date: new Date('2024-01-09'),
    notes: 'Customer request',
  },
  {
    id: randomUUID(),
    serviceId: services[4].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-10'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[4].id,
    price: 50,
    date: new Date('2024-01-11'),
    notes: 'Regular appointment',
  },
  {
    id: randomUUID(),
    serviceId: services[5].id,
    staffId: users[3].id,
    price: 40,
    date: new Date('2024-01-12'),
    notes: 'Premium color',
  },
  {
    id: randomUUID(),
    serviceId: services[3].id,
    staffId: users[2].id,
    price: 40,
    date: new Date('2024-01-13'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[1].id,
    staffId: users[4].id,
    price: 30,
    date: new Date('2024-01-14'),
    notes: 'Walk-in customer',
  },

  // Week 3 (Jan 15-21): 660 SAR
  {
    id: randomUUID(),
    serviceId: services[2].id,
    staffId: users[2].id,
    price: 20,
    date: new Date('2024-01-15'),
    notes: 'Special service',
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[3].id,
    price: 50,
    date: new Date('2024-01-16'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[4].id,
    staffId: users[2].id,
    price: 15,
    date: new Date('2024-01-17'),
    notes: 'Styling service',
  },
  {
    id: randomUUID(),
    serviceId: services[5].id,
    staffId: users[4].id,
    price: 40,
    date: new Date('2024-01-18'),
    notes: 'Hair color appointment',
  },
  {
    id: randomUUID(),
    serviceId: services[1].id,
    staffId: users[3].id,
    price: 40,
    date: new Date('2024-01-19'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-20'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    serviceId: services[3].id,
    staffId: users[4].id,
    price: 40,
    date: new Date('2024-01-21'),
    notes: null,
  },

  // Week 4 (Jan 22-28): 700 SAR
  {
    id: randomUUID(),
    serviceId: services[4].id,
    staffId: users[2].id,
    price: 60,
    date: new Date('2024-01-22'),
    notes: 'Styling',
  },
  {
    id: randomUUID(),
    serviceId: services[2].id,
    staffId: users[3].id,
    price: 150,
    date: new Date('2024-01-23'),
    notes: 'Full service',
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[4].id,
    price: 50,
    date: new Date('2024-01-24'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[5].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-25'),
    notes: 'Color treatment',
  },
  {
    id: randomUUID(),
    serviceId: services[1].id,
    staffId: users[3].id,
    price: 40,
    date: new Date('2024-01-26'),
    notes: 'Customer request',
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[2].id,
    price: 50,
    date: new Date('2024-01-27'),
    notes: 'Regular appointment',
  },
  {
    id: randomUUID(),
    serviceId: services[3].id,
    staffId: users[4].id,
    price: 40,
    date: new Date('2024-01-28'),
    notes: null,
  },

  // Week 5 (Jan 29-31): 290 SAR
  {
    id: randomUUID(),
    serviceId: services[4].id,
    staffId: users[2].id,
    price: 60,
    date: new Date('2024-01-29'),
    notes: null,
  },
  {
    id: randomUUID(),
    serviceId: services[0].id,
    staffId: users[3].id,
    price: 50,
    date: new Date('2024-01-30'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    serviceId: services[5].id,
    staffId: users[4].id,
    price: 100,
    date: new Date('2024-01-31'),
    notes: 'Month-end customer',
  },
];

// ========== WEEKLY REVENUE (Calculated) ==========
// Week 1: 50+75+40+60+50+100+150 = 525 SAR
// Week 2: 50+75+60+50+100+40+75 = 450 SAR
// Week 3: 150+50+60+100+75+50+40 = 525 SAR
// Week 4: 60+150+50+100+75+50+40 = 525 SAR
// Week 5: 60+50+100 = 210 SAR
// Total January: 2235 SAR
export const weeklyRevenue = [
  // January 2024
  {
    week: 'W1',
    year: 2024,
    month: 'Jan',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    revenue: 525,
  },
  {
    week: 'W2',
    year: 2024,
    month: 'Jan',
    startDate: '2024-01-08',
    endDate: '2024-01-14',
    revenue: 450,
  },
  {
    week: 'W3',
    year: 2024,
    month: 'Jan',
    startDate: '2024-01-15',
    endDate: '2024-01-21',
    revenue: 525,
  },
  {
    week: 'W4',
    year: 2024,
    month: 'Jan',
    startDate: '2024-01-22',
    endDate: '2024-01-28',
    revenue: 525,
  },
  {
    week: 'W5',
    year: 2024,
    month: 'Jan',
    startDate: '2024-01-29',
    endDate: '2024-01-31',
    revenue: 210,
  },
  // February 2024
  {
    week: 'W1',
    year: 2024,
    month: 'Feb',
    startDate: '2024-02-01',
    endDate: '2024-02-04',
    revenue: 240,
  },
  {
    week: 'W2',
    year: 2024,
    month: 'Feb',
    startDate: '2024-02-05',
    endDate: '2024-02-11',
    revenue: 620,
  },
  {
    week: 'W3',
    year: 2024,
    month: 'Feb',
    startDate: '2024-02-12',
    endDate: '2024-02-18',
    revenue: 680,
  },
  {
    week: 'W4',
    year: 2024,
    month: 'Feb',
    startDate: '2024-02-19',
    endDate: '2024-02-25',
    revenue: 660,
  },
  {
    week: 'W5',
    year: 2024,
    month: 'Feb',
    startDate: '2024-02-26',
    endDate: '2024-02-29',
    revenue: 200,
  },
  // March 2024
  {
    week: 'W1',
    year: 2024,
    month: 'Mar',
    startDate: '2024-03-01',
    endDate: '2024-03-03',
    revenue: 185,
  },
  {
    week: 'W2',
    year: 2024,
    month: 'Mar',
    startDate: '2024-03-04',
    endDate: '2024-03-10',
    revenue: 595,
  },
  {
    week: 'W3',
    year: 2024,
    month: 'Mar',
    startDate: '2024-03-11',
    endDate: '2024-03-17',
    revenue: 700,
  },
  {
    week: 'W4',
    year: 2024,
    month: 'Mar',
    startDate: '2024-03-18',
    endDate: '2024-03-24',
    revenue: 620,
  },
  {
    week: 'W5',
    year: 2024,
    month: 'Mar',
    startDate: '2024-03-25',
    endDate: '2024-03-31',
    revenue: 500,
  },
];

// ========== MONTHLY REVENUE SUMMARY ==========
export const monthlyRevenue = [
  { month: 'Jan', revenue: 2850 },
  { month: 'Feb', revenue: 3200 },
  { month: 'Mar', revenue: 3100 },
  { month: 'Apr', revenue: 3500 },
  { month: 'May', revenue: 3800 },
  { month: 'Jun', revenue: 4200 },
  { month: 'Jul', revenue: 4500 },
  { month: 'Aug', revenue: 4300 },
  { month: 'Sep', revenue: 3900 },
  { month: 'Oct', revenue: 4100 },
  { month: 'Nov', revenue: 4400 },
  { month: 'Dec', revenue: 5000 },
];