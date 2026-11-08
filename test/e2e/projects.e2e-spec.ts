import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { USER_ABILITY_REPOSITORY } from '@modules/authorization/domain/repositories/user-ability.repository';
import type { AbilityPair } from '@shared/domain/authorization/ability-pair.type';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { type AuthAgent, createAuthAgent } from './helpers/auth-agent';
import { createTestApp } from './helpers/create-test-app';
import { createIsolatedUser } from './helpers/isolated-user';

interface EnvelopeBody<T> {
  data: T;
  meta: { message?: string; total?: number };
}

interface HeroShape {
  uuid: string;
  name: string;
  character: { code: string } | null;
}

interface ProjectShape {
  uuid: string;
  name: string;
  description: string;
  status: string;
  statusLabel: string;
  progress: number;
  responsible: HeroShape;
  goals: Array<{
    goal: string;
    goalLabel: string;
    description: string | null;
    progress: number;
  }>;
}

interface StatisticsShape {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  averageProgress: number;
}

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let admin: AuthAgent;
  let hero: AuthAgent;
  let otherHero: AuthAgent;
  let heroUuid: string;
  let otherHeroUuid: string;
  let adminUuid: string;

  async function uuidOf(agent: AuthAgent): Promise<string> {
    const response = await agent.get('/api/users/me').expect(200);

    return (response.body as EnvelopeBody<{ uuid: string }>).data.uuid;
  }

  async function createProject(
    name: string,
    responsibleUuid: string,
  ): Promise<ProjectShape> {
    const response = await admin
      .post('/api/projects')
      .send({ name, description: `${name} description`, responsibleUuid })
      .expect(201);

    return (response.body as EnvelopeBody<ProjectShape>).data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    admin = await createAuthAgent(app);
    hero = await createAuthAgent(app, await createIsolatedUser(app));
    otherHero = await createAuthAgent(app, await createIsolatedUser(app));
    heroUuid = await uuidOf(hero);
    otherHeroUuid = await uuidOf(otherHero);
    adminUuid = await uuidOf(admin);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves read-only history with current project visibility, validation, and safe event values', async () => {
    const project = await createProject('Timeline', heroUuid);
    await admin
      .patch(`/api/projects/${project.uuid}`)
      .send({ name: 'Timeline renamed', description: 'Changed' })
      .expect(200);
    await admin
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({ goals: [{ goal: 'AGILITY', progress: 20 }] })
      .expect(200);
    await admin
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({ goals: [{ goal: 'AGILITY', progress: 70 }] })
      .expect(200);

    const response = await hero
      .get(`/api/projects/${project.uuid}/history?page=1&limit=2`)
      .expect(200);

    const body = response.body as EnvelopeBody<
      Array<{
        uuid: string;
        type: string;
        createdAt: string;
        actor: { uuid: string; name: string };
        goal: string | null;
        previousValues: { progress?: number };
        newValues: { progress?: number };
      }>
    >;

    expect(body.meta).toMatchObject({ total: 5, page: 1, limit: 2 });
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      type: 'GOAL_PROGRESS_CHANGED',
      goal: 'AGILITY',
      actor: { uuid: adminUuid },
      previousValues: { progress: 20 },
      newValues: { progress: 70 },
    });
    expect(Object.keys(body.data[0].actor).sort()).toEqual(['name', 'uuid']);
    expect(Object.keys(body.data[0]).sort()).toEqual([
      'actor',
      'createdAt',
      'goal',
      'newValues',
      'previousValues',
      'type',
      'uuid',
    ]);
    expect(Number.isNaN(Date.parse(body.data[0].createdAt))).toBe(false);
    await otherHero.get(`/api/projects/${project.uuid}/history`).expect(404);
    await admin.get(`/api/projects/${project.uuid}/history?page=0`).expect(400);
    await admin
      .get(`/api/projects/${project.uuid}/history?limit=51`)
      .expect(400);
    await admin.get('/api/projects/not-a-uuid/history').expect(400);
    await hero
      .post(`/api/projects/${project.uuid}/history`)
      .send({ type: 'PROJECT_CREATED' })
      .expect(404);

    await admin
      .patch(`/api/projects/${project.uuid}`)
      .send({ responsibleUuid: otherHeroUuid })
      .expect(200);
    await hero.get(`/api/projects/${project.uuid}/history`).expect(404);

    const reassigned = await otherHero
      .get(`/api/projects/${project.uuid}/history?page=3&limit=2`)
      .expect(200);

    expect(
      (reassigned.body as EnvelopeBody<Array<{ type: string }>>).data.at(-1)
        ?.type,
    ).toBe('PROJECT_CREATED');
    await admin.delete(`/api/projects/${project.uuid}`).expect(200);
    await admin.get(`/api/projects/${project.uuid}/history`).expect(404);
  });

  it('creates a PENDING project with six goals and only public hero fields', async () => {
    const response = await admin
      .post('/api/projects')
      .send({
        name: 'Operation Skyfall',
        description: 'Stop the meteor shower.',
        responsibleUuid: heroUuid,
        status: 'COMPLETED',
        progress: 100,
      })
      .expect(201);

    const project = (response.body as EnvelopeBody<ProjectShape>).data;

    expect(project.status).toBe('PENDING');
    expect(project.progress).toBe(0);
    expect(project.goals.map((goal) => goal.goal)).toEqual([
      'AGILITY',
      'DELIGHT',
      'EFFICIENCY',
      'EXCELLENCE',
      'TRANSPARENCY',
      'AMBITION',
    ]);
    expect(project.goals.every((goal) => goal.progress === 0)).toBe(true);
    expect(Object.keys(project.responsible).sort()).toEqual([
      'character',
      'name',
      'uuid',
    ]);
    expect(project.responsible.uuid).toBe(heroUuid);
  });

  it('rejects a responsible user without the USER role or unknown', async () => {
    await admin
      .post('/api/projects')
      .send({
        name: 'Admin project',
        description: 'Not allowed.',
        responsibleUuid: adminUuid,
      })
      .expect(422);

    await admin
      .post('/api/projects')
      .send({
        name: 'Ghost project',
        description: 'Nobody.',
        responsibleUuid: '00000000-0000-4000-8000-000000000000',
      })
      .expect(404);
  });

  it('updates goals, deriving progress and status, and ignores manual status', async () => {
    const project = await createProject('Goal project', heroUuid);

    const halfway = await admin
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({
        goals: [
          { goal: 'AGILITY', progress: 100, description: 'Move fast' },
          { goal: 'DELIGHT', progress: 1 },
        ],
      })
      .expect(200);

    const updated = (halfway.body as EnvelopeBody<ProjectShape>).data;

    expect(updated.progress).toBe(16);
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.goals[0]).toEqual(
      expect.objectContaining({
        goal: 'AGILITY',
        description: 'Move fast',
        progress: 100,
      }),
    );

    const renamed = await admin
      .patch(`/api/projects/${project.uuid}`)
      .send({ name: 'Renamed', status: 'PENDING', progress: 0 })
      .expect(200);

    expect((renamed.body as EnvelopeBody<ProjectShape>).data).toEqual(
      expect.objectContaining({
        name: 'Renamed',
        status: 'IN_PROGRESS',
        progress: 16,
      }),
    );

    const completed = await admin
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({
        goals: [
          'AGILITY',
          'DELIGHT',
          'EFFICIENCY',
          'EXCELLENCE',
          'TRANSPARENCY',
          'AMBITION',
        ].map((goal) => ({ goal, progress: 100 })),
      })
      .expect(200);

    expect((completed.body as EnvelopeBody<ProjectShape>).data).toEqual(
      expect.objectContaining({ status: 'COMPLETED', progress: 100 }),
    );

    await admin
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({ goals: [{ goal: 'AGILITY', progress: 101 }] })
      .expect(400);
  });

  it('shows a hero only their own projects, details, and statistics', async () => {
    const mine = await createProject('Visible project', otherHeroUuid);
    const foreign = await createProject('Hidden project', heroUuid);

    const list = await otherHero.get('/api/projects').expect(200);
    const listed = (list.body as EnvelopeBody<ProjectShape[]>).data;

    expect(listed.length).toBeGreaterThan(0);
    expect(
      listed.every((project) => project.responsible.uuid === otherHeroUuid),
    ).toBe(true);

    await otherHero.get(`/api/projects/${mine.uuid}`).expect(200);
    await otherHero.get(`/api/projects/${foreign.uuid}`).expect(404);

    const statistics = await otherHero
      .get('/api/projects/statistics')
      .expect(200);

    expect((statistics.body as EnvelopeBody<StatisticsShape>).data).toEqual({
      total: listed.length,
      pending: listed.length,
      inProgress: 0,
      completed: 0,
      averageProgress: 0,
    });
  });

  it('forbids heroes from managing projects or listing heroes and users', async () => {
    const project = await createProject('Locked project', heroUuid);

    await hero
      .post('/api/projects')
      .send({
        name: 'Mine',
        description: 'Self-assigned.',
        responsibleUuid: heroUuid,
      })
      .expect(403);
    await hero
      .patch(`/api/projects/${project.uuid}`)
      .send({ name: 'Hacked' })
      .expect(403);
    await hero
      .patch(`/api/projects/${project.uuid}/goals`)
      .send({ goals: [{ goal: 'AGILITY', progress: 100 }] })
      .expect(403);
    await hero.delete(`/api/projects/${project.uuid}`).expect(403);

    const heroesResponse = await hero
      .get('/api/projects/heroes')
      .set('Accept-Language', 'en')
      .expect(403);

    expect((heroesResponse.body as { message: string }).message).toBe(
      'Only administrators can list the heroes available for projects',
    );
    await hero.get('/api/users').expect(403);
  });

  it('filters by status and responsible hero for administrators', async () => {
    const project = await createProject('Filter project', otherHeroUuid);

    const response = await admin
      .get(`/api/projects?responsible=${otherHeroUuid}&status=PENDING`)
      .expect(200);

    const listed = (response.body as EnvelopeBody<ProjectShape[]>).data;

    expect(listed.map((item) => item.uuid)).toContain(project.uuid);
    expect(
      listed.every(
        (item) =>
          item.responsible.uuid === otherHeroUuid && item.status === 'PENDING',
      ),
    ).toBe(true);

    await admin.get('/api/projects?status=DONE').expect(400);
    await admin.get('/api/projects?sortBy=password').expect(400);
  });

  it('searches by name case-insensitively, sorts, and paginates', async () => {
    const token = `Paged${Date.now()}`;

    for (const suffix of ['Alpha', 'Charlie', 'Bravo']) {
      await createProject(`${token} ${suffix}`, heroUuid);
    }

    const query = `name=${token.toLowerCase()}&sortBy=name&sortOrder=DESC&limit=2`;
    const firstPage = await admin.get(`/api/projects?${query}`).expect(200);

    const secondPage = await admin
      .get(`/api/projects?${query}&page=2`)
      .expect(200);

    const firstBody = firstPage.body as EnvelopeBody<ProjectShape[]>;
    const secondBody = secondPage.body as EnvelopeBody<ProjectShape[]>;

    expect(firstBody.meta.total).toBe(3);
    expect(firstBody.data.map((item) => item.name)).toEqual([
      `${token} Charlie`,
      `${token} Bravo`,
    ]);
    expect(secondBody.data.map((item) => item.name)).toEqual([
      `${token} Alpha`,
    ]);

    await admin.get('/api/projects?limit=51').expect(400);
    await admin.get('/api/projects?page=0').expect(400);
  });

  it('lists eligible heroes without the administrator', async () => {
    const response = await admin
      .get('/api/projects/heroes?limit=50')
      .expect(200);

    const heroes = (response.body as EnvelopeBody<HeroShape[]>).data;

    expect(heroes.every((item) => item.uuid !== adminUuid)).toBe(true);
    expect(Object.keys(heroes[0]).sort()).toEqual([
      'character',
      'name',
      'uuid',
    ]);
  });

  it('keeps projects of a deactivated hero and allows reassigning them', async () => {
    const credentials = await createIsolatedUser(app);
    const departing = await createAuthAgent(app, credentials);
    const departingUuid = await uuidOf(departing);
    const project = await createProject('Inherited project', departingUuid);

    await admin
      .put(`/api/users/${departingUuid}/status`)
      .send({ status: 'INACTIVE' })
      .expect(200);

    const kept = await admin.get(`/api/projects/${project.uuid}`).expect(200);

    expect(
      (kept.body as EnvelopeBody<ProjectShape>).data.responsible.uuid,
    ).toBe(departingUuid);

    await admin
      .post('/api/projects')
      .send({
        name: 'Too late',
        description: 'Inactive hero.',
        responsibleUuid: departingUuid,
      })
      .expect(422);

    await admin.delete(`/api/users/${departingUuid}`).expect(200);

    const afterDeletion = await admin
      .get(`/api/projects/${project.uuid}`)
      .expect(200);

    expect(
      (afterDeletion.body as EnvelopeBody<ProjectShape>).data.responsible.name,
    ).toBe('Isolated User');

    const reassigned = await admin
      .patch(`/api/projects/${project.uuid}`)
      .send({ responsibleUuid: heroUuid })
      .expect(200);

    expect(
      (reassigned.body as EnvelopeBody<ProjectShape>).data.responsible.uuid,
    ).toBe(heroUuid);
  });

  it('soft-deletes a project', async () => {
    const project = await createProject('Doomed project', heroUuid);

    await admin.delete(`/api/projects/${project.uuid}`).expect(200);
    await admin.get(`/api/projects/${project.uuid}`).expect(404);
    await admin.delete(`/api/projects/${project.uuid}`).expect(404);
  });

  // Granting write abilities through PATCH /roles/:uuid/abilities would change the shared USER
  // role that parallel suites assert, so a separate app grants every PROJECT ability instead.
  // Passport registers its strategies globally, so that app stays open until the last test.
  describe('with every PROJECT ability granted to a hero', () => {
    let grantingApp: INestApplication<App>;

    beforeAll(async () => {
      const projectAbilities: AbilityPair[] = Object.values(Action).map(
        (action) => ({ action, subject: Subject.PROJECT }),
      );

      grantingApp = await createTestApp({
        override: (builder) =>
          builder.overrideProvider(USER_ABILITY_REPOSITORY).useValue({
            findGrantedAbilities: () => Promise.resolve(projectAbilities),
          }),
      });
    });

    afterAll(async () => {
      await grantingApp.close();
    });

    it('keeps the hero read-only', async () => {
      const credentials = await createIsolatedUser(grantingApp);
      const granted = await createAuthAgent(grantingApp, credentials);
      const grantedUuid = await uuidOf(granted);
      const project = await createProject('Granted project', grantedUuid);

      const forbidden =
        'Only administrators can create, edit, or delete projects and update their goals';

      const attempts = [
        () =>
          granted.post('/api/projects').send({
            name: 'Mine',
            description: 'Self-assigned.',
            responsibleUuid: grantedUuid,
          }),
        () =>
          granted
            .patch(`/api/projects/${project.uuid}`)
            .send({ responsibleUuid: heroUuid }),
        () =>
          granted
            .patch(`/api/projects/${project.uuid}/goals`)
            .send({ goals: [{ goal: 'AGILITY', progress: 100 }] }),
        () => granted.delete(`/api/projects/${project.uuid}`),
      ];

      for (const attempt of attempts) {
        const response = await attempt()
          .set('Accept-Language', 'en')
          .expect(403);

        expect((response.body as { message: string }).message).toBe(forbidden);
      }

      const kept = await granted
        .get(`/api/projects/${project.uuid}`)
        .expect(200);

      expect((kept.body as EnvelopeBody<ProjectShape>).data).toMatchObject({
        name: 'Granted project',
        progress: 0,
        responsible: { uuid: grantedUuid },
      });
      const notTheirs = await createProject('Not theirs', heroUuid);

      await granted.get(`/api/projects/${notTheirs.uuid}`).expect(404);
    });
  });
});
