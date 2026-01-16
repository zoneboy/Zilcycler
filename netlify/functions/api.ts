import { query } from './db';

// Helper for standard response
const response = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*" // Allow CORS if needed
  },
  body: JSON.stringify(body)
});

export const handler = async (event: any) => {
  // Robust path parsing
  // event.path might be "/.netlify/functions/api/users" or just "/users" depending on how it's invoked (proxy vs redirect)
  let cleanPath = event.path
    .replace(/\/?\.netlify\/functions\/api/, '') // Remove function base
    .replace(/^\/api/, '') // Remove /api base if present
    .replace(/^\//, ''); // Remove leading slash
    
  // If cleanPath is empty or just slash, it might be the root check
  if (!cleanPath) cleanPath = '';

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  // Log for debugging (appears in Netlify logs)
  console.log(`[API] ${method} /${cleanPath}`);

  try {
    // --- HEALTH CHECK ---
    if (cleanPath === '' || cleanPath === 'health') {
        return response(200, { status: 'ok', message: 'Zilcycler API is running' });
    }

    // --- USERS ---
    if (cleanPath === 'users') {
      if (method === 'GET') {
        const { rows } = await query('SELECT * FROM users');
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
        const { id, name, email, role, phone } = body;
        await query(
            `INSERT INTO users (id, name, email, role, phone, avatar) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, name, email, role, phone, `https://i.pravatar.cc/150?u=${id}`]
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

    return response(404, { error: `Endpoint not found: ${cleanPath}` });

  } catch (err: any) {
    console.error("API Error", err);
    return response(500, { error: err.message });
  }
};