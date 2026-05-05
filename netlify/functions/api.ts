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
  DeleteAccountInitiateSchema,
  DeleteAccountConfirmSchema,
  LogErrorSchema,
  VersionCheckSchema,
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

// ============================================================
// CORS CONFIGURATION
// ============================================================
const ALLOWED_ORIGINS = [
  'https://zilcycler.netlify.app',
  'http://localhost:5173',
  'http://localhost:8888',
  'capacitor://localhost',
  'https://localhost',
];

const getCorsHeaders = (origin: string | undefined) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
};

const response = (statusCode: number, body: any, origin?: string) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    ...getCorsHeaders(origin)
  },
  body: JSON.stringify(body)
});

const errorResponse = (statusCode: number, publicMessage: string, internalError?: any, origin?: string) => {
  if (internalError) {
    console.error(`[API ERROR ${statusCode}]`, internalError);
  }
  return response(statusCode, { error: publicMessage }, origin);
};

// ============================================================
// SECRETS
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET must be set in environment variables');
}
if (JWT_SECRET.length < 32) {
  throw new Error('CRITICAL: JWT_SECRET must be at least 32 characters.');
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || JWT_SECRET;
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT;

if (!process.env.ENCRYPTION_KEY) {
  console.warn('SECURITY WARNING: ENCRYPTION_KEY not set, falling back to JWT_SECRET.');
}

if (!ENCRYPTION_SALT && IS_PRODUCTION) {
    throw new Error('CRITICAL: ENCRYPTION_SALT required in production');
}

const SALT_BUFFER = ENCRYPTION_SALT 
    ? Buffer.from(ENCRYPTION_SALT, 'base64') 
    : Buffer.from('development_salt_fallback_insecure');

const ENCRYPTION_KEY = scryptSync(ENCRYPTION_SECRET, SALT_BUFFER, 32);

const encrypt = (text: string): string => {
    if (!text) return text;
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
    if (!text.startsWith('{')) return text;
    
    try {
        const parsed = JSON.parse(text);
        const { iv, content, tag } = parsed;
        if (!iv || !content || !tag) return text;

        const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error("Decryption error", e);
        return '';
    }
};

const safeCompare = (a: string, b: string): boolean => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
};

