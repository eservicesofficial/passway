# Passway — Hostinger Node.js deployment

This deployment follows the working Escloud pattern: a standard Next.js production server (`next start`), Node.js, npm, and MySQL. Old workspace-specific Bun/standalone/Caddy scripts are not used.

## Requirements

- Hostinger Node.js app with Node.js 22.5 or newer (Node.js 22 LTS is recommended).
- A MySQL database created in hPanel.
- Writable application directory for `db/master.key` unless `VAULT_MASTER_KEY` is supplied.

## 1. Configure environment variables

In hPanel → Node.js → Environment variables, set `DATABASE_URL` using your actual MySQL details:

```text
mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME
```

Keep the password private. Do not upload your real `.env` file to a public repository.

### Preserve the existing vault encryption key

The project includes the original `db/master.key`. Do not delete, replace, or regenerate it. Alternatively, set `VAULT_MASTER_KEY` to the exact 64-hex-character contents of that original file in Hostinger's private environment settings. Using a different key can break server-key-wrapped vault sharing and password duplicate fingerprints.

## 2. Install and prepare the database (first deployment only)

Run from the project root after setting `DATABASE_URL`:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:import:sqlite
npm run build
```

`db:import:sqlite` imports the existing `db/custom.db` into the MySQL tables. The import script is repeatable for the same source: matching existing primary/unique rows are skipped. Run it only when you intend to import the bundled legacy database; do not run it after replacing that file with an old backup unless you want those records merged back in.

The source SQLite file is read-only during import and remains available as a backup. Confirm the app login and password records after the first import before removing any backups.

## 3. Hostinger application commands

- **Build command:** `npm run build`
- **Startup command:** `npm start`
- **Application root:** the directory containing `package.json`

`npm run build` runs Prisma Client generation, synchronizes the schema with MySQL, then runs `next build --webpack`. `npm start` runs `next start`, which honors Hostinger's `PORT` environment variable.

## 4. Later deployments

Set the same `DATABASE_URL` and keep the same `VAULT_MASTER_KEY` (or unchanged `db/master.key`). Then run `npm install` and `npm run build`. Do not rerun `npm run db:import:sqlite` routinely; initial import is a one-time data migration.

## Troubleshooting

- **Prisma cannot connect:** verify the database host, name, username, password, and MySQL access rules in hPanel.
- **`node:sqlite` is unavailable:** switch the Hostinger app to Node.js 22.5+ before running the import.
- **No tables:** run `npm run db:push` before the importer.
- **Login works but shared vault operations fail:** verify the original server master key was preserved.
- **SQLite import fails due to duplicate/conflicting user data:** back up the MySQL database and inspect existing rows before retrying; do not delete production data blindly.
