import { GUIDE_ACTION_ID } from './actions';
import { step } from './step';
import { GUIDE_TOOL_ID } from './toolId';
import type { GuideTourConfig } from './types';

export const sidebarTour: GuideTourConfig = {
  steps: [
    step(
      'navigation',
      GUIDE_TOOL_ID.sidebarNavigation,
      'sidebar.navigation.title',
      'sidebar.navigation.content'
    ),
    step(
      'sessions',
      GUIDE_TOOL_ID.sidebarContent,
      'sidebar.sessions.title',
      'sidebar.sessions.content',
      'right-start',
      GUIDE_ACTION_ID.showSidebarSessions
    ),
    step(
      'drive',
      GUIDE_TOOL_ID.sidebarContent,
      'sidebar.drive.title',
      'sidebar.drive.content',
      'right-start',
      GUIDE_ACTION_ID.showSidebarDrive
    ),
    step(
      'courses',
      GUIDE_TOOL_ID.sidebarContent,
      'sidebar.courses.title',
      'sidebar.courses.content',
      'right-start',
      GUIDE_ACTION_ID.showSidebarCourses
    ),
    step(
      'account',
      GUIDE_TOOL_ID.sidebarAccount,
      'sidebar.account.title',
      'sidebar.account.content'
    ),
  ],
};
