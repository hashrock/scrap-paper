import { useCallback, useEffect, useState } from 'react'
import './App.css'
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
  const hasDirectory = Boolean(directoryHandle)

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
      />

      {!hasDirectory && (
        <div
          style={{
            position: 'fixed',
            top: '88px',
            right: '32px',
            backgroundColor: '#111',
            color: '#fff',
            padding: '18px 24px',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '320px',
            zIndex: 150
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600 }}>No folder selected</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>Drawings stay local to this session. Choose a folder to enable autosave, cutting, and the gallery.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { void selectNewDirectory() }}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#fff',
                color: '#111',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Select folder
            </button>
            {recentDirs.length > 0 && (
              <select
                defaultValue=""
                onChange={(event) => {
                  const selectedId = event.currentTarget.value
                  if (!selectedId) return
                  const entry = recentDirs.find((dir) => dir.id === selectedId)
                  if (entry) {
                    void selectRecentDirectory(entry)
                  }
                  event.currentTarget.value = ''
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="" disabled>Open recent…</option>
                {recentDirs.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px'
      }}>
        {mode === 'gallery' ? (
          hasDirectory ? (
            <GalleryView
              directoryHandle={directoryHandle as FileSystemDirectoryHandle}
              images={savedImages}
              onImageDeleted={reloadSavedImages}
            />
          ) : (
            <div
              style={{
                maxWidth: '520px',
                width: '100%',
                backgroundColor: '#fff',
                borderRadius: '24px',
                boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                alignItems: 'flex-start'
              }}
            >
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#111' }}>Saving is disabled</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#444', lineHeight: 1.6 }}>Pick a folder to unlock autosave and view the gallery of your clipped images.</p>
              <button
                type="button"
                onClick={() => { void selectNewDirectory() }}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#111',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Select folder
              </button>
              {recentDirs.length > 0 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>Recent folders</span>
                  {recentDirs.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => { void selectRecentDirectory(entry) }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fff',
                        color: '#111',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <CanvasWorkspace
            directoryHandle={directoryHandle}
            tool={tool}
            strokeWidth={strokeWidth}
            strokeWidthOptions={STROKE_WIDTH_OPTIONS}
            onToolChange={setTool}
            onStrokeWidthChange={setStrokeWidth}
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
