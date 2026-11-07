import { RoleEnum } from '@modules/authorization';
import type { ProjectScope } from '../repositories/project.repository';

export interface ProjectViewer {
  id: number;
  roles: readonly string[];
}

export function projectScopeFor(viewer: ProjectViewer): ProjectScope {
  if (viewer.roles.includes(RoleEnum.ADMIN)) {
    return {};
  }

  return { responsibleId: viewer.id };
}
