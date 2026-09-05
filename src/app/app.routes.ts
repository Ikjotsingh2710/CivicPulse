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
