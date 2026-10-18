# Hostinger build configuration

Use the normal Next.js server, not the old Bun standalone/Caddy runtime.

- Node.js: 22 LTS (22.5 or newer)
- Install: `npm install`
- Initial data setup: `npm run db:generate`, `npm run db:push`, then `npm run db:import:sqlite`
- Build: `npm run build`
- Start: `npm start`

`next.config.ts` intentionally does not set `output: "standalone"` because Hostinger starts the application with `next start`.
