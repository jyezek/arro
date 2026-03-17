import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import type { TokenCache } from '@clerk/clerk-expo'

// expo-secure-store is native-only; fall back to localStorage on web
const createTokenCache = (): TokenCache => ({
  getToken: async (key: string) => {
    try {
      if (Platform.OS === 'web') return localStorage.getItem(key)
      return SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  saveToken: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') { localStorage.setItem(key, value); return }
      await SecureStore.setItemAsync(key, value)
    } catch {}
  },
  clearToken: async (key: string) => {
    try {
      if (Platform.OS === 'web') { localStorage.removeItem(key); return }
      await SecureStore.deleteItemAsync(key)
    } catch {}
  },
})

export const tokenCache = createTokenCache()
