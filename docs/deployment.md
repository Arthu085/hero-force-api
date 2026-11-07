# First production deployment

This guide prepares a small production demo without selecting a hosting provider. Reuse the
existing `prod` Docker target and compiled migration/seed commands. The repository's
`docker-compose.yml` is for development: it mounts source, starts the watcher, and publishes the
database. Do not run that stack in production.

## Services and connections

Start with one API instance and one frontend origin, for example `https://hero.example.com`:

| Service                               | Connections and storage                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| HTTPS reverse proxy and static server | Public ports 80/443; redirects HTTP to HTTPS, serves the client's `dist/`, forwards `/api/` unchanged to the private API |
| API `prod` image                      | Listens on private port 3000; connects to PostgreSQL and an SMTP provider; logs JSON to stdout                           |
| PostgreSQL 16                         | Private port 5432; persistent disk or Docker named volume at `/var/lib/postgresql/data`; scheduled off-host backups      |
| SMTP provider                         | Outbound SMTP from the API; verified sender/domain and provider credentials                                              |

The browser accesses frontend and API through the same HTTPS origin. This keeps host-only
`Secure; SameSite=Lax` cookies first-party and avoids third-party cookie dependencies. The frontend
build uses `VITE_API_URL=https://hero.example.com` without `/api`; its HTTP client adds the prefix.
Use the client's [production guide](https://github.com/Arthu085/hero-force-client/blob/main/docs/deployment.md)
for static serving, React Router fallback, asset caching, and PWA verification.

