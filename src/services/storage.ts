import { toRaw } from 'vue'

const DB_NAME = 'sunstudio_db'
const DB_VERSION = 1
const STORE_NAME = 'app_data'

/**
 * 深度克隆数据，移除 Vue 响应式代理
 * 确保数据可以被 IndexedDB 的结构化克隆算法处理
 */
const deepClone = <T>(data: T): T => {
  if (data === null || data === undefined) return data
  // 使用 toRaw 移除 Vue 响应式代理，然后通过 JSON 序列化确保完全是普通对象
  try {
    return JSON.parse(JSON.stringify(toRaw(data)))
  } catch {
    // 如果 JSON 序列化失败，返回原始数据
    return toRaw(data) as T
  }
}

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event: any) => {
      resolve(event.target.result)
    }

    request.onerror = (event: any) => {
      reject(event.target.error)
    }
  })
}

export const saveToStorage = async (key: string, data: any) => {
  const db = await getDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    // 深度克隆数据以移除 Vue 响应式代理，确保可被 IndexedDB 克隆
    const clonedData = deepClone(data)
    store.put(clonedData, key)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const loadFromStorage = async <T>(key: string): Promise<T | undefined> => {
  const db = await getDB()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}


