import { Logger } from '@nestjs/common';
import { RoleEntity } from '@modules/authorization/domain/entities/role.entity';
import { RoleEnum } from '@modules/authorization/domain/enums/role.enum';
import { InactiveRoleError } from '@modules/authorization/domain/errors/inactive-role.error';
import { RoleNotFoundError } from '@modules/authorization/domain/errors/role-not-found.error';
import type { RoleRepository } from '@modules/authorization/domain/repositories/role.repository';
import { CharacterCode } from '@modules/characters';
import { EmailSchedulingUnavailableError } from '@shared/application/ports';
import { EmailType } from '@shared/domain/enums/email-type.enum';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { buildUser } from '@test/support/builders/user.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { UserEntity } from '../../../domain/entities/user.entity';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error';
import type { UserRepository } from '../../../domain/repositories/user.repository';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import { RegisterUserUseCase } from '../register-user.use-case';

function buildRole(
  name: RoleEnum,
  status: RecordStatus = RecordStatus.ACTIVE,
): RoleEntity {
  return RoleEntity.reconstitute({
    id: 1,
    uuid: `${name.toLowerCase()}-role`,
    status,
    name,
    abilities: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

const transactionManager = {
  runInTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
  runInSavepoint: <T>(work: () => Promise<T>): Promise<T> => work(),
};

const input = {
  name: 'Jane Doe',
  email: '  Jane@Example.COM ',
  password: 'StrongPass123!',
  character: null,
};

function buildHarness(
  options: {
    existing?: UserEntity | null;
    role?: RoleEntity | null;
    create?: jest.Mock;
    schedule?: jest.Mock;
  } = {},
) {
  const create =
    options.create ??
    jest.fn().mockImplementation((user: UserEntity) => Promise.resolve(user));

  const findByEmail = jest.fn().mockResolvedValue(options.existing ?? null);

  const findByName = jest
    .fn()
    .mockResolvedValue(
      options.role === undefined ? buildRole(RoleEnum.USER) : options.role,
    );

  const hash = jest.fn((plain: string) => Promise.resolve(`hashed:${plain}`));

  const schedule =
    options.schedule ?? jest.fn().mockResolvedValue({ scheduled: true });

  const useCase = new RegisterUserUseCase(
    mockOf<UserRepository>({ findByEmail, create }),
    mockOf<RoleRepository>({ findByName }),
    mockOf<PasswordHasher>({ hash }),
    { schedule },
    transactionManager,
  );

  return { useCase, create, findByEmail, findByName, hash, schedule };
}

describe('RegisterUserUseCase', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates an unconfirmed USER account with a hashed password and schedules its confirmation', async () => {
    const { useCase, create, findByEmail, findByName, schedule } =
      buildHarness();

    await useCase.execute({ ...input, character: CharacterCode.BATMAN });

    expect(findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(findByName).toHaveBeenCalledWith(RoleEnum.USER);

    const [created] = create.mock.calls[0] as [UserEntity];
    expect(created.email).toBe('jane@example.com');
    expect(created.password).toBe('hashed:StrongPass123!');
    expect(created.roles.map((role) => role.name)).toEqual([RoleEnum.USER]);
    expect(created.character).toBe(CharacterCode.BATMAN);
    expect(created.emailConfirmedAt).toBeNull();
    expect(created.createdBy).toBeNull();
    expect(created.status).toBe(RecordStatus.ACTIVE);

    expect(schedule).toHaveBeenCalledWith({
      emailType: EmailType.EMAIL_CONFIRMATION,
      recipient: 'jane@example.com',
    });
  });

  it('stores no character when none is chosen', async () => {
    const { useCase, create } = buildHarness();

    await useCase.execute(input);

    const [created] = create.mock.calls[0] as [UserEntity];
    expect(created.character).toBeNull();
  });

  it('returns silently for a registered email, hashing anyway and writing nothing', async () => {
    const { useCase, create, hash, schedule } = buildHarness({
      existing: buildUser({ email: 'jane@example.com' }),
    });

    await expect(useCase.execute(input)).resolves.toBeUndefined();

    expect(hash).toHaveBeenCalledWith('StrongPass123!');
    expect(create).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('returns silently when a concurrent registration wins the unique index', async () => {
    const { useCase, schedule } = buildHarness({
      create: jest.fn().mockRejectedValue(new EmailAlreadyInUseError()),
    });

    await expect(useCase.execute(input)).resolves.toBeUndefined();
    expect(schedule).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null, RoleNotFoundError],
    [
      'inactive',
      buildRole(RoleEnum.USER, RecordStatus.INACTIVE),
      InactiveRoleError,
    ],
  ] as const)(
    'refuses to register when the USER role is %s',
    async (_label, role, error) => {
      const { useCase, create } = buildHarness({ role });

      await expect(useCase.execute(input)).rejects.toThrow(error);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('rolls back when the outbox is unavailable', async () => {
    const { useCase } = buildHarness({
      schedule: jest
        .fn()
        .mockResolvedValue({ scheduled: false, reason: 'UNAVAILABLE' }),
    });

    await expect(useCase.execute(input)).rejects.toThrow(
      EmailSchedulingUnavailableError,
    );
  });

  it('commits and logs a warning when the quota denies the confirmation email', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const { useCase, create } = buildHarness({
      schedule: jest
        .fn()
        .mockResolvedValue({ scheduled: false, reason: 'EXHAUSTED' }),
    });

    await useCase.execute(input);

    expect(create).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Email confirmation not scheduled',
        reason: 'EXHAUSTED',
      }),
    );
  });
});
