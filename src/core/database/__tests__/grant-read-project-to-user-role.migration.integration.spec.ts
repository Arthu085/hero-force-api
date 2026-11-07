import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { CoreConfigModule } from '@core/config';
import { RoleEnum } from '@modules/authorization/domain/enums/role.enum';
import { AbilitiesSeeder } from '@modules/authorization/infrastructure/seeds/abilities.seeder';
import { RolesSeeder } from '@modules/authorization/infrastructure/seeds/roles.seeder';
import { DatabaseModule } from '../database.module';
import { GrantReadProjectToUserRole1794070369426 } from '../migrations/1794070369426-grant-read-project-to-user-role';

describe('GrantReadProjectToUserRole1794070369426 (integration)', () => {
  const migration = new GrantReadProjectToUserRole1794070369426();

  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreConfigModule, DatabaseModule],
    }).compile();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    queryRunner = dataSource.createQueryRunner();
  });

  afterAll(async () => {
    await queryRunner.release();
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "roles", "abilities" RESTART IDENTITY CASCADE',
    );
  });

  async function grantsOf(role: RoleEnum): Promise<string[]> {
    const rows: Array<{ pair: string }> = await dataSource.query(
      `
        SELECT a.action || ':' || a.subject AS pair
        FROM "role_abilities" ra
        JOIN "roles" r ON r.id = ra.role_id
        JOIN "abilities" a ON a.id = ra.ability_id
        WHERE r.name = $1
      `,
      [role],
    );

    return rows.map((row) => row.pair).sort();
  }

  // Reproduces a database seeded by the previous release: both roles exist
  // and USER holds a grant added at runtime, but no PROJECT ability exists.
  async function seedPreviousReleaseRoles(): Promise<void> {
    await dataSource.query(
      `INSERT INTO "abilities" ("action", "subject") VALUES ('READ', 'ROLE')`,
    );
    await dataSource.query(
      `INSERT INTO "roles" ("name") VALUES ('ADMIN'), ('USER')`,
    );
    await dataSource.query(
      `
        INSERT INTO "role_abilities" (role_id, ability_id)
        SELECT r.id, a.id FROM "roles" r, "abilities" a
        WHERE r.name = 'USER' AND a.action = 'READ' AND a.subject = 'ROLE'
      `,
    );
  }

  it('creates (READ, PROJECT) and grants it to USER only, idempotently', async () => {
    await seedPreviousReleaseRoles();

    await migration.up(queryRunner);
    await migration.up(queryRunner);

    expect(await grantsOf(RoleEnum.USER)).toEqual([
      'READ:PROJECT',
      'READ:ROLE',
    ]);
    expect(await grantsOf(RoleEnum.ADMIN)).toEqual([]);
  });

  it('revokes only the USER grant when reverted', async () => {
    await seedPreviousReleaseRoles();
    await migration.up(queryRunner);

    await migration.down(queryRunner);
    await migration.down(queryRunner);

    expect(await grantsOf(RoleEnum.USER)).toEqual(['READ:ROLE']);
  });

  it('lets a later seed create USER with the same grant on a fresh database', async () => {
    await migration.up(queryRunner);

    const abilities: unknown[] = await dataSource.query(
      `SELECT 1 FROM "abilities" WHERE "action" = 'READ' AND "subject" = 'PROJECT'`,
    );

    expect(abilities).toHaveLength(1);
    expect(await dataSource.query('SELECT 1 FROM "role_abilities"')).toEqual(
      [],
    );

    await new AbilitiesSeeder().run(dataSource.manager);
    await new RolesSeeder().run(dataSource.manager);

    expect(await grantsOf(RoleEnum.USER)).toEqual(['READ:PROJECT']);
  });
});
