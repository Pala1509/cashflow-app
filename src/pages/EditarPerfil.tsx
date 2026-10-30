import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, Camera, AtSign, Lock, Mail, Check, Loader2 } from 'lucide-react'
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
  // Nickname: quien no tiene puede crearlo; quien ya tiene puede cambiarlo
  // máximo una vez cada 30 días (la base de datos también lo valida).
  const [nickname, setNickname] = useState<string | null>(null)
  const [nickCambiadoAt, setNickCambiadoAt] = useState<string | null>(null)
  const [editandoNick, setEditandoNick] = useState(false)
  const [nickNuevo, setNickNuevo] = useState('')
  const [nickEstado, setNickEstado] = useState<'vacio' | 'revisando' | 'libre' | 'ocupado' | 'invalido'>('vacio')
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
      .select('apellido, fecha_nacimiento, ciudad, avatar_url, pais, nickname')
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
          setNickname((data.nickname as string | null) ?? null)
        }
        setLoadingProfile(false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('nickname_cambiado_at').eq('id', user.id).single()
      .then(({ data, error }) => { if (!error) setNickCambiadoAt((data as { nickname_cambiado_at: string | null } | null)?.nickname_cambiado_at ?? null) })
  }, [user])

  const proximoCambio = nickCambiadoAt ? new Date(new Date(nickCambiadoAt).getTime() + 30 * 86_400_000) : null
  const puedeCambiarNick = !nickname || !proximoCambio || proximoCambio <= new Date()
  const escribiendoNick = !nickname || editandoNick

  useEffect(() => {
    const n = nickNuevo.trim().toLowerCase()
    if (!n) { setNickEstado('vacio'); return }
    if (!/^[a-z0-9_.]{3,20}$/.test(n)) { setNickEstado('invalido'); return }
    setNickEstado('revisando')
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('nickname_disponible', { p_nickname: n })
      if (error) { setNickEstado('vacio'); return }
      setNickEstado(data ? 'libre' : 'ocupado')
    }, 450)
    return () => clearTimeout(id)
  }, [nickNuevo])

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
    if (escribiendoNick && nickNuevo.trim() && nickNuevo.trim().toLowerCase() !== nickname && nickEstado !== 'libre') { setMsg(nickEstado === 'ocupado' ? 'Ese nickname ya está en uso, prueba otro.' : 'Revisa el nickname: solo letras, números, punto y _ (3 a 20).'); return }
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
        ...(escribiendoNick && puedeCambiarNick && nickEstado === 'libre' && nickNuevo.trim().toLowerCase() !== nickname ? { nickname: nickNuevo.trim().toLowerCase() } : {}),
      })
      .eq('id', user.id)

    setSaving(false)
    if (profileError?.message?.includes('una vez al mes')) { setMsg('Solo puedes cambiar tu nickname una vez al mes.'); return }
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

        <div className="grid grid-cols-2 gap-2.5">
          <Campo label={t('ep_nombre')}>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('ep_placeholder_nombre')} autoComplete="given-name" className="w-full rounded-2xl px-4 text-[15px] outline-none" style={INPUT} />
          </Campo>
          <Campo label={t('ep_apellido')}>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder={t('ep_placeholder_apellido')} autoComplete="family-name" className="w-full rounded-2xl px-4 text-[15px] outline-none" style={INPUT} />
          </Campo>
        </div>

        <Campo label="Nickname">
          {!escribiendoNick ? (
            <div className="flex items-center gap-2 rounded-2xl pl-4 pr-1.5" style={{ ...INPUT, color: 'var(--text-2)' }}>
              <AtSign size={17} />
              <span className="flex-1 text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{nickname}</span>
              {puedeCambiarNick ? (
                <button type="button" onClick={(e) => { e.preventDefault(); setEditandoNick(true); setNickNuevo(nickname ?? '') }} className="rounded-xl px-3 text-[12px] font-bold" style={{ height: 38, background: 'var(--card-2)', color: 'var(--lime)' }}>Cambiar</button>
              ) : <span className="pr-2.5"><Lock size={15} /></span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl px-4" style={{ ...INPUT, borderColor: nickEstado === 'libre' ? 'var(--lime)' : nickEstado === 'ocupado' || nickEstado === 'invalido' ? 'var(--coral)' : 'var(--line)' }}>
              <AtSign size={17} color="var(--text-2)" />
              <input value={nickNuevo} onChange={(e) => setNickNuevo(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="tu.nickname" maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: 'var(--text-1)' }} />
              {nickEstado === 'revisando' && <Loader2 size={15} className="animate-spin" color="var(--text-2)" />}
              {nickEstado === 'libre' && <Check size={15} color="var(--lime)" />}
              {nickname && <button type="button" aria-label="Cancelar cambio de nickname" onClick={(e) => { e.preventDefault(); setEditandoNick(false); setNickNuevo('') }}><X size={16} color="var(--text-2)" /></button>}
            </div>
          )}
          <span className="mt-1.5 block text-[11.5px]" style={{ color: escribiendoNick && (nickEstado === 'ocupado' || nickEstado === 'invalido') ? 'var(--coral)' : 'var(--text-2)' }}>
            {escribiendoNick
              ? (nickEstado === 'ocupado' ? 'Ya está en uso, prueba otro.'
                : nickEstado === 'invalido' ? 'Solo letras, números, punto y _ (3 a 20).'
                : nickname ? 'Ojo: después de cambiarlo, el próximo cambio es en 30 días.'
                : 'Escoge uno para entrar sin escribir el correo. Lo puedes cambiar una vez al mes.')
              : puedeCambiarNick ? 'Con tu nickname también puedes entrar. Lo puedes cambiar una vez al mes.'
              : `Con tu nickname también puedes entrar. Podrás cambiarlo desde el ${proximoCambio ? proximoCambio.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : ''}.`}
          </span>
        </Campo>

        <Campo label="Correo electrónico">
          <div className="flex items-center gap-2 rounded-2xl px-4" style={{ ...INPUT, color: 'var(--text-2)' }}>
            <Mail size={17} />
            <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: 'var(--text-1)' }}>{user?.email ?? '—'}</span>
            <Lock size={15} />
          </div>
        </Campo>

        <Campo label={t('ep_fecha_nacimiento')}>
          <DateSelect value={fechaNacimiento} onChange={setFechaNacimiento} />
        </Campo>

        <div className="grid grid-cols-2 gap-2.5">
          <Campo label={t('ep_ciudad')}>
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder={t('ep_placeholder_ciudad')} autoComplete="address-level2" className="w-full rounded-2xl px-4 text-[15px] outline-none" style={INPUT} />
          </Campo>
          <Campo label={t('ep_pais')}>
            <select value={pais} onChange={(e) => setPais(e.target.value)} className="w-full rounded-2xl px-3 text-[15px] outline-none" style={{ ...INPUT, color: pais ? 'var(--text-1)' : 'var(--text-2)' }}>
              <option value="">{t('ep_pais_selecciona')}</option>
              {PAISES.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </Campo>
        </div>

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

const INPUT: React.CSSProperties = { height: 52, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }

// Mismo estilo de campo que el registro: etiqueta pequeña arriba y caja alta.
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3.5 flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{label}</span>
      {children}
    </label>
  )
}
