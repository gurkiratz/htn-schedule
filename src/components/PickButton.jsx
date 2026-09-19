/** Checkbox for adding an event to the multi-select basket. */
export default function PickButton({ picked, onToggle, title, className = '' }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={picked}
      aria-label={picked ? `Deselect ${title}` : `Select ${title}`}
      title={picked ? 'Remove from selection' : 'Add to selection'}
      className={`pick ${picked ? 'is-on' : ''} ${className}`.trim()}
      onClick={(e) => {
        // The row or block itself opens the detail sheet; this must not.
        e.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m4 12.5 5 5L20 6.5" />
      </svg>
    </button>
  )
}
