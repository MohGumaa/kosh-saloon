import { Tajawal, Cairo } from 'next/font/google';

export const tajawal = Tajawal({
	weight: ['400', '500', '700'],
	subsets: ['arabic'], // For Arabic language support
	display: 'swap',
});

export const cairo = Cairo({
  weight: ['400', '500', '700'],
  subsets: ['arabic'],
  display: 'swap',
});
