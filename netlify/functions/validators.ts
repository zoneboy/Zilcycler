import { z } from 'zod';

// ============================================================
// ZILCYCLER INPUT VALIDATORS
// Centralized Zod schemas for all API endpoints
// ============================================================

// --- Role Enums ---
// Roles a user is allowed to self-register as via public signup
export const PublicRegistrationRoleSchema = z.enum(['HOUSEHOLD', 'ORGANIZATION']);

// All valid roles (used for admin-created accounts)
export const UserRoleSchema = z.enum(['HOUSEHOLD', 'ORGANIZATION', 'COLLECTOR', 'STAFF', 'ADMIN']);

// Pickup statuses
export const PickupStatusSchema = z.enum(['Pending', 'Assigned', 'Completed', 'Missed']);

// Redemption statuses
export const RedemptionStatusSchema = z.enum(['Pending', 'Approved', 'Rejected']);

// --- Common Field Schemas ---
const EmailSchema = z.string().trim().toLowerCase().email('Invalid email format').max(255);
const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);
const PhoneSchema = z.string().trim().regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid phone number');
const OtpSchema = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');
const NameSchema = z.string().trim().min(1, 'Name is required').max(255);
const UrlSchema = z.string().url('Invalid URL').max(2000).optional();
const SafeStringSchema = z.string().trim().max(500);
const LongTextSchema = z.string().trim().max(5000);

// --- Auth Endpoint Schemas ---

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const SendVerificationSchema = z.object({
  email: EmailSchema,
});

export const RegisterSchema = z.object({
  user: z.object({
    name: NameSchema,
    email: EmailSchema,
    phone: PhoneSchema,
    // CRITICAL: Only HOUSEHOLD and ORGANIZATION allowed via public registration
    role: PublicRegistrationRoleSchema,
    avatar: z.string().max(2000).optional().default(''),
    gender: z.string().trim().max(50).optional().default(''),
    address: SafeStringSchema.optional().default(''),
    industry: z.string().trim().max(100).optional().default(''),
  }),
  password: PasswordSchema,
  otp: OtpSchema,
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  email: EmailSchema,
  otp: OtpSchema,
  newPassword: PasswordSchema,
});

export const ChangePasswordInitiateSchema = z.object({
  userId: z.string().min(1).max(255),
  currentPassword: z.string().min(1).max(128),
});

export const ChangePasswordConfirmSchema = z.object({
  userId: z.string().min(1).max(255),
  otp: OtpSchema,
  newPassword: PasswordSchema,
});

export const SignUploadSchema = z.object({
  folder: z.string().trim().regex(/^[a-zA-Z0-9_]+$/, 'Folder name must be alphanumeric').max(100).optional(),
});

// --- User Endpoint Schemas ---

export const CreateUserSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  // Admins can create any role except another ADMIN (defensive)
  role: z.enum(['HOUSEHOLD', 'ORGANIZATION', 'COLLECTOR', 'STAFF']),
  phone: PhoneSchema,
  password: PasswordSchema,
  gender: z.string().trim().max(50).optional().default(''),
  address: SafeStringSchema.optional().default(''),
  industry: z.string().trim().max(100).optional().default(''),
  avatar: z.string().max(2000).optional().default(''),
});

export const BankDetailsSchema = z.object({
  bankName: z.string().trim().max(100),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Account number must be 6-20 digits'),
  accountName: z.string().trim().max(255),
});

export const UpdateUserSchema = z.object({
  id: z.string().min(1).max(255),
  updates: z.object({
    name: NameSchema.optional(),
    phone: PhoneSchema.optional(),
    avatar: z.string().max(2000).optional(),
    gender: z.string().trim().max(50).optional(),
    address: SafeStringSchema.optional(),
    industry: z.string().trim().max(100).optional(),
    // Privileged fields - role check enforced in handler
    isActive: z.boolean().optional(),
    zointsBalance: z.number().min(0).max(10_000_000).optional(),
    role: UserRoleSchema.optional(),
    esgScore: z.string().trim().max(10).optional(),
    bankDetails: BankDetailsSchema.optional(),
  }),
});

// --- Pickup Endpoint Schemas ---

export const CreatePickupSchema = z.object({
  userId: z.string().min(1).max(255),
  location: SafeStringSchema.min(1, 'Location is required'),
  time: z.string().trim().max(50),
  date: z.string().trim().max(50),
  items: SafeStringSchema.min(1, 'Items are required'),
  status: PickupStatusSchema,
  contact: z.string().trim().max(255),
  phoneNumber: PhoneSchema.optional(),
  wasteImage: z.string().max(2000).optional(),
});

export const CollectionItemSchema = z.object({
  category: z.string().trim().min(1).max(100),
  weight: z.number().min(0).max(10000),
  rate: z.number().min(0).max(10000),
  earned: z.number().min(0).max(10_000_000),
});

export const UpdatePickupSchema = z.object({
  id: z.string().min(1).max(255),
  updates: z.object({
    status: PickupStatusSchema.optional(),
    driver: z.string().trim().max(255).optional(),
    weight: z.number().min(0).max(100000).optional(),
    earnedZoints: z.number().min(0).max(10_000_000).optional(),
    collectionDetails: z.array(CollectionItemSchema).max(50).optional(),
  }),
});

// --- Redemption Endpoint Schemas ---

export const CreateRedemptionSchema = z.object({
  userId: z.string().min(1).max(255),
  userName: NameSchema,
  type: z.enum(['Cash', 'Charity']),
  amount: z.number().int().min(500, 'Minimum redemption is 500 Z').max(10_000_000),
  status: z.literal('Pending'),
  date: z.string().trim().max(50),
});

export const UpdateRedemptionSchema = z.object({
  id: z.string().min(1).max(255),
  status: z.enum(['Approved', 'Rejected']),
});

// --- Message Endpoint Schemas ---

export const CreateMessageSchema = z.object({
  senderId: z.string().min(1).max(255),
  receiverId: z.string().min(1).max(255),
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000),
});

// --- Config & Rates Endpoint Schemas ---

export const UpdateConfigSchema = z.object({
  maintenanceMode: z.boolean(),
  allowRegistrations: z.boolean(),
});

export const WasteRateSchema = z.object({
  rate: z.number().min(0).max(100000),
  co2: z.number().min(0).max(10000),
});

export const UpdateRatesSchema = z.object({
  rates: z.record(z.string().trim().max(100), WasteRateSchema),
});

// --- Blog Endpoint Schemas ---

export const CreateBlogPostSchema = z.object({
  title: z.string().trim().min(1).max(500),
  category: z.string().trim().max(100),
  excerpt: LongTextSchema,
  image: z.string().max(2000),
});

export const DeleteBlogPostSchema = z.object({
  id: z.string().min(1).max(255),
});

// --- Certificate Endpoint Schemas ---

export const CreateCertificateSchema = z.object({
  orgId: z.string().min(1).max(255),
  orgName: NameSchema,
  month: z.string().trim().max(20),
  year: z.number().int().min(2020).max(2100),
  url: z.string().url().max(2000),
});

// --- Helper: safe parse with formatted error ---
export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return first error message for clean API response
  const firstError = result.error.errors[0];
  const path = firstError.path.join('.');
  const msg = path ? `${path}: ${firstError.message}` : firstError.message;
  return { success: false, error: msg };
};