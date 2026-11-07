import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  applyExactFilter,
  applyILikeFilter,
  BaseTransactionalRepository,
} from '@shared/infrastructure/persistence';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import type { ProjectListSort } from '../../../domain/repositories/project-list-sort';
import type {
  PaginatedProjects,
  ProjectListFilters,
  ProjectRepository,
  ProjectScope,
  ProjectStatistics,
} from '../../../domain/repositories/project.repository';
import { ProjectGoalOrmEntity } from '../entities/project-goal.orm-entity';
import { ProjectOrmEntity } from '../entities/project.orm-entity';
import { ProjectMapper } from '../mappers/project.mapper';

const PROJECT_SORT_COLUMNS = {
  name: 'project.name',
  status: 'project.progressStatus',
  progress: 'project.progress',
  responsible: 'responsible.name',
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
};

interface StatisticsRow {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  averageProgress: number;
}

@Injectable()
export class TypeOrmProjectRepository
  extends BaseTransactionalRepository<ProjectOrmEntity>
  implements ProjectRepository
{
  constructor(
    @InjectRepository(ProjectOrmEntity)
    repository: Repository<ProjectOrmEntity>,
  ) {
    super(repository);
  }

  async findAllPaginated(
    offset: number,
    limit: number,
    filters: ProjectListFilters,
    sort?: ProjectListSort,
  ): Promise<PaginatedProjects> {
    const qb = this.hydratedQuery()
      .orderBy('project.id', 'DESC')
      .skip(offset)
      .take(limit);

    if (sort?.sortBy) {
      qb.orderBy(
        PROJECT_SORT_COLUMNS[sort.sortBy],
        sort.sortOrder ?? 'ASC',
      ).addOrderBy('project.id', 'DESC');
    }

    this.applyScope(qb, filters);
    applyILikeFilter(qb, 'project.name', 'name', filters.name);
    applyExactFilter(qb, 'project.progressStatus', 'status', filters.status);
    applyExactFilter(
      qb,
      'responsible.uuid',
      'responsibleUuid',
      filters.responsibleUuid,
    );

    const [rows, total] = await qb.getManyAndCount();

    return { items: rows.map((row) => ProjectMapper.toDomain(row)), total };
  }

  async findByUuid(
    uuid: string,
    scope: ProjectScope = {},
  ): Promise<ProjectEntity | null> {
    const qb = this.hydratedQuery().andWhere('project.uuid = :uuid', { uuid });

    this.applyScope(qb, scope);

    const project = await qb.getOne();

    return project ? ProjectMapper.toDomain(project) : null;
  }

  async findByUuidForUpdate(uuid: string): Promise<ProjectEntity | null> {
    await this.repository
      .createQueryBuilder('project')
      .select('project.id')
      .where('project.uuid = :uuid', { uuid })
      .setLock('for_no_key_update')
      .getOne();

    return this.findByUuid(uuid);
  }

  async getStatistics(scope: ProjectScope): Promise<ProjectStatistics> {
    const qb = this.repository
      .createQueryBuilder('project')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE project.progress_status = :pending)::int',
        'pending',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE project.progress_status = :inProgress)::int',
        'inProgress',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE project.progress_status = :completed)::int',
        'completed',
      )
      .addSelect(
        'COALESCE(FLOOR(AVG(project.progress)), 0)::int',
        'averageProgress',
      )
      .setParameters({
        pending: ProjectStatus.PENDING,
        inProgress: ProjectStatus.IN_PROGRESS,
        completed: ProjectStatus.COMPLETED,
      });

    this.applyScope(qb, scope);

    const row = await qb.getRawOne<StatisticsRow>();

    return {
      total: row?.total ?? 0,
      pending: row?.pending ?? 0,
      inProgress: row?.inProgress ?? 0,
      completed: row?.completed ?? 0,
      averageProgress: row?.averageProgress ?? 0,
    };
  }

  async create(project: ProjectEntity): Promise<ProjectEntity> {
    const saved = await this.repository.save(ProjectMapper.toOrm(project));

    await this.saveGoals(saved.id, project);

    return this.reload(saved.uuid);
  }

  async update(project: ProjectEntity): Promise<ProjectEntity> {
    await this.repository.save(ProjectMapper.toOrm(project));
    await this.saveGoals(project.id, project);

    return this.reload(project.uuid);
  }

  async softDelete(project: ProjectEntity): Promise<void> {
    await this.repository.save(ProjectMapper.toOrm(project));
  }

  // withDeleted keeps a soft-deleted responsible hero joined; the explicit
  // deletedAt check still hides soft-deleted projects.
  private hydratedQuery(): SelectQueryBuilder<ProjectOrmEntity> {
    return this.repository
      .createQueryBuilder('project')
      .withDeleted()
      .innerJoin('project.responsible', 'responsible')
      .addSelect([
        'responsible.id',
        'responsible.uuid',
        'responsible.name',
        'responsible.character',
      ])
      .leftJoinAndSelect('project.goals', 'goal')
      .where('project.deletedAt IS NULL');
  }

  private applyScope(
    qb: SelectQueryBuilder<ProjectOrmEntity>,
    scope: ProjectScope,
  ): void {
    if (scope.responsibleId !== undefined) {
      qb.andWhere('project.responsibleId = :responsibleId', {
        responsibleId: scope.responsibleId,
      });
    }
  }

  private async saveGoals(
    projectId: number,
    project: ProjectEntity,
  ): Promise<void> {
    await this.repository.manager
      .createQueryBuilder()
      .insert()
      .into(ProjectGoalOrmEntity)
      .values(ProjectMapper.goalsToOrm(projectId, project))
      .orUpdate(['description', 'progress'], ['project_id', 'goal'])
      .execute();
  }

  private async reload(uuid: string): Promise<ProjectEntity> {
    const project = await this.findByUuid(uuid);

    if (!project) {
      throw new Error(`Project ${uuid} disappeared after being saved`);
    }

    return project;
  }
}
