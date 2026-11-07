import { ProjectStatus } from '../../enums/project-status.enum';
import {
  calculateProjectProgress,
  deriveProjectStatus,
} from '../project-progress.policy';

const goals = (...values: number[]) => values.map((progress) => ({ progress }));

describe('project progress policy', () => {
  describe('calculateProjectProgress', () => {
    it('averages the goals with equal weight and rounds down', () => {
      expect(calculateProjectProgress(goals(100, 100, 0, 0, 0, 1))).toBe(33);
      expect(calculateProjectProgress(goals(99, 100, 100, 100, 100, 100))).toBe(
        99,
      );
    });

    it('is 0 without goals', () => {
      expect(calculateProjectProgress([])).toBe(0);
    });
  });

  describe('deriveProjectStatus', () => {
    it('is PENDING when every goal is at 0%', () => {
      expect(deriveProjectStatus(goals(0, 0, 0, 0, 0, 0))).toBe(
        ProjectStatus.PENDING,
      );
    });

    it('is COMPLETED only when every goal is at 100%', () => {
      expect(deriveProjectStatus(goals(100, 100, 100, 100, 100, 100))).toBe(
        ProjectStatus.COMPLETED,
      );
      expect(deriveProjectStatus(goals(100, 100, 100, 100, 100, 99))).toBe(
        ProjectStatus.IN_PROGRESS,
      );
    });

    it('is IN_PROGRESS for any other combination', () => {
      expect(deriveProjectStatus(goals(1, 0, 0, 0, 0, 0))).toBe(
        ProjectStatus.IN_PROGRESS,
      );
      expect(deriveProjectStatus(goals(100, 0, 0, 0, 0, 0))).toBe(
        ProjectStatus.IN_PROGRESS,
      );
    });
  });
});
