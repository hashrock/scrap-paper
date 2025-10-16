import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

type Tool = 'pen' | 'eraser'

const INITIAL_CANVAS_HEIGHT = 1200
const CANVAS_WIDTH = 800
const CANVAS_EXTEND_HEIGHT = 400

function App() {
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT)
  const [tool, setTool] = useState<Tool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [scissorLine, setScissorLine] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill with white
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)
  }, [canvasHeight])

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

  const handleSelectDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker()
      setDirectoryHandle(handle)
    } catch (err) {
      console.error('Directory selection cancelled or failed', err)
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

  const handleScissorClick = (y: number) => {
    setScissorLine(y)
  }

  const handleCut = async () => {
    if (scissorLine === null || !directoryHandle) {
      alert('Please select a directory first')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas for the upper part
    const upperCanvas = document.createElement('canvas')
    upperCanvas.width = CANVAS_WIDTH
    upperCanvas.height = scissorLine
    const upperCtx = upperCanvas.getContext('2d')

    if (!upperCtx) return

    // Copy the upper part
    const ctx = getCanvasContext()
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, scissorLine)
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
        const lowerImageData = ctx.getImageData(0, scissorLine, CANVAS_WIDTH, canvasHeight - scissorLine)

        // Update canvas height
        const newHeight = canvasHeight - scissorLine
        setCanvasHeight(newHeight)
        setScissorLine(null)

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

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#888',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '20px',
      boxSizing: 'border-box',
      overflow: 'auto'
    }}>
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setTool('pen')}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'pen' ? '#333' : '#fff',
            color: tool === 'pen' ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Pen
        </button>
        <button
          onClick={() => setTool('eraser')}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'eraser' ? '#333' : '#fff',
            color: tool === 'eraser' ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Eraser
        </button>
        <div style={{ borderLeft: '1px solid #ccc', height: '30px', margin: '0 10px' }} />
        <label>Size:</label>
        {strokeWidthOptions.map(size => (
          <button
            key={size}
            onClick={() => setStrokeWidth(size)}
            style={{
              padding: '8px 12px',
              backgroundColor: strokeWidth === size ? '#333' : '#fff',
              color: strokeWidth === size ? '#fff' : '#333',
              border: '1px solid #333',
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '40px'
            }}
          >
            {size}
          </button>
        ))}
        <div style={{ borderLeft: '1px solid #ccc', height: '30px', margin: '0 10px' }} />
        <button
          onClick={handleSelectDirectory}
          style={{
            padding: '8px 16px',
            backgroundColor: directoryHandle ? '#4CAF50' : '#fff',
            color: directoryHandle ? '#fff' : '#333',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {directoryHandle ? 'Directory Selected' : 'Select Directory'}
        </button>
        {scissorLine !== null && (
          <button
            onClick={handleCut}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cut & Save
          </button>
        )}
      </div>

      <div style={{ position: 'relative', backgroundColor: '#fff' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            border: '1px solid #ccc',
            cursor: 'crosshair',
            display: 'block'
          }}
        />

        {/* Scissor line indicator */}
        {scissorLine !== null && (
          <div
            style={{
              position: 'absolute',
              top: `${scissorLine}px`,
              left: 0,
              width: '100%',
              height: '2px',
              backgroundColor: 'red',
              pointerEvents: 'none',
              boxShadow: '0 0 4px rgba(255, 0, 0, 0.5)'
            }}
          />
        )}

        {/* Scissor buttons on the right edge */}
        <div style={{
          position: 'absolute',
          right: '-40px',
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
                style={{
                  width: '30px',
                  height: '30px',
                  backgroundColor: scissorLine === y ? '#f44336' : '#fff',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                title={`Cut at ${y}px`}
              >
                ✂️
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={extendCanvas}
        style={{
          padding: '12px 24px',
          backgroundColor: '#2196F3',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '24px',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        +
      </button>
    </div>
  )
}

export default App
