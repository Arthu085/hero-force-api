import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { PROJECT_REPOSITORY } from '../../../../domain/repositories/project.repository';
import { PROJECT_HERO_REPOSITORY } from '../../../../domain/repositories/project-hero.repository';
import { TypeOrmProjectRepository } from '../typeorm-project.repository';
import { TypeOrmProjectHeroRepository } from '../typeorm-project-hero.repository';
import { ProjectGoalOrmEntity } from '../../entities/project-goal.orm-entity';
import { CoreConfigModule } from '@core/config';
import { DatabaseModule } from '@core/database';
import {
  buildProjectAdmin,
  buildProjectHeroViewer,
} from '@test/support/builders/project.builder';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { RoleEnum } from '@modules/authorization/domain/enums/role.enum';
import { RoleOrmEntity } from '@modules/authorization/infrastructure/persistence/entities/role.orm-entity';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { CreateProjectUseCase } from '../../../../application/use-cases/create-project.use-case';
import { UpdateProjectUseCase } from '../../../../application/use-cases/update-project.use-case';
import { UpdateProjectGoalsUseCase } from '../../../../application/use-cases/update-project-goals.use-case';
import { DeleteProjectUseCase } from '../../../../application/use-cases/delete-project.use-case';
import { ListProjectHistoryUseCase } from '../../../../application/use-cases/list-project-history.use-case';
import { GetProjectUseCase } from '../../../../application/use-cases/get-project.use-case';
import { ProjectGoalType } from '../../../../domain/enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../../../domain/enums/project-history-type.enum';
import { ProjectNotFoundError } from '../../../../domain/errors/project-not-found.error';
import { InactiveProjectError } from '../../../../domain/errors/inactive-project.error';
import { ProjectHistoryOrmEntity } from '../../entities/project-history.orm-entity';
import { ProjectOrmEntity } from '../../entities/project.orm-entity';
import { TypeOrmProjectHistoryRepository } from '../typeorm-project-history.repository';
import { PROJECT_HISTORY_REPOSITORY } from '../../../../domain/repositories/project-history.repository';

