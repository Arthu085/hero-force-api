import { mockOf } from '@test/support/mocks/mock-of';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { AbilityEntity } from '../../../domain/entities/ability.entity';
import type { RoleEntity } from '../../../domain/entities/role.entity';
import { RoleEnum } from '../../../domain/enums/role.enum';
import { AdminRoleAbilitiesImmutableError } from '../../../domain/errors/admin-role-abilities-immutable.error';
import { InactiveAbilityError } from '../../../domain/errors/inactive-ability.error';
import { InactiveRoleError } from '../../../domain/errors/inactive-role.error';
import { RoleNotFoundError } from '../../../domain/errors/role-not-found.error';
import { UnknownAbilityError } from '../../../domain/errors/unknown-ability.error';
import { UserProjectAbilitiesRestrictedError } from '../../../domain/errors/user-project-abilities-restricted.error';
import type { AbilityRepository } from '../../../domain/repositories/ability.repository';
import type { RoleRepository } from '../../../domain/repositories/role.repository';
import { UpdateRoleAbilitiesUseCase } from '../update-role-abilities.use-case';

describe('UpdateRoleAbilitiesUseCase', () => {
  function buildRole(
    status: RecordStatus = RecordStatus.ACTIVE,
    name: RoleEnum = RoleEnum.USER,
  ): {
    role: RoleEntity;
    withAbilities: jest.Mock;
  } {
    const withAbilities = jest.fn().mockImplementation(function (
      this: RoleEntity,
      abilities: AbilityEntity[],
    ) {
      return { ...this, abilities };
    });

    const role = mockOf<RoleEntity>({
      uuid: 'role-1',
      status,
      name,
      withAbilities,
    });

    return { role, withAbilities };
  }

  it('replaces the role abilities when every pair resolves', async () => {
    const { role, withAbilities } = buildRole();

    const resolvedAbilities = [
      mockOf<AbilityEntity>({ uuid: 'ability-1', status: RecordStatus.ACTIVE }),
    ];

    const updatedRole = { uuid: 'role-1', abilities: resolvedAbilities };

    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn().mockResolvedValue(updatedRole);

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn().mockResolvedValue(resolvedAbilities);

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    const input = {
      roleUuid: 'role-1',
      abilities: [{ action: Action.READ, subject: Subject.USER }],
    };

    await expect(useCase.execute(input)).resolves.toBe(updatedRole);

    expect(findByUuid).toHaveBeenCalledWith('role-1');
    expect(findByPairs).toHaveBeenCalledWith(input.abilities);
    expect(withAbilities).toHaveBeenCalledWith(resolvedAbilities);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each([Action.CREATE, Action.UPDATE, Action.DELETE])(
    'rejects USER %s PROJECT before resolving or mutating any grants',
    async (action) => {
      const { role, withAbilities } = buildRole();
      const update = jest.fn();
      const findByPairs = jest.fn();

      const useCase = new UpdateRoleAbilitiesUseCase(
        mockOf<RoleRepository>({
          findByUuid: jest.fn().mockResolvedValue(role),
          update,
        }),
        mockOf<AbilityRepository>({ findByPairs }),
      );

      await expect(
        useCase.execute({
          roleUuid: role.uuid,
          abilities: [
            { action: Action.READ, subject: Subject.PROJECT },
            { action, subject: Subject.PROJECT },
          ],
        }),
      ).rejects.toBeInstanceOf(UserProjectAbilitiesRestrictedError);
      expect(findByPairs).not.toHaveBeenCalled();
      expect(withAbilities).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('collapses duplicate pairs instead of reporting them as unknown abilities', async () => {
    const { role, withAbilities } = buildRole();

    const resolvedAbilities = [
      mockOf<AbilityEntity>({ uuid: 'ability-1', status: RecordStatus.ACTIVE }),
      mockOf<AbilityEntity>({ uuid: 'ability-2', status: RecordStatus.ACTIVE }),
    ];

    const updatedRole = { uuid: 'role-1', abilities: resolvedAbilities };

    const roleRepository = mockOf<RoleRepository>({
      findByUuid: jest.fn().mockResolvedValue(role),
      update: jest.fn().mockResolvedValue(updatedRole),
    });

    const findByPairs = jest.fn().mockResolvedValue(resolvedAbilities);

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [
          { action: Action.READ, subject: Subject.USER },
          { action: Action.READ, subject: Subject.ROLE },
          { action: Action.READ, subject: Subject.USER },
        ],
      }),
    ).resolves.toBe(updatedRole);

    expect(findByPairs).toHaveBeenCalledWith([
      { action: Action.READ, subject: Subject.USER },
      { action: Action.READ, subject: Subject.ROLE },
    ]);
    expect(withAbilities).toHaveBeenCalledWith(resolvedAbilities);
  });

  it('throws RoleNotFoundError when the role does not exist', async () => {
    const findByUuid = jest.fn().mockResolvedValue(null);
    const roleRepository = mockOf<RoleRepository>({ findByUuid });

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs: jest.fn(),
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({ roleUuid: 'missing', abilities: [] }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it('throws UnknownAbilityError when a requested pair does not resolve', async () => {
    const { role } = buildRole();
    const findByUuid = jest.fn().mockResolvedValue(role);

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update: jest.fn(),
    });

    // Only one of the two requested pairs resolves.
    const findByPairs = jest.fn().mockResolvedValue([
      mockOf<AbilityEntity>({
        uuid: 'ability-1',
        status: RecordStatus.ACTIVE,
      }),
    ]);

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [
          { action: Action.READ, subject: Subject.USER },
          { action: Action.READ, subject: Subject.ROLE },
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownAbilityError);
  });

  it('throws InactiveAbilityError when a requested pair resolves to an INACTIVE ability and never persists', async () => {
    const { role, withAbilities } = buildRole();
    const update = jest.fn();

    const roleRepository = mockOf<RoleRepository>({
      findByUuid: jest.fn().mockResolvedValue(role),
      update,
    });

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs: jest.fn().mockResolvedValue([
        mockOf<AbilityEntity>({
          uuid: 'ability-1',
          status: RecordStatus.ACTIVE,
        }),
        mockOf<AbilityEntity>({
          uuid: 'ability-2',
          status: RecordStatus.INACTIVE,
        }),
      ]),
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [
          { action: Action.READ, subject: Subject.USER },
          { action: Action.READ, subject: Subject.ROLE },
        ],
      }),
    ).rejects.toBeInstanceOf(InactiveAbilityError);

    expect(withAbilities).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('throws InactiveRoleError when the role is INACTIVE and never touches the repository mutation path', async () => {
    const { role } = buildRole(RecordStatus.INACTIVE);
    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn();

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn();

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [{ action: Action.READ, subject: Subject.USER }],
      }),
    ).rejects.toBeInstanceOf(InactiveRoleError);

    expect(findByPairs).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('clears every grant when the abilities array is empty', async () => {
    const { role, withAbilities } = buildRole(
      RecordStatus.ACTIVE,
      RoleEnum.USER,
    );

    const updatedRole = { uuid: 'role-1', abilities: [] };

    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn().mockResolvedValue(updatedRole);

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn().mockResolvedValue([]);

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    const input = { roleUuid: 'role-1', abilities: [] };

    await expect(useCase.execute(input)).resolves.toBe(updatedRole);

    expect(findByPairs).toHaveBeenCalledWith([]);
    expect(withAbilities).toHaveBeenCalledWith([]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('rejects an ADMIN role with AdminRoleAbilitiesImmutableError', async () => {
    const { role } = buildRole(RecordStatus.ACTIVE, RoleEnum.ADMIN);
    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn();

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn();

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [{ action: Action.READ, subject: Subject.USER }],
      }),
    ).rejects.toBeInstanceOf(AdminRoleAbilitiesImmutableError);

    expect(findByPairs).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an ADMIN role even when the payload would clear its abilities', async () => {
    const { role } = buildRole(RecordStatus.ACTIVE, RoleEnum.ADMIN);
    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn();

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn();

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({ roleUuid: 'role-1', abilities: [] }),
    ).rejects.toBeInstanceOf(AdminRoleAbilitiesImmutableError);

    expect(findByPairs).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('checks the active guard before the admin guard', async () => {
    const { role } = buildRole(RecordStatus.INACTIVE, RoleEnum.ADMIN);
    const findByUuid = jest.fn().mockResolvedValue(role);
    const update = jest.fn();

    const roleRepository = mockOf<RoleRepository>({
      findByUuid,
      update,
    });

    const findByPairs = jest.fn();

    const abilityRepository = mockOf<AbilityRepository>({
      findByPairs,
    });

    const useCase = new UpdateRoleAbilitiesUseCase(
      roleRepository,
      abilityRepository,
    );

    await expect(
      useCase.execute({
        roleUuid: 'role-1',
        abilities: [{ action: Action.READ, subject: Subject.USER }],
      }),
    ).rejects.toBeInstanceOf(InactiveRoleError);

    expect(findByPairs).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
