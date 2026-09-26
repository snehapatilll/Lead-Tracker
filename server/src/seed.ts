import './env';
import { createPool, migrate } from './db';
import type { LeadStatus } from './domain';

/**
 * Populates the database with representative sample leads.
 *
 * Idempotent: emails are unique and inserts use ON CONFLICT DO NOTHING, so
 * running it twice is harmless and it will not clobber real data. Intended
 * for a fresh deployment so the app does not greet a reviewer with an empty
 * table.
 *
 *   npm run seed --workspace server
 */

interface SeedLead {
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  /** How long ago this lead was created, in hours. */
  hoursAgo: number;
}

const SAMPLE_LEADS: SeedLead[] = [
  { name: 'Ananya Sharma', email: 'ananya.sharma@brightwork.in', phone: '+91 98450 22118', status: 'new', hoursAgo: 2 },
  { name: 'Rohan Mehta', email: 'rohan.mehta@finedge.co', phone: '+91 99870 41203', status: 'new', hoursAgo: 7 },
  { name: 'Priya Nair', email: 'priya.nair@lumenlabs.io', phone: '+91 90035 77841', status: 'contacted', hoursAgo: 26 },
  { name: 'Vikram Desai', email: 'vikram@orbitspaces.com', phone: '+91 88670 19924', status: 'contacted', hoursAgo: 33 },
  { name: 'Sarah Whitfield', email: 'sarah.w@northgate.co.uk', phone: '+44 20 7946 0331', status: 'qualified', hoursAgo: 52 },
  { name: 'Daniel Okafor', email: 'daniel.okafor@zenithhr.com', phone: '+234 802 445 7719', status: 'qualified', hoursAgo: 61 },
  { name: 'Meera Krishnan', email: 'meera.k@stackforge.dev', phone: '+91 97410 65502', status: 'converted', hoursAgo: 96 },
  { name: 'James Aldridge', email: 'j.aldridge@havenpartners.com', phone: '+1 415 555 0182', status: 'converted', hoursAgo: 120 },
  { name: 'Kavya Reddy', email: 'kavya.reddy@pulsemetrics.in', phone: '+91 93920 88147', status: 'contacted', hoursAgo: 144 },
  { name: 'Tom Brennan', email: 'tom.brennan@corefleet.ie', phone: '+353 1 553 0294', status: 'lost', hoursAgo: 190 },
  { name: 'Ishita Bose', email: 'ishita.bose@vantagecx.com', phone: '+91 80080 31265', status: 'new', hoursAgo: 14 },
  { name: 'Marcus Vogel', email: 'm.vogel@nordhaus.de', phone: '+49 30 5557 8820', status: 'qualified', hoursAgo: 78 },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Nothing to seed.');
    process.exit(1);
  }

  const pool = createPool(connectionString);

  try {
    await migrate(pool);

    let inserted = 0;
    for (const lead of SAMPLE_LEADS) {
      const { rowCount } = await pool.query(
        `INSERT INTO leads (name, email, phone, status, created_at)
         VALUES ($1, $2, $3, $4, NOW() - ($5 || ' hours')::interval)
         ON CONFLICT (email) DO NOTHING`,
        [lead.name, lead.email, lead.phone, lead.status, String(lead.hoursAgo)],
      );
      inserted += rowCount ?? 0;
    }

    const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) FROM leads');
    console.log(
      `Seed complete: ${inserted} inserted, ${SAMPLE_LEADS.length - inserted} already present. ` +
        `${rows[0]?.count ?? '?'} leads total.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
