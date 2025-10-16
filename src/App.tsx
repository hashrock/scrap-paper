import { useState, useRef, useEffect, useCallback } from 'react'
import { saveDirectoryHandle, getRecentDirectories, removeDirectory } from './db'
import './App.css'

type Tool = 'pen' | 'eraser'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400

interface DirectoryEntry {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  lastUsed: number
}

function App() {
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [recentDirs, setRecentDirs] = useState<DirectoryEntry[]>([])
  const [hoveredScissorY, setHoveredScissorY] = useState<number | null>(null)
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

      const now = new Date()
      const filename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.png`

      try {
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()

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

        <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          {directoryHandle.name}
        </div>
      </div>

      {/* Canvas area */}
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

            {/* Hover preview line */}
            {hoveredScissorY !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: `${hoveredScissorY}px`,
                  left: 0,
                  width: `${CANVAS_WIDTH}px`,
                  height: '1px',
                  backgroundColor: '#999',
                  pointerEvents: 'none',
                  boxShadow: '0 0 4px rgba(0, 0, 0, 0.3)'
                }}
              />
            )}

            {/* Scissor buttons on the right edge */}
            <div style={{
              position: 'absolute',
              left: `${CANVAS_WIDTH + 16}px`,
              top: 0,
              height: canvasHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-evenly'
            }}>
              {Array.from({ length: Math.ceil(canvasHeight / 100) }).map((_, i) => {
                const y = (i + 1) * 100
                return (
                  <button
                    key={i}
                    onClick={() => handleScissorClick(y)}
                    onMouseEnter={() => setHoveredScissorY(y)}
                    onMouseLeave={() => setHoveredScissorY(null)}
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      opacity: 0.4,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      setHoveredScissorY(y)
                      e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      setHoveredScissorY(null)
                      e.currentTarget.style.opacity = '0.4'
                    }}
                    title={`Cut at ${y}px`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <line x1="8" y1="6" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="8" y1="18" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Extend button below canvas */}
          <button
            onClick={extendCanvas}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
