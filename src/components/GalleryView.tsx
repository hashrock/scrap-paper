import type { SavedImage } from '../types'

interface GalleryViewProps {
  images: SavedImage[]
}

const GalleryView = ({ images }: GalleryViewProps) => {
  if (images.length === 0) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px',
        width: '100%',
        maxWidth: '1400px',
        alignContent: 'start',
        gridAutoRows: 'min-content'
      }}>
        <div style={{
          gridColumn: '1 / -1',
          textAlign: 'center',
          padding: '60px 20px',
          color: '#666',
          fontSize: '16px'
        }}>
          No images saved yet
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px',
      width: '100%',
      maxWidth: '1400px',
      alignContent: 'start',
      gridAutoRows: 'min-content'
    }}>
      {images.map((image) => (
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
      ))}
    </div>
  )
}

export default GalleryView
