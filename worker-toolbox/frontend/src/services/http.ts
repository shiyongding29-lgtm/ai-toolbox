import axios from 'axios'
import JSONBig from 'json-bigint'

const JSONBigString = JSONBig({ storeAsString: true })

const http = axios.create({
  timeout: 100000,
  transformResponse: [
    (data) => {
      if (typeof data === 'string') {
        try {
          return JSONBigString.parse(data)
        } catch (_e) {
          return data
        }
      }
      return data
    },
  ],
})

// Response interceptor — unwrap data
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default http