A single host is enough for the demo. A managed database is also compatible; use the
[managed PostgreSQL settings](infrastructure.md#managed-postgresql), including certificate-verified
TLS. Leave Redis unset for one API instance; in-memory rate limits reset after a restart. Add
[shared Redis](infrastructure.md#shared-rate-limiting-with-redis) before running multiple instances.

## Prepare the host

1. Select a host with Docker, persistent storage, and enough memory for PostgreSQL and the API.
   Choose a domain, point its DNS to the proxy, and allow public access only to HTTPS, its HTTP
   redirect/certificate challenge, and restricted operator access.
2. Configure a certificate and automatic renewal at the reverse proxy or hosting ingress. Check
   HTTPS before sign-in: production cookies require it. Set the proxy to overwrite incoming
   `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` with trusted values. With exactly
   one proxy and no direct public API access, set `TRUST_PROXY=1`. Re-evaluate the value if a CDN
   or another proxy is added.
3. Provision PostgreSQL with a persistent volume. Use the same volume for container replacements;
   removing a container must not remove its data. Never use `docker compose down -v`,
   `docker volume prune`, or an empty replacement volume against production. A volume is not a
   backup. Managed PostgreSQL must have an explicit backup policy too.
4. Configure SMTP with a verified sender and the provider's DNS records (SPF/DKIM and DMARC as
   supported). Prefer port 465 with `MAIL_SECURE=true` for TLS from connection establishment.
   Port 587 uses `MAIL_SECURE=false` and upgrades with STARTTLS when advertised; the current
   transport does not require that upgrade, so verify the provider's TLS behavior before using it.

For a self-hosted database, keep it on a private Docker network. Example names used below are
`hero-force`, `hero-postgres`, and `hero-postgres-data`. Create a PostgreSQL-only env file outside
all checkouts with a unique bootstrap password (`POSTGRES_USER=postgres`, `POSTGRES_DB=postgres`,
and `POSTGRES_PASSWORD=<generated value>`), mode `600`, then provision once:

```sh
docker network create hero-force
docker volume create hero-postgres-data
docker run -d --name hero-postgres --restart unless-stopped \
  --network hero-force --env-file /srv/hero-force/postgres.env \
  --mount type=volume,src=hero-postgres-data,dst=/var/lib/postgresql/data \
  postgres:16-alpine
docker exec hero-postgres pg_isready -U postgres -d postgres
docker exec -it hero-postgres createuser -U postgres --pwprompt hero
docker exec hero-postgres createdb -U postgres --owner=hero hero
```

`createuser` creates a non-superuser without role/database creation privileges. Enter a separate
generated password at its prompt and use that password for the API's `DB_PASSWORD`. The `hero`
role owns its application database so migrations can create its schema and trusted extensions;
keep the bootstrap superuser credentials out of the API environment.

There is no published database port. Never put PostgreSQL or SMTP credentials in frontend
variables or Docker build arguments. Pin a tested PostgreSQL image digest for the actual host.

## Runtime environment

Create `/srv/hero-force/production.env` outside both repositories with mode `600`, or use the
host's secret manager. Start with an empty production file rather than copying the development
`.env.example`, whose admin credentials and insecure defaults are rejected in production.
Docker `--env-file` values are literal: do not surround `MAIL_FROM` with quotes.

Set these values, replacing every example host, address, and secret:

```dotenv
NODE_ENV=production
PORT=3000
APP_WEB_URL=https://hero.example.com
CORS_ORIGINS=https://hero.example.com
TRUST_PROXY=1
DB_HOST=hero-postgres
DB_PORT=5432
DB_USER=hero
DB_PASSWORD=<generated password for the hero role>
DB_NAME=hero
DB_SSL=false
DB_POOL_MAX=10
DB_STATEMENT_TIMEOUT_MS=30000
JWT_ACCESS_SECRET=<independent random secret>
JWT_REFRESH_SECRET=<independent random secret>
COOKIE_SECRET=<independent random secret>
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=
MAIL_TRANSPORT=smtp
MAIL_HOST=<provider SMTP hostname>
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=<provider username>
MAIL_PASSWORD=<provider password>
MAIL_FROM=Hero Force <no-reply@your-domain.com>
LOG_PRETTY=false
EMAIL_OUTBOX_WORKER_ENABLED=true
```

Generate each signing secret independently with `openssl rand -base64 48`; keep the same values
across application restarts and updates. Changing them signs users out. Omit `SEED_ADMIN_*` from
this file. `DB_SSL=false` above is for the same-host private database; external databases should
use verified TLS. The full [configuration reference](infrastructure.md#configuration) defines the
remaining defaults and validation rules. Keep `CORS_ORIGINS` an exact origin without a trailing
slash; use no wildcard. Do not disable CSRF or secure cookies to troubleshoot hosting.

## First release and administrator

Build from the reviewed commit in each repository. Tag the API with its commit and retain that tag
for updates and rollback:

```sh
TAG=$(git rev-parse --short HEAD)
API_IMAGE="hero-force-api:$TAG"
docker build --target prod -t "$API_IMAGE" .
docker run --rm --network hero-force --env-file /srv/hero-force/production.env \
  "$API_IMAGE" npm run migration:run:prod
docker run --rm --network hero-force --env-file /srv/hero-force/production.env \
  "$API_IMAGE" npm run seed:prod
```

Stop on any command failure. Run migrations from only one place per release; they do not
coordinate concurrent runners. Seeds create the fixed roles and abilities without demo data.
Create the first administrator with credentials supplied only to this one-off container:

```sh
export SEED_ADMIN_PASSWORD="$(openssl rand -hex 16)-Aa1"
docker run --rm --network hero-force --env-file /srv/hero-force/production.env \
  -e SEED_ADMIN_ENABLED=true -e SEED_ADMIN_EMAIL=admin@your-domain.com \
  -e SEED_ADMIN_PASSWORD "$API_IMAGE" npm run seed:prod
unset SEED_ADMIN_PASSWORD
```

Store or hand over the generated password securely before unsetting it, or discard it and use
password recovery after SMTP works. Re-running the seed never resets an existing password. No
administrator credential needs to remain in the running API's environment.

Start the API with a restart policy and the same private network. This example assumes the HTTPS
proxy runs on the Docker host; if the proxy is containerized, connect it to the private network
and use `api:3000` with no published API port instead:

```sh
docker run -d --name api --restart unless-stopped --stop-timeout 30 \
  --network hero-force --env-file /srv/hero-force/production.env \
  -p 127.0.0.1:3000:3000 "$API_IMAGE"
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
```

Configure the proxy to preserve `/api` and pass requests to `127.0.0.1:3000`. Do not cache API
responses, authentication headers, or cookies, and keep the health endpoints private to operator
and hosting probes. A liveness failure identifies a process problem; readiness also checks
PostgreSQL and optional Redis. Docker's restart policy restarts exited processes, not containers
whose health status is merely `unhealthy`; monitor both probes separately.

Build the client with its public production variables and publish its complete `dist/` through
the proxy. In a real HTTPS browser, verify login, refresh after access-token expiry, logout,
page refresh on a nested route, and a password-reset email with the production domain. Check
`Secure`, `HttpOnly` auth cookies, `SameSite=Lax`, and successful CSRF-protected mutations in the
browser network panel. Readiness alone does not verify SMTP or browser authentication.

## Backups and restore rehearsal

Schedule at least daily encrypted off-host backups and an additional backup before migrations.
Choose retention and the acceptable loss window explicitly; alert on failed or missing backups.
A same-host dump alone does not protect against host or disk loss. Back up runtime secrets and
proxy configuration separately through a secure store.

For the self-hosted example, the following commands create a consistent custom-format dump and
restore it into a separate empty database for a rehearsal. Never restore over the live database:

```sh
umask 077
BACKUP="/srv/hero-force/backups/hero-$(date -u +%Y%m%dT%H%M%SZ).dump"
mkdir -p /srv/hero-force/backups
docker exec hero-postgres pg_dump -U hero -d hero --format=custom > "$BACKUP"
test -s "$BACKUP"
docker exec hero-postgres createdb -U postgres -O hero -T template0 hero_restore_check
docker exec -i hero-postgres pg_restore -U hero -d hero_restore_check \
  --exit-on-error --no-owner --no-privileges < "$BACKUP"
docker exec hero-postgres psql -U hero -d hero_restore_check \
  -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM migrations;'
```

Keep the rehearsal database isolated from the running API. Confirm expected records and schema,
then remove only that rehearsal database when finished. Encrypt and copy the dump off-host, verify
the copy, and periodically rehearse a full recovery on an isolated host. Managed databases should
use the provider's restore-to-new-database procedure. `pg_dump` captures one database, not cluster
roles; record required roles and extensions as part of recovery. See PostgreSQL's
[backup documentation](https://www.postgresql.org/docs/16/backup-dump.html).

## Application updates and recovery

1. Run both repository gates and the production image smoke test before release. Build a new
   commit-tagged API image and client bundle; keep the previous artifacts.
2. Take and verify a database backup. Run pending migrations once from the new image before
   starting it; stop if migration or required seed commands fail. Keep old/new schema compatibility
   in mind even for a single-instance rollback.
3. Replace the API using the [existing deployment procedure](infrastructure.md#deployment). Retain
   `--network hero-force`, `--restart unless-stopped`, the secrets, and the loopback binding from
   this guide. Single-instance replacement has a short outage. Never delete the database volume.
4. Wait for readiness, publish the new client bundle atomically, and verify the browser flows above.
   Keep hashed assets needed by open tabs during the update and follow the client's PWA update
   guidance. Watch JSON logs and the [email outbox](infrastructure.md#email-outbox-operations).
5. On failure, route back to the previous client and API artifacts only if the newer schema supports
   them. Application rollback leaves the database unchanged. Schema revert and backup restore are
   separate deliberate operations; prefer a forward fix when production data would be lost.

Remaining hosting work is manual: choose the host/domain, configure DNS, certificates and renewal,
private networks/firewall, secret injection, persistent storage, SMTP verification, image/artifact
publication, restart supervision, probe/log monitoring, and backup scheduling with restore drills.
No external service is provisioned by this repository or its CI.

References: [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)
explains loopback bindings; [Nodemailer SMTP](https://nodemailer.com/smtp) defines TLS settings.
