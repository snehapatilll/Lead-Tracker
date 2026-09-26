import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Loads environment variables before anything else imports them.
 *
 * npm runs workspace scripts with the cwd set to the workspace directory, so
 * `dotenv/config`'s default lookup checks `server/.env` and silently misses
 * the `.env` at the repo root. Both locations are loaded here, root first.
 *
 * dotenv does not overwrite variables that are already set, so a real
 * environment (Render, CI) always wins over a stray local file.
 *
 * Resolves correctly from `src/` under tsx and from `dist/` after a build -
 * both are one level below the workspace root.
 */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
