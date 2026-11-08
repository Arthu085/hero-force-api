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
