import axios from 'axios'
import { useStore } from '../store/useStore'

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 by logging out
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export default api
