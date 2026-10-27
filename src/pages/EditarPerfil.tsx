import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, User, MapPin, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getIniciales } from '../lib/profile'
import DateSelect from '../components/DateSelect'
import PhotoCropper from '../components/PhotoCropper'
import { useIdioma } from '../lib/IdiomaContext'
import { PAISES } from '../lib/paises'

export default function EditarPerfil() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { t } = useIdioma()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState((user?.user_metadata?.nombre as string) || '')
  const [apellido, setApellido] = useState((user?.user_metadata?.apellido as string) || '')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [pais, setPais] = useState('')
  const [avatarUrl, setAvatarUrl] = useState((user?.user_metadata?.avatar_url as string) || '')
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Si venimos de tocar la foto directamente (Perfil → avatar), abrimos
  // el selector de archivo de una vez, sin que el usuario tenga que buscarlo.
  useEffect(() => {
    if (params.get('foto') === '1') {
      const t = setTimeout(() => fileRef.current?.click(), 150)
      return () => clearTimeout(t)
    }
  }, [params])

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('apellido, fecha_nacimiento, ciudad, avatar_url, pais')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.apellido) setApellido(data.apellido)
          if (data.fecha_nacimiento) setFechaNacimiento(data.fecha_nacimiento)
          if (data.ciudad) setCiudad(data.ciudad)
          if (data.avatar_url) setAvatarUrl(data.avatar_url)
          // pais no existía antes de este campo — los beta que ya tenían
          // cuenta lo tendrán null hasta que lo guarden aquí una vez.
          if (data.pais) setPais(data.pais)
        }
        setLoadingProfile(false)
      })
  }, [user])

  function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg(t('ep_error_tipo_imagen')); return }
    if (file.size > 8 * 1024 * 1024) { setMsg(t('ep_error_tamano_imagen')); return }
    setMsg(null)
    setPendingFile(file)
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null)
    if (!user) return
    setUploading(true)
    const path = `${user.id}/avatar.jpg`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      setUploading(false)
      setMsg(t('ep_error_subir', { msg: uploadError.message }))
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`

    const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

    setUploading(false)
    if (authError || profileError) { setMsg(t('ep_error_subir_guardar', { msg: authError?.message || profileError?.message || '' })); return }
    setAvatarUrl(publicUrl)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    setMsg(null)

    const { error: authError } = await supabase.auth.updateUser({ data: { nombre, apellido } })
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        nombre,
        apellido: apellido || null,
        fecha_nacimiento: fechaNacimiento || null,
        ciudad: ciudad || null,
        pais: pais || null,
      })
      .eq('id', user.id)

    setSaving(false)
    if (authError || profileError) {
      setMsg(t('ep_error_guardar', { msg: authError?.message || profileError?.message || '' }))
      return
    }
    navigate(-1)
  }

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('ep_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-5 mt-2 flex justify-center">
          <div className="relative">
            <div className="flex h-19 w-19 items-center justify-center overflow-hidden rounded-full text-2xl font-bold font-display" style={{ width: 76, height: 76, background: avatarUrl ? undefined : 'var(--lime)', color: 'var(--lime-text)' }}>
              {avatarUrl ? <img src={avatarUrl} alt={t('ep_tu_foto')} className="h-full w-full object-cover" /> : getIniciales(user)}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-50"
              style={{ background: 'var(--card)', border: '2px solid var(--bg)', color: 'var(--text-2)' }}
            >
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePickPhoto} className="hidden" />
          </div>
        </div>
        {uploading && <div className="mb-3 text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('ep_subiendo')}</div>}

        <FieldLabel>{t('ep_nombre')}</FieldLabel>
        <InputRow icon={<User size={16} />} value={nombre} onChange={setNombre} placeholder={t('ep_placeholder_nombre')} />

        <FieldLabel>{t('ep_apellido')}</FieldLabel>
        <InputRow icon={<User size={16} />} value={apellido} onChange={setApellido} placeholder={t('ep_placeholder_apellido')} />

        <FieldLabel>{t('ep_fecha_nacimiento')}</FieldLabel>
        <DateSelect value={fechaNacimiento} onChange={setFechaNacimiento} />

        <FieldLabel>{t('ep_ciudad')}</FieldLabel>
        <InputRow icon={<MapPin size={16} />} value={ciudad} onChange={setCiudad} placeholder={t('ep_placeholder_ciudad')} />

        <FieldLabel>{t('ep_pais')}</FieldLabel>
        <select
          value={pais}
          onChange={(e) => setPais(e.target.value)}
          className="mb-2.5 w-full rounded-2xl px-3.5 py-3 text-[13px] outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: pais ? 'var(--text-1)' : 'var(--text-3)' }}
        >
          <option value="">{t('ep_pais_selecciona')}</option>
          {PAISES.map((p) => (
            <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
          ))}
        </select>

        {loadingProfile && <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('ep_cargando_info')}</div>}
        {msg && <div className="mt-3 text-xs" style={{ color: 'var(--coral)' }}>{msg}</div>}

        <button
          onClick={save}
          disabled={saving || !nombre}
          className="mt-6 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          {saving ? t('ep_guardando') : t('ep_guardar_cambios')}
        </button>
      </div>

      {pendingFile && (
        <PhotoCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

function InputRow({ icon, placeholder, value, onChange }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-1)' }}
      />
    </div>
  )
}
