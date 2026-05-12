import { type ReactNode } from 'react'

interface CardProps {
  title?: string
  className?: string
  children: ReactNode
}

/** Swiss style card: clean borders, no rounded corners, minimal shadow. */
export function Card({ title, className = '', children }: CardProps) {
  return (
    <div className={`bg-white border border-black/10 p-8 ${className}`}>
      {title && (
        <h3 className="text-sm font-bold text-black uppercase tracking-wide mb-6">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
