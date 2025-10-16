const DB_NAME = 'canvas-paint-db'
const DB_VERSION = 1
const STORE_NAME = 'directories'

interface DirectoryEntry {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  lastUsed: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB()
  const entry: DirectoryEntry = {
    id: handle.name,
    name: handle.name,
    handle: handle,
    lastUsed: Date.now()
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(entry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getRecentDirectories(): Promise<DirectoryEntry[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const entries = request.result as DirectoryEntry[]
      // Filter out directories we no longer have permission for
      Promise.all(
        entries.map(async (entry) => {
          try {
            const permission = await entry.handle.queryPermission({ mode: 'readwrite' })
            return permission === 'granted' ? entry : null
          } catch {
            return null
          }
        })
      ).then((filtered) => {
        const valid = filtered.filter((e): e is DirectoryEntry => e !== null)
        valid.sort((a, b) => b.lastUsed - a.lastUsed)
        resolve(valid.slice(0, 5)) // Keep only 5 most recent
      })
    }

    request.onerror = () => reject(request.error)
  })
}

export async function removeDirectory(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