describe('Project history (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let actor: UserOrmEntity;
  let hero: UserOrmEntity;
  let other: UserOrmEntity;
  let history: TypeOrmProjectHistoryRepository;
  let create: CreateProjectUseCase;
  let update: UpdateProjectUseCase;
  let goals: UpdateProjectGoalsUseCase;
  let remove: DeleteProjectUseCase;
  let list: ListProjectHistoryUseCase;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        CoreConfigModule,
        DatabaseModule,
        TypeOrmModule.forFeature([
          ProjectOrmEntity,
          ProjectGoalOrmEntity,
          ProjectHistoryOrmEntity,
          UserOrmEntity,
        ]),
      ],
      providers: [
        { provide: PROJECT_REPOSITORY, useClass: TypeOrmProjectRepository },
        {
          provide: PROJECT_HERO_REPOSITORY,
          useClass: TypeOrmProjectHeroRepository,
        },
        {
          provide: PROJECT_HISTORY_REPOSITORY,
          useClass: TypeOrmProjectHistoryRepository,
        },
        GetProjectUseCase,
        CreateProjectUseCase,
        UpdateProjectUseCase,
        UpdateProjectGoalsUseCase,
        DeleteProjectUseCase,
        ListProjectHistoryUseCase,
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
    history = moduleRef.get(PROJECT_HISTORY_REPOSITORY);
    create = moduleRef.get(CreateProjectUseCase);
    update = moduleRef.get(UpdateProjectUseCase);
    goals = moduleRef.get(UpdateProjectGoalsUseCase);
    remove = moduleRef.get(DeleteProjectUseCase);
    list = moduleRef.get(ListProjectHistoryUseCase);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    const roles = dataSource.getRepository(RoleOrmEntity);
    const role = await roles.save(roles.create({ name: RoleEnum.USER }));
    const users = dataSource.getRepository(UserOrmEntity);

    const insert = (name: string) =>
      users.save(
        users.create({
          name,
          email: `${randomUUID()}@example.com`,
          password: 'hash',
          roles: [role],
        }),
      );

    actor = await insert('History actor');
    hero = await insert('First hero');
    other = await insert('Second hero');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await dataSource.query(
      'TRUNCATE TABLE "projects", "users", "roles" RESTART IDENTITY CASCADE',
    );
  });

  const viewer = () => buildProjectAdmin(actor.id);

  const makeProject = () =>
    create.execute({
      name: 'History project',
      description: 'Original',
      responsibleUuid: hero.uuid,
      viewer: viewer(),
    });

  it('records every event, skips no-ops, and pages newest first with deterministic ties', async () => {
    const project = await makeProject();
    await update.execute({
      uuid: project.uuid,
      name: project.name,
      description: project.description,
      responsibleUuid: hero.uuid,
      viewer: viewer(),
    });
    await goals.execute({
      uuid: project.uuid,
      goals: [
        { goal: ProjectGoalType.AGILITY, progress: 0, description: null },
      ],
      viewer: viewer(),
    });
    expect((await history.findByProject(project.id, 0, 20)).total).toBe(1);

    await update.execute({
      uuid: project.uuid,
      name: 'Renamed',
      description: 'Changed',
      responsibleUuid: other.uuid,
      viewer: viewer(),
    });
    await goals.execute({
      uuid: project.uuid,
      goals: [
        { goal: ProjectGoalType.AGILITY, description: 'Fast', progress: 20 },
      ],
      viewer: viewer(),
    });
    await goals.execute({
      uuid: project.uuid,
      goals: [
        { goal: ProjectGoalType.AGILITY, description: null, progress: 70 },
      ],
      viewer: viewer(),
    });
    await remove.execute({ uuid: project.uuid, viewer: viewer() });

    const all = await history.findByProject(project.id, 0, 20);
    expect(all.total).toBe(9);
    expect(all.items[0].type).toBe(ProjectHistoryType.PROJECT_DELETED);
    expect(all.items.at(-1)).toMatchObject({
      type: ProjectHistoryType.PROJECT_CREATED,
      previousValues: null,
      newValues: {
        name: 'History project',
        description: 'Original',
        responsible: { uuid: hero.uuid, name: hero.name },
      },
    });
    expect(
      all.items.find(
        (item) => item.type === ProjectHistoryType.RESPONSIBLE_HERO_CHANGED,
      ),
    ).toMatchObject({
      previousValues: { responsible: { uuid: hero.uuid, name: hero.name } },
      newValues: { responsible: { uuid: other.uuid, name: other.name } },
    });
    expect(
      all.items.find((item) => item.newValues?.progress === 70),
    ).toMatchObject({
      type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
      goal: ProjectGoalType.AGILITY,
      previousValues: { progress: 20 },
      newValues: { progress: 70 },
    });
    expect(
      all.items.every(
        (item) =>
          JSON.stringify(item.actor) ===
          JSON.stringify({ uuid: actor.uuid, name: actor.name }),
      ),
    ).toBe(true);
    expect(JSON.stringify(all.items)).not.toContain('@example.com');
    expect(JSON.stringify(all.items)).not.toContain('password');
    expect(all.items.map((item) => item.type)).toEqual(
      expect.arrayContaining(Object.values(ProjectHistoryType)),
    );
    expect((await history.findByProject(project.id, 2, 2)).items).toEqual(
      all.items.slice(2, 4),
    );
    expect((await history.findByProject(project.id, 100, 2)).items).toEqual([]);
    await expect(
      list.execute({
        uuid: project.uuid,
        page: 1,
        limit: 20,
        viewer: viewer(),
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('preserves history and actor names after deactivation and soft deletion, and entries after hard deletion', async () => {
    const project = await makeProject();
    const users = dataSource.getRepository(UserOrmEntity);
    await users.update(actor.id, { status: RecordStatus.INACTIVE });
    expect(
      (await history.findByProject(project.id, 0, 20)).items[0].actor?.name,
    ).toBe(actor.name);
    await users.softDelete(actor.id);
    expect(
      (await history.findByProject(project.id, 0, 20)).items[0].actor,
    ).toEqual({ uuid: actor.uuid, name: actor.name });
    await users.delete(actor.id);
    expect(
      (await history.findByProject(project.id, 0, 20)).items[0].actor,
    ).toBeNull();
    expect((await history.findByProject(project.id, 0, 20)).total).toBe(1);
  });

  it('enforces current project visibility and active-record rules, including after reassignment', async () => {
    const project = await makeProject();
    const input = { uuid: project.uuid, page: 1, limit: 20 };
    expect(
      (
        await list.execute({
          ...input,
          viewer: buildProjectHeroViewer(hero.id),
        })
      ).total,
    ).toBe(1);
    await expect(
      list.execute({ ...input, viewer: buildProjectHeroViewer(other.id) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    await update.execute({
      uuid: project.uuid,
      responsibleUuid: other.uuid,
      viewer: viewer(),
    });
    await expect(
      list.execute({ ...input, viewer: buildProjectHeroViewer(hero.id) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(
      (
        await list.execute({
          ...input,
          viewer: buildProjectHeroViewer(other.id),
        })
      ).total,
    ).toBe(2);
    await dataSource
      .getRepository(ProjectOrmEntity)
      .update(project.id, { status: RecordStatus.INACTIVE });
    await expect(
      list.execute({ ...input, viewer: viewer() }),
    ).rejects.toBeInstanceOf(InactiveProjectError);
  });

  it('orders a delayed outer transaction by the event write time after the project lock', async () => {
    const project = await makeProject();

    const transactionManager =
      moduleRef.get<TransactionManagerPort>(TRANSACTION_MANAGER);

    let release: () => void = () => undefined;
    let started: () => void = () => undefined;

    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });

    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });

    const delayed = transactionManager.runInTransaction(async () => {
      started();
      await resume;
      return goals.execute({
        uuid: project.uuid,
        goals: [{ goal: ProjectGoalType.AGILITY, progress: 70 }],
        viewer: viewer(),
      });
    });

    await ready;
    await dataSource.query('SELECT pg_sleep(0.02)');
    try {
      await goals.execute({
        uuid: project.uuid,
        goals: [{ goal: ProjectGoalType.AGILITY, progress: 20 }],
        viewer: viewer(),
      });
    } finally {
      release();
    }
    await delayed;

    const result = await history.findByProject(project.id, 0, 20);

    expect(result.items[0]).toMatchObject({
      type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
      previousValues: { progress: 20 },
      newValues: { progress: 70 },
    });
    expect(result.items[1]).toMatchObject({
      previousValues: { progress: 0 },
      newValues: { progress: 20 },
    });
  });

  it('rolls back appended events with project rows when the outer transaction fails', async () => {
    const transactionManager =
      moduleRef.get<TransactionManagerPort>(TRANSACTION_MANAGER);

    await expect(
      transactionManager.runInTransaction(async () => {
        await makeProject();
        throw new Error('Outer transaction failed');
      }),
    ).rejects.toThrow('Outer transaction failed');
    expect(
      await dataSource.getRepository(ProjectHistoryOrmEntity).count(),
    ).toBe(0);
    expect(await dataSource.getRepository(ProjectOrmEntity).count()).toBe(0);
  });

  describe('goal progress timeline', () => {
    const at = (value: string) => new Date(value);

    const insertEvents = (
      projectId: number,
      events: {
        type: ProjectHistoryType;
        goal?: ProjectGoalType;
        createdAt: Date;
        from?: number;
        to?: number;
      }[],
    ) =>
      dataSource.getRepository(ProjectHistoryOrmEntity).insert(
        events.map(({ type, goal = null, createdAt, from, to }) => ({
          projectId,
          actorId: actor.id,
          type,
          goal,
          createdAt,
          previousValues: from === undefined ? null : { progress: from },
          newValues: to === undefined ? null : { progress: to },
        })),
      );

    it('reads the first event, the last progress before the window, and ordered window changes of one project only', async () => {
      const project = await makeProject();
      const neighbour = await makeProject();

      await insertEvents(project.id, [
        {
          type: ProjectHistoryType.RESPONSIBLE_HERO_CHANGED,
          createdAt: at('2026-01-01T00:00:00Z'),
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AGILITY,
          createdAt: at('2026-01-05T00:00:00Z'),
          from: 0,
          to: 10,
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AGILITY,
          createdAt: at('2026-01-06T00:00:00Z'),
          from: 10,
          to: 20,
        },
        {
          type: ProjectHistoryType.GOAL_DESCRIPTION_CHANGED,
          goal: ProjectGoalType.AGILITY,
          createdAt: at('2026-01-07T00:00:00Z'),
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.DELIGHT,
          createdAt: at('2026-02-01T00:00:00Z'),
          from: 0,
          to: 30,
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AGILITY,
          createdAt: at('2026-02-01T00:00:00Z'),
          from: 20,
          to: 40,
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AGILITY,
          createdAt: at('2026-02-03T00:00:00Z'),
          from: 40,
          to: 35,
        },
      ]);
      await insertEvents(neighbour.id, [
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AMBITION,
          createdAt: at('2025-12-01T00:00:00Z'),
          from: 0,
          to: 90,
        },
        {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          goal: ProjectGoalType.AMBITION,
          createdAt: at('2026-02-02T00:00:00Z'),
          from: 90,
          to: 95,
        },
      ]);

      const timeline = await history.findGoalProgressTimeline(
        project.id,
        at('2026-02-01T00:00:00Z'),
      );

      expect(timeline).toEqual({
        firstEvent: {
          type: ProjectHistoryType.RESPONSIBLE_HERO_CHANGED,
          at: at('2026-01-01T00:00:00Z'),
        },
        progressBefore: [{ goal: ProjectGoalType.AGILITY, progress: 20 }],
        changes: [
          {
            goal: ProjectGoalType.DELIGHT,
            at: at('2026-02-01T00:00:00Z'),
            previousProgress: 0,
            progress: 30,
          },
          {
            goal: ProjectGoalType.AGILITY,
            at: at('2026-02-01T00:00:00Z'),
            previousProgress: 20,
            progress: 40,
          },
          {
            goal: ProjectGoalType.AGILITY,
            at: at('2026-02-03T00:00:00Z'),
            previousProgress: 40,
            progress: 35,
          },
        ],
      });
    });

    it('reports the creation event of a tracked project and nothing for a project without history', async () => {
      const project = await makeProject();
      await goals.execute({
        uuid: project.uuid,
        goals: [{ goal: ProjectGoalType.AGILITY, progress: 25 }],
        viewer: viewer(),
      });

      const tracked = await history.findGoalProgressTimeline(
        project.id,
        project.createdAt,
      );

      expect(tracked.firstEvent?.type).toBe(ProjectHistoryType.PROJECT_CREATED);
      expect(tracked.progressBefore).toEqual([]);
      expect(tracked.changes).toEqual([
        expect.objectContaining({
          goal: ProjectGoalType.AGILITY,
          previousProgress: 0,
          progress: 25,
        }),
      ]);

      await dataSource
        .getRepository(ProjectHistoryOrmEntity)
        .delete({ projectId: project.id });

      expect(
        await history.findGoalProgressTimeline(project.id, project.createdAt),
      ).toEqual({ firstEvent: null, progressBefore: [], changes: [] });
    });
  });

  it.each(['create', 'update', 'goals', 'delete'])(
    'rolls back the %s mutation when history insertion fails',
    async (operation) => {
      const project = await makeProject();
      jest
        .spyOn(history, 'append')
        .mockRejectedValueOnce(new Error('History unavailable'));

      const run = () => {
        switch (operation) {
          case 'create':
            return makeProject();
          case 'update':
            return update.execute({
              uuid: project.uuid,
              name: 'Rolled back',
              viewer: viewer(),
            });
          case 'goals':
            return goals.execute({
              uuid: project.uuid,
              goals: [{ goal: ProjectGoalType.AGILITY, progress: 70 }],
              viewer: viewer(),
            });
          default:
            return remove.execute({ uuid: project.uuid, viewer: viewer() });
        }
      };

      await expect(run()).rejects.toThrow('History unavailable');

      const reloaded = await moduleRef
        .get(GetProjectUseCase)
        .execute({ uuid: project.uuid, viewer: viewer() });

      expect(reloaded.name).toBe(project.name);
      expect(reloaded.goals[0].progress).toBe(0);
      expect(await dataSource.getRepository(ProjectOrmEntity).count()).toBe(1);
      expect(
        await dataSource.getRepository(ProjectHistoryOrmEntity).count(),
      ).toBe(1);
    },
  );
});
