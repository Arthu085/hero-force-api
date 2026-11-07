import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { CoreConfigModule } from '@core/config';
import { RoleEnum } from '@modules/authorization/domain/enums/role.enum';
import {
  ABILITY_CATALOG,
  ROLE_ABILITY_GRANTS,
} from '@modules/authorization/domain/catalog/ability-catalog';
import { AbilitiesSeeder } from '@modules/authorization/infrastructure/seeds/abilities.seeder';
import { RolesSeeder } from '@modules/authorization/infrastructure/seeds/roles.seeder';
import { Action } from '@shared/domain/enums/action.enum';
import { Subject } from '@shared/domain/authorization/subject';
import { DatabaseModule } from '../database.module';
import { RevokeReadUserFromUserRole1794068245174 } from '../migrations/1794068245174-revoke-read-user-from-user-role';

interface GrantRow {
  action: Action;
  subject: Subject;
}

function pairKey({ action, subject }: GrantRow): string {
  return `${action}:${subject}`;
}

const READ_USER: GrantRow = { action: Action.READ, subject: Subject.USER };
const READ_ROLE: GrantRow = { action: Action.READ, subject: Subject.ROLE };

describe('RevokeReadUserFromUserRole1794068245174 (integration)', () => {
  const migration = new RevokeReadUserFromUserRole1794068245174();

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
    jest.restoreAllMocks();
    await dataSource.query(
      'TRUNCATE TABLE "roles", "abilities" RESTART IDENTITY CASCADE',
    );
  });

  async function grantsOf(role: RoleEnum): Promise<string[]> {
    const rows: GrantRow[] = await dataSource.query(
      `
        SELECT a.action AS action, a.subject AS subject
        FROM "role_abilities" ra
        JOIN "roles" r ON r.id = ra.role_id
        JOIN "abilities" a ON a.id = ra.ability_id
        WHERE r.name = $1
      `,
      [role],
    );

    return rows.map(pairKey).sort();
  }

  async function grant(role: RoleEnum, pair: GrantRow): Promise<void> {
    await dataSource.query(
      `
        INSERT INTO "role_abilities" (role_id, ability_id)
        SELECT r.id, a.id FROM "roles" r, "abilities" a
        WHERE r.name = $1 AND a.action = $2 AND a.subject = $3
      `,
      [role, pair.action, pair.subject],
    );
  }

  // Reproduces a database seeded by the previous release, where USER was
  // granted (READ, USER) by default, plus a grant added at runtime.
  async function seedPreviousReleaseGrants(): Promise<void> {
    jest.replaceProperty(ROLE_ABILITY_GRANTS, RoleEnum.USER, []);

    await new AbilitiesSeeder().run(dataSource.manager);
    await new RolesSeeder().run(dataSource.manager);
    await grant(RoleEnum.USER, READ_USER);
    await grant(RoleEnum.USER, READ_ROLE);
  }

  it('revokes (READ, USER) from USER only, keeping other grants, and is idempotent', async () => {
    await seedPreviousReleaseGrants();

    await migration.up(queryRunner);

    expect(await grantsOf(RoleEnum.USER)).toEqual([pairKey(READ_ROLE)]);
    expect(await grantsOf(RoleEnum.ADMIN)).toEqual(
      ABILITY_CATALOG.map(pairKey).sort(),
    );

    await migration.up(queryRunner);

    expect(await grantsOf(RoleEnum.USER)).toEqual([pairKey(READ_ROLE)]);
  });

  it('restores (READ, USER) on USER when reverted, without duplicating it', async () => {
    await seedPreviousReleaseGrants();
    await migration.up(queryRunner);

    await migration.down(queryRunner);
    await migration.down(queryRunner);

    expect(await grantsOf(RoleEnum.USER)).toEqual(
      [pairKey(READ_ROLE), pairKey(READ_USER)].sort(),
    );
  });

  it('is a no-op in both directions when the role or ability does not exist', async () => {
    await expect(migration.up(queryRunner)).resolves.toBeUndefined();
    await expect(migration.down(queryRunner)).resolves.toBeUndefined();

    const rows: unknown[] = await dataSource.query(
      'SELECT 1 FROM "role_abilities"',
    );

    expect(rows).toEqual([]);
  });
});
