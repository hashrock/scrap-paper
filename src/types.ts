export type Tool = 'pen' | 'eraser'
export type Mode = 'canvas' | 'gallery'

export interface DirectoryEntry {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  lastUsed: number
}

export interface SavedImage {
  name: string
  url: string
  file: File
}

export interface ToastState {
  message: string
  visible: boolean
}
