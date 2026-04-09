import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import InvoiceDetail from '../views/InvoiceDetail.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/invoice/:id', component: InvoiceDetail }
  ]
})


export default router