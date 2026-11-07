import { RoleEnum } from '@modules/authorization';
import type { ProjectScope } from '../repositories/project.repository';

export interface ProjectViewer {
  id: number;
  roles: readonly string[];
}

export function isProjectAdministrator(viewer: ProjectViewer): boolean {
  return viewer.roles.includes(RoleEnum.ADMIN);
}

export function projectScopeFor(viewer: ProjectViewer): ProjectScope {
  if (isProjectAdministrator(viewer)) {
    return {};
  }

  return { responsibleId: viewer.id };
}
