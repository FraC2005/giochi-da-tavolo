import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/dama', name: 'checkers-menu', component: () => import('@/views/GameMenuView.vue'), props: { game: 'checkers' } },
    { path: '/scacchi', name: 'chess-menu', component: () => import('@/views/GameMenuView.vue'), props: { game: 'chess' } },
    { path: '/dama/locale', name: 'checkers-local', component: () => import('@/views/checkers/LocalView.vue') },
    { path: '/scacchi/locale', name: 'chess-local', component: () => import('@/views/chess/LocalView.vue') },
    { path: '/dama/online', name: 'checkers-online', component: () => import('@/views/checkers/OnlineView.vue') },
    { path: '/scacchi/online', name: 'chess-online', component: () => import('@/views/chess/OnlineView.vue') },
    { path: '/dama/online/:room', name: 'checkers-room', component: () => import('@/views/checkers/OnlineView.vue') },
    { path: '/scacchi/online/:room', name: 'chess-room', component: () => import('@/views/chess/OnlineView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
