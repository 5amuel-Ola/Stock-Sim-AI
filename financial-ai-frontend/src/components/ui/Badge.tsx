type Variant = 'green' | 'red' | 'yellow' | 'blue' | 'gray'

interface BadgeProps {
  label: string
  variant?: Variant
}

const CLASSES: Record<Variant, string> = {
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100    text-red-700',
  yellow: 'bg-amber-100  text-amber-700',
  blue:   'bg-blue-100   text-blue-700',
  gray:   'bg-slate-100  text-slate-600',
}

export function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CLASSES[variant]}`}>
      {label}
    </span>
  )
}
