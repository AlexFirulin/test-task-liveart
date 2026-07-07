import { createApp } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './plugins/vuetify'
import './style.css'
import App from './App.vue'

createApp(App).use(createPinia()).use(vuetify).mount('#app')
