import 'dotenv/config';
import {z} from 'zod';
const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'), PORT:z.coerce.number().int().min(1).max(65535).default(3001),
 DATABASE_URL:z.string().min(1), DATABASE_CA:z.string().optional(),
 SUPABASE_URL:z.string().url(), SUPABASE_ANON_KEY:z.string().min(1), SUPABASE_SERVICE_ROLE_KEY:z.string().min(1),
 STORAGE_BUCKET:z.string().regex(/^[a-z0-9-]+$/).default('festival-gallery'),
 APP_ORIGIN:z.string().url().default('http://127.0.0.1:5173'),
 ALLOWED_ORIGINS:z.string().default('http://127.0.0.1:5173'),
 CSRF_SECRET:z.string().min(32).refine(v=>!v.startsWith('REPLACE_'),'Generate a random secret'), SESSION_HOURS:z.coerce.number().int().min(1).max(24).default(8),
 TRUST_PROXY_HOPS:z.coerce.number().int().min(0).max(3).default(0),
 COOKIE_SAME_SITE:z.enum(['lax','strict','none']).default('lax')
});
export type Config=z.infer<typeof schema>;
export function readConfig():Config {const parsed=schema.safeParse(process.env);if(!parsed.success)throw new Error('Missing or invalid configuration: '+parsed.error.issues.map(i=>i.path.join('.')).join(', '));const c=parsed.data;if(c.NODE_ENV==='production'&&!c.APP_ORIGIN.startsWith('https://'))throw new Error('Production APP_ORIGIN must use HTTPS');return c;}
