import { useCallback, useEffect, useState } from 'react'
import { getRecentDirectories, removeDirectory, saveDirectoryHandle } from '../db'
import type { DirectoryEntry } from '../types'

interface UseDirectoryManagerResult {
  directoryHandle: FileSystemDirectoryHandle | null
  recentDirs: DirectoryEntry[]
  selectNewDirectory: () => Promise<void>
  selectRecentDirectory: (entry: DirectoryEntry) => Promise<void>
}

const useDirectoryManager = (): UseDirectoryManagerResult => {
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [recentDirs, setRecentDirs] = useState<DirectoryEntry[]>([])

  const refreshRecentDirectories = useCallback(async () => {
    try {
      const dirs = await getRecentDirectories()
      setRecentDirs(dirs)
    } catch (err) {
      console.error('Failed to load recent directories', err)
    }
  }, [])

  useEffect(() => {
    refreshRecentDirectories()
  }, [refreshRecentDirectories])

  const selectNewDirectory = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      await saveDirectoryHandle(handle)
      setDirectoryHandle(handle)
      await refreshRecentDirectories()
    } catch (err) {
      console.error('Directory selection cancelled or failed', err)
    }
  }, [refreshRecentDirectories])

  const selectRecentDirectory = useCallback(async (entry: DirectoryEntry) => {
    try {
      const permission = await entry.handle.requestPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        await saveDirectoryHandle(entry.handle)
        setDirectoryHandle(entry.handle)
        await refreshRecentDirectories()
      }
    } catch (err) {
      console.error('Failed to access directory', err)
      await removeDirectory(entry.id)
      await refreshRecentDirectories()
    }
  }, [refreshRecentDirectories])

  return {
    directoryHandle,
    recentDirs,
    selectNewDirectory,
    selectRecentDirectory
  }
}

export default useDirectoryManager
