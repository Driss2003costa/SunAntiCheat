import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './locales/fr.json'
import en from './locales/en.json'

/**
 * Configuration i18next du portail.
 *
 * - Détection auto via navigator.language (1ère visite)
 * - Choix utilisateur persistant en localStorage sous "sun-portal-lang"
 * - Langues supportées : fr, en
 * - Fallback : en (les chaînes manquantes en fr ne casseront pas)
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'en',
    supportedLngs: ['fr', 'en'],
    interpolation: { escapeValue: false }, // React échappe déjà
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sun-portal-lang',
    },
    returnNull: false,
  })

export default i18n
