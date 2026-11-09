import { Controller, HttpStatus, Param, Query } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { endpoint } from '@shared/presentation/builders';
import {
  CurrentActor,
  Translator,
  type Translate,
} from '@shared/presentation/decorators';
import type { AuthenticatedUser } from '@shared/presentation/http';
import { ParseUuidParamPipe } from '@shared/presentation/pipes';
import { GetProjectGoalProgressUseCase } from '../../application/use-cases/get-project-goal-progress.use-case';
import { ListProjectHistoryUseCase } from '../../application/use-cases/list-project-history.use-case';
import { GetProjectGoalProgressQueryDto } from '../dto/input/get-project-goal-progress-query.dto';
import { ListProjectHistoryQueryDto } from '../dto/input/list-project-history-query.dto';
import { ProjectGoalProgressResponseDto } from '../dto/output/project-goal-progress.response';
import { ProjectHistoryResponseDto } from '../dto/output/project-history.response';

@Controller('projects/:uuid/history')
export class ProjectHistoryController {
  constructor(
    private readonly listProjectHistory: ListProjectHistoryUseCase,
    private readonly getProjectGoalProgress: GetProjectGoalProgressUseCase,
  ) {}

  @(endpoint()
    .get()
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.history')
    .successMessage('success.ok')
    .tags('projects')
    .summary('List project change history')
    .description(
      'Read-only business events, newest first. Uses the same project visibility and active-record rules as project details. Deleted projects are not accessible. Actor data contains only uuid and name, including soft-deleted users.',
    )
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .paginatedResponse(ProjectHistoryResponseDto)
    .build())
  async findAll(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @Query() query: ListProjectHistoryQueryDto,
    @CurrentActor() actor: AuthenticatedUser,
  ): Promise<PaginatedResult<ProjectHistoryResponseDto>> {
    const result = await this.listProjectHistory.execute({
      uuid,
      page: query.page,
      limit: query.limit,
      viewer: actor,
    });

    return result.map((entry) => ProjectHistoryResponseDto.fromDomain(entry));
  }

  @(endpoint()
    .get('goal-progress')
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.goalProgress')
    .successMessage('success.ok')
    .tags('projects')
    .summary('Get goal progress evolution')
    .description(
      'Progress of the six goals over the selected period, rebuilt from recorded GOAL_PROGRESS_CHANGED history events. Uses the same project visibility and active-record rules as project details. Progress before `recordedFrom` is unknown and is never invented.',
    )
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .response(ProjectGoalProgressResponseDto)
    .build())
  async goalProgress(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @Query() query: GetProjectGoalProgressQueryDto,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<ProjectGoalProgressResponseDto> {
    const progress = await this.getProjectGoalProgress.execute({
      uuid,
      period: query.period,
      viewer: actor,
    });

    return ProjectGoalProgressResponseDto.fromDomain(progress, translate);
  }
}
