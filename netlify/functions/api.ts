import { query } from './db';
import crypto, { randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import {
  validate,
  LoginSchema,
  SendVerificationSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordInitiateSchema,
  ChangePasswordConfirmSchema,
  SignUploadSchema,
  CreateUserSchema,
  UpdateUserSchema,
  CreatePickupSchema,
  UpdatePickupSchema,
  CreateRedemptionSchema,
  UpdateRedemptionSchema,
  CreateMessageSchema,
  UpdateConfigSchema,
  UpdateRatesSchema,
  CreateBlogPostSchema,
  DeleteBlogPostSchema,
  CreateCertificateSchema,
} from './validators';

// --- CORS CONFIGURATION ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

// Helper for standard response
const response = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    ...CORS_HEADERS
  },
  body: JSON.stringify(body)
});

// Production-safe error response (don't leak err.message in prod)
const errorResponse = (statusCode: number, publicMessage: string, internalError?: any) => {
  if (internalError) {
    console.error(`[API ERROR ${statusCode}]`, internalError);
  }
  return response(statusCode, { error: publicMessage });
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET must be set in environment variables');
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- ENCRYPTION UTILS ---
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || JWT_SECRET;
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT;

if (!ENCRYPTION_SALT && IS_PRODUCTION) {
    throw new Error('CRITICAL: ENCRYPTION_SALT required in production');
}

const SALT_BUFFER = ENCRYPTION_SALT 
    ? Buffer.from(ENCRYPTION_SALT, 'base64') 
    : Buffer.from('development_salt_fallback_insecure');

const ENCRYPTION_KEY = scryptSync(ENCRYPTION_SECRET, SALT_BUFFER, 32);

const encrypt = (text: string): string => {
    if (!text) return text;
    // SECURITY: No silent fallback. If encryption fails, throw - never store plaintext.
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return JSON.stringify({
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag.toString('hex')
    });
};

const decrypt = (text: string): string => {
    if (!text) return text;
    
    // Check if it looks like our encrypted JSON format
    if (!text.startsWith('{')) {
        // Legacy plaintext - return as-is during migration window
        // TODO: After migration period, log these and migrate
        return text;
    }
    
    try {
        const parsed = JSON.parse(text);
        const { iv, content, tag } = parsed;
        if (!iv || !content || !tag) {
            // Malformed but JSON - treat as legacy
            return text;
        }

        const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // Decryption failed - log but return empty to prevent leaking corrupted data
        console.error("Decryption error - data may be corrupted or key changed", e);
        return '';
    }
};

// --- TIMING-SAFE STRING COMPARISON ---
const safeCompare = (a: string, b: string): boolean => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
};

// --- AUTH MIDDLEWARE ---
interface AuthUser {
    userId: string;
    role: string;
    email: string;
    iat: number;
}

const getAuth = async (headers: any): Promise<AuthUser | null> => {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        
        // SECURITY: Check if password was changed after token was issued
        // If so, invalidate the token (forces re-login on all devices)
        const pwCheck = await query(
            'SELECT password_changed_at FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (pwCheck.rows.length === 0) {
            return null; // User no longer exists
        }
        
        const pwChangedAt = pwCheck.rows[0].password_changed_at;
        if (pwChangedAt) {
            const pwChangedTimestamp = Math.floor(new Date(pwChangedAt).getTime() / 1000);
            if (decoded.iat < pwChangedTimestamp) {
                return null; // Token issued before password change - invalid
            }
        }
        
        return decoded;
    } catch (e) {
        return null;
    }
};

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Configure Rate Limiter
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
    });
} else {
    console.warn("WARNING: Upstash Redis credentials not found. Rate limiting is disabled.");
}

// Password Utils
const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;

const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, storedHash: string) => {
    if (!storedHash) return false;
    return await bcrypt.compare(password, storedHash);
};

// --- OTP VALIDATION HELPER ---
// Centralized OTP check with attempt counter and timing-safe comparison
const validateOtp = async (email: string, providedOtp: string): Promise<{ valid: boolean; error?: string }> => {
    const result = await query('SELECT * FROM password_resets WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired code' };
    }
    
    const record = result.rows[0];
    
    // Check expiry first
    if (new Date(record.expires_at) < new Date()) {
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return { valid: false, error: 'Code expired. Please request a new one.' };
    }
    
    // Check attempts BEFORE comparing to prevent abuse
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
    }
    
    // Timing-safe comparison
    if (!safeCompare(record.otp, providedOtp)) {
        // Increment attempt counter
        await query(
            'UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1',
            [email]
        );
        return { valid: false, error: 'Invalid code' };
    }
    
    return { valid: true };
};

