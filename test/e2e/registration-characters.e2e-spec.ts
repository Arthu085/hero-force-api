import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  USER_NOTIFIER,
  type UserNotifier,
} from '@modules/users/application/ports/user-notifier.port';
import {
  type AuthAgent,
  CSRF_COOKIE,
  CSRF_HEADER,
  type Credentials,
  createAuthAgent,
} from './helpers/auth-agent';
import { createTestApp } from './helpers/create-test-app';
import { deliverQueuedEmails } from './helpers/deliver-queued-emails';
import { createIsolatedUser } from './helpers/isolated-user';

interface EnvelopeBody<T> {
  data: T;
  meta: { message?: string };
}

interface CharacterShape {
  code: string;
  name: string;
  universe: string;
  universeLabel: string;
  avatarPath: string | null;
}

interface UserShape {
  uuid: string;
  name: string;
  email: string;
  emailConfirmedAt: string | null;
  roles: Array<{ uuid: string; role: string }>;
  character: CharacterShape | null;
}

const PASSWORD = 'StrongPass123!';

interface PublicClient {
  post(path: string): request.Test;
}

// Registration and login are CSRF-protected public routes, so an anonymous
// client still needs a CSRF cookie and header pair.
async function anonymousClient(
  app: INestApplication<App>,
): Promise<PublicClient> {
  const server = app.getHttpServer();
  const csrf = await request(server).get('/api/auth/csrf').expect(200);
  const raw = csrf.headers['set-cookie'] as unknown as string[] | string;

  const cookies = (Array.isArray(raw) ? raw : [raw]).map(
    (cookie) => cookie.split(';')[0],
  );

  const token = cookies
    .find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`))!
    .slice(CSRF_COOKIE.length + 1);

  return {
    post: (path) =>
      request(server)
        .post(path)
        .set('Cookie', cookies.join('; '))
        .set(CSRF_HEADER, token),
  };
}

// Registration is rate-limited like login, and this spec registers and signs
// in several accounts, so it raises that limit for its own worker process.
describe('Public registration and characters (e2e)', () => {
  const originalAuthThrottleLimit = process.env.AUTH_THROTTLE_LIMIT;

  let app: INestApplication<App>;
  let admin: AuthAgent;
  let dataSource: DataSource;
  let adminRoleUuid: string;

  const confirmationTokens = new Map<string, string>();

  const notifier: UserNotifier = {
    sendEmailChangeNotice: () => Promise.resolve(),
    sendEmailConfirmation: ({ email, token }) => {
      confirmationTokens.set(email, token);
      return Promise.resolve();
    },
    sendPasswordReset: () => Promise.resolve(),
    sendUserChangeRequest: () => Promise.resolve(),
  };

  beforeAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = '1000';

    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(USER_NOTIFIER).useValue(notifier),
    });

    admin = await createAuthAgent(app);
    dataSource = app.get<DataSource>(getDataSourceToken());

    const roles = (
      (await admin.get('/api/roles').expect(200)).body as EnvelopeBody<
        Array<{ uuid: string; role: string }>
      >
    ).data;

    adminRoleUuid = roles.find((role) => role.role === 'ADMIN')!.uuid;
  });

  afterAll(async () => {
    await app.close();

    if (originalAuthThrottleLimit === undefined) {
      delete process.env.AUTH_THROTTLE_LIMIT;
    } else {
      process.env.AUTH_THROTTLE_LIMIT = originalAuthThrottleLimit;
    }
  });

  async function register(
    body: Record<string, unknown>,
  ): Promise<request.Response> {
    const client = await anonymousClient(app);

    return client.post('/api/users/register').set('x-lang', 'en').send(body);
  }

  async function login(credentials: Credentials): Promise<request.Response> {
    const client = await anonymousClient(app);

    return client.post('/api/auth/login').send(credentials);
  }

  async function confirm(email: string): Promise<void> {
    await deliverQueuedEmails(app, email);

    const client = await anonymousClient(app);

    await client
      .post('/api/users/confirm-email')
      .send({ token: confirmationTokens.get(email) })
      .expect(200);
  }

  async function storedRoleNames(email: string): Promise<string[]> {
    const rows = await dataSource.query<Array<{ name: string }>>(
      `SELECT roles.name
       FROM users
         INNER JOIN user_roles ON user_roles.user_id = users.id
         INNER JOIN roles ON roles.id = user_roles.role_id
       WHERE users.email = $1`,
      [email],
    );

    return rows.map((row) => row.name);
  }

  describe('GET /api/characters', () => {
    it('lists the 12-character catalog without authentication, with localized universes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/characters')
        .set('x-lang', 'pt-BR')
        .expect(200);

      const characters = (response.body as EnvelopeBody<CharacterShape[]>).data;

      expect(characters).toHaveLength(12);
      expect(characters).toContainEqual({
        code: 'SPIDER_MAN',
        name: 'Spider-Man',
        universe: 'MARVEL',
        universeLabel: 'Marvel',
        avatarPath: '/characters/spider-man.svg',
      });
      expect(
        new Set(characters.map((character) => character.universe)),
      ).toEqual(new Set(['MARVEL', 'DC', 'DARK_HORSE', 'IMAGE']));
    });
  });

  describe('POST /api/users/register', () => {
    it('creates an unconfirmed USER account with the chosen character that can log in only after confirming', async () => {
      const email = `register-${randomUUID()}@example.com`;

      const response = await register({
        name: 'New Hero',
        email: email.toUpperCase(),
        password: PASSWORD,
        characterCode: 'WONDER_WOMAN',
      });

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({ data: null });
      expect((response.body as EnvelopeBody<null>).meta.message).toContain(
        'confirm',
      );

      await expect(storedRoleNames(email)).resolves.toEqual(['USER']);

      const blocked = await login({ email, password: PASSWORD });
      expect(blocked.status).toBe(403);

      await confirm(email);

      const agent = await createAuthAgent(app, { email, password: PASSWORD });

      const me = (
        (await agent.get('/api/users/me').expect(200))
          .body as EnvelopeBody<UserShape>
      ).data;

      expect(me).toMatchObject({
        name: 'New Hero',
        email,
        roles: [expect.objectContaining({ role: 'USER' })],
        character: expect.objectContaining({
          code: 'WONDER_WOMAN',
          name: 'Wonder Woman',
        }) as unknown,
      });
    });

    it('never grants roles from the payload', async () => {
      const email = `register-roles-${randomUUID()}@example.com`;

      await register({
        name: 'Sneaky',
        email,
        password: PASSWORD,
        roleUuids: [adminRoleUuid],
        roles: ['ADMIN'],
        abilities: [{ action: 'DELETE', subject: 'USER' }],
      }).then((res) => expect(res.status).toBe(202));

      await expect(storedRoleNames(email)).resolves.toEqual(['USER']);
    });

    it('answers a registered email exactly like a new one and changes nothing', async () => {
      const existing = await createIsolatedUser(app);

      const fresh = await register({
        name: 'Fresh',
        email: `register-fresh-${randomUUID()}@example.com`,
        password: PASSWORD,
      });

      const duplicate = await register({
        name: 'Impostor',
        email: existing.email,
        password: 'Other-Pass123!',
        characterCode: 'BATMAN',
      });

      expect(duplicate.status).toBe(fresh.status);
      expect(duplicate.body).toEqual(fresh.body);

      const original = await login(existing);
      expect(original.status).toBe(200);

      const agent = await createAuthAgent(app, existing);

      const me = (
        (await agent.get('/api/users/me').expect(200))
          .body as EnvelopeBody<UserShape>
      ).data;

      expect(me.name).toBe('Isolated User');
      expect(me.character).toBeNull();
    });

    it('applies the password strength rule and rejects an unknown character', async () => {
      const response = await register({
        name: 'Weak',
        email: `register-weak-${randomUUID()}@example.com`,
        password: 'weakpass',
        characterCode: 'DEADPOOL',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('character selection', () => {
    it('lets a user set and remove their own character through PATCH /users/me', async () => {
      const credentials = await createIsolatedUser(app);

      const chosen = await (await createAuthAgent(app, credentials))
        .patch('/api/users/me')
        .send({ characterCode: 'THE_FLASH' })
        .expect(200);

      expect(
        (chosen.body as EnvelopeBody<UserShape>).data.character?.code,
      ).toBe('THE_FLASH');

      const removed = await (await createAuthAgent(app, credentials))
        .patch('/api/users/me')
        .send({ characterCode: null })
        .expect(200);

      expect(
        (removed.body as EnvelopeBody<UserShape>).data.character,
      ).toBeNull();
    });

    it('lets an administrator create, list, change, and remove a user character', async () => {
      const userRoles = (
        (await admin.get('/api/roles').expect(200)).body as EnvelopeBody<
          Array<{ uuid: string; role: string }>
        >
      ).data;

      const userRoleUuid = userRoles.find((role) => role.role === 'USER')!.uuid;
      const email = `admin-character-${randomUUID()}@example.com`;

      const created = (
        (
          await admin
            .post('/api/users')
            .send({
              name: 'Managed Hero',
              email,
              password: PASSWORD,
              roleUuids: [userRoleUuid],
              characterCode: 'HELLBOY',
            })
            .expect(201)
        ).body as EnvelopeBody<UserShape>
      ).data;

      expect(created.character).toMatchObject({
        code: 'HELLBOY',
        avatarPath: null,
      });

      const listed = (
        (await admin.get(`/api/users?email=${email}`).expect(200))
          .body as EnvelopeBody<UserShape[]>
      ).data;

      expect(listed[0].character?.code).toBe('HELLBOY');

      const changed = await admin
        .patch(`/api/users/${created.uuid}`)
        .send({ characterCode: 'SPAWN' })
        .expect(200);

      expect(
        (changed.body as EnvelopeBody<UserShape>).data.character?.code,
      ).toBe('SPAWN');

      const removed = await admin
        .patch(`/api/users/${created.uuid}`)
        .send({ characterCode: null })
        .expect(200);

      expect(
        (removed.body as EnvelopeBody<UserShape>).data.character,
      ).toBeNull();
    });
  });
});
