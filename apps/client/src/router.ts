import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppStore } from './stores/app'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/onboarding', component: () => import('./views/OnboardingView.vue') },
    {
      path: '/',
      component: () => import('./views/MainLayout.vue'),
      children: [
        { path: '', component: () => import('./views/DashboardView.vue') },
        { path: 'teams', component: () => import('./views/TeamsView.vue') },
        { path: 'analysis', component: () => import('./views/AnalysisView.vue') },
        { path: 'records', component: () => import('./views/RecordsView.vue') },
        { path: 'activities', component: () => import('./views/ActivitiesView.vue') },
        { path: 'items', component: () => import('./views/ItemsView.vue') },
        { path: 'settings', component: () => import('./views/SettingsView.vue') },
        { path: 'about', component: () => import('./views/AboutView.vue') }
      ]
    },
    { path: '/record', component: () => import('./views/RecordView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

// 首次使用先走三步向导；完成后不再打扰。没有登录，也没有网络请求。
router.beforeEach(async (to) => {
  const app = useAppStore()
  const settings = await app.ensureSettings()
  const done = settings?.onboardingDone === true
  if (!done && to.path !== '/onboarding') return { path: '/onboarding' }
  if (done && to.path === '/onboarding') return { path: '/' }
  return true
})
