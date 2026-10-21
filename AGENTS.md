# my-shop Project Instructions

This project was generated with `@vendure/create`.

## Project Layout

- Custom backend code belongs in `src/plugins`
- Runtime configuration is in `src/vendure-config.ts`
- Static assets and email templates live in `static`

## Vendure Development

- Prefer implementing custom functionality as a Vendure plugin.
- Use `npx vendure add` to scaffold plugins, entities, services, API extensions, and job queues.
- Read environment variables in `vendure-config.ts` and pass values into plugins through `Plugin.init()` options.
- Create job queues in `onModuleInit()` or `onApplicationBootstrap()`, then reuse the queue when adding jobs.
- Pass `RequestContext` to Vendure services and `TransactionalConnection` methods when it is available.
- Do not commit `.env` values or generated runtime data.
- Do not use `dbConnectionOptions.synchronize: true` for production data.

## Custom Fields

- Custom fields are hidden from customers by default. `customFields` in `vendure-config.ts` is wrapped in `internalByDefault()`, so a field without `public` gets `public: false` plus a guard that rejects Shop API writes.
- Expose a field to customers only with an explicit `public: true`, and say why in its `description`.
- A plugin that adds custom fields in its own `configuration` hook bypasses `internalByDefault()`. Set `public` explicitly there.
- Do not use `internal: true` or `readonly: true` to hide a field from customers: they also hide or lock the field for back-office staff.

## Commands

- Start development: `npm run dev` (server, worker and the dashboard at `http://localhost:3000/dashboard`)
- Build: `npm run build`
- `npm run dev:server` and `npm run start:server` do not build the dashboard. Without a build, `/dashboard` shows only a "Build your dashboard" placeholder. Run `npm run build:dashboard` once (output in `dist/dashboard`, gitignored); it also regenerates `src/gql/graphql-env.d.ts`.
- Unit tests: `npm test`

## Quality Checks

- Run `npm run build` after changing backend code.
- Run targeted tests for the package or feature you changed.
