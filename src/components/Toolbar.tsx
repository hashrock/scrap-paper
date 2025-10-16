import type { Mode } from '../types'

interface ToolbarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
}

const tabs: Array<{ id: Mode; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'gallery', label: 'Gallery' }
]

const Toolbar = ({ mode, onModeChange }: ToolbarProps) => {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '12px 24px 0',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '36px',
            position: 'relative',
            paddingBottom: '12px'
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === mode
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onModeChange(tab.id)
                  }
                }}
                style={{
                  position: 'relative',
                  padding: '12px 0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isActive ? '#111' : '#9ca3af',
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'color 0.2s ease'
                }}
                aria-pressed={isActive}
              >
                {tab.label}
                <span
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    right: '-8px',
                    bottom: '-12px',
                    height: '2px',
                    borderRadius: '999px',
                    backgroundColor: isActive ? '#111' : 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Toolbar
