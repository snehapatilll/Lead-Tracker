import { useState, type FormEvent } from 'react';
import { ApiRequestError } from '../lib/api';
import { LEAD_STATUSES, STATUS_LABELS, type CreateLeadPayload, type LeadStatus } from '../types';

interface LeadFormProps {
  onCreate: (payload: CreateLeadPayload) => Promise<unknown>;
}

const EMPTY_FORM = { name: '', email: '', phone: '', status: 'new' as LeadStatus };

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'status' | '_', string>>;

/**
 * Cheap client-side pass so obvious mistakes do not cost a round trip. The
 * server revalidates everything - this is a convenience, not the boundary.
 */
function validate(form: typeof EMPTY_FORM): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Enter a valid email address';
  if (!form.phone.trim()) errors.phone = 'Phone is required';
  else if (form.phone.trim().length < 7) errors.phone = 'Phone looks too short';
  return errors;
}

export function LeadForm({ onCreate }: LeadFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, _: undefined }));
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onCreate(form);
      setForm(EMPTY_FORM);
      setErrors({});
      setSuccessMessage(`${form.name.trim()} added.`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // Field-level detail from the server takes precedence; fall back to
        // the top-level message (e.g. a duplicate-email conflict).
        setErrors(error.details ?? { _: error.message });
      } else {
        setErrors({ _: 'Something went wrong. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card lead-form" onSubmit={handleSubmit} noValidate>
      <h2 className="card-title">Add a lead</h2>

      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Ada Lovelace"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="ada@example.com"
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>

      <div className="field">
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="+91 98765 43210"
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone && <p className="field-error">{errors.phone}</p>}
      </div>

      <div className="field">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          value={form.status}
          onChange={(e) => update('status', e.target.value as LeadStatus)}
        >
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {errors._ && <p className="form-error">{errors._}</p>}
      {successMessage && (
        <p className="form-success" role="status">
          {successMessage}
        </p>
      )}

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? 'Adding...' : 'Add lead'}
      </button>
    </form>
  );
}
