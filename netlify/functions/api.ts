import { query } from './db';
import crypto, { randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

// Helper for standard response
const response = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*" // Allow CORS if needed
  },
  body: JSON.stringify(body)
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Prevent startup with insecure configuration
  throw new Error('CRITICAL: JWT_SECRET must be set in environment variables');
}

// --- ENCRYPTION UTILS ---
// Use a consistent key derived from env var. 
// In prod, ENCRYPTION_KEY should be set explicitly.
// We fall back to JWT_SECRET which is now guaranteed to exist.
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || JWT_SECRET;
const ENCRYPTION_KEY = scryptSync(ENCRYPTION_SECRET, 'salt', 32); // 32 bytes for aes-256-gcm

const encrypt = (text: string) => {
    if (!text) return text;
    try {
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
    } catch (e) {
        console.error("Encryption error", e);
        return text; // Fail safe, though technically insecure if fallback happens silently, but prevents data loss
    }
};

const decrypt = (text: string) => {
    if (!text) return text;
    try {
        // Attempt to parse as JSON (new format)
        // If it's legacy plain text, JSON.parse will likely throw or return structure missing keys
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return text; // Assume legacy plain text
        }

        const { iv, content, tag } = parsed;
        if (!iv || !content || !tag) return text; // Not our format

        const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // If decryption fails (wrong key or corrupted), return raw or empty
        console.error("Decryption error", e);
        return text; 
    }
};

// --- AUTH MIDDLEWARE ---
const getAuth = (headers: any) => {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, role: string, email: string };
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

// Configure Rate Limiter (Upstash Redis)
// Falls back to no-op if env vars are missing to allow dev without crashing, 
// but logs warning. In production, these should be set.
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute
        analytics: true,
    });
} else {
    console.warn("WARNING: Upstash Redis credentials not found. Rate limiting is disabled.");
}

// Password Utils
const SALT_ROUNDS = 12;

const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, storedHash: string) => {
    if (!storedHash) return false;
    return await bcrypt.compare(password, storedHash);
};

