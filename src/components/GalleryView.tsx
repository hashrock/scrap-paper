import { useState } from 'react'
import type { SavedImage } from '../types'

interface GalleryViewProps {
  images: SavedImage[]
  onImageDeleted?: () => void
}

const GalleryView = ({ images, onImageDeleted }: GalleryViewProps) => {
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null)
  const [deletingImage, setDeletingImage] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, image: SavedImage) => {
    e.stopPropagation()
    if (!confirm(`Delete ${image.name}?`)) {
      return
    }

    setDeletingImage(image.name)
    try {
      await image.fileHandle.remove()
      onImageDeleted?.()
    } catch (err) {
      console.error('Failed to delete image', err)
      alert('Failed to delete image')
    } finally {
      setDeletingImage(null)
    }
  }

  const handleImageClick = (image: SavedImage) => {
    setSelectedImage(image)
  }

  const handleClosePreview = () => {
    setSelectedImage(null)
  }
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
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            position: 'relative',
            opacity: deletingImage === image.name ? 0.5 : 1
          }}
          onClick={() => handleImageClick(image)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <button
            onClick={(e) => handleDelete(e, image)}
            disabled={deletingImage === image.name}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'
            }}
          >
            ×
          </button>
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

      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '40px'
          }}
          onClick={handleClosePreview}
        >
          <button
            onClick={handleClosePreview}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            ×
          </button>
          <img
            src={selectedImage.url}
            alt={selectedImage.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            {selectedImage.name}
          </div>
        </div>
      )}
    </div>
  )
}

export default GalleryView
