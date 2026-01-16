export enum UserRole {
  HOUSEHOLD = 'HOUSEHOLD',
  COLLECTOR = 'COLLECTOR',
  ORGANIZATION = 'ORGANIZATION',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN'
}

export enum Screen {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  SCHEDULE_PICKUP = 'SCHEDULE_PICKUP',
  BLOG = 'BLOG',
  SETTINGS = 'SETTINGS',
  DROP_OFF = 'DROP_OFF',
  MESSAGES = 'MESSAGES',
  WALLET = 'WALLET',
  PICKUP_HISTORY = 'PICKUP_HISTORY'
}

export interface RecycledBreakdown {
  category: string;
  weight: number;
}

export interface CollectionItem {
  category: string;
  weight: number;
  rate: number;
  earned: number;
}

export interface WasteRates {
  [category: string]: number;
}

export interface SystemConfig {
  maintenanceMode: boolean;
  allowRegistrations: boolean;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  zointsBalance: number;
  totalRecycledKg?: number;
  recycledBreakdown?: RecycledBreakdown[];
  isActive?: boolean; // For Admin management
  email?: string;
  phone?: string;
  bankDetails?: BankDetails;
}

export interface PickupTask {
  id: string;
  userId: string; // Added to link task to user
  location: string;
  time: string;
  date: string;
  items: string;
  status: 'Pending' | 'Assigned' | 'Completed' | 'Missed';
  contact: string;
  phoneNumber?: string;
  driver?: string;
  wasteImage?: string; // URL for the uploaded image
  
  // Completion Details
  weight?: number; // Total weight
  earnedZoints?: number; // Total earned
  collectionDetails?: CollectionItem[]; // Granular breakdown
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
}

export interface StatData {
  name: string;
  value: number;
}

export interface RedemptionRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'Cash' | 'Charity';
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
}