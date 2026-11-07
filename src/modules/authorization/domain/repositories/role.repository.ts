import { RoleEntity } from '../entities/role.entity';
import type { RoleEnum } from '../enums/role.enum';
import type { RoleListSort } from './role-list-sort';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export interface RoleRepository {
  findAll(sort?: RoleListSort): Promise<RoleEntity[]>;
  findByUuid(uuid: string): Promise<RoleEntity | null>;
  findByUuids(uuids: string[]): Promise<RoleEntity[]>;
  findByName(name: RoleEnum): Promise<RoleEntity | null>;
  update(role: RoleEntity): Promise<RoleEntity>;
}
