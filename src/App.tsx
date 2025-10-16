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
  const [cutAnimation, setCutAnimation] = useState<{ imageUrl: string; height: number } | null>(null)
  const [tornEdgePath] = useState(() => {
    // Generate torn edge path once
    const points = Array.from({ length: 40 }, (_, i) => {
      const x = (i / 40) * CANVAS_WIDTH
      const y = 20 - Math.random() * 8 - (Math.sin(i * 0.5) * 3)
      return `L${x},${y}`
    }).join(' ')
    return `M0,20 ${points} L${CANVAS_WIDTH},20 Z`
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const isExtending = useRef(false)
  const needsExtension = useRef(false)

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
          const fileHandle = entry as FileSystemFileHandle
          const file = await fileHandle.getFile()
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

  const extendCanvas = useCallback(() => {
    if (isExtending.current) return
    isExtending.current = true

    const canvas = canvasRef.current
    if (!canvas) {
      isExtending.current = false
      return
    }

    // Save current canvas content
    const currentImageData = canvas.toDataURL('image/png')

    // Update height
    const newHeight = canvasHeight + CANVAS_EXTEND_HEIGHT
    setCanvasHeight(newHeight)

    // Restore content after height change
    setTimeout(() => {
      const ctx = getCanvasContext()
      if (!ctx) {
        isExtending.current = false
        return
      }

      // Fill new area with white
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, CANVAS_WIDTH, newHeight)

      // Restore old content
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        isExtending.current = false
      }
      img.src = currentImageData
    }, 0)
  }, [canvasHeight])

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

    // Mark that extension is needed if drawing near the bottom (within 200px)
    if (y > canvasHeight - 200) {
      needsExtension.current = true
    }
  }, [canvasHeight])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false

    // Extend canvas after drawing is complete if needed
    if (needsExtension.current) {
      needsExtension.current = false
      extendCanvas()
    }
  }, [extendCanvas])

  const handleMouseLeave = useCallback(() => {
    isDrawing.current = false

    // Extend canvas after drawing is complete if needed
    if (needsExtension.current) {
      needsExtension.current = false
      extendCanvas()
    }
  }, [extendCanvas])

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

    // Start animation with the upper part
    const animationImageUrl = upperCanvas.toDataURL('image/png')
    setCutAnimation({ imageUrl: animationImageUrl, height: y })

    // Remove animation after it completes
    setTimeout(() => {
      setCutAnimation(null)
    }, 800)

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

        // Update canvas height after a short delay to let animation start
        setTimeout(() => {
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
        }, 100)
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
        justifyContent: 'center',
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
                  width: '36px',
                  height: '36px',
                  backgroundColor: tool === 'pen' ? '#000' : '#fff',
                  color: tool === 'pen' ? '#fff' : '#000',
                  border: '1px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                title="Pen"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/>
                  <circle cx="11" cy="11" r="2"/>
                </svg>
              </button>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: tool === 'eraser' ? '#000' : '#fff',
                  color: tool === 'eraser' ? '#fff' : '#000',
                  border: '1px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                title="Eraser"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20H7L2.5 15.5a2 2 0 0 1 0-2.83L12.71 2.46a2 2 0 0 1 2.83 0L21.54 8.5a2 2 0 0 1 0 2.83L16 17"/>
                  <path d="M7 20v-4"/>
                </svg>
              </button>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd' }} />

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: '200px' }}>
              <span style={{ fontSize: '14px', color: '#666', minWidth: '32px' }}>{strokeWidth}px</span>
              <input
                type="range"
                min="0"
                max="6"
                value={strokeWidthOptions.indexOf(strokeWidth)}
                onChange={(e) => setStrokeWidth(strokeWidthOptions[parseInt(e.target.value)])}
                style={{
                  flex: 1,
                  cursor: 'pointer'
                }}
              />
            </div>
          </>
        )}
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
            {/* Torn paper edge at top */}
            <svg
              width={CANVAS_WIDTH}
              height="20"
              viewBox={`0 0 ${CANVAS_WIDTH} 20`}
              style={{
                position: 'absolute',
                top: '-20px',
                left: 0,
                zIndex: 1
              }}
              preserveAspectRatio="none"
            >
              <path
                d={tornEdgePath}
                fill="#fff"
                stroke="#ddd"
                strokeWidth="1"
              />
            </svg>

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

            {/* Cut animation */}
            {cutAnimation && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${CANVAS_WIDTH}px`,
                  height: `${cutAnimation.height}px`,
                  pointerEvents: 'none',
                  animation: 'slideUp 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards',
                  zIndex: 100
                }}
              >
                <img
                  src={cutAnimation.imageUrl}
                  alt="Cut animation"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </div>
            )}

            {/* Gray overlay for cut area */}
            {hoveredScissorY !== null && !cutAnimation && (
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

            {/* Ruler scale on the right */}
            <svg
              width="40"
              height={canvasHeight}
              viewBox={`0 0 40 ${canvasHeight}`}
              style={{
                position: 'absolute',
                right: '-40px',
                top: 0,
                pointerEvents: 'none'
              }}
            >
              {Array.from({ length: Math.floor(canvasHeight / 10) + 1 }).map((_, i) => {
                const y = i * 10
                const isMajor = i % 10 === 0
                const isMedium = i % 5 === 0
                const lineWidth = isMajor ? 20 : isMedium ? 12 : 6
                const opacity = isMajor ? 0.5 : isMedium ? 0.35 : 0.25

                return (
                  <line
                    key={i}
                    x1="0"
                    y1={y}
                    x2={lineWidth}
                    y2={y}
                    stroke="#999"
                    strokeWidth="1"
                    opacity={opacity}
                  />
                )
              })}
            </svg>

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
