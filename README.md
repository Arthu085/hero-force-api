# Hero Force API

Hero Force is a superhero-themed project management application. Teams assign projects to
responsible heroes, track six shared goals, and follow progress through a dashboard.

This repository provides the REST API: it stores application data, manages accounts and sessions,
enforces permissions, and calculates project progress. The
[Hero Force Client](https://github.com/Arthu085/hero-force-client) provides the web interface and
consumes this API using cookie-based sessions, CSRF protection, and localized responses. Each
repository has its own setup and validation.

## Quick start

### Docker Compose (recommended)

Use Docker Compose to start the API and PostgreSQL together. This is the primary development
setup and requires only Docker with Docker Compose; local Node.js and PostgreSQL installations
are not needed.

From the repository root:

```sh
cp .env.example .env
docker compose up --build -d
```

Compose runs migrations and seeds automatically, then starts the API in watch mode. See
[Docker](#docker) for optional email and Redis services.

### Without Docker

Alternatively, install Node.js 24, npm, and PostgreSQL locally. Copy the configuration:

```sh
cp .env.example .env
```

Create a PostgreSQL user and database, then set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
and `DB_NAME` in `.env` to match. With PostgreSQL running, select Node with nvm if you use it,
then install dependencies and start the API:

```sh
nvm use
npm ci
npm run migration:run
npm run seed
npm run start:dev
```

### Access the API

The API listens on `http://localhost:3000/api` by default. Swagger UI is available at
`http://localhost:3000/api/docs` outside production.

Start the [client](https://github.com/Arthu085/hero-force-client#quick-start) separately. Its
`VITE_API_URL` should be `http://localhost:3000`, without `/api`; the API's `CORS_ORIGINS` must
include the client's actual origin, normally `http://localhost:5173`.

For direct API requests, first obtain a CSRF token from `GET /api/auth/csrf`, preserve cookies,
and send `X-CSRF-Token` on state-changing requests. See the
[authentication integration guide](docs/modules/auth.md#frontend-integration).

### First sign-in

The seed creates an administrator with an already confirmed email. If you copied
[`.env.example`](.env.example) without changing the seed settings, sign in from the client with
these **local development only** credentials:

- **Email:** `admin@email.com`
- **Password:** `Admin@123`

To use custom credentials, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` before
running the seed. Rerunning the seed does not reset an existing user's password.

Never use these example credentials in production or publish actual production credentials.
Production administrator creation requires explicit opt-in through `SEED_ADMIN_ENABLED=true`;
see the [deployment guide](docs/deployment.md).

## Features

- **Projects and goals:** assign a responsible hero, track six fixed goals, and calculate progress
  and status automatically.
- **Dashboard:** project totals, status counts, and average progress for the caller's visible projects.
- **Accounts:** registration, email confirmation, cookie-based sessions, password recovery, and
  profile updates.
- **Users and permissions:** superhero identities, user administration, fixed roles, and editable
  ability grants; administrators manage all projects, while users see their assigned projects.
- **Supporting services:** Portuguese and English responses, request auditing, and queued
  transactional email.

## Technology stack

- Node.js 24, TypeScript, NestJS 11, and Express.
- PostgreSQL and TypeORM, with migrations and idempotent seeds.
- JWT authentication in signed httpOnly cookies, CSRF protection, and role/ability guards.
- nestjs-i18n, Pino logging, Swagger, Nodemailer, and optional Redis for shared rate limiting.
- Jest, Supertest, PostgreSQL/Redis Testcontainers, ESLint, Prettier, and GitHub Actions.
- Docker and Docker Compose for local services and development; a separate production image target.

## Prerequisites

- **Recommended Docker setup:** Docker with Docker Compose.
- **Without Docker:** Node.js 24, npm, and PostgreSQL. [`.nvmrc`](.nvmrc) selects Node 24; the
  supported range is `^24.11.0`. The development Compose service uses PostgreSQL 16.
- **Integration and end-to-end tests:** Docker for Testcontainers-based tests.

## Docker

Compose overrides database and mail hostnames so the same `.env` works on the host and in
Compose. Stop the services with `docker compose down`; the database volume is retained.

By default, `MAIL_TRANSPORT=log` sends no email and writes confirmation and password-reset tokens
to application logs. To inspect SMTP email locally, set `MAIL_TRANSPORT=smtp` in `.env` and run
`docker compose --profile mail up --build -d`; Mailpit is available at `http://localhost:8025`.
The optional `redis` profile supports shared rate limiting. See
[local development](docs/infrastructure.md#local-development) for Redis URLs and service details,
and [Docker images](docs/infrastructure.md#docker-images) for the `dev` and `prod` targets.

## Environment

[`.env.example`](.env.example) documents the full configuration. Values are validated at startup;
keep `.env` local. The main settings for development are:

| Settings                                                        | Purpose                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`, `DEFAULT_LOCALE`                            | Runtime environment, HTTP port, and default response language                     |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`       | PostgreSQL connection; `DB_HOST=localhost` for the host workflow                  |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`      | Token signing and cookie secrets; replace development placeholders for production |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`                             | Access-token and refresh-token lifetimes                                          |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`             | Browser cookie settings; local defaults support HTTP on localhost                 |
| `CORS_ORIGINS`, `APP_WEB_URL`                                   | Allowed frontend origins and the frontend base URL used in email links            |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_ENABLED` | Initial administrator; production creation requires explicit opt-in               |
| `MAIL_TRANSPORT`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`         | Log or SMTP delivery; the example targets Mailpit on port 1025                    |
| `THROTTLE_REDIS_URL`                                            | Optional shared rate-limit storage; leave empty for single-instance development   |

See [configuration](docs/infrastructure.md#configuration) for production requirements, database
TLS, retention, email quotas, and outbox settings.

## Commands

| Command                                                 | Purpose                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run start:dev`                                     | Start the API in watch mode                                      |
| `npm run start:debug`                                   | Start in watch mode with the Node.js debugger                    |
| `npm run build` / `npm run start:prod`                  | Compile to `dist/` / run the compiled API                        |
| `npm run lint` / `npm run lint:check`                   | Lint with autofix / check without fixing, failing on any warning |
| `npm run format`                                        | Format TypeScript source and tests                               |
| `npm run typecheck`                                     | Type-check source and tests without emitting files               |
| `npm test` / `npm run test:watch`                       | Run unit tests / run them in watch mode                          |
| `npm run test:cov`                                      | Run unit tests with coverage and the 80% global threshold        |
| `npm run test:integration`                              | Run PostgreSQL integration tests using Testcontainers            |
| `npm run test:e2e`                                      | Run HTTP end-to-end tests using Testcontainers                   |
| `npm run migration:generate --name=<kebab-description>` | Generate a migration from entity changes                         |
| `npm run migration:run` / `npm run migration:revert`    | Apply pending migrations / revert the latest migration           |
| `npm run seed`                                          | Provision roles, abilities, and the initial administrator        |

Additional commands, including compiled migration and seed variants, are in
[`package.json`](package.json). Operational procedures are in
[migrations and seeds](docs/infrastructure.md#migrations-and-seeds).

## Testing and validation

After `npm ci`, run the repository gate with Docker running:

```sh
npm run lint:check && npm run typecheck && npm run test:cov && npm run test:integration && npm run test:e2e && npm run build
```

Unit tests use mocks and need no running API or database. Integration and end-to-end tests start
disposable PostgreSQL containers; tests that need Redis start their own container. They do not use
the development database. See [testing conventions](docs/conventions.md#testing).

The client's [API integration tests](https://github.com/Arthu085/hero-force-client#api-integration-tests)
also validate real frontend requests and response schemas against this backend. Both repositories
run that suite in CI, using a matching counterpart branch when available and `main` otherwise.
See the client guide for local execution with `BACKEND_PATH` and
[API CI documentation](docs/infrastructure.md#ci) for cross-repository credentials and the
production image smoke test.

## Documentation

| Document                                               | Covers                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [`docs/PROJECT.md`](docs/PROJECT.md)                   | Purpose, modules, responsibilities, and seeded data                            |
| [`docs/conventions.md`](docs/conventions.md)           | Engineering, architecture, security, testing, and delivery rules               |
| [`docs/core.md`](docs/core.md)                         | Request pipeline, guards, transactions, scheduling, mail, and logging          |
| [`docs/deployment.md`](docs/deployment.md)             | First production demo, HTTPS, services, administrator, backups, and updates    |
| [`docs/infrastructure.md`](docs/infrastructure.md)     | Environment, Docker, migrations, deployment, operations, and CI                |
| [`docs/modules/projects.md`](docs/modules/projects.md) | Projects, six goals, derived progress, dashboard statistics, and visibility    |
| [`docs/modules/`](docs/modules)                        | Authentication, users, characters, authorization, auditing, and email services |
| Swagger at `/api/docs`                                 | Route reference, request validation, and response shapes outside production    |
