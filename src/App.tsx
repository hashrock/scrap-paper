import { useState, useRef, useEffect, useCallback } from 'react'
import { saveDirectoryHandle, getRecentDirectories, removeDirectory } from './db'
import './App.css'

type Tool = 'pen' | 'eraser'
type Mode = 'canvas' | 'gallery'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400

interface DirectoryEntry {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  lastUsed: number
}

interface SavedImage {
  name: string
  url: string
  file: File
}

function App() {
  const [mode, setMode] = useState<Mode>('canvas')
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [recentDirs, setRecentDirs] = useState<DirectoryEntry[]>([])
  const [hoveredScissorY, setHoveredScissorY] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false })
  const [savedImages, setSavedImages] = useState<SavedImage[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)

  // Load recent directories on mount
  useEffect(() => {
    loadRecentDirectories()
  }, [])

  const loadRecentDirectories = async () => {
    try {
      const dirs = await getRecentDirectories()
      setRecentDirs(dirs)
    } catch (err) {
      console.error('Failed to load recent directories', err)
    }
  }

  const showToast = (message: string) => {
    setToast({ message, visible: true })
    setTimeout(() => {
      setToast({ message: '', visible: false })
    }, 3000)
  }

  const loadSavedImages = async () => {
    if (!directoryHandle) return

    try {
      const images: SavedImage[] = []
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.png')) {
          const file = await entry.getFile()
          const url = URL.createObjectURL(file)
          images.push({ name: entry.name, url, file })
        }
      }
      // Sort by name (which is timestamp-based)
      images.sort((a, b) => b.name.localeCompare(a.name))
      setSavedImages(images)
    } catch (err) {
      console.error('Failed to load images', err)
    }
  }

  // Load images when switching to gallery mode
  useEffect(() => {
    if (mode === 'gallery' && directoryHandle) {
      loadSavedImages()
    }
  }, [mode, directoryHandle])

  // Initialize canvas with white background
  useEffect(() => {
    if (!directoryHandle) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill with white
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)
  }, [canvasHeight, directoryHandle])

  const getCanvasContext = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = tool === 'pen' ? 'black' : 'white'
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [tool, strokeWidth])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = getCanvasContext()
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }, [])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDrawing.current = false
  }, [])

  const handleSelectNewDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker()
      await saveDirectoryHandle(handle)
      setDirectoryHandle(handle)
      await loadRecentDirectories()
    } catch (err) {
      console.error('Directory selection cancelled or failed', err)
    }
  }

  const handleSelectRecentDirectory = async (entry: DirectoryEntry) => {
    try {
      // Request permission if needed
      const permission = await entry.handle.requestPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        await saveDirectoryHandle(entry.handle)
        setDirectoryHandle(entry.handle)
        await loadRecentDirectories()
      }
    } catch (err) {
      console.error('Failed to access directory', err)
      // Remove invalid directory
      await removeDirectory(entry.id)
      await loadRecentDirectories()
    }
  }

  const extendCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Save current canvas content
    const currentImageData = canvas.toDataURL('image/png')

    // Update height
    const newHeight = canvasHeight + CANVAS_EXTEND_HEIGHT
    setCanvasHeight(newHeight)

    // Restore content after height change
    setTimeout(() => {
      const ctx = getCanvasContext()
      if (!ctx) return

      // Fill new area with white
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, CANVAS_WIDTH, newHeight)

      // Restore old content
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = currentImageData
    }, 0)
  }

  const handleScissorClick = async (y: number) => {
    if (!directoryHandle) {
      alert('Please select a directory first')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas for the upper part
    const upperCanvas = document.createElement('canvas')
    upperCanvas.width = CANVAS_WIDTH
    upperCanvas.height = y
    const upperCtx = upperCanvas.getContext('2d')

    if (!upperCtx) return

    // Copy the upper part
    const ctx = getCanvasContext()
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, y)
    upperCtx.putImageData(imageData, 0, 0)

    // Convert to blob and save
    upperCanvas.toBlob(async (blob) => {
      if (!blob) return

      const filename = generateFilename()

      try {
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()

        // Show success toast
        showToast(`Saved ${filename}`)

        // Reload images if in gallery mode
        if (mode === 'gallery') {
          loadSavedImages()
        }

        // Keep only the lower part
        const lowerImageData = ctx.getImageData(0, y, CANVAS_WIDTH, canvasHeight - y)

        // Update canvas height
        const newHeight = canvasHeight - y
        setCanvasHeight(newHeight)

        // Restore lower part after height change
        setTimeout(() => {
          const newCtx = getCanvasContext()
          if (!newCtx) return

          // Fill with white
          newCtx.fillStyle = 'white'
          newCtx.fillRect(0, 0, CANVAS_WIDTH, newHeight)

          // Draw lower part at top
          newCtx.putImageData(lowerImageData, 0, 0)
        }, 0)
      } catch (err) {
        console.error('Failed to save file', err)
        alert('Failed to save file')
      }
    }, 'image/png')
  }

  const strokeWidthOptions = [1, 2, 4, 8, 16, 32, 64]

  const generateFilename = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.png`
  }

  if (!directoryHandle) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '30px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#000', margin: 0 }}>
          Select a folder to save your drawings
        </h1>

        <button
          onClick={handleSelectNewDirectory}
          style={{
            padding: '16px 32px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Select Folder
        </button>

        {recentDirs.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '400px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#666', margin: 0 }}>
              Recent folders
            </h2>
            {recentDirs.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleSelectRecentDirectory(entry)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#fff',
                  color: '#000',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#000'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#ddd'}
              >
                {entry.name}
              </button>
            ))}
          </div>
        )}
      </div>
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
      {/* Top toolbar */}
      <div style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#fff'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setMode('canvas')}
            style={{
              padding: '8px 16px',
              backgroundColor: mode === 'canvas' ? '#000' : '#fff',
              color: mode === 'canvas' ? '#fff' : '#000',
              border: '1px solid #000',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Canvas
          </button>
          <button
            onClick={() => setMode('gallery')}
            style={{
              padding: '8px 16px',
              backgroundColor: mode === 'gallery' ? '#000' : '#fff',
              color: mode === 'gallery' ? '#fff' : '#000',
              border: '1px solid #000',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Gallery
          </button>
        </div>

        {mode === 'canvas' && (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd' }} />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setTool('pen')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: tool === 'pen' ? '#000' : '#fff',
                  color: tool === 'pen' ? '#fff' : '#000',
                  border: '1px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: tool === 'eraser' ? '#000' : '#fff',
                  color: tool === 'eraser' ? '#fff' : '#000',
                  border: '1px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Eraser
              </button>
            </div>
          </>
        )}

        {mode === 'canvas' && (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd' }} />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Size:</span>
              {strokeWidthOptions.map(size => (
                <button
                  key={size}
                  onClick={() => setStrokeWidth(size)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: strokeWidth === size ? '#000' : '#fff',
                    color: strokeWidth === size ? '#fff' : '#000',
                    border: '1px solid #000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    minWidth: '32px'
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          {directoryHandle.name}
        </div>
      </div>

      {/* Canvas/Gallery area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          justifyContent: 'center',
          padding: '40px'
        }}
      >
        {mode === 'gallery' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
            width: '100%',
            maxWidth: '1400px',
            alignContent: 'start',
            gridAutoRows: 'min-content'
          }}>
            {savedImages.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '60px 20px',
                color: '#666',
                fontSize: '16px'
              }}>
                No images saved yet
              </div>
            ) : (
              savedImages.map((image) => (
                <div
                  key={image.name}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    style={{
                      width: '100%',
                      display: 'block',
                      backgroundColor: '#fff'
                    }}
                  />
                  <div style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: '#666',
                    borderTop: '1px solid #eee'
                  }}>
                    {image.name}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={canvasHeight}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{
                border: '1px solid #ddd',
                cursor: 'crosshair',
                display: 'block',
                backgroundColor: '#fff'
              }}
            />

            {/* Gray overlay for cut area */}
            {hoveredScissorY !== null && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${CANVAS_WIDTH}px`,
                    height: `${hoveredScissorY}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#000',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}>
                    Save as {generateFilename()}
                  </div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: `${hoveredScissorY}px`,
                    left: 0,
                    width: `${CANVAS_WIDTH}px`,
                    height: '2px',
                    backgroundColor: '#000',
                    pointerEvents: 'none',
                    boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)'
                  }}
                />
              </>
            )}

            {/* Right edge hover area for cutting */}
            <div
              style={{
                position: 'absolute',
                right: '-40px',
                top: 0,
                width: '40px',
                height: canvasHeight,
                cursor: 'pointer'
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const y = Math.max(50, Math.min(canvasHeight - 50, e.clientY - rect.top))
                setHoveredScissorY(Math.round(y))
              }}
              onMouseLeave={() => setHoveredScissorY(null)}
              onClick={() => {
                if (hoveredScissorY !== null) {
                  handleScissorClick(hoveredScissorY)
                }
              }}
            />
          </div>

          {/* Extend button below canvas */}
          <button
            onClick={extendCanvas}
            style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              minHeight: '40px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            +
          </button>
        </div>
        )}
      </div>

      {/* Toast notification */}
      {toast.visible && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#000',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-in'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
