import type { Mode, Tool } from '../types'

interface ToolbarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  tool: Tool
  onToolChange: (tool: Tool) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  strokeWidthOptions: number[]
}

const Toolbar = ({
  mode,
  onModeChange,
  tool,
  onToolChange,
  strokeWidth,
  onStrokeWidthChange,
  strokeWidthOptions
}: ToolbarProps) => {
  return (
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
          onClick={() => onModeChange('canvas')}
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
          onClick={() => onModeChange('gallery')}
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
              onClick={() => onToolChange('pen')}
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
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>
            <button
              onClick={() => onToolChange('eraser')}
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
                <path d="M20 20H7L2.5 15.5a2 2 0 0 1 0-2.83L12.71 2.46a2 2 0 0 1 2.83 0L21.54 8.5a2 2 0 0 1 0 2.83L16 17" />
                <path d="M7 20v-4" />
              </svg>
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd' }} />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: '200px' }}>
            <span style={{ fontSize: '14px', color: '#666', minWidth: '32px' }}>{strokeWidth}px</span>
            <input
              type="range"
              min="0"
              max={(strokeWidthOptions.length - 1).toString()}
              value={strokeWidthOptions.indexOf(strokeWidth)}
              onChange={(e) => onStrokeWidthChange(strokeWidthOptions[parseInt(e.target.value, 10)])}
              style={{ flex: 1, cursor: 'pointer' }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default Toolbar
