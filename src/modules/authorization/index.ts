export { RoleEntity } from './domain/entities/role.entity';
export { RoleEnum } from './domain/enums/role.enum';
export { InactiveRoleError } from './domain/errors/inactive-role.error';
export { RoleNotFoundError } from './domain/errors/role-not-found.error';
export { assertRolesResolved } from './domain/policies';
export { ROLE_REPOSITORY } from './domain/repositories/role.repository';
export type { RoleRepository } from './domain/repositories/role.repository';
export { USER_ABILITY_REPOSITORY } from './domain/repositories/user-ability.repository';
export type { UserAbilityRepository } from './domain/repositories/user-ability.repository';
