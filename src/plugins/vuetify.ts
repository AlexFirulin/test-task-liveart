import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

export default createVuetify({
  theme: {
    defaultTheme: 'dark',
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  defaults: {
    VSlider: {
      color: 'primary',
      thumbLabel: true,
      hideDetails: true,
      density: 'compact',
    },
    VBtn: {
      variant: 'tonal',
    },
  },
})
