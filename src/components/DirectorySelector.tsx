import type { DirectoryEntry } from '../types'

interface DirectorySelectorProps {
  recentDirs: DirectoryEntry[]
  onSelectNewDirectory: () => Promise<void>
  onSelectRecentDirectory: (entry: DirectoryEntry) => Promise<void>
}

const DirectorySelector = ({
  recentDirs,
  onSelectNewDirectory,
  onSelectRecentDirectory
}: DirectorySelectorProps) => {
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
        onClick={onSelectNewDirectory}
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
              onClick={() => onSelectRecentDirectory(entry)}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#ddd'
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default DirectorySelector
