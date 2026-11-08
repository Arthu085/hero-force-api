import { Inject, Injectable } from '@nestjs/common';
import { abilityPairKey } from '@shared/domain/authorization/ability-pair-key';
import type { AbilityPair } from '@shared/domain/authorization/ability-pair.type';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { assertRecordActive } from '@shared/domain/policies';
import { RoleEntity } from '../../domain/entities/role.entity';
import { RoleEnum } from '../../domain/enums/role.enum';
import { AdminRoleAbilitiesImmutableError } from '../../domain/errors/admin-role-abilities-immutable.error';
import { InactiveAbilityError } from '../../domain/errors/inactive-ability.error';
import { InactiveRoleError } from '../../domain/errors/inactive-role.error';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error';
import { UnknownAbilityError } from '../../domain/errors/unknown-ability.error';
import { UserProjectAbilitiesRestrictedError } from '../../domain/errors/user-project-abilities-restricted.error';
import {
  ABILITY_REPOSITORY,
  type AbilityRepository,
} from '../../domain/repositories/ability.repository';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
} from '../../domain/repositories/role.repository';

export interface UpdateRoleAbilitiesInput {
  roleUuid: string;
  abilities: AbilityPair[];
}

@Injectable()
export class UpdateRoleAbilitiesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(ABILITY_REPOSITORY)
    private readonly abilityRepository: AbilityRepository,
  ) {}

  async execute(input: UpdateRoleAbilitiesInput): Promise<RoleEntity> {
    const role = await this.roleRepository.findByUuid(input.roleUuid);

    if (!role) {
      throw new RoleNotFoundError();
    }

    assertRecordActive(role, new InactiveRoleError());

    if (role.name === RoleEnum.ADMIN) {
      throw new AdminRoleAbilitiesImmutableError();
    }

    const uniquePairs = [
      ...new Map(
        input.abilities.map((pair) => [abilityPairKey(pair), pair]),
      ).values(),
    ];

    if (
      role.name === RoleEnum.USER &&
      uniquePairs.some(
        ({ action, subject }) =>
          subject === Subject.PROJECT &&
          [Action.CREATE, Action.UPDATE, Action.DELETE].includes(action),
      )
    ) {
      throw new UserProjectAbilitiesRestrictedError();
    }

    const resolvedAbilities =
      await this.abilityRepository.findByPairs(uniquePairs);

    if (resolvedAbilities.length !== uniquePairs.length) {
      throw new UnknownAbilityError();
    }

    for (const ability of resolvedAbilities) {
      assertRecordActive(ability, new InactiveAbilityError());
    }

    const updatedRole = role.withAbilities(resolvedAbilities);

    return this.roleRepository.update(updatedRole);
  }
}
