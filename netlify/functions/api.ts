import { query } from './db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Helper for standard response
const response = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*" // Allow CORS if needed
  },
  body: JSON.stringify(body)
});

// Configure Nodemailer Transporter
// Note: These values are read automatically from Netlify Environment Variables in production
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Password Utils
const hashPassword = (password: string) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string) => {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
};

export const handler = async (event: any) => {
  let cleanPath = event.path
    .replace(/\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/^\//, '');
    
  if (!cleanPath) cleanPath = '';

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  console.log(`[API] ${method} /${cleanPath}`);

  try {
    if (cleanPath === '' || cleanPath === 'health') {
        return response(200, { status: 'ok', message: 'Zilcycler API is running' });
    }

    // --- AUTHENTICATION ---
    if (cleanPath === 'auth/login' && method === 'POST') {
        const { email, password } = body;
        
        // 1. Fetch user by email
        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return response(401, { error: "Invalid email or password" });
        }

        // 2. Verify Password
        if (!user.password_hash) {
             return response(401, { error: "Account security update required. Please reset password." });
        }

        const isValid = verifyPassword(password, user.password_hash);
        if (!isValid) {
            return response(401, { error: "Invalid email or password" });
        }

        // 3. Return user info (excluding password)
        const userObj = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            avatar: user.avatar,
            zointsBalance: parseFloat(user.zoints_balance),
            totalRecycledKg: parseFloat(user.total_recycled_kg),
            isActive: user.is_active,
            bankDetails: {
                bankName: user.bank_name,
                accountNumber: user.account_number,
                accountName: user.account_name
            }
        };

        return response(200, userObj);
    }

    // --- PASSWORD RESET ---
    if (cleanPath === 'auth/forgot-password' && method === 'POST') {
        const { email } = body;
        
        const { rows } = await query('SELECT id, name FROM users WHERE email = $1', [email]);
        
        if (rows.length === 0) {
            return response(404, { error: "No account found with this email" });
        }
        
        const userName = rows[0].name;

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Expires in 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await query(
            'INSERT INTO password_resets (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3',
            [email, otp, expiresAt]
        );

        // CHECK: Are SMTP variables present?
        const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

        if (isSmtpConfigured) {
            // REAL EMAIL MODE
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || '"Zilcycler Support" <noreply@zilcycler.com>',
                    to: email,
                    subject: 'Reset Your Zilcycler Password',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #166534; text-align: center;">Password Reset Request</h2>
                            <p>Hello ${userName},</p>
                            <p>We received a request to reset your password for your Zilcycler account.</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #166534; background: #f0fdf4; padding: 10px 20px; border-radius: 5px;">${otp}</span>
                            </div>
                            <p>This code is valid for <strong>10 minutes</strong>.</p>
                            <p style="color: #666; font-size: 12px; margin-top: 30px;">If you didn't request this change, you can safely ignore this email.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="text-align: center; color: #999; font-size: 12px;">&copy; ${new Date().getFullYear()} Zilcycler. All rights reserved.</p>
                        </div>
                    `,
                    text: `Your Zilcycler password reset code is: ${otp}. This code expires in 10 minutes.`
                });
                console.log(`[Email] OTP sent successfully to ${email}`);
                return response(200, { message: "OTP sent to email" });
            } catch (emailError: any) {
                console.error("Failed to send OTP email:", emailError);
                return response(500, { error: "Failed to send email. Check server logs." });
            }
        } else {
            // SIMULATION MODE (Fallback if SMTP is missing)
            console.log("================================================================");
            console.log(`[SIMULATION] SMTP Variables missing. OTP for ${email}: ${otp}`);
            console.log("================================================================");
            return response(200, { 
                message: "OTP generated (Simulation Mode)", 
                warning: "Email not sent: SMTP config missing in Netlify." 
            });
        }
    }

    if (cleanPath === 'auth/reset-password' && method === 'POST') {
        const { email, otp, newPassword } = body;
        
        const { rows } = await query('SELECT * FROM password_resets WHERE email = $1', [email]);
        if (rows.length === 0) return response(400, { error: "Invalid or expired request" });
        
        const resetRecord = rows[0];
        
        if (resetRecord.otp !== otp) {
            return response(400, { error: "Invalid OTP code" });
        }
        
        if (new Date(resetRecord.expires_at) < new Date()) {
            return response(400, { error: "OTP has expired. Please request a new one." });
        }

        const passwordHash = hashPassword(newPassword);
        
        // Update user password and clear reset record
        await query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
        await query('DELETE FROM password_resets WHERE email = $1', [email]);

        return response(200, { success: true });
    }

    // --- USERS ---
    if (cleanPath === 'users') {
      if (method === 'GET') {
        const { rows } = await query('SELECT id, name, email, role, phone, avatar, zoints_balance, total_recycled_kg, is_active, bank_name, account_number, account_name, created_at FROM users');
        const users = rows.map((u: any) => ({
            ...u,
            zointsBalance: parseFloat(u.zoints_balance),
            totalRecycledKg: parseFloat(u.total_recycled_kg),
            isActive: u.is_active,
            bankDetails: {
                bankName: u.bank_name,
                accountNumber: u.account_number,
                accountName: u.account_name
            }
        }));
        return response(200, users);
      }
      if (method === 'POST') {
        const { id, name, email, role, phone, password } = body;
        const passwordHash = password ? hashPassword(password) : null;

        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, name, email, role, phone, `https://i.pravatar.cc/150?u=${id}`, passwordHash]
        );
        return response(201, { message: "User created" });
      }
      if (method === 'PUT') {
          const { id, updates } = body;
          if (updates.isActive !== undefined) await query('UPDATE users SET is_active = $1 WHERE id = $2', [updates.isActive, id]);
          if (updates.zointsBalance !== undefined) await query('UPDATE users SET zoints_balance = $1 WHERE id = $2', [updates.zointsBalance, id]);
          return response(200, { success: true });
      }
    }

    // --- PICKUPS ---
    if (cleanPath === 'pickups') {
      if (method === 'GET') {
        const { rows } = await query('SELECT * FROM pickups ORDER BY created_at DESC');
        const pickups = rows.map((p: any) => ({
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
        await query(
            `INSERT INTO pickups (id, user_id, location, time, date, items, status, contact, phone_number, waste_image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [p.id, p.userId, p.location, p.time, p.date, p.items, p.status, p.contact, p.phoneNumber, p.wasteImage]
        );
        return response(201, { success: true });
      }
      if (method === 'PUT') {
          const { id, updates } = body;
          if (updates.status) await query('UPDATE pickups SET status = $1 WHERE id = $2', [updates.status, id]);
          if (updates.driver) await query('UPDATE pickups SET driver = $1 WHERE id = $2', [updates.driver, id]);
          if (updates.weight) {
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

    // --- CONFIG & RATES ---
    if (cleanPath === 'config') {
        const configRes = await query('SELECT * FROM system_config WHERE id = 1');
        const ratesRes = await query('SELECT * FROM waste_rates');
        
        const ratesObj: any = {};
        ratesRes.rows.forEach((r: any) => ratesObj[r.category] = parseFloat(r.rate));

        return response(200, {
            sysConfig: {
                maintenanceMode: configRes.rows[0]?.maintenance_mode || false,
                allowRegistrations: configRes.rows[0]?.allow_registrations || true
            },
            wasteRates: ratesObj
        });
    }
    
    if (cleanPath === 'config/update' && method === 'POST') {
        const { maintenanceMode, allowRegistrations } = body;
        await query('UPDATE system_config SET maintenance_mode = $1, allow_registrations = $2 WHERE id = 1', [maintenanceMode, allowRegistrations]);
        return response(200, { success: true });
    }
    
    if (cleanPath === 'rates/update' && method === 'POST') {
        const { rates } = body;
        for (const [category, rate] of Object.entries(rates)) {
            await query('INSERT INTO waste_rates (category, rate) VALUES ($1, $2) ON CONFLICT (category) DO UPDATE SET rate = $2', [category, rate]);
        }
        return response(200, { success: true });
    }

    // --- REDEMPTION ---
    if (cleanPath === 'redemption') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM redemption_requests ORDER BY created_at DESC');
            const requests = rows.map((r: any) => ({
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
            await query('BEGIN');
            try {
                await query(
                    `INSERT INTO redemption_requests (id, user_id, user_name, type, amount, status, date) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [r.id, r.userId, r.userName, r.type, r.amount, r.status, r.date]
                );
                await query(`UPDATE users SET zoints_balance = zoints_balance - $1 WHERE id = $2`, [r.amount, r.userId]);
                await query('COMMIT');
                return response(201, { success: true });
            } catch (e) {
                await query('ROLLBACK');
                throw e;
            }
        }
        if (method === 'PUT') {
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

    // --- BLOG ---
    if (cleanPath === 'blog') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM blog_posts ORDER BY created_at DESC');
            return response(200, rows);
        }
        if (method === 'POST') {
            const p = body;
            await query('INSERT INTO blog_posts (id, title, category, excerpt, image) VALUES ($1, $2, $3, $4, $5)', [p.id, p.title, p.category, p.excerpt, p.image]);
            return response(201, { success: true });
        }
        if (method === 'DELETE') {
            const { id } = body;
            await query('DELETE FROM blog_posts WHERE id = $1', [id]);
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

    // --- MESSAGES ---
    if (cleanPath === 'messages') {
        if (method === 'GET') {
            const { rows } = await query('SELECT * FROM messages ORDER BY created_at ASC');
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
            await query(
                'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4)',
                [m.id, m.senderId, m.receiverId, m.content]
            );
            return response(201, { success: true });
        }
    }

    return response(404, { error: `Endpoint not found: ${cleanPath}` });

  } catch (err: any) {
    console.error("API Error", err);
    return response(500, { error: err.message });
  }
};