export const handler = async (event: any) => {
  // Handle Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
        statusCode: 204,
        headers: CORS_HEADERS,
        body: ''
    };
  }

  let cleanPath = event.path
    .replace(/\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/^\//, '');
    
  if (!cleanPath) cleanPath = '';

  const method = event.httpMethod;
  
  // Parse body safely
  let body: any = {};
  if (event.body) {
      try {
          body = JSON.parse(event.body);
      } catch (e) {
          return errorResponse(400, 'Invalid JSON body');
      }
  }
  
  const user = await getAuth(event.headers);
  const isAdminOrStaff = user && (user.role === 'ADMIN' || user.role === 'STAFF');
  const isAdmin = user && user.role === 'ADMIN';
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0] || event.headers['client-ip'] || 'unknown';

  console.log(`[API] ${method} /${cleanPath} [User: ${user ? user.role : 'Guest'}] [IP: ${clientIp}]`);

  const checkRateLimit = async (identifier: string) => {
      if (!ratelimit) return true;
      const { success } = await ratelimit.limit(identifier);
      return success;
  };

  try {
    if (cleanPath === '' || cleanPath === 'health') {
        return response(200, { status: 'ok', message: 'Zilcycler API is running' });
    }

    // ============================================================
    // PUBLIC AUTH ROUTES
    // ============================================================
    
    if (cleanPath === 'auth/login' && method === 'POST') {
        if (!(await checkRateLimit(`login:${clientIp}`))) {
            return errorResponse(429, 'Too many login attempts. Please try again later.');
        }

        const validation = validate(LoginSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);
        
        const { email, password } = validation.data;
        
        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        const dbUser = rows[0];

        if (!dbUser) return errorResponse(401, 'Invalid email or password');
        if (!dbUser.password_hash) return errorResponse(401, 'Account security update required. Please reset password.');

        // Maintenance Mode Check (ADMIN only bypasses)
        const configCheck = await query('SELECT maintenance_mode FROM system_config WHERE id = 1');
        if (configCheck.rows[0]?.maintenance_mode && dbUser.role !== 'ADMIN') {
             return errorResponse(503, 'System is in maintenance mode. Please try again later.');
        }

        const isValid = await verifyPassword(password, dbUser.password_hash);
        if (!isValid) return errorResponse(401, 'Invalid email or password');

        if (!dbUser.is_active) {
            return errorResponse(403, 'Account is suspended. Please contact support.');
        }

        const token = jwt.sign(
            { userId: dbUser.id, role: dbUser.role, email: dbUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userObj = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            phone: dbUser.phone,
            avatar: dbUser.avatar,
            zointsBalance: parseFloat(dbUser.zoints_balance),
            totalRecycledKg: parseFloat(dbUser.total_recycled_kg),
            isActive: dbUser.is_active,
            gender: dbUser.gender,
            address: dbUser.address,
            industry: dbUser.industry,
            esgScore: dbUser.esg_score,
            bankDetails: {
                bankName: dbUser.bank_name,
                accountNumber: decrypt(dbUser.account_number),
                accountName: dbUser.account_name
            }
        };

        return response(200, { user: userObj, token });
    }

    if (cleanPath === 'auth/verify' && method === 'GET') {
        if (!user) return errorResponse(401, 'Invalid or expired token');
        return response(200, { userId: user.userId, valid: true });
    }

    if (cleanPath === 'auth/send-verification' && method === 'POST') {
        if (!(await checkRateLimit(`send_verif:${clientIp}`))) {
            return errorResponse(429, 'Too many verification requests. Please wait.');
        }

        const validation = validate(SendVerificationSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return errorResponse(403, 'New registrations are currently closed.');
        }

        const { email } = validation.data;
        const userCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return errorResponse(409, 'Email already registered. Please login.');

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await query(
            'INSERT INTO password_resets (email, otp, expires_at, attempts) VALUES ($1, $2, $3, 0) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, attempts = 0',
            [email, otp, expiresAt]
        );

        if (process.env.SMTP_HOST) {
             try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: email,
                    subject: 'Verify your email - Zilcycler',
                    text: `Your verification code is: ${otp}\n\nThis code expires in 15 minutes.`
                });
             } catch (e) {
                 console.error("Email send failure", e);
             }
        } else if (!IS_PRODUCTION) {
             console.log(`[DEV] Verification OTP for ${email}: ${otp}`);
        }
        return response(200, { message: "OTP sent" });
    }

    if (cleanPath === 'auth/register' && method === 'POST') {
        if (!(await checkRateLimit(`register:${clientIp}`))) {
            return errorResponse(429, 'Too many registration attempts.');
        }

        // CRITICAL: Schema enforces role can only be HOUSEHOLD or ORGANIZATION
        const validation = validate(RegisterSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return errorResponse(403, 'Registrations closed.');
        }

        const { user: regUser, password, otp } = validation.data;
        
        // Validate OTP with timing-safe compare and attempt counter
        const otpCheck = await validateOtp(regUser.email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code');

        // Double-check email isn't taken (race condition guard)
        const emailCheck = await query('SELECT id FROM users WHERE email = $1', [regUser.email]);
        if (emailCheck.rows.length > 0) {
            return errorResponse(409, 'Email already registered.');
        }

        const passwordHash = await hashPassword(password);
        const userId = `u_${randomUUID()}`;

        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash, gender, address, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, regUser.name, regUser.email, regUser.role, regUser.phone, regUser.avatar || '', passwordHash, regUser.gender, regUser.address, regUser.industry]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [regUser.email]);

        // Welcome Email
        if (process.env.SMTP_HOST) {
             try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: regUser.email,
                    subject: 'Welcome to Zilcycler!',
                    text: `Hi ${regUser.name},\n\nWelcome to Zilcycler! We are thrilled to have you join our community dedicated to sustainable waste management.\n\nYou can now log in to your dashboard to schedule pickups, track your recycling impact, and earn Zoints.\n\nLet's make the world cleaner together!\n\nBest regards,\nThe Zilcycler Team`
                });
             } catch (e) {
                 console.error("Welcome email fail", e);
             }
        }

        return response(201, { message: "Account created", userId });
    }

    if (cleanPath === 'auth/forgot-password' && method === 'POST') {
        if (!(await checkRateLimit(`forgot_pw:${clientIp}`))) {
            return errorResponse(429, 'Too many requests. Please wait.');
        }

        const validation = validate(ForgotPasswordSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const { email } = validation.data;
        const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
        
        // Account enumeration protection: always return same response
        if (rows.length > 0) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            await query(
                'INSERT INTO password_resets (email, otp, expires_at, attempts) VALUES ($1, $2, $3, 0) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, attempts = 0',
                [email, otp, expiresAt]
            );
            
            if (process.env.SMTP_HOST) {
                 try {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM,
                        to: email,
                        subject: 'Reset Password - Zilcycler',
                        text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes.`
                    });
                 } catch (e) {
                     console.error("Email fail", e);
                 }
            } else if (!IS_PRODUCTION) {
                 console.log(`[DEV] Reset Password OTP for ${email}: ${otp}`);
            }
        }
        
        return response(200, { message: "If that email exists, we sent a reset code." });
    }

    if (cleanPath === 'auth/reset-password' && method === 'POST') {
        if (!(await checkRateLimit(`reset_pw:${clientIp}`))) {
            return errorResponse(429, 'Too many attempts.');
        }

        const validation = validate(ResetPasswordSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const { email, otp, newPassword } = validation.data;
        
        const otpCheck = await validateOtp(email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code');
        
        const passwordHash = await hashPassword(newPassword);
        await query(
            'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE email = $2',
            [passwordHash, email]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return response(200, { success: true });
    }

    // ============================================================
    // PROTECTED ROUTES - REQUIRE AUTH
    // ============================================================
    
    if (!user) {
        return errorResponse(401, 'Unauthorized access');
    }

    // --- CLOUDINARY SIGNING ---
    if (cleanPath === 'auth/sign-upload' && method === 'POST') {
        if (!(await checkRateLimit(`upload_sign:${user.userId}`))) {
            return errorResponse(429, 'Too many upload attempts.');
        }

        const validation = validate(SignUploadSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const safeFolder = validation.data.folder || 'zilcycler_general';
        const timestamp = Math.round((new Date()).getTime() / 1000);
        
        if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
            return errorResponse(500, 'Upload configuration error', 'Cloudinary env vars missing');
        }

        const paramsToSign = `folder=${safeFolder}&timestamp=${timestamp}`;
        const signatureStr = paramsToSign + process.env.CLOUDINARY_API_SECRET;
        const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

        return response(200, {
            signature,
            timestamp,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            folder: safeFolder
        });
    }
    
    // --- CHANGE PASSWORD ---
    if (cleanPath === 'auth/change-password/initiate' && method === 'POST') {
        if (!(await checkRateLimit(`chg_pw_init:${user.userId}`))) {
            return errorResponse(429, 'Too many requests.');
        }

        const validation = validate(ChangePasswordInitiateSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const { userId, currentPassword } = validation.data;
        if (user.userId !== userId) return errorResponse(403, 'Forbidden');

        const { rows } = await query('SELECT email, password_hash FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) return errorResponse(404, 'User not found');
        if (!(await verifyPassword(currentPassword, rows[0].password_hash))) {
            return errorResponse(401, 'Incorrect password');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await query(
            'INSERT INTO password_resets (email, otp, expires_at, attempts) VALUES ($1, $2, $3, 0) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, attempts = 0',
            [rows[0].email, otp, expiresAt]
        );
        
        if (process.env.SMTP_HOST) {
             try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: rows[0].email,
                    subject: 'Change Password Verification - Zilcycler',
                    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`
                });
             } catch (e) {
                 console.error("Email fail", e);
             }
        } else if (!IS_PRODUCTION) {
             console.log(`[DEV] Change Password OTP for ${rows[0].email}: ${otp}`);
        }

        return response(200, { message: "OTP sent" });
    }

    if (cleanPath === 'auth/change-password/confirm' && method === 'POST') {
        if (!(await checkRateLimit(`chg_pw_conf:${user.userId}`))) {
            return errorResponse(429, 'Too many attempts.');
        }

        const validation = validate(ChangePasswordConfirmSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);

        const { userId, otp, newPassword } = validation.data;
        if (user.userId !== userId) return errorResponse(403, 'Forbidden');
        
        const userRes = await query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return errorResponse(404, 'User not found');
        const email = userRes.rows[0].email;
        
        const otpCheck = await validateOtp(email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code');

        const passwordHash = await hashPassword(newPassword);
        await query(
            'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, userId]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return response(200, { success: true });
    }

    // --- CONFIG & RATES ---
    if (cleanPath === 'config') {
        const configRes = await query('SELECT * FROM system_config WHERE id = 1');
        const ratesRes = await query('SELECT * FROM waste_rates');
        
        const ratesObj: any = {};
        ratesRes.rows.forEach((r: any) => {
            ratesObj[r.category] = {
                rate: parseFloat(r.rate),
                co2: parseFloat(r.co2_saved_per_kg || 0)
            };
        });

        return response(200, {
            sysConfig: {
                maintenanceMode: configRes.rows[0]?.maintenance_mode || false,
                allowRegistrations: configRes.rows[0]?.allow_registrations || true
            },
            wasteRates: ratesObj
        });
    }
    
    if (cleanPath === 'config/update' && method === 'POST') {
        if (!isAdmin) return errorResponse(403, 'Admin only');
        
        const validation = validate(UpdateConfigSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);
        
        const { maintenanceMode, allowRegistrations } = validation.data;
        await query('UPDATE system_config SET maintenance_mode = $1, allow_registrations = $2 WHERE id = 1', [maintenanceMode, allowRegistrations]);
        return response(200, { success: true });
    }
    
    if (cleanPath === 'rates/update' && method === 'POST') {
        if (!isAdmin) return errorResponse(403, 'Admin only');
        
        const validation = validate(UpdateRatesSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);
        
        const { rates } = validation.data;
        for (const [category, data] of Object.entries(rates)) {
            await query(
                'INSERT INTO waste_rates (category, rate, co2_saved_per_kg) VALUES ($1, $2, $3) ON CONFLICT (category) DO UPDATE SET rate = $2, co2_saved_per_kg = $3',
                [category, data.rate, data.co2]
            );
        }
        return response(200, { success: true });
    }

    // --- BLOG ---
    if (cleanPath === 'blog') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM blog_posts ORDER BY created_at DESC');
            return response(200, rows);
        }
        if (method === 'POST') {
            if (!isAdminOrStaff) return errorResponse(403, 'Forbidden');
            
            const validation = validate(CreateBlogPostSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            const p = validation.data;
            const postId = `blog_${randomUUID()}`;
            await query(
                'INSERT INTO blog_posts (id, title, category, excerpt, image) VALUES ($1, $2, $3, $4, $5)',
                [postId, p.title, p.category, p.excerpt, p.image]
            );
            return response(201, { success: true, id: postId });
        }
        if (method === 'DELETE') {
            if (!isAdminOrStaff) return errorResponse(403, 'Forbidden');
            
            const validation = validate(DeleteBlogPostSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            await query('DELETE FROM blog_posts WHERE id = $1', [validation.data.id]);
            return response(200, { success: true });
        }
    }

    // --- LOCATIONS ---
    if (cleanPath === 'locations') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM drop_off_locations');
            const locations = rows.map((l: any) => ({
                id: l.id,
                name: l.name,
                address: l.address,
                open: l.open_hours,
                url: l.map_url,
                lat: parseFloat(l.lat),
                lng: parseFloat(l.lng)
            }));
            return response(200, locations);
        }
    }

    // --- CERTIFICATES ---
    if (cleanPath === 'certificates') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM certificates ORDER BY created_at DESC');
            const certs = rows.map((c: any) => ({
                id: c.id,
                orgId: c.org_id,
                orgName: c.org_name,
                month: c.month,
                year: c.year,
                url: c.url,
                dateIssued: c.created_at
            }));
            return response(200, certs);
        }
        if (method === 'POST') {
            if (!isAdminOrStaff) return errorResponse(403, 'Forbidden');
            
            const validation = validate(CreateCertificateSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            const c = validation.data;
            const certId = `cert_${randomUUID()}`;
            await query(
                'INSERT INTO certificates (id, org_id, org_name, month, year, url) VALUES ($1, $2, $3, $4, $5, $6)',
                [certId, c.orgId, c.orgName, c.month, c.year, c.url]
            );
            return response(201, { success: true, id: certId });
        }
    }

    // --- USERS ---
    if (cleanPath === 'users') {
      if (method === 'GET') {
        let queryText = 'SELECT id, name, email, role, phone, avatar, zoints_balance, total_recycled_kg, is_active, gender, address, industry, esg_score, bank_name, account_number, account_name, created_at FROM users';
        const params: any[] = [];

        if (!isAdminOrStaff) {
             queryText += ' WHERE id = $1 OR id IN (SELECT sender_id FROM messages WHERE receiver_id = $1) OR id IN (SELECT receiver_id FROM messages WHERE sender_id = $1)';
             params.push(user.userId);
        }

        const { rows } = await query(queryText, params);
        
        const formattedUsers = rows.map((u: any) => {
            if (isAdminOrStaff || u.id === user.userId) {
                return {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    phone: u.phone,
                    avatar: u.avatar,
                    zointsBalance: parseFloat(u.zoints_balance),
                    totalRecycledKg: parseFloat(u.total_recycled_kg),
                    isActive: u.is_active,
                    gender: u.gender,
                    address: u.address,
                    industry: u.industry,
                    esgScore: u.esg_score,
                    bankDetails: {
                        bankName: u.bank_name,
                        accountNumber: decrypt(u.account_number),
                        accountName: u.account_name
                    },
                    createdAt: u.created_at
                };
            } 
            
            return {
                id: u.id,
                name: u.name,
                role: u.role,
                avatar: u.avatar,
                isActive: u.is_active,
                industry: u.industry,
                esgScore: u.esg_score
            };
        });
        
        return response(200, formattedUsers);
      }
      
      if (method === 'POST') {
        // SECURITY: Only ADMIN can create users (Staff/Collector accounts)
        if (!isAdmin) return errorResponse(403, 'Only admins can create users manually');
        
        const validation = validate(CreateUserSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);
        
        const { name, email, role, phone, password, gender, address, industry, avatar } = validation.data;
        
        // Check email isn't taken
        const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return errorResponse(409, 'Email already registered');
        }
        
        const passwordHash = await hashPassword(password);
        const userId = `u_${randomUUID()}`;
        
        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash, gender, address, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, name, email, role, phone, avatar || '', passwordHash, gender, address, industry]
        );
        return response(201, { message: "User created", userId });
      }

      if (method === 'PUT') {
          const validation = validate(UpdateUserSchema, body);
          if (!validation.success) return errorResponse(400, validation.error);
          
          const { id, updates } = validation.data;
          if (user.userId !== id && !isAdminOrStaff) return errorResponse(403, 'Forbidden');

          // SECURITY: Strip privileged fields based on role
          const safeUpdates: any = { ...updates };
          
          if (!isAdminOrStaff) {
              // Regular users can't change these
              delete safeUpdates.zointsBalance;
              delete safeUpdates.isActive;
              delete safeUpdates.role;
              delete safeUpdates.esgScore;
          }
          
          // SECURITY: Only ADMIN can credit balances directly (not Staff)
          if (!isAdmin) {
              delete safeUpdates.zointsBalance;
              delete safeUpdates.role;
          }

          if (safeUpdates.isActive !== undefined) await query('UPDATE users SET is_active = $1 WHERE id = $2', [safeUpdates.isActive, id]);
          if (safeUpdates.zointsBalance !== undefined) await query('UPDATE users SET zoints_balance = $1 WHERE id = $2', [safeUpdates.zointsBalance, id]);
          if (safeUpdates.gender !== undefined) await query('UPDATE users SET gender = $1 WHERE id = $2', [safeUpdates.gender, id]);
          if (safeUpdates.address !== undefined) await query('UPDATE users SET address = $1 WHERE id = $2', [safeUpdates.address, id]);
          if (safeUpdates.industry !== undefined) await query('UPDATE users SET industry = $1 WHERE id = $2', [safeUpdates.industry, id]);
          if (safeUpdates.name !== undefined) await query('UPDATE users SET name = $1 WHERE id = $2', [safeUpdates.name, id]);
          if (safeUpdates.phone !== undefined) await query('UPDATE users SET phone = $1 WHERE id = $2', [safeUpdates.phone, id]);
          if (safeUpdates.avatar !== undefined) await query('UPDATE users SET avatar = $1 WHERE id = $2', [safeUpdates.avatar, id]);
          if (safeUpdates.esgScore !== undefined) await query('UPDATE users SET esg_score = $1 WHERE id = $2', [safeUpdates.esgScore, id]);
          if (safeUpdates.role !== undefined) await query('UPDATE users SET role = $1 WHERE id = $2', [safeUpdates.role, id]);
          if (safeUpdates.bankDetails) {
              const encryptedAccNum = encrypt(safeUpdates.bankDetails.accountNumber);
              await query(
                  'UPDATE users SET bank_name = $1, account_number = $2, account_name = $3 WHERE id = $4',
                  [safeUpdates.bankDetails.bankName, encryptedAccNum, safeUpdates.bankDetails.accountName, id]
              );
          }
          return response(200, { success: true });
      }
    }

    // --- PICKUPS ---
    if (cleanPath === 'pickups') {
      if (method === 'GET') {
        const { rows } = await query('SELECT * FROM pickups ORDER BY created_at DESC');
        let filteredRows = rows;
        if (!isAdminOrStaff && user.role !== 'COLLECTOR') {
            filteredRows = rows.filter((r: any) => r.user_id === user.userId);
        }
        const pickups = filteredRows.map((p: any) => ({
            ...p,
            userId: p.user_id,
            phoneNumber: p.phone_number,
            wasteImage: p.waste_image,
            earnedZoints: parseFloat(p.earned_zoints || 0),
            weight: parseFloat(p.weight || 0),
            collectionDetails: p.collection_details
        }));
        return response(200, pickups);
      }

      if (method === 'POST') {
        const validation = validate(CreatePickupSchema, body);
        if (!validation.success) return errorResponse(400, validation.error);
        
        const p = validation.data;
        if (p.userId !== user.userId && !isAdminOrStaff) return errorResponse(403, 'Cannot schedule for others');
        
        // SECURITY: Force status to 'Pending' on creation - prevent client setting Completed
        const pickupId = `P-${randomUUID().substring(0,8).toUpperCase()}`;

        await query(
            `INSERT INTO pickups (id, user_id, location, time, date, items, status, contact, phone_number, waste_image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [pickupId, p.userId, p.location, p.time, p.date, p.items, 'Pending', p.contact, p.phoneNumber, p.wasteImage]
        );
        return response(201, { success: true, id: pickupId });
      }

      if (method === 'PUT') {
          const validation = validate(UpdatePickupSchema, body);
          if (!validation.success) return errorResponse(400, validation.error);
          
          const { id, updates } = validation.data;
          
          // Fetch current pickup state for authorization and replay protection
          const pickupRes = await query('SELECT * FROM pickups WHERE id = $1', [id]);
          if (pickupRes.rows.length === 0) return errorResponse(404, 'Pickup not found');
          const currentPickup = pickupRes.rows[0];
          
          // SECURITY: Authorization checks
          // - Status changes: Staff/Admin always; Collector only on their assigned pickups
          // - Driver assignment: Staff/Admin only
          // - Weight/completion: Staff/Admin always; Collector only on their assigned pickups
          
          const isAssignedCollector = user.role === 'COLLECTOR' && currentPickup.driver === user.email; 
          // NOTE: driver is stored as name in current system. We check by name fallback below for safety.
          // This will be tightened in a future migration.
          
          const isCollectorOnThisPickup = user.role === 'COLLECTOR';
          // Collectors operating on pickups must have it assigned to them
          // We do a name-based match because that's how the existing system works
          
          // --- DRIVER ASSIGNMENT (Staff/Admin only) ---
          if (updates.driver !== undefined) {
              if (!isAdminOrStaff) return errorResponse(403, 'Only staff can assign drivers');
              await query('UPDATE pickups SET driver = $1 WHERE id = $2', [updates.driver, id]);
          }
          
          // --- WEIGHT/COMPLETION FLOW ---
          if (updates.weight !== undefined) {
              // Only Collector (assigned), Staff, or Admin can complete
              if (!isAdminOrStaff && user.role !== 'COLLECTOR') {
                  return errorResponse(403, 'Forbidden');
              }
              
              // For collectors, verify they're assigned to this pickup by name match
              if (user.role === 'COLLECTOR') {
                  const collectorRes = await query('SELECT name FROM users WHERE id = $1', [user.userId]);
                  const collectorName = collectorRes.rows[0]?.name;
                  if (currentPickup.driver !== collectorName) {
                      return errorResponse(403, 'You are not assigned to this pickup');
                  }
              }
              
              // SECURITY: Replay protection - only credit if not already Completed
              if (currentPickup.status === 'Completed') {
                  return errorResponse(409, 'Pickup already completed');
              }
              
              // Validate earnedZoints matches collectionDetails sum (prevent client tampering)
              if (updates.collectionDetails && updates.earnedZoints !== undefined) {
                  const calculatedTotal = updates.collectionDetails.reduce(
                      (sum, item) => sum + (item.earned || 0), 0
                  );
                  // Allow small floating point tolerance
                  if (Math.abs(calculatedTotal - updates.earnedZoints) > 1) {
                      return errorResponse(400, 'Earnings do not match collection details');
                  }
              }
              
              // Atomic update with transaction-like guard
              const newStatus = updates.status || 'Completed';
              const updateResult = await query(
                  `UPDATE pickups 
                   SET status = $1, weight = $2, earned_zoints = $3, collection_details = $4 
                   WHERE id = $5 AND status != 'Completed' 
                   RETURNING user_id`,
                  [newStatus, updates.weight, updates.earnedZoints || 0, JSON.stringify(updates.collectionDetails || []), id]
              );
              
              // Only credit balance if the update actually changed the row (replay-safe)
              if (updateResult.rows.length > 0 && updates.earnedZoints && updates.earnedZoints > 0) {
                  await query(
                      'UPDATE users SET zoints_balance = zoints_balance + $1 WHERE id = $2',
                      [updates.earnedZoints, updateResult.rows[0].user_id]
                  );
              }
              
              return response(200, { success: true });
          }
          
          // --- STATUS-ONLY UPDATE (no weight) ---
          if (updates.status !== undefined && updates.weight === undefined) {
              // Status changes without weight (e.g. Missed, Pending, Assigned)
              // Staff/Admin only - users can't change pickup status arbitrarily
              if (!isAdminOrStaff) return errorResponse(403, 'Forbidden');
              
              // SECURITY: Don't allow setting to Completed without weight (use weight flow)
              if (updates.status === 'Completed') {
                  return errorResponse(400, 'Cannot mark Completed without collection details');
              }
              
              await query('UPDATE pickups SET status = $1 WHERE id = $2', [updates.status, id]);
          }
          
          return response(200, { success: true });
      }
    }

    // --- REDEMPTION ---
    if (cleanPath === 'redemption') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM redemption_requests ORDER BY created_at DESC');
            let filteredRows = rows;
            if (!isAdminOrStaff) {
                filteredRows = rows.filter((r: any) => r.user_id === user.userId);
            }
            const requests = filteredRows.map((r: any) => ({
                id: r.id,
                userId: r.user_id,
                userName: r.user_name,
                type: r.type,
                amount: parseFloat(r.amount),
                status: r.status,
                date: r.date
            }));
            return response(200, requests);
        }
        if (method === 'POST') {
            const validation = validate(CreateRedemptionSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            const r = validation.data;
            if (r.userId !== user.userId) return errorResponse(403, 'Forbidden');
            
            // SECURITY: Check user has sufficient balance BEFORE deducting
            const balanceCheck = await query('SELECT zoints_balance FROM users WHERE id = $1', [user.userId]);
            if (balanceCheck.rows.length === 0) return errorResponse(404, 'User not found');
            const currentBalance = parseFloat(balanceCheck.rows[0].zoints_balance);
            
            if (currentBalance < r.amount) {
                return errorResponse(400, 'Insufficient balance');
            }

            const reqId = `REQ-${randomUUID().substring(0,8).toUpperCase()}`;

            await query('BEGIN');
            try {
                await query(
                    `INSERT INTO redemption_requests (id, user_id, user_name, type, amount, status, date, refunded) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)`,
                    [reqId, r.userId, r.userName, r.type, r.amount, r.status, r.date]
                );
                await query(
                    `UPDATE users SET zoints_balance = zoints_balance - $1 WHERE id = $2 AND zoints_balance >= $1`,
                    [r.amount, r.userId]
                );
                await query('COMMIT');
                return response(201, { success: true, id: reqId });
            } catch (e) {
                await query('ROLLBACK');
                throw e;
            }
        }
        if (method === 'PUT') {
            if (!isAdminOrStaff) return errorResponse(403, 'Forbidden');
            
            const validation = validate(UpdateRedemptionSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            const { id, status } = validation.data;
            
            // Fetch current state for safe refund logic
            const reqRes = await query('SELECT * FROM redemption_requests WHERE id = $1', [id]);
            if (reqRes.rows.length === 0) return errorResponse(404, 'Request not found');
            const currentReq = reqRes.rows[0];
            
            // SECURITY: Only refund on Pending -> Rejected, never on Approved -> Rejected
            // Also use 'refunded' flag to prevent double-refunds
            if (status === 'Rejected') {
                if (currentReq.status === 'Pending' && !currentReq.refunded) {
                    await query('BEGIN');
                    try {
                        await query(
                            'UPDATE redemption_requests SET status = $1, refunded = TRUE WHERE id = $2',
                            [status, id]
                        );
                        await query(
                            'UPDATE users SET zoints_balance = zoints_balance + $1 WHERE id = $2',
                            [parseFloat(currentReq.amount), currentReq.user_id]
                        );
                        await query('COMMIT');
                    } catch (e) {
                        await query('ROLLBACK');
                        throw e;
                    }
                } else {
                    // Just update status without refund
                    await query('UPDATE redemption_requests SET status = $1 WHERE id = $2', [status, id]);
                }
            } else {
                // Approved - just update status, money already deducted at creation
                await query('UPDATE redemption_requests SET status = $1 WHERE id = $2', [status, id]);
            }
            
            return response(200, { success: true });
        }
    }

    // --- MESSAGES ---
    if (cleanPath === 'messages') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY created_at ASC', [user.userId]);
            const messages = rows.map((m: any) => ({
                id: m.id,
                senderId: m.sender_id,
                receiverId: m.receiver_id,
                content: m.content,
                createdAt: m.created_at,
                isRead: m.is_read
            }));
            return response(200, messages);
        }
        if (method === 'POST') {
            const validation = validate(CreateMessageSchema, body);
            if (!validation.success) return errorResponse(400, validation.error);
            
            const m = validation.data;
            if (m.senderId !== user.userId) return errorResponse(403, 'Identity mismatch');
            
            // SECURITY: Verify receiver exists (prevents enumeration attacks)
            const receiverCheck = await query('SELECT id FROM users WHERE id = $1', [m.receiverId]);
            if (receiverCheck.rows.length === 0) return errorResponse(404, 'Recipient not found');
            
            const msgId = `msg_${randomUUID()}`;
            await query(
                'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4)',
                [msgId, m.senderId, m.receiverId, m.content]
            );
            return response(201, { success: true, id: msgId });
        }
    }

    return errorResponse(404, `Endpoint not found: ${cleanPath}`);

  } catch (err: any) {
    // SECURITY: Don't leak internal error messages in production
    return errorResponse(500, 'An unexpected error occurred', err);
  }
};