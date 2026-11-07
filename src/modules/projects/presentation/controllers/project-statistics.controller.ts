import { Controller } from '@nestjs/common';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { endpoint } from '@shared/presentation/builders';
import { CurrentActor } from '@shared/presentation/decorators';
import type { AuthenticatedUser } from '@shared/presentation/http';
import { GetProjectStatisticsUseCase } from '../../application/use-cases/get-project-statistics.use-case';
import { ProjectStatisticsResponseDto } from '../dto/output/project-statistics.response';

@Controller('projects/statistics')
export class ProjectStatisticsController {
  constructor(
    private readonly getProjectStatistics: GetProjectStatisticsUseCase,
  ) {}

  @(endpoint()
    .get()
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.statistics')
    .successMessage('success.ok')
    .tags('projects')
    .summary('Get dashboard statistics for the visible projects')
    .description(
      'Administrators get statistics for every project; other users only for the projects they are responsible for.',
    )
    .response(ProjectStatisticsResponseDto)
    .build())
  async get(
    @CurrentActor() actor: AuthenticatedUser,
  ): Promise<ProjectStatisticsResponseDto> {
    return ProjectStatisticsResponseDto.fromDomain(
      await this.getProjectStatistics.execute(actor),
    );
  }
}
