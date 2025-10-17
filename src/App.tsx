import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Toolbar from './components/Toolbar'
import CanvasWorkspace from './components/CanvasWorkspace'
import GalleryView from './components/GalleryView'
import Toast from './components/Toast'
import SettingsPanel from './components/SettingsPanel'
import Footer from './components/Footer'
import useDirectoryManager from './hooks/useDirectoryManager'
import useSavedImages from './hooks/useSavedImages'
import useToast from './hooks/useToast'
import type { Mode, Tool } from './types'

const STROKE_WIDTH_OPTIONS = [1, 2, 4, 8, 16, 32, 64]
const SHORTCUTS_STORAGE_KEY = 'canvas-keyboard-shortcuts'

interface KeyboardShortcuts {
  pen: string
  eraser: string
}

const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  pen: 'p',
  eraser: 'e'
}

function App() {
  const [mode, setMode] = useState<Mode>('canvas')
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [showSettings, setShowSettings] = useState(false)
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(() => {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (stored) {
      try {
        return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) }
      } catch {
        return DEFAULT_SHORTCUTS
      }
    }
    return DEFAULT_SHORTCUTS
  })

  const { directoryHandle, recentDirs, selectNewDirectory, selectRecentDirectory } = useDirectoryManager()
  const { toast, showToast } = useToast()
  const { savedImages, reloadSavedImages } = useSavedImages(directoryHandle)
  const hasDirectory = Boolean(directoryHandle)

  const handleShortcutChange = useCallback((key: keyof KeyboardShortcuts, value: string) => {
    const newShortcuts = { ...shortcuts, [key]: value }
    setShortcuts(newShortcuts)
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(newShortcuts))
  }, [shortcuts])

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
      minHeight: '100vh',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        onSettingsClick={() => setShowSettings(true)}
      />

      {!hasDirectory && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '16px',
            backgroundColor: '#111',
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '280px',
            zIndex: 150,
            fontSize: '13px'
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600 }}>No folder selected</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>Choose a folder to enable autosave and gallery.</div>
          <button
            type="button"
            onClick={() => { void selectNewDirectory() }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#fff',
              color: '#111',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Select folder
          </button>
        </div>
      )}

      <div style={{
        flex: 1,
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px'
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
            shortcuts={shortcuts}
            onToolChange={setTool}
            onStrokeWidthChange={setStrokeWidth}
            onImageSaved={handleImageSaved}
            onSettingsClick={() => setShowSettings(true)}
          />
        )}
      </div>

      <Footer />

      {toast.visible && (
        <Toast message={toast.message} />
      )}

      <SettingsPanel
        visible={showSettings}
        shortcuts={shortcuts}
        onClose={() => setShowSettings(false)}
        onShortcutChange={handleShortcutChange}
      />
    </div>
  )
}

export default App
