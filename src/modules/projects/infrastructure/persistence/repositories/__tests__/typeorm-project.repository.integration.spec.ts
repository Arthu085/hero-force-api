import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CoreConfigModule } from '@core/config';
import { DatabaseModule } from '@core/database';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { RoleEnum } from '@modules/authorization/domain/enums/role.enum';
import { RoleOrmEntity } from '@modules/authorization/infrastructure/persistence/entities/role.orm-entity';
import { CharacterCode } from '@modules/characters';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { ProjectEntity } from '../../../../domain/entities/project.entity';
import type { ProjectHero } from '../../../../domain/entities/project-hero';
import {
  PROJECT_GOAL_TYPES,
  ProjectGoalType,
} from '../../../../domain/enums/project-goal-type.enum';
import { ProjectStatus } from '../../../../domain/enums/project-status.enum';
import { ProjectGoalOrmEntity } from '../../entities/project-goal.orm-entity';
import { ProjectOrmEntity } from '../../entities/project.orm-entity';
import { TypeOrmProjectHeroRepository } from '../typeorm-project-hero.repository';
import { TypeOrmProjectRepository } from '../typeorm-project.repository';

describe('Project repositories (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let projects: TypeOrmProjectRepository;
  let heroes: TypeOrmProjectHeroRepository;
  let transactionManager: TransactionManagerPort;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        CoreConfigModule,
        DatabaseModule,
        TypeOrmModule.forFeature([
          ProjectOrmEntity,
          ProjectGoalOrmEntity,
          UserOrmEntity,
          RoleOrmEntity,
        ]),
      ],
      providers: [TypeOrmProjectRepository, TypeOrmProjectHeroRepository],
    }).compile();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    projects = moduleRef.get(TypeOrmProjectRepository);
    heroes = moduleRef.get(TypeOrmProjectHeroRepository);
    transactionManager = moduleRef.get(TRANSACTION_MANAGER);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "projects", "users", "roles" RESTART IDENTITY CASCADE',
    );
  });

  async function insertRole(
    name: RoleEnum,
    status = RecordStatus.ACTIVE,
  ): Promise<RoleOrmEntity> {
    const repository = dataSource.getRepository(RoleOrmEntity);

    return repository.save(repository.create({ name, status }));
  }

  async function insertUser(
    name: string,
    roles: RoleOrmEntity[],
    overrides: Partial<UserOrmEntity> = {},
  ): Promise<UserOrmEntity> {
    const repository = dataSource.getRepository(UserOrmEntity);

    return repository.save(
      repository.create({
        name,
        email: `${randomUUID()}@example.com`,
        password: 'hashed-password',
        roles,
        ...overrides,
      }),
    );
  }

  function heroOf(user: UserOrmEntity): ProjectHero {
    return {
      id: user.id,
      uuid: user.uuid,
      name: user.name,
      character: user.character ?? null,
    };
  }

  function createProject(
    name: string,
    responsible: UserOrmEntity,
  ): Promise<ProjectEntity> {
    return transactionManager.runInTransaction(() =>
      projects.create(
        ProjectEntity.create({
          uuid: randomUUID(),
          name,
          description: `${name} description`,
          responsible: heroOf(responsible),
          createdBy: null,
        }),
      ),
    );
  }

  async function setProgress(
    project: ProjectEntity,
    progress: number,
  ): Promise<ProjectEntity> {
    return projects.update(
      project.withGoalChanges(
        PROJECT_GOAL_TYPES.map((goal) => ({ goal, progress })),
        null,
      ),
    );
  }

  describe('TypeOrmProjectRepository', () => {
    it('persists a project with its six goals and the responsible hero', async () => {
      const userRole = await insertRole(RoleEnum.USER);

      const peter = await insertUser('Peter Parker', [userRole], {
        character: CharacterCode.SPIDER_MAN,
      });

      const created = await createProject('Skyfall', peter);

      expect(created.id).toBeGreaterThan(0);
      expect(created.goals.map((goal) => goal.goal)).toEqual(
        PROJECT_GOAL_TYPES,
      );
      expect(created.responsible).toEqual(heroOf(peter));
      expect(created.progressStatus).toBe(ProjectStatus.PENDING);
    });

    it('stores goal changes with the derived progress and status', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const project = await createProject('Skyfall', peter);

      await projects.update(
        project.withGoalChanges(
          [
            {
              goal: ProjectGoalType.AGILITY,
              progress: 100,
              description: 'Fast',
            },
            { goal: ProjectGoalType.DELIGHT, progress: 5 },
          ],
          null,
        ),
      );

      const reloaded = await projects.findByUuid(project.uuid);

      const row = await dataSource
        .getRepository(ProjectOrmEntity)
        .findOneByOrFail({ uuid: project.uuid });

      expect(reloaded?.progress).toBe(17);
      expect(reloaded?.progressStatus).toBe(ProjectStatus.IN_PROGRESS);
      expect(reloaded?.goals[0]).toEqual({
        goal: ProjectGoalType.AGILITY,
        description: 'Fast',
        progress: 100,
      });
      expect(row.progress).toBe(17);
      expect(row.progressStatus).toBe(ProjectStatus.IN_PROGRESS);
      expect(await dataSource.getRepository(ProjectGoalOrmEntity).count()).toBe(
        6,
      );
    });

    it('keeps projects of a deactivated or soft-deleted hero, with the hero name', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const project = await createProject('Skyfall', peter);

      await dataSource
        .getRepository(UserOrmEntity)
        .update(peter.id, { status: RecordStatus.INACTIVE });
      await dataSource.getRepository(UserOrmEntity).softDelete(peter.id);

      const reloaded = await projects.findByUuid(project.uuid);

      expect(reloaded?.responsible.name).toBe('Peter Parker');
    });

    it('hides soft-deleted projects', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const project = await createProject('Skyfall', peter);

      await projects.softDelete(project.markDeleted(null));

      expect(await projects.findByUuid(project.uuid)).toBeNull();
      expect((await projects.findAllPaginated(0, 20, {})).total).toBe(0);
    });

    it('filters, scopes, sorts, and paginates the listing', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const diana = await insertUser('Diana Prince', [userRole]);

      const alpha = await createProject('Alpha', peter);
      const beta = await createProject('Beta', diana);
      await createProject('Gamma', peter);

      await setProgress(alpha, 100);
      await setProgress(beta, 50);

      const byNewest = await projects.findAllPaginated(0, 2, {});

      expect(byNewest.total).toBe(3);
      expect(byNewest.items.map((project) => project.name)).toEqual([
        'Gamma',
        'Beta',
      ]);

      const byProgress = await projects.findAllPaginated(
        0,
        20,
        {},
        { sortBy: 'progress', sortOrder: 'DESC' },
      );

      expect(byProgress.items.map((project) => project.name)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
      ]);

      const byResponsible = await projects.findAllPaginated(
        0,
        20,
        {},
        { sortBy: 'responsible' },
      );

      expect(byResponsible.items.map((project) => project.name)).toEqual([
        'Beta',
        'Gamma',
        'Alpha',
      ]);

      const completed = await projects.findAllPaginated(0, 20, {
        status: ProjectStatus.COMPLETED,
      });

      expect(completed.items.map((project) => project.uuid)).toEqual([
        alpha.uuid,
      ]);

      const ofPeter = await projects.findAllPaginated(0, 20, {
        responsibleUuid: peter.uuid,
      });

      expect(ofPeter.items.map((project) => project.name)).toEqual([
        'Gamma',
        'Alpha',
      ]);

      const scoped = await projects.findAllPaginated(0, 20, {
        responsibleId: diana.id,
        name: 'et',
      });

      expect(scoped.items.map((project) => project.uuid)).toEqual([beta.uuid]);
      expect(scoped.items[0].goals).toHaveLength(6);
    });

    it('finds a project only within the given scope', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const diana = await insertUser('Diana Prince', [userRole]);
      const project = await createProject('Skyfall', peter);

      expect(
        await projects.findByUuid(project.uuid, { responsibleId: diana.id }),
      ).toBeNull();
      expect(
        (await projects.findByUuid(project.uuid, { responsibleId: peter.id }))
          ?.uuid,
      ).toBe(project.uuid);
    });

    it('computes statistics within a scope', async () => {
      expect(await projects.getStatistics({})).toEqual({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        averageProgress: 0,
      });

      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);
      const diana = await insertUser('Diana Prince', [userRole]);

      await setProgress(await createProject('Alpha', peter), 100);
      await setProgress(await createProject('Beta', peter), 33);
      await createProject('Gamma', diana);

      expect(await projects.getStatistics({})).toEqual({
        total: 3,
        pending: 1,
        inProgress: 1,
        completed: 1,
        averageProgress: 44,
      });

      expect(await projects.getStatistics({ responsibleId: diana.id })).toEqual(
        {
          total: 1,
          pending: 1,
          inProgress: 0,
          completed: 0,
          averageProgress: 0,
        },
      );
    });
  });

  describe('TypeOrmProjectHeroRepository', () => {
    it('describes a candidate with its status and USER role', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const adminRole = await insertRole(RoleEnum.ADMIN);

      const peter = await insertUser('Peter Parker', [userRole], {
        character: CharacterCode.SPIDER_MAN,
      });

      const admin = await insertUser('Admin', [adminRole]);

      expect(await heroes.findCandidateByUuid(peter.uuid)).toEqual({
        id: peter.id,
        uuid: peter.uuid,
        name: 'Peter Parker',
        character: CharacterCode.SPIDER_MAN,
        status: RecordStatus.ACTIVE,
        holdsHeroRole: true,
      });
      expect(
        (await heroes.findCandidateByUuid(admin.uuid))?.holdsHeroRole,
      ).toBe(false);
      expect(await heroes.findCandidateByUuid(randomUUID())).toBeNull();
    });

    it('treats a soft-deleted user as missing', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const peter = await insertUser('Peter Parker', [userRole]);

      await dataSource.getRepository(UserOrmEntity).softDelete(peter.id);

      expect(await heroes.findCandidateByUuid(peter.uuid)).toBeNull();
    });

    it('lists only active users holding an active USER role, by name', async () => {
      const userRole = await insertRole(RoleEnum.USER);
      const adminRole = await insertRole(RoleEnum.ADMIN);

      await insertUser('Wade Wilson', [userRole]);
      await insertUser('Bruce Wayne', [userRole]);
      await insertUser('Admin Only', [adminRole]);
      await insertUser('Admin Hero', [adminRole, userRole]);
      await insertUser('Inactive Hero', [userRole], {
        status: RecordStatus.INACTIVE,
      });

      const deleted = await insertUser('Deleted Hero', [userRole]);
      await dataSource.getRepository(UserOrmEntity).softDelete(deleted.id);

      const all = await heroes.findEligiblePaginated(0, 20);

      expect(all.total).toBe(3);
      expect(all.items.map((hero) => hero.name)).toEqual([
        'Admin Hero',
        'Bruce Wayne',
        'Wade Wilson',
      ]);
      expect(Object.keys(all.items[0]).sort()).toEqual([
        'character',
        'id',
        'name',
        'uuid',
      ]);

      const filtered = await heroes.findEligiblePaginated(0, 1, 'w');

      expect(filtered.total).toBe(2);
      expect(filtered.items.map((hero) => hero.name)).toEqual(['Bruce Wayne']);
    });

    it('lists no heroes when the USER role is inactive', async () => {
      const userRole = await insertRole(RoleEnum.USER, RecordStatus.INACTIVE);

      await insertUser('Peter Parker', [userRole]);

      expect((await heroes.findEligiblePaginated(0, 20)).total).toBe(0);
    });
  });
});
