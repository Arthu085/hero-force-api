import type { ProjectEntity } from '../entities/project.entity';
import type { ProjectStatus } from '../enums/project-status.enum';
import type { ProjectListSort } from './project-list-sort';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectScope {
  responsibleId?: number;
}

export interface ProjectListFilters extends ProjectScope {
  name?: string;
  status?: ProjectStatus;
  responsibleUuid?: string;
}

export interface PaginatedProjects {
  items: ProjectEntity[];
  total: number;
}

export interface ProjectStatistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  averageProgress: number;
}

export interface ProjectRepository {
  findAllPaginated(
    offset: number,
    limit: number,
    filters: ProjectListFilters,
    sort?: ProjectListSort,
  ): Promise<PaginatedProjects>;
  findByUuid(uuid: string, scope?: ProjectScope): Promise<ProjectEntity | null>;
  findByUuidForUpdate(uuid: string): Promise<ProjectEntity | null>;
  getStatistics(scope: ProjectScope): Promise<ProjectStatistics>;
  create(project: ProjectEntity): Promise<ProjectEntity>;
  update(project: ProjectEntity): Promise<ProjectEntity>;
  softDelete(project: ProjectEntity): Promise<void>;
}
