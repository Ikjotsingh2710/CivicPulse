import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'CivicPulse — fix your campus & city issues',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'auth',
    title: 'Sign in · CivicPulse',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'issues',
    title: 'Issues by region · CivicPulse',
    loadComponent: () => import('./features/issues/issues-page').then((m) => m.IssuesPage),
  },
  {
    // Public on purpose: someone with a burst main and no account still needs
    // the number, and there is nothing private in a published portal URL.
    path: 'portals',
    title: 'Where complaints go · CivicPulse',
    loadComponent: () =>
      import('./features/portals/portal-directory-page').then((m) => m.PortalDirectoryPage),
  },
  {
    // Public: the point of a shared link is that it works for someone who has
    // never opened this app. It reads `public_tickets`, so RLS decides what a
    // stranger is allowed to see rather than this route.
    path: 'r/:number',
    title: 'A report on CivicPulse',
    loadComponent: () =>
      import('./features/share/shared-report-page').then((m) => m.SharedReportPage),
  },
  {
    path: 'report',
    title: 'File a report · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () => import('./features/report/report-page').then((m) => m.ReportPage),
  },
  {
    path: 'profile',
    title: 'Your reports · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: 'escalations',
    title: 'Ticket escalations · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/escalations/escalations-page').then((m) => m.EscalationsPage),
  },
  {
    path: 'resolved',
    title: 'Resolved photos · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () => import('./features/resolved/resolved-page').then((m) => m.ResolvedPage),
  },
  {
    path: 'pulse-points',
    title: 'Pulse Points · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/points/pulse-points-page').then((m) => m.PulsePointsPage),
  },
  {
    path: 'security',
    title: 'Security settings · CivicPulse',
    canActivate: [authGuard],
    loadComponent: () => import('./features/security/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'admin',
    title: 'Control desk · CivicPulse',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-page').then((m) => m.AdminPage),
  },
  { path: '**', redirectTo: '' },
];
