export function ImagePlaceholder({ label, aspect = '16:9', className = '' }) {
  const [w, h] = aspect.split(':').map(Number)
  return (
    <div
      className={`img-placeholder ${className}`}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      <img src="/placeholder.jpg" alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}