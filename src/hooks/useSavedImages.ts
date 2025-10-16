import { useCallback, useEffect, useState } from 'react'
import type { SavedImage } from '../types'

interface UseSavedImagesResult {
  savedImages: SavedImage[]
  reloadSavedImages: () => Promise<void>
}

const useSavedImages = (directoryHandle: FileSystemDirectoryHandle | null): UseSavedImagesResult => {
  const [savedImages, setSavedImages] = useState<SavedImage[]>([])

  const revokeUrls = useCallback((images: SavedImage[]) => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url)
    })
  }, [])

  const reloadSavedImages = useCallback(async () => {
    if (!directoryHandle) {
      setSavedImages((prev) => {
        revokeUrls(prev)
        return []
      })
      return
    }

    try {
      const images: SavedImage[] = []
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.png')) {
          const fileHandle = entry as FileSystemFileHandle
          const file = await fileHandle.getFile()
          const url = URL.createObjectURL(file)
          images.push({ name: entry.name, url, file })
        }
      }

      images.sort((a, b) => b.name.localeCompare(a.name))

      setSavedImages((prev) => {
        revokeUrls(prev)
        return images
      })
    } catch (err) {
      console.error('Failed to load images', err)
    }
  }, [directoryHandle, revokeUrls])

  useEffect(() => {
    if (!directoryHandle) {
      setSavedImages((prev) => {
        revokeUrls(prev)
        return []
      })
    }
  }, [directoryHandle, revokeUrls])

  useEffect(() => {
    return () => {
      revokeUrls(savedImages)
    }
  }, [savedImages, revokeUrls])

  return {
    savedImages,
    reloadSavedImages
  }
}

export default useSavedImages
