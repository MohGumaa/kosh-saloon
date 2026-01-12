import { randomUUID } from 'crypto';

// ========== ADMIN USERS ==========
export const users = [
  {
    id: randomUUID(),
    name: 'Admin',
    email: 'admin@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/user-avatar.jpg',
    role: 'ADMIN',
  },
  {
    id: randomUUID(),
    name: 'عاصم',
    email: 'supervisor@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/img-0.png',
    role: 'SUPERVISOR',
  },
  {
    id: randomUUID(),
    name: 'العقرب',
    email: 'staff1@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/img-1.png',
    role: 'STAFF',
  },
  {
    id: randomUUID(),
    name: 'تامر',
    email: 'staff2@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/img-2.png',
    role: 'STAFF',
  },
  {
    id: randomUUID(),
    name: 'دي ماريا',
    email: 'staff3@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/img-3.png',
    role: 'STAFF',
  },
    {
    id: randomUUID(),
    name: 'مصعب',
    email: 'staff4@kosh-saloon.com',
    password: '123456',
    image_url: '/staff/img-4.png',
    role: 'STAFF',
  },
];

// ========== SALON SERVICES ==========
// These are main service categories that staff select when creating invoices
// Price and duration are added during invoice creation per customer/transaction
export const services = [
  {
    id: randomUUID(),
    name_en: 'Haircut',
    name_ar: 'حلاقة شعر',
    is_active: true,
    created_by_id: users[0].id,
  },
  {
    id: randomUUID(),
    name_en: 'Haircut with beard',
    name_ar: 'حلاقة شعر مع دقن',
    is_active: true,
    created_by_id: users[0].id,
  },
  {
    id: randomUUID(),
    name_en: 'Haircut with beard and hair color',
    name_ar: 'حلاقة شعر مع دقن و صبغة',
    is_active: true,
    created_by_id: users[0].id,
  },
  {
    id: randomUUID(),
    name_en: 'Beard',
    name_ar: 'دقن',
    is_active: true,
    created_by_id: users[0].id,
  },
  {
    id: randomUUID(),
    name_en: 'Hair Styling',
    name_ar: 'قطعية',
    is_active: true,
    created_by_id: users[0].id,
  },
  {
    id: randomUUID(),
    name_en: 'Hair Color',
    name_ar: 'صبغة',
    is_active: true,
    created_by_id: users[0].id,
  },
];

// ========== INVOICES / TRANSACTIONS ==========
// Creating invoices for all weeks in January 2025
export const invoices = [
  {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[2].id,
    amount: 40,
    date: new Date('2025-12-01'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[1].id,
    user_id: users[1].id,
    amount: 35,
    date: new Date('2025-12-02'),
    notes: null,
  },
  {
    id: randomUUID(),
    service_id: services[3].id,
    user_id: users[2].id,
    amount: 25,
    date: new Date('2025-12-03'),
    notes: 'Quick service',
  },
  {
    id: randomUUID(),
    service_id: services[4].id,
    user_id: users[4].id,
    amount: 40,
    date: new Date('2025-12-04'),
    notes: 'Styling for event',
  },
  {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[1].id,
    amount: 50,
    date: new Date('2025-12-05'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[5].id,
    user_id: users[3].id,
    amount: 10,
    date: new Date('2025-12-06'),
    notes: 'Color treatment',
  },
  {
    id: randomUUID(),
    service_id: services[3].id,
    user_id: users[3].id,
    amount: 40,
    date: new Date('2025-12-07'),
    notes: 'Full package service',
  },
    {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[4].id,
    amount: 40,
    date: new Date('2025-12-01'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[1].id,
    user_id: users[2].id,
    amount: 35,
    date: new Date('2025-12-02'),
    notes: null,
  },
  {
    id: randomUUID(),
    service_id: services[3].id,
    user_id: users[3].id,
    amount: 25,
    date: new Date('2025-12-03'),
    notes: 'Quick service',
  },
  {
    id: randomUUID(),
    service_id: services[3].id,
    user_id: users[2].id,
    amount: 40,
    date: new Date('2025-12-04'),
    notes: 'Styling for event',
  },
  {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[1].id,
    amount: 50,
    date: new Date('2025-12-05'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[5].id,
    user_id: users[2].id,
    amount: 10,
    date: new Date('2025-12-06'),
    notes: 'Color treatment',
  },
  {
    id: randomUUID(),
    service_id: services[2].id,
    user_id: users[2].id,
    amount: 40,
    date: new Date('2025-12-07'),
    notes: 'Full package service',
  },
    {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[2].id,
    amount: 40,
    date: new Date('2025-12-01'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[1].id,
    user_id: users[1].id,
    amount: 35,
    date: new Date('2025-12-02'),
    notes: null,
  },
  {
    id: randomUUID(),
    service_id: services[3].id,
    user_id: users[2].id,
    amount: 25,
    date: new Date('2025-12-03'),
    notes: 'Quick service',
  },
  {
    id: randomUUID(),
    service_id: services[4].id,
    user_id: users[4].id,
    amount: 40,
    date: new Date('2025-12-04'),
    notes: 'Styling for event',
  },
  {
    id: randomUUID(),
    service_id: services[0].id,
    user_id: users[1].id,
    amount: 50,
    date: new Date('2025-12-05'),
    notes: 'Regular customer',
  },
  {
    id: randomUUID(),
    service_id: services[5].id,
    user_id: users[3].id,
    amount: 10,
    date: new Date('2025-12-06'),
    notes: 'Color treatment',
  },
  {
    id: randomUUID(),
    service_id: services[2].id,
    user_id: users[2].id,
    amount: 40,
    date: new Date('2025-12-07'),
    notes: 'Full package service',
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
  {
    week: 'W1',
    year: 2025,
    month: 'Jan',
    startDate: '2025-12-01',
    endDate: '2025-12-07',
    revenue: 525,
  },
  {
    week: 'W2',
    year: 2025,
    month: 'Jan',
    startDate: '2025-12-08',
    endDate: '2025-12-14',
    revenue: 450,
  },
  {
    week: 'W3',
    year: 2025,
    month: 'Jan',
    startDate: '2025-12-15',
    endDate: '2025-12-21',
    revenue: 525,
  },
  {
    week: 'W4',
    year: 2025,
    month: 'Jan',
    startDate: '2025-12-22',
    endDate: '2025-12-28',
    revenue: 525,
  },
  {
    week: 'W5',
    year: 2025,
    month: 'Jan',
    startDate: '2025-12-29',
    endDate: '2025-12-31',
    revenue: 210,
  },
  {
    week: 'W1',
    year: 2025,
    month: 'Feb',
    startDate: '2025-02-01',
    endDate: '2025-02-04',
    revenue: 240,
  }
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