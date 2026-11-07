import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
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
});