// ============================================================
// AUDIT LOG HELPER
// ============================================================
const auditLog = async (params: {
    actorId: string | null;
    actorRole: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
    ipAddress?: string;
}) => {
    try {
        await query(
            `INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, metadata, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                params.actorId,
                params.actorRole,
                params.action,
                params.targetType || null,
                params.targetId || null,
                params.metadata ? JSON.stringify(params.metadata) : null,
                params.ipAddress || null,
            ]
        );
    } catch (e) {
        console.error('AUDIT LOG FAILURE:', e);
    }
};

// ============================================================
// VERSION COMPARISON HELPER
// ============================================================
const compareVersions = (a: string, b: string): number => {
    const partsA = a.split('.').map(n => parseInt(n) || 0);
    const partsB = b.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < 3; i++) {
        if (partsA[i] > partsB[i]) return 1;
        if (partsA[i] < partsB[i]) return -1;
    }
    return 0;
};

// --- AUTH MIDDLEWARE ---
interface AuthUser {
    userId: string;
    role: string;
    email: string;
    iat: number;
    tv?: number;
}

const getAuth = async (headers: any): Promise<AuthUser | null> => {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        
        // STAGE 2C: Also exclude soft-deleted users
        const userCheck = await query(
            'SELECT password_changed_at, token_version, is_active, deleted_at FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (userCheck.rows.length === 0) {
            return null;
        }
        
        const userRow = userCheck.rows[0];
        
        // Soft-deleted account
        if (userRow.deleted_at !== null) {
            return null;
        }
        
        if (userRow.is_active === false) {
            return null;
        }
        
        const pwChangedAt = userRow.password_changed_at;
        if (pwChangedAt) {
            const pwChangedTimestamp = Math.floor(new Date(pwChangedAt).getTime() / 1000);
            if (decoded.iat < pwChangedTimestamp) {
                return null;
            }
        }
        
        if (decoded.tv !== undefined && userRow.token_version !== decoded.tv) {
            return null;
        }
        
        return decoded;
    } catch (e) {
        return null;
    }
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ============================================================
// RATE LIMITERS
// ============================================================
let strictRatelimit: Ratelimit | null = null;
let standardRatelimit: Ratelimit | null = null;
let messagesRatelimit: Ratelimit | null = null;
let verifyRatelimit: Ratelimit | null = null;
let errorLogRatelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = Redis.fromEnv();
    strictRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'rl:strict',
    });
    standardRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'rl:std',
    });
    messagesRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
        prefix: 'rl:msg',
    });
    verifyRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        analytics: true,
        prefix: 'rl:verify',
    });
    // STAGE 2C: Cap error logging to prevent log spam
    errorLogRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
        prefix: 'rl:err',
    });
} else {
    console.warn("WARNING: Upstash Redis credentials not found. Rate limiting is disabled.");
}

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const TOKEN_EXPIRY = '12h';

const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, storedHash: string) => {
    if (!storedHash) return false;
    return await bcrypt.compare(password, storedHash);
};

const validateOtp = async (email: string, providedOtp: string): Promise<{ valid: boolean; error?: string }> => {
    const result = await query('SELECT * FROM password_resets WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired code' };
    }
    
    const record = result.rows[0];
    
    if (new Date(record.expires_at) < new Date()) {
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return { valid: false, error: 'Code expired. Please request a new one.' };
    }
    
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
    }
    
    if (!safeCompare(record.otp, providedOtp)) {
        await query(
            'UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1',
            [email]
        );
        return { valid: false, error: 'Invalid code' };
    }
    
    return { valid: true };
};

export const handler = async (event: any) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  
  if (event.httpMethod === 'OPTIONS') {
    return {
        statusCode: 204,
        headers: getCorsHeaders(origin),
        body: ''
    };
  }

  let cleanPath = event.path
    .replace(/\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/^\//, '');
    
  if (!cleanPath) cleanPath = '';

  const method = event.httpMethod;
  
  let body: any = {};
  if (event.body) {
      try {
          body = JSON.parse(event.body);
      } catch (e) {
          return errorResponse(400, 'Invalid JSON body', null, origin);
      }
  }
  
  const user = await getAuth(event.headers);
  const isAdminOrStaff = user && (user.role === 'ADMIN' || user.role === 'STAFF');
  const isAdmin = user && user.role === 'ADMIN';
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0] || event.headers['client-ip'] || 'unknown';

  console.log(`[API] ${method} /${cleanPath} [User: ${user ? user.role : 'Guest'}] [IP: ${clientIp}]`);

  const checkStrictLimit = async (id: string) => {
      if (!strictRatelimit) return true;
      const { success } = await strictRatelimit.limit(id);
      return success;
  };
  const checkStandardLimit = async (id: string) => {
      if (!standardRatelimit) return true;
      const { success } = await standardRatelimit.limit(id);
      return success;
  };
  const checkMessagesLimit = async (id: string) => {
      if (!messagesRatelimit) return true;
      const { success } = await messagesRatelimit.limit(id);
      return success;
  };
  const checkVerifyLimit = async (id: string) => {
      if (!verifyRatelimit) return true;
      const { success } = await verifyRatelimit.limit(id);
      return success;
  };
  const checkErrorLogLimit = async (id: string) => {
      if (!errorLogRatelimit) return true;
      const { success } = await errorLogRatelimit.limit(id);
      return success;
  };

  try {
    if (cleanPath === '' || cleanPath === 'health') {
        return response(200, { status: 'ok', message: 'Zilcycler API is running' }, origin);
    }

    // ============================================================
    // PUBLIC ROUTES (no auth required)
    // ============================================================
    
    // STAGE 2C: Version check (public, called on app launch)
    if (cleanPath === 'health/version' && method === 'POST') {
        const validation = validate(VersionCheckSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);
        
        const { platform, currentVersion } = validation.data;
        
        const versionRes = await query(
            'SELECT current_version, minimum_version, update_message, update_url FROM app_versions WHERE platform = $1',
            [platform]
        );
        
        if (versionRes.rows.length === 0) {
            // Platform not configured - assume OK
            return response(200, { 
                upToDate: true, 
                forceUpdate: false 
            }, origin);
        }
        
        const versionInfo = versionRes.rows[0];
        const isAtMinimum = compareVersions(currentVersion, versionInfo.minimum_version) >= 0;
        const isLatest = compareVersions(currentVersion, versionInfo.current_version) >= 0;
        
        return response(200, {
            upToDate: isLatest,
            forceUpdate: !isAtMinimum,
            currentVersion: versionInfo.current_version,
            minimumVersion: versionInfo.minimum_version,
            updateMessage: versionInfo.update_message,
            updateUrl: versionInfo.update_url,
        }, origin);
    }
    
    // STAGE 2C: Error logging (public but rate-limited; auth optional for user_id tracking)
    if (cleanPath === 'log/error' && method === 'POST') {
        // Rate limit by IP to prevent log spam
        if (!(await checkErrorLogLimit(`err:${clientIp}`))) {
            // Silently drop - don't tell client they're rate limited
            return response(200, { logged: false }, origin);
        }
        
        const validation = validate(LogErrorSchema, body);
        if (!validation.success) {
            // Don't fail loudly - just drop malformed errors
            return response(200, { logged: false }, origin);
        }
        
        const e = validation.data;
        
        try {
            await query(
                `INSERT INTO error_log (user_id, error_type, error_message, error_stack, user_agent, app_version, platform, url, metadata, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    user?.userId || null,
                    e.errorType,
                    e.errorMessage,
                    e.errorStack || null,
                    e.userAgent || null,
                    e.appVersion || null,
                    e.platform,
                    e.url || null,
                    e.metadata ? JSON.stringify(e.metadata) : null,
                    clientIp,
                ]
            );
            return response(200, { logged: true }, origin);
        } catch (err) {
            console.error('Failed to write error log:', err);
            return response(200, { logged: false }, origin);
        }
    }
    
    // CONFIG (public read)
    if (cleanPath === 'config' && method === 'GET') {
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
        }, origin);
    }

    // BLOG (public read)
    if (cleanPath === 'blog' && method === 'GET') {
        const { rows } = await query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        return response(200, rows, origin);
    }

    // LOCATIONS (public read)
    if (cleanPath === 'locations' && method === 'GET') {
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
        return response(200, locations, origin);
    }

    // ============================================================
    // PUBLIC AUTH ROUTES
    // ============================================================
    
    if (cleanPath === 'auth/login' && method === 'POST') {
        if (!(await checkStrictLimit(`login:${clientIp}`))) {
            return errorResponse(429, 'Too many login attempts. Please try again later.', null, origin);
        }

        const validation = validate(LoginSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);
        
        const { email, password } = validation.data;
        
        // STAGE 2C: Exclude soft-deleted users
        const { rows } = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
        const dbUser = rows[0];

        if (!dbUser) return errorResponse(401, 'Invalid email or password', null, origin);
        if (!dbUser.password_hash) return errorResponse(401, 'Account security update required. Please reset password.', null, origin);

        if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(dbUser.locked_until).getTime() - Date.now()) / 60000);
            return errorResponse(429, `Account temporarily locked. Try again in ${minutesLeft} minute(s).`, null, origin);
        }

        const configCheck = await query('SELECT maintenance_mode FROM system_config WHERE id = 1');
        if (configCheck.rows[0]?.maintenance_mode && dbUser.role !== 'ADMIN') {
             return errorResponse(503, 'System is in maintenance mode. Please try again later.', null, origin);
        }

        const isValid = await verifyPassword(password, dbUser.password_hash);
        
        if (!isValid) {
            const newFailedCount = (dbUser.failed_login_attempts || 0) + 1;
            
            if (newFailedCount >= MAX_LOGIN_ATTEMPTS) {
                const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                await query(
                    'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
                    [newFailedCount, lockUntil.toISOString(), dbUser.id]
                );
                
                await auditLog({
                    actorId: dbUser.id,
                    actorRole: dbUser.role,
                    action: 'ACCOUNT_LOCKED',
                    targetType: 'user',
                    targetId: dbUser.id,
                    metadata: { reason: 'failed_login_threshold', attempts: newFailedCount },
                    ipAddress: clientIp,
                });
                
                return errorResponse(429, `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts.`, null, origin);
            } else {
                await query(
                    'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
                    [newFailedCount, dbUser.id]
                );
            }
            
            return errorResponse(401, 'Invalid email or password', null, origin);
        }

        if (!dbUser.is_active) {
            return errorResponse(403, 'Account is suspended. Please contact support.', null, origin);
        }

        await query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [dbUser.id]
        );

        const tokenVersion = dbUser.token_version || 1;
        const token = jwt.sign(
            { userId: dbUser.id, role: dbUser.role, email: dbUser.email, tv: tokenVersion },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        await auditLog({
            actorId: dbUser.id,
            actorRole: dbUser.role,
            action: 'LOGIN_SUCCESS',
            targetType: 'user',
            targetId: dbUser.id,
            ipAddress: clientIp,
        });

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

        return response(200, { user: userObj, token }, origin);
    }

    if (cleanPath === 'auth/verify' && method === 'GET') {
        if (!(await checkVerifyLimit(`verify:${clientIp}`))) {
            return errorResponse(429, 'Too many requests', null, origin);
        }
        if (!user) return errorResponse(401, 'Invalid or expired token', null, origin);
        return response(200, { userId: user.userId, valid: true }, origin);
    }

    if (cleanPath === 'auth/send-verification' && method === 'POST') {
        if (!(await checkStrictLimit(`send_verif:${clientIp}`))) {
            return errorResponse(429, 'Too many verification requests. Please wait.', null, origin);
        }

        const validation = validate(SendVerificationSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return errorResponse(403, 'New registrations are currently closed.', null, origin);
        }

        const { email } = validation.data;
        // STAGE 2C: Allow re-registration with previously deleted account email
        const userCheck = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
        if (userCheck.rows.length > 0) return errorResponse(409, 'Email already registered. Please login.', null, origin);

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
        return response(200, { message: "OTP sent" }, origin);
    }

    if (cleanPath === 'auth/register' && method === 'POST') {
        if (!(await checkStrictLimit(`register:${clientIp}`))) {
            return errorResponse(429, 'Too many registration attempts.', null, origin);
        }

        const validation = validate(RegisterSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return errorResponse(403, 'Registrations closed.', null, origin);
        }

        const { user: regUser, password, otp } = validation.data;
        
        const otpCheck = await validateOtp(regUser.email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code', null, origin);

        // STAGE 2C: Check active accounts only
        const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [regUser.email]);
        if (emailCheck.rows.length > 0) {
            return errorResponse(409, 'Email already registered.', null, origin);
        }

        const passwordHash = await hashPassword(password);
        const userId = `u_${randomUUID()}`;

        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash, gender, address, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, regUser.name, regUser.email, regUser.role, regUser.phone, regUser.avatar || '', passwordHash, regUser.gender, regUser.address, regUser.industry]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [regUser.email]);

        await auditLog({
            actorId: userId,
            actorRole: regUser.role,
            action: 'USER_REGISTERED',
            targetType: 'user',
            targetId: userId,
            metadata: { email: regUser.email, role: regUser.role, acceptedTerms: true },
            ipAddress: clientIp,
        });

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

        return response(201, { message: "Account created", userId }, origin);
    }

    if (cleanPath === 'auth/forgot-password' && method === 'POST') {
        if (!(await checkStrictLimit(`forgot_pw:${clientIp}`))) {
            return errorResponse(429, 'Too many requests. Please wait.', null, origin);
        }

        const validation = validate(ForgotPasswordSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const { email } = validation.data;
        const { rows } = await query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
        
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
        
        return response(200, { message: "If that email exists, we sent a reset code." }, origin);
    }

    if (cleanPath === 'auth/reset-password' && method === 'POST') {
        if (!(await checkStrictLimit(`reset_pw:${clientIp}`))) {
            return errorResponse(429, 'Too many attempts.', null, origin);
        }

        const validation = validate(ResetPasswordSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const { email, otp, newPassword } = validation.data;
        
        const otpCheck = await validateOtp(email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code', null, origin);
        
        const passwordHash = await hashPassword(newPassword);
        const userRes = await query(
            'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, token_version = COALESCE(token_version, 1) + 1, failed_login_attempts = 0, locked_until = NULL WHERE email = $2 AND deleted_at IS NULL RETURNING id, role',
            [passwordHash, email]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        
        if (userRes.rows[0]) {
            await auditLog({
                actorId: userRes.rows[0].id,
                actorRole: userRes.rows[0].role,
                action: 'PASSWORD_RESET',
                targetType: 'user',
                targetId: userRes.rows[0].id,
                ipAddress: clientIp,
            });
        }
        
        return response(200, { success: true }, origin);
    }

    // ============================================================
    // PROTECTED ROUTES - REQUIRE AUTH
    // ============================================================
    
    if (!user) {
        return errorResponse(401, 'Unauthorized access', null, origin);
    }

    // STAGE 2C: ACCOUNT DELETION - INITIATE
    if (cleanPath === 'auth/delete-account/initiate' && method === 'POST') {
        if (!(await checkStrictLimit(`del_init:${user.userId}`))) {
            return errorResponse(429, 'Too many requests.', null, origin);
        }

        const validation = validate(DeleteAccountInitiateSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const { userId, password } = validation.data;
        if (user.userId !== userId) return errorResponse(403, 'Forbidden', null, origin);

        // Admin cannot self-delete (must use a different admin)
        if (user.role === 'ADMIN') {
            return errorResponse(403, 'Admin accounts cannot be self-deleted. Contact another administrator.', null, origin);
        }

        const { rows } = await query('SELECT email, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
        if (rows.length === 0) return errorResponse(404, 'User not found', null, origin);
        if (!(await verifyPassword(password, rows[0].password_hash))) {
            return errorResponse(401, 'Incorrect password', null, origin);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await query(
            'INSERT INTO password_resets (email, otp, expires_at, attempts) VALUES ($1, $2, $3, 0) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, attempts = 0',
            [rows[0].email, otp, expiresAt]
        );

        if (process.env.SMTP_HOST) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: rows[0].email,
                    subject: 'Confirm Account Deletion - Zilcycler',
                    text: `You requested to delete your Zilcycler account.\n\nVerification code: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did NOT request this, please change your password immediately and contact admin@zilcycler.com.\n\nWARNING: Deleting your account will:\n- Anonymize your personal information\n- Forfeit any unredeemed Zoints\n- Cannot be undone`
                });
            } catch (e) {
                console.error("Email fail", e);
            }
        } else if (!IS_PRODUCTION) {
            console.log(`[DEV] Delete Account OTP for ${rows[0].email}: ${otp}`);
        }

        return response(200, { message: "OTP sent. Check your email to confirm deletion." }, origin);
    }

    // STAGE 2C: ACCOUNT DELETION - CONFIRM
    if (cleanPath === 'auth/delete-account/confirm' && method === 'POST') {
        if (!(await checkStrictLimit(`del_conf:${user.userId}`))) {
            return errorResponse(429, 'Too many attempts.', null, origin);
        }

        const validation = validate(DeleteAccountConfirmSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const { userId, otp, reason } = validation.data;
        if (user.userId !== userId) return errorResponse(403, 'Forbidden', null, origin);

        if (user.role === 'ADMIN') {
            return errorResponse(403, 'Admin accounts cannot be self-deleted.', null, origin);
        }

        const userRes = await query('SELECT email, role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
        if (userRes.rows.length === 0) return errorResponse(404, 'User not found', null, origin);
        const email = userRes.rows[0].email;
        const userRole = userRes.rows[0].role;

        const otpCheck = await validateOtp(email, otp);
        if (!otpCheck.valid) return errorResponse(400, otpCheck.error || 'Invalid code', null, origin);

        // ============================================================
        // SOFT DELETE WITH ANONYMIZATION
        // ============================================================
        const anonId = `deleted_${randomUUID().substring(0, 8)}`;
        
        await query('BEGIN');
        try {
            // Anonymize the user record but keep the row for FK integrity
            await query(
                `UPDATE users SET 
                    name = $1,
                    email = $2,
                    phone = NULL,
                    avatar = NULL,
                    password_hash = NULL,
                    bank_name = NULL,
                    account_number = NULL,
                    account_name = NULL,
                    gender = NULL,
                    address = NULL,
                    is_active = FALSE,
                    deleted_at = CURRENT_TIMESTAMP,
                    deletion_reason = $3,
                    token_version = COALESCE(token_version, 1) + 1,
                    zoints_balance = 0
                 WHERE id = $4`,
                [`[Deleted User]`, `${anonId}@deleted.zilcycler`, reason || null, userId]
            );

            // Anonymize messages sent BY this user (keep messages received - other side may need context)
            await query(
                `UPDATE messages SET content = '[Message from deleted user]' WHERE sender_id = $1`,
                [userId]
            );

            // Cancel any pending pickups
            await query(
                `UPDATE pickups SET status = 'Missed' WHERE user_id = $1 AND status IN ('Pending', 'Assigned')`,
                [userId]
            );

            // Cancel any pending redemption requests (refunding doesn't matter since balance is zero now)
            await query(
                `UPDATE redemption_requests SET status = 'Rejected', refunded = TRUE WHERE user_id = $1 AND status = 'Pending'`,
                [userId]
            );

            await query('COMMIT');

            await auditLog({
                actorId: userId,
                actorRole: userRole,
                action: 'ACCOUNT_DELETED',
                targetType: 'user',
                targetId: userId,
                metadata: { reason: reason || 'no_reason_given' },
                ipAddress: clientIp,
            });

            await query('DELETE FROM password_resets WHERE email = $1', [email]);

            return response(200, { 
                success: true, 
                message: 'Your account has been deleted. Personal data has been anonymized.' 
            }, origin);
        } catch (e) {
            await query('ROLLBACK');
            throw e;
        }
    }

    // --- CLOUDINARY SIGNING ---
    if (cleanPath === 'auth/sign-upload' && method === 'POST') {
        if (!(await checkStandardLimit(`upload_sign:${user.userId}`))) {
            return errorResponse(429, 'Too many upload attempts.', null, origin);
        }

        const validation = validate(SignUploadSchema, body);
        if (!validation.success) return errorResponse(400, validation.error, null, origin);

        const safeFolder = validation.data.folder || 'zilcycler_general';
        const timestamp = Math.round((new Date()).getTime() / 1000);
        
        if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
            return errorResponse(500, 'Upload configuration error', 'Cloudinary env vars missing', origin);
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
        }, origin);
    }
    
    // --- CHANGE PASSWORD ---
    if (cleanPath === 'auth/change-password/initiate