import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTransactionalRepository } from '@shared/infrastructure/persistence';
import type {
  ProjectHistory,
  ProjectHistoryChange,
} from '../../../domain/entities/project-history';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import { ProjectHistoryOrmEntity } from '../entities/project-history.orm-entity';

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
}
