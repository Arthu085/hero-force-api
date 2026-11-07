import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RoleEnum } from '@modules/authorization';
import type { CharacterCode } from '@modules/characters';
import { UserOrmEntity } from '@modules/users/persistence';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import {
  applyILikeFilter,
  BaseTransactionalRepository,
} from '@shared/infrastructure/persistence';
import type {
  PaginatedProjectHeroes,
  ProjectHeroCandidate,
  ProjectHeroRepository,
} from '../../../domain/repositories/project-hero.repository';
import { ProjectMapper } from '../mappers/project.mapper';

const HERO_IDS_SUBQUERY = `hero.id IN (
  SELECT
    user_roles.user_id
  FROM user_roles
    INNER JOIN roles ON roles.id = user_roles.role_id
  WHERE roles.name = :heroRole
    AND roles.status = :heroRoleStatus
    AND roles.deleted_at IS NULL
)`;

interface CandidateRow {
  id: number;
  uuid: string;
  name: string;
  character: CharacterCode | null;
  status: RecordStatus;
  holdsHeroRole: boolean;
}

@Injectable()
export class TypeOrmProjectHeroRepository
  extends BaseTransactionalRepository<UserOrmEntity>
  implements ProjectHeroRepository
{
  constructor(
    @InjectRepository(UserOrmEntity)
    repository: Repository<UserOrmEntity>,
  ) {
    super(repository);
  }

  async findCandidateByUuid(
    uuid: string,
  ): Promise<ProjectHeroCandidate | null> {
    const row = await this.withHeroParameters(
      this.repository
        .createQueryBuilder('hero')
        .select('hero.id', 'id')
        .addSelect('hero.uuid', 'uuid')
        .addSelect('hero.name', 'name')
        .addSelect('hero.character', 'character')
        .addSelect('hero.status', 'status')
        .addSelect(HERO_IDS_SUBQUERY, 'holdsHeroRole')
        .where('hero.uuid = :uuid', { uuid }),
    ).getRawOne<CandidateRow>();

    return row ?? null;
  }

  async findEligiblePaginated(
    offset: number,
    limit: number,
    name?: string,
  ): Promise<PaginatedProjectHeroes> {
    const qb = this.withHeroParameters(
      this.repository
        .createQueryBuilder('hero')
        .select(['hero.id', 'hero.uuid', 'hero.name', 'hero.character'])
        .where('hero.status = :heroStatus')
        .andWhere(HERO_IDS_SUBQUERY)
        .orderBy('hero.name', 'ASC')
        .addOrderBy('hero.id', 'ASC')
        .skip(offset)
        .take(limit),
    );

    applyILikeFilter(qb, 'hero.name', 'name', name);

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => ProjectMapper.heroToDomain(row)),
      total,
    };
  }

  private withHeroParameters(
    qb: SelectQueryBuilder<UserOrmEntity>,
  ): SelectQueryBuilder<UserOrmEntity> {
    return qb.setParameters({
      heroRole: RoleEnum.USER,
      heroStatus: RecordStatus.ACTIVE,
      heroRoleStatus: RecordStatus.ACTIVE,
    });
  }
}
