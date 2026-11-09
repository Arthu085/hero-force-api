# Hero Force API

Hero Force is a superhero-themed project management application. Teams assign projects to
responsible heroes, track six shared goals, and follow progress through a dashboard.

This repository contains the REST API. It stores application data, manages accounts and sessions,
enforces permissions, and calculates project progress. The web interface lives in the
[Hero Force Client](https://github.com/Arthu085/hero-force-client) repository.

## Features

- **Projects and goals:** assign a responsible hero, track six fixed goals, and derive progress and
  status automatically.
- **Project change history:** a paginated, read-only timeline of project and goal changes,
  recorded in the same transaction as each change.
- **Dashboard:** project totals, status counts, and average progress for the caller's visible
  projects.
- **Accounts:** registration, email confirmation, cookie-based sessions, password recovery, and
  profile updates.
- **Users and permissions:** superhero identities, user administration, fixed roles, and editable
  ability grants. Administrators manage all projects; users see their assigned projects.
- **Supporting services:** Portuguese and English responses, request auditing, and queued
  transactional email.

## Technology stack

- Node.js 24, TypeScript, NestJS 11, and Express
- PostgreSQL and TypeORM, with migrations and idempotent seeds
- JWT in signed httpOnly cookies, CSRF protection, and role and ability guards
- nestjs-i18n, Pino, Swagger, Nodemailer, and optional Redis for shared rate limiting
- Jest, Supertest, Testcontainers, ESLint, Prettier, and GitHub Actions
- Docker and Docker Compose

## Quick start

### Docker Compose (recommended)

Requires only Docker with Docker Compose. From the repository root:

```sh
cp .env.example .env
docker compose up --build -d
```

Compose starts PostgreSQL and the API, runs migrations and seeds, and starts the API in watch mode.
Stop it with `docker compose down`; the database volume is kept.

### Without Docker

Requires Node.js 24 ([`.nvmrc`](.nvmrc)), npm, and PostgreSQL. Copy the configuration, create a
PostgreSQL user and database, and set the `DB_*` variables in `.env` to match:

```sh
cp .env.example .env
```

Then install dependencies, prepare the database, and start the API:

```sh
nvm use
npm ci
npm run migration:run
npm run seed
npm run start:dev
```

### Access the API

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs` (disabled in production)

To use the web interface, start the
[client](https://github.com/Arthu085/hero-force-client#quick-start) with
`VITE_API_URL=http://localhost:3000` (without `/api`). The API's `CORS_ORIGINS` must include the
client's origin, `http://localhost:5173` by default.

Direct API clients must preserve cookies and send the CSRF token from `GET /api/auth/csrf` as
`X-CSRF-Token` on state-changing requests. See the
[authentication integration guide](docs/modules/auth.md#frontend-integration).

### First administrator

The seed creates an administrator with a confirmed email. With the unchanged
[`.env.example`](.env.example), sign in with these **local development only** credentials:

- **Email:** `admin@email.com`
- **Password:** `Admin@123`

To use other credentials, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` before running
the seed. Rerunning the seed does not reset an existing user's password.

> [!WARNING]
> Never use these example credentials in production or publish real production credentials.
> Production administrator creation requires explicit opt-in with `SEED_ADMIN_ENABLED=true`; see the
> [deployment guide](docs/deployment.md#first-release-and-administrator).

By default, `MAIL_TRANSPORT=log` sends no email and writes confirmation and password-reset tokens to
the application logs. To capture real emails with Mailpit, see
[email locally](docs/infrastructure.md#email-locally).

## Configuration

[`.env.example`](.env.example) lists every variable with local development values. The API
validates its configuration at startup and refuses to start with missing or unsafe values. Keep
`.env` local and never commit it. Production requirements are described in
[configuration](docs/infrastructure.md#configuration).

## Development commands

| Command                                                 | Purpose                                                 |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `npm run start:dev`                                     | Start the API in watch mode                             |
| `npm run build`                                         | Compile to `dist/`                                      |
| `npm run lint:check`                                    | Lint without fixing, failing on any warning             |
| `npm run typecheck`                                     | Type-check source and tests                             |
| `npm test`                                              | Run unit tests                                          |
| `npm run migration:generate --name=<kebab-description>` | Generate a migration from entity changes                |
| `npm run migration:run`                                 | Apply pending migrations                                |
| `npm run seed`                                          | Provision roles, abilities, and the first administrator |

All scripts are in [`package.json`](package.json). Migration and seed procedures are in
[migrations and seeds](docs/infrastructure.md#migrations-and-seeds).

## Testing

Unit tests need no database. Integration and end-to-end tests start disposable PostgreSQL
containers, so Docker must be running. The full validation gate is:

```sh
npm run lint:check && npm run typecheck && npm run test:cov && npm run test:integration && npm run test:e2e && npm run build
```

CI runs this gate, a production image smoke test, and the client's
[API integration tests](https://github.com/Arthu085/hero-force-client#api-integration-tests)
against this API. See [testing conventions](docs/conventions.md#testing) and
[CI](docs/infrastructure.md#ci).

## Deployment

The [deployment guide](docs/deployment.md) covers the first production deployment: HTTPS, services,
the first administrator, backups, and updates. Docker images and operations are described in
[infrastructure and operations](docs/infrastructure.md).

## Documentation

| Document                                           | Covers                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`docs/PROJECT.md`](docs/PROJECT.md)               | Purpose, modules, responsibilities, and seeded data                                      |
| [`docs/conventions.md`](docs/conventions.md)       | Architecture, security, testing, and delivery rules                                      |
| [`docs/core.md`](docs/core.md)                     | Request pipeline, guards, transactions, scheduling, mail, and logging                    |
| [`docs/infrastructure.md`](docs/infrastructure.md) | Local services, configuration, Docker, migrations, operations, and CI                    |
| [`docs/deployment.md`](docs/deployment.md)         | First production deployment                                                              |
| [`docs/modules/`](docs/modules)                    | Projects, history, authentication, users, characters, authorization, auditing, and email |
| Swagger at `/api/docs`                             | Route reference and request and response shapes outside production                       |
