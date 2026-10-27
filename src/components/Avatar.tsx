import type { User } from '@supabase/supabase-js'
import { getIniciales } from '../lib/profile'

export default function Avatar({ user, size = 34, onClick }: { user: User | null; size?: number; onClick?: () => void }) {
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const fontSize = Math.round(size * 0.35)

  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: avatarUrl ? undefined : 'var(--lime)',
    color: 'var(--lime-text)',
    fontSize,
    flexShrink: 0,
    overflow: 'hidden',
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full font-bold font-display"
      style={style}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="Tu foto de perfil" className="h-full w-full object-cover" />
      ) : (
        getIniciales(user)
      )}
    </button>
  )
}
