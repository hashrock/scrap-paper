import { useCallback, useEffect, useState } from 'react'
import './App.css'
import DirectorySelector from './components/DirectorySelector'
import Toolbar from './components/Toolbar'
import CanvasWorkspace from './components/CanvasWorkspace'
import GalleryView from './components/GalleryView'
import Toast from './components/Toast'
import useDirectoryManager from './hooks/useDirectoryManager'
import useSavedImages from './hooks/useSavedImages'
import useToast from './hooks/useToast'
import type { Mode, Tool } from './types'

const STROKE_WIDTH_OPTIONS = [1, 2, 4, 8, 16, 32, 64]

function App() {
  const [mode, setMode] = useState<Mode>('canvas')
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)

  const { directoryHandle, recentDirs, selectNewDirectory, selectRecentDirectory } = useDirectoryManager()
  const { toast, showToast } = useToast()
  const { savedImages, reloadSavedImages } = useSavedImages(directoryHandle)

  useEffect(() => {
    if (mode === 'gallery') {
      void reloadSavedImages()
    }
  }, [mode, reloadSavedImages])

  useEffect(() => {
    if (mode === 'gallery' && directoryHandle) {
      void reloadSavedImages()
    }
  }, [directoryHandle, mode, reloadSavedImages])

  const handleImageSaved = useCallback((filename: string) => {
    showToast(`Saved ${filename}`)
    if (mode === 'gallery') {
      void reloadSavedImages()
    }
  }, [mode, reloadSavedImages, showToast])

  if (!directoryHandle) {
    return (
      <DirectorySelector
        recentDirs={recentDirs}
        onSelectNewDirectory={selectNewDirectory}
        onSelectRecentDirectory={selectRecentDirectory}
      />
    )
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        tool={tool}
        onToolChange={setTool}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        strokeWidthOptions={STROKE_WIDTH_OPTIONS}
      />

      <div style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px'
      }}>
        {mode === 'gallery' ? (
          <GalleryView
            directoryHandle={directoryHandle}
            images={savedImages}
            onImageDeleted={reloadSavedImages}
          />
        ) : (
          <CanvasWorkspace
            directoryHandle={directoryHandle}
            tool={tool}
            strokeWidth={strokeWidth}
            onImageSaved={handleImageSaved}
          />
        )}
      </div>

      {toast.visible && (
        <Toast message={toast.message} />
      )}
    </div>
  )
}

export default App
