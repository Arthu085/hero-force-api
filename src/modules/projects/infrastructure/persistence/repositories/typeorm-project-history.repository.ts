import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTransactionalRepository } from '@shared/infrastructure/persistence';
import type { ProjectGoalProgressTimeline } from '../../../domain/entities/project-goal-progress';
import type { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../../domain/enums/project-history-type.enum';
import type {
  ProjectHistory,
  ProjectHistoryChange,
} from '../../../domain/entities/project-history';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import { ProjectHistoryOrmEntity } from '../entities/project-history.orm-entity';

interface FirstEventRow {
  type: ProjectHistoryType;
  at: Date;
}

interface ProgressBeforeRow {
  goal: ProjectGoalType;
  progress: number;
}

interface ProgressChangeRow extends ProgressBeforeRow {
  at: Date;
  previousProgress: number;
}

const PREVIOUS_PROGRESS = "(history.previous_values ->> 'progress')::int";
const NEW_PROGRESS = "(history.new_values ->> 'progress')::int";

@Injectable()
export class TypeOrmProjectHistoryRepository
  extends BaseTransactionalRepository<ProjectHistoryOrmEntity>
  implements ProjectHistoryRepository
{
  constructor(
    @InjectRepository(ProjectHistoryOrmEntity)
    repository: Repository<ProjectHistoryOrmEntity>,
  ) {
    super(repository);
  }

  async append(
    projectId: number,
    actorId: number,
    changes: readonly ProjectHistoryChange[],
  ): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    await this.repository.insert(
      changes.map((change) => ({
        projectId,
        actorId,
        ...change,
        createdAt: () => 'statement_timestamp()',
      })),
    );
  }

  async findByProject(
    projectId: number,
    offset: number,
    limit: number,
  ): Promise<{ items: ProjectHistory[]; total: number }> {
    const [rows, total] = await this.repository
      .createQueryBuilder('history')
      .withDeleted()
      .leftJoin('history.actor', 'actor')
      .addSelect(['actor.uuid', 'actor.name'])
      .where('history.projectId = :projectId', { projectId })
      .orderBy('history.createdAt', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      items: rows.map((row) => ({
        uuid: row.uuid,
        type: row.type,
        createdAt: row.createdAt,
        goal: row.goal,
        actor: row.actor
          ? { uuid: row.actor.uuid, name: row.actor.name }
          : null,
        previousValues: row.previousValues,
        newValues: row.newValues,
      })),
      total,
    };
  }

  async findGoalProgressTimeline(
    projectId: number,
    from: Date,
  ): Promise<ProjectGoalProgressTimeline> {
    const firstEvent = await this.repository
      .createQueryBuilder('history')
      .select('history.type', 'type')
      .addSelect('history.created_at', 'at')
      .where('history.project_id = :projectId', { projectId })
      .orderBy('history.created_at', 'ASC')
      .addOrderBy('history.id', 'ASC')
      .limit(1)
      .getRawOne<FirstEventRow>();

    if (!firstEvent) {
      return { firstEvent: null, progressBefore: [], changes: [] };
    }

    const progressBefore = await this.goalProgressEvents(projectId)
      .distinctOn(['history.goal'])
      .select('history.goal', 'goal')
      .addSelect(NEW_PROGRESS, 'progress')
      .andWhere('history.created_at < :from', { from })
      .orderBy('history.goal', 'ASC')
      .addOrderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .getRawMany<ProgressBeforeRow>();

    const changes = await this.goalProgressEvents(projectId)
      .select('history.goal', 'goal')
      .addSelect('history.created_at', 'at')
      .addSelect(PREVIOUS_PROGRESS, 'previousProgress')
      .addSelect(NEW_PROGRESS, 'progress')
      .andWhere('history.created_at >= :from', { from })
      .orderBy('history.created_at', 'ASC')
      .addOrderBy('history.id', 'ASC')
      .getRawMany<ProgressChangeRow>();

    return {
      firstEvent: { type: firstEvent.type, at: firstEvent.at },
      progressBefore: progressBefore.map(({ goal, progress }) => ({
        goal,
        progress,
      })),
      changes: changes.map(({ goal, at, previousProgress, progress }) => ({
        goal,
        at,
        previousProgress,
        progress,
      })),
    };
  }

  private goalProgressEvents(projectId: number) {
    return this.repository
      .createQueryBuilder('history')
      .where('history.project_id = :projectId', { projectId })
      .andWhere('history.type = :type', {
        type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
      });
  }
}
