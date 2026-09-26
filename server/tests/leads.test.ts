import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { InMemoryLeadRepository } from '../src/repositories/inMemoryLeadRepository';

/**
 * Integration tests over the real Express stack (routing, validation, error
 * handling) with the in-memory repository swapped in for Postgres, so the
 * suite runs anywhere with `npm test` and no database process.
 */

let repo: InMemoryLeadRepository;
let app: Express;

const validLead = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+91 98765 43210',
};

async function seed(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/leads')
    .send({ ...validLead, ...overrides });
  return res.body.lead;
}

beforeEach(() => {
  repo = new InMemoryLeadRepository();
  app = createApp({ repo });
});

describe('GET /api/health', () => {
  it('reports ok and advertises the status vocabulary', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.statuses).toContain('new');
  });
});

describe('POST /api/leads', () => {
  it('creates a lead and defaults its status to "new"', async () => {
    const res = await request(app).post('/api/leads').send(validLead);

    expect(res.status).toBe(201);
    expect(res.body.lead).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      status: 'new',
    });
    expect(res.body.lead.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(res.body.lead.createdAt)).not.toBeNaN();
  });

  it('accepts an explicit starting status', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, status: 'qualified' });

    expect(res.status).toBe(201);
    expect(res.body.lead.status).toBe('qualified');
  });

  it('normalises email to lowercase and trims whitespace', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, name: '  Ada  ', email: '  ADA@EXAMPLE.COM  ' });

    expect(res.body.lead.email).toBe('ada@example.com');
    expect(res.body.lead.name).toBe('Ada');
  });

  it('rejects a missing name with a field-level error', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details).toHaveProperty('name');
  });

  it('rejects a malformed email', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('rejects a phone number containing letters', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, phone: 'call-me-maybe' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('phone');
  });

  it('rejects an unknown status value', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ ...validLead, status: 'on-fire' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('status');
  });

  it('returns 409 when the email is already taken', async () => {
    await seed();
    const res = await request(app).post('/api/leads').send(validLead);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/leads', () => {
  beforeEach(async () => {
    await seed({ name: 'Ada Lovelace', email: 'ada@example.com', phone: '+91 90000 11111' });
    await seed({ name: 'Grace Hopper', email: 'grace@navy.mil', phone: '+1 202 555 0143' });
    await seed({ name: 'Alan Turing', email: 'alan@bletchley.uk', phone: '+44 20 7946 0958' });
  });

  it('lists every lead with pagination metadata', async () => {
    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(200);
    expect(res.body.leads).toHaveLength(3);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
  });

  it('returns newest first by default', async () => {
    const res = await request(app).get('/api/leads');
    const names = res.body.leads.map((l: { name: string }) => l.name);

    expect(names[0]).toBe('Alan Turing');
  });

  it('searches by partial name, case-insensitively', async () => {
    const res = await request(app).get('/api/leads?search=grace');

    expect(res.body.total).toBe(1);
    expect(res.body.leads[0].name).toBe('Grace Hopper');
  });

  it('searches by email fragment', async () => {
    const res = await request(app).get('/api/leads?search=bletchley');

    expect(res.body.total).toBe(1);
    expect(res.body.leads[0].name).toBe('Alan Turing');
  });

  it('searches by phone fragment', async () => {
    const res = await request(app).get('/api/leads?search=7946');

    expect(res.body.total).toBe(1);
    expect(res.body.leads[0].name).toBe('Alan Turing');
  });

  it('returns an empty page rather than an error when nothing matches', async () => {
    const res = await request(app).get('/api/leads?search=zzzznomatch');

    expect(res.status).toBe(200);
    expect(res.body.leads).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('filters by status', async () => {
    const lead = await seed({ email: 'extra@example.com' });
    await request(app).patch('/api/leads/' + lead.id + '/status').send({ status: 'converted' });

    const res = await request(app).get('/api/leads?status=converted');

    expect(res.body.total).toBe(1);
    expect(res.body.leads[0].id).toBe(lead.id);
  });

  it('paginates and reports the pre-pagination total', async () => {
    const res = await request(app).get('/api/leads?page=2&pageSize=2');

    expect(res.body.leads).toHaveLength(1);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(2);
  });

  it('sorts by name ascending on request', async () => {
    const res = await request(app).get('/api/leads?sort=name&order=asc');
    const names = res.body.leads.map((l: { name: string }) => l.name);

    expect(names).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
  });

  it('rejects a pageSize above the allowed maximum', async () => {
    const res = await request(app).get('/api/leads?pageSize=5000');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('pageSize');
  });
});

describe('PATCH /api/leads/:id/status', () => {
  it('moves a lead to a new status', async () => {
    const lead = await seed();

    const res = await request(app)
      .patch('/api/leads/' + lead.id + '/status')
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.lead.status).toBe('contacted');
    expect(res.body.lead.id).toBe(lead.id);
  });

  it('persists the change', async () => {
    const lead = await seed();
    await request(app).patch('/api/leads/' + lead.id + '/status').send({ status: 'lost' });

    const res = await request(app).get('/api/leads/' + lead.id);

    expect(res.body.lead.status).toBe('lost');
  });

  it('rejects an invalid status', async () => {
    const lead = await seed();

    const res = await request(app)
      .patch('/api/leads/' + lead.id + '/status')
      .send({ status: 'maybe-later' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const res = await request(app)
      .patch('/api/leads/3f2504e0-4f89-41d3-9a0c-0305e82c3301/status')
      .send({ status: 'contacted' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for an id that is not a UUID', async () => {
    const res = await request(app)
      .patch('/api/leads/banana/status')
      .send({ status: 'contacted' });

    expect(res.status).toBe(400);
  });
});

describe('unmatched API routes', () => {
  it('returns JSON 404 rather than HTML', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