export const handler = async (event: any) => {
  let cleanPath = event.path
    .replace(/\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/^\//, '');
    
  if (!cleanPath) cleanPath = '';

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const user = getAuth(event.headers);

  // Helper to check if user is admin or staff
  const isAdminOrStaff = user && (user.role === 'ADMIN' || user.role === 'STAFF');
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0] || event.headers['client-ip'] || 'unknown';

  console.log(`[API] ${method} /${cleanPath} [User: ${user ? user.role : 'Guest'}] [IP: ${clientIp}]`);

  // Rate Limit Check Helper
  const checkRateLimit = async (identifier: string) => {
      if (!ratelimit) return true; // Fail open if config missing
      const { success } = await ratelimit.limit(identifier);
      return success;
  };

  try {
    if (cleanPath === '' || cleanPath === 'health') {
        return response(200, { status: 'ok', message: 'Zilcycler API is running' });
    }

    // --- PUBLIC AUTH ROUTES ---
    if (cleanPath === 'auth/login' && method === 'POST') {
        if (!(await checkRateLimit(`login:${clientIp}`))) {
            return response(429, { error: 'Too many login attempts. Please try again later.' });
        }

        const { email, password } = body;
        
        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        const dbUser = rows[0];

        if (!dbUser) return response(401, { error: "Invalid email or password" });
        if (!dbUser.password_hash) return response(401, { error: "Account security update required. Please reset password." });

        // Check Maintenance Mode (Backend Enforcement)
        const configCheck = await query('SELECT maintenance_mode FROM system_config WHERE id = 1');
        if (configCheck.rows[0]?.maintenance_mode && dbUser.role !== 'ADMIN' && dbUser.role !== 'STAFF') {
             return response(503, { error: "System is in maintenance mode. Staff access only." });
        }

        const isValid = await verifyPassword(password, dbUser.password_hash);
        if (!isValid) return response(401, { error: "Invalid email or password" });

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
                accountNumber: decrypt(dbUser.account_number), // Decrypt on read
                accountName: dbUser.account_name
            }
        };

        return response(200, { user: userObj, token });
    }

    if (cleanPath === 'auth/verify' && method === 'GET') {
        if (!user) return response(401, { error: 'Invalid or expired token' });
        return response(200, { userId: user.userId, valid: true });
    }

    if (cleanPath === 'auth/send-verification' && method === 'POST') {
        if (!(await checkRateLimit(`send_verif:${clientIp}`))) {
            return response(429, { error: 'Too many verification requests. Please wait.' });
        }

        // Check if registrations are allowed
        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return response(403, { error: "New registrations are currently closed." });
        }

        const { email } = body;
        const userCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return response(409, { error: "Email already registered. Please login." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await query(
            'INSERT INTO password_resets (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3',
            [email, otp, expiresAt]
        );

        if (process.env.SMTP_HOST) {
             try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: email,
                    subject: 'Verify your email - Zilcycler',
                    text: `Your verification code is: ${otp}`
                });
             } catch (e) {
                 console.error("Email fail", e);
             }
        } else if (process.env.NODE_ENV !== 'production') {
             console.log(`[DEV] Verification OTP for ${email}: ${otp}`);
        }
        return response(200, { message: "OTP sent" });
    }

    if (cleanPath === 'auth/register' && method === 'POST') {
        if (!(await checkRateLimit(`register:${clientIp}`))) {
            return response(429, { error: 'Too many registration attempts.' });
        }

        // Double check registration config
        const configCheck = await query('SELECT allow_registrations FROM system_config WHERE id = 1');
        if (!configCheck.rows[0]?.allow_registrations) {
             return response(403, { error: "Registrations closed." });
        }

        const { user: regUser, password, otp } = body;
        
        const otpCheck = await query('SELECT * FROM password_resets WHERE email = $1', [regUser.email]);
        if (otpCheck.rows.length === 0 || otpCheck.rows[0].otp !== otp) return response(400, { error: "Invalid code" });
        if (new Date(otpCheck.rows[0].expires_at) < new Date()) return response(400, { error: "Code expired" });

        const passwordHash = await hashPassword(password);
        // Generate Server-Side ID
        const userId = `u_${randomUUID()}`;

        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash, gender, address, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, regUser.name, regUser.email, regUser.role, regUser.phone, regUser.avatar || '', passwordHash, regUser.gender, regUser.address, regUser.industry]
        );
        await query('DELETE FROM password_resets WHERE email = $1', [regUser.email]);

        // --- Send Welcome Email ---
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
            return response(429, { error: 'Too many requests. Please wait.' });
        }

        const { email } = body;
        const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (rows.length === 0) return response(404, { error: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await query('INSERT INTO password_resets (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3', [email, otp, expiresAt]);
        
        if (process.env.SMTP_HOST) {
             try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: email,
                    subject: 'Reset Password - Zilcycler',
                    text: `Your password reset code is: ${otp}`
                });
             } catch (e) {
                 console.error("Email fail", e);
             }
        } else if (process.env.NODE_ENV !== 'production') {
             console.log(`[DEV] Reset Password OTP for ${email}: ${otp}`);
        }
        
        return response(200, { message: "OTP sent" });
    }

    if (cleanPath === 'auth/reset-password' && method === 'POST') {
        if (!(await checkRateLimit(`reset_pw:${clientIp}`))) {
            return response(429, { error: 'Too many attempts.' });
        }

        const { email, otp, newPassword } = body;
        const { rows } = await query('SELECT * FROM password_resets WHERE email = $1', [email]);
        if (rows.length === 0 || rows[0].otp !== otp) return response(400, { error: "Invalid code" });
        
        const passwordHash = await hashPassword(newPassword);
        await query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
        await query('DELETE FROM password_resets WHERE email = $1', [email]);
        return response(200, { success: true });
    }

    // --- PROTECTED ROUTES (ALL BELOW REQUIRE AUTH) ---
    if (!user) {
        return response(401, { error: "Unauthorized access" });
    }
    
    // Change Password
    if (cleanPath.startsWith('auth/change-password')) {
        if (cleanPath === 'auth/change-password/initiate' && method === 'POST') {
            if (!(await checkRateLimit(`chg_pw_init:${user.userId}`))) {
                return response(429, { error: 'Too many requests.' });
            }

            const { userId, currentPassword } = body;
            if (user.userId !== userId) return response(403, { error: "Forbidden" });

            const { rows } = await query('SELECT email, password_hash FROM users WHERE id = $1', [userId]);
            if (!(await verifyPassword(currentPassword, rows[0].password_hash))) return response(401, { error: "Incorrect password" });

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            await query('INSERT INTO password_resets (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3', [rows[0].email, otp, expiresAt]);
            
            if (process.env.SMTP_HOST) {
                 try {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM,
                        to: rows[0].email,
                        subject: 'Change Password Verification - Zilcycler',
                        text: `Your verification code is: ${otp}`
                    });
                 } catch (e) {
                     console.error("Email fail", e);
                 }
            } else if (process.env.NODE_ENV !== 'production') {
                 console.log(`[DEV] Change Password OTP for ${rows[0].email}: ${otp}`);
            }

            return response(200, { message: "OTP sent" });
        }

        if (cleanPath === 'auth/change-password/confirm' && method === 'POST') {
            if (!(await checkRateLimit(`chg_pw_conf:${user.userId}`))) {
                return response(429, { error: 'Too many attempts.' });
            }

            const { userId, otp, newPassword } = body;
            if (user.userId !== userId) return response(403, { error: "Forbidden" });
            
            const userRes = await query('SELECT email FROM users WHERE id = $1', [userId]);
            const email = userRes.rows[0].email;
            
            const { rows } = await query('SELECT * FROM password_resets WHERE email = $1', [email]);
            if (rows.length === 0 || rows[0].otp !== otp) return response(400, { error: "Invalid code" });

            const passwordHash = await hashPassword(newPassword);
            await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
            await query('DELETE FROM password_resets WHERE email = $1', [email]);
            return response(200, { success: true });
        }
    }

    // CONFIG & RATES (Protected Read, Admin Write)
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
        if (user.role !== 'ADMIN') return response(403, { error: "Admin only" });
        const { maintenanceMode, allowRegistrations } = body;
        await query('UPDATE system_config SET maintenance_mode = $1, allow_registrations = $2 WHERE id = 1', [maintenanceMode, allowRegistrations]);
        return response(200, { success: true });
    }
    
    if (cleanPath === 'rates/update' && method === 'POST') {
        if (user.role !== 'ADMIN') return response(403, { error: "Admin only" });
        const { rates } = body;
        for (const [category, data] of Object.entries(rates)) {
            const typedData = data as any; 
            await query('INSERT INTO waste_rates (category, rate, co2_saved_per_kg) VALUES ($1, $2, $3) ON CONFLICT (category) DO UPDATE SET rate = $2, co2_saved_per_kg = $3', [category, typedData.rate, typedData.co2]);
        }
        return response(200, { success: true });
    }

    // BLOG (Protected Read, Admin Write)
    if (cleanPath === 'blog') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM blog_posts ORDER BY created_at DESC');
            return response(200, rows);
        }
        if (method === 'POST') {
            if (!isAdminOrStaff) return response(403, { error: "Forbidden" });
            const p = body;
            const postId = `blog_${randomUUID()}`;
            await query('INSERT INTO blog_posts (id, title, category, excerpt, image) VALUES ($1, $2, $3, $4, $5)', [postId, p.title, p.category, p.excerpt, p.image]);
            return response(201, { success: true, id: postId });
        }
        if (method === 'DELETE') {
            if (!isAdminOrStaff) return response(403, { error: "Forbidden" });
            const { id } = body;
            await query('DELETE FROM blog_posts WHERE id = $1', [id]);
            return response(200, { success: true });
        }
    }

    // LOCATIONS (Protected Read)
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

    // CERTIFICATES (Protected Read, Admin Write)
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
            if (!isAdminOrStaff) return response(403, { error: "Forbidden" });
            const c = body;
            const certId = `cert_${randomUUID()}`;
            await query(
                'INSERT INTO certificates (id, org_id, org_name, month, year, url) VALUES ($1, $2, $3, $4, $5, $6)',
                [certId, c.orgId, c.orgName, c.month, c.year, c.url]
            );
            return response(201, { success: true, id: certId });
        }
    }

    // USERS
    if (cleanPath === 'users') {
      if (method === 'GET') {
        let queryText = 'SELECT id, name, email, role, phone, avatar, zoints_balance, total_recycled_kg, is_active, gender, address, industry, esg_score, bank_name, account_number, account_name, created_at FROM users';
        const params: any[] = [];

        // RBAC: Admin/Staff see all. Others see themselves OR people they've chatted with (for message history context).
        if (!isAdminOrStaff) {
             queryText += ' WHERE id = $1 OR id IN (SELECT sender_id FROM messages WHERE receiver_id = $1) OR id IN (SELECT receiver_id FROM messages WHERE sender_id = $1)';
             params.push(user.userId);
        }

        const { rows } = await query(queryText, params);
        
        const formattedUsers = rows.map((u: any) => {
            // Full Data for Admin, Staff, or Own Profile
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
                        accountNumber: decrypt(u.account_number), // Decrypt on read
                        accountName: u.account_name
                    },
                    createdAt: u.created_at
                };
            } 
            
            // Restricted Data for Others (Public Profile)
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
        if (user.role !== 'ADMIN') return response(403, { error: "Only admins can create users manually" });
        const { name, email, role, phone, password, gender, address, industry, avatar } = body;
        const passwordHash = password ? await hashPassword(password) : null;
        const userId = `u_${randomUUID()}`;
        
        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash, gender, address, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, name, email, role, phone, avatar || '', passwordHash, gender, address, industry]
        );
        return response(201, { message: "User created", userId });
      }

      if (method === 'PUT') {
          const { id, updates } = body;
          if (user.userId !== id && !isAdminOrStaff) return response(403, { error: "Forbidden" });

          if (!isAdminOrStaff) {
              delete updates.zointsBalance;
              delete updates.isActive;
              delete updates.role;
              delete updates.esgScore;
          }

          if (updates.isActive !== undefined) await query('UPDATE users SET is_active = $1 WHERE id = $2', [updates.isActive, id]);
          if (updates.zointsBalance !== undefined) await query('UPDATE users SET zoints_balance = $1 WHERE id = $2', [updates.zointsBalance, id]);
          if (updates.gender !== undefined) await query('UPDATE users SET gender = $1 WHERE id = $2', [updates.gender, id]);
          if (updates.address !== undefined) await query('UPDATE users SET address = $1 WHERE id = $2', [updates.address, id]);
          if (updates.industry !== undefined) await query('UPDATE users SET industry = $1 WHERE id = $2', [updates.industry, id]);
          if (updates.name !== undefined) await query('UPDATE users SET name = $1 WHERE id = $2', [updates.name, id]);
          if (updates.phone !== undefined) await query('UPDATE users SET phone = $1 WHERE id = $2', [updates.phone, id]);
          if (updates.avatar !== undefined) await query('UPDATE users SET avatar = $1 WHERE id = $2', [updates.avatar, id]);
          if (updates.esgScore !== undefined) await query('UPDATE users SET esg_score = $1 WHERE id = $2', [updates.esgScore, id]);
          if (updates.bankDetails) {
              // Encrypt Account Number before storage
              const encryptedAccNum = encrypt(updates.bankDetails.accountNumber);
              await query(
                  'UPDATE users SET bank_name = $1, account_number = $2, account_name = $3 WHERE id = $4',
                  [updates.bankDetails.bankName, encryptedAccNum, updates.bankDetails.accountName, id]
              );
          }
          return response(200, { success: true });
      }
    }

    // PICKUPS
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
        const p = body;
        if (p.userId !== user.userId && !isAdminOrStaff) return response(403, { error: "Cannot schedule for others" });
        
        const pickupId = `P-${randomUUID().substring(0,8).toUpperCase()}`;

        await query(
            `INSERT INTO pickups (id, user_id, location, time, date, items, status, contact, phone_number, waste_image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [pickupId, p.userId, p.location, p.time, p.date, p.items, p.status, p.contact, p.phoneNumber, p.wasteImage]
        );
        return response(201, { success: true, id: pickupId });
      }

      if (method === 'PUT') {
          const { id, updates } = body;
          if (updates.status) await query('UPDATE pickups SET status = $1 WHERE id = $2', [updates.status, id]);
          if (updates.driver) await query('UPDATE pickups SET driver = $1 WHERE id = $2', [updates.driver, id]);
          if (updates.weight) {
              if (user.role === 'HOUSEHOLD' || user.role === 'ORGANIZATION') return response(403, { error: "Forbidden" });

              await query(
                  'UPDATE pickups SET status=$1, weight=$2, earned_zoints=$3, collection_details=$4 WHERE id=$5',
                  [updates.status, updates.weight, updates.earnedZoints, JSON.stringify(updates.collectionDetails), id]
              );
              const pickupRes = await query('SELECT user_id FROM pickups WHERE id = $1', [id]);
              if(pickupRes.rows[0]) {
                  await query('UPDATE users SET zoints_balance = zoints_balance + $1 WHERE id = $2', [updates.earnedZoints, pickupRes.rows[0].user_id]);
              }
          }
          return response(200, { success: true });
      }
    }

    // REDEMPTION
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
            const r = body;
            if (r.userId !== user.userId) return response(403, { error: "Forbidden" });

            const reqId = `REQ-${randomUUID().substring(0,8).toUpperCase()}`;

            await query('BEGIN');
            try {
                await query(
                    `INSERT INTO redemption_requests (id, user_id, user_name, type, amount, status, date) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [reqId, r.userId, r.userName, r.type, r.amount, r.status, r.date]
                );
                await query(`UPDATE users SET zoints_balance = zoints_balance - $1 WHERE id = $2`, [r.amount, r.userId]);
                await query('COMMIT');
                return response(201, { success: true, id: reqId });
            } catch (e) {
                await query('ROLLBACK');
                throw e;
            }
        }
        if (method === 'PUT') {
            if (!isAdminOrStaff) return response(403, { error: "Forbidden" });
            const { id, status } = body;
            await query('UPDATE redemption_requests SET status = $1 WHERE id = $2', [status, id]);
            if (status === 'Rejected') {
                const req = await query('SELECT user_id, amount FROM redemption_requests WHERE id = $1', [id]);
                if (req.rows[0]) {
                    await query('UPDATE users SET zoints_balance = zoints_balance + $1 WHERE id = $2', [req.rows[0].amount, req.rows[0].user_id]);
                }
            }
            return response(200, { success: true });
        }
    }

    // MESSAGES
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
            const m = body;
            if (m.senderId !== user.userId) return response(403, { error: "Identity mismatch" });
            const msgId = `msg_${randomUUID()}`;
            await query(
                'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4)',
                [msgId, m.senderId, m.receiverId, m.content]
            );
            return response(201, { success: true, id: msgId });
        }
    }

    return response(404, { error: `Endpoint not found: ${cleanPath}` });

  } catch (err: any) {
    console.error("API Error", err);
    return response(500, { error: err.message });
  }
};