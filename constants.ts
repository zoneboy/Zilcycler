import { PickupTask, BlogPost, StatData } from './types';

export const ZOINTS_RATE_NAIRA = 15.50;

export const MOCK_PICKUPS: PickupTask[] = [
  {
    id: '1',
    userId: 'u1',
    location: 'Johnson Family, 12 Palm Ave',
    time: '10:00 AM',
    date: 'May 12, 2024',
    items: '15 Bottles',
    status: 'Pending',
    contact: 'Sarah Johnson'
  },
  {
    id: '2',
    userId: 'u2',
    location: 'Grace School, 45 Edu Lane',
    time: '11:30 AM',
    date: 'May 12, 2024',
    items: 'Mixed Paper (10kg)',
    status: 'Pending',
    contact: 'Admin Office'
  },
  {
    id: '3',
    userId: 'u3',
    location: 'Lekan Stores, Market Road',
    time: '01:00 PM',
    date: 'May 12, 2024',
    items: 'Plastic & Cans',
    status: 'Pending',
    contact: 'Mr. Lekan'
  },
  {
    id: '4',
    userId: 'u4',
    location: 'Okevor Estates',
    time: '10:00 AM',
    date: 'May 11, 2024',
    items: 'Glass',
    status: 'Missed',
    contact: 'Estate Manager'
  }
];

export const MOCK_BLOGS: BlogPost[] = [
  {
    id: '1',
    title: 'Best Ways to Segregate Your Waste',
    excerpt: 'Learn the color codes and best practices for separating your household waste efficiently.',
    image: 'https://picsum.photos/400/200?random=1',
    category: 'Tips'
  },
  {
    id: '2',
    title: 'Reducing Single-Use Plastics',
    excerpt: 'Simple swaps you can make today to reduce your plastic footprint forever.',
    image: 'https://picsum.photos/400/200?random=2',
    category: 'Lifestyle'
  },
  {
    id: '3',
    title: 'How ZOINTS Help the Community',
    excerpt: 'Your recycling efforts translate directly into charitable donations and community growth.',
    image: 'https://picsum.photos/400/200?random=3',
    category: 'Community'
  }
];

export const ADMIN_STATS: StatData[] = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 550 },
  { name: 'Thu', value: 450 },
  { name: 'Fri', value: 600 },
  { name: 'Sat', value: 800 },
  { name: 'Sun', value: 200 },
];