// Todo esto existe por una sola razón: Firebase Cloud Messaging exige que
// el SERVIDOR (no la app) se autentique con Google usando la llave
// privada del service account, antes de poder mandar un solo push. Google
// no acepta la llave directamente — hay que firmar un token (JWT) con
// ella, cambiarlo por un "access token" temporal, y usar ESE para mandar
// el push. Es más largo de lo que se ve, pero es el único camino oficial.

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Cambia la llave privada por un access token válido por 1 hora — se pide
// uno nuevo en cada corrida de la función (correr una vez al día no
// justifica guardarlo en caché).
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(firma)}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Google OAuth rechazó el token: ${JSON.stringify(data)}`)
  return data.access_token as string
}

// Manda un push a UN dispositivo (un token). Si el token ya no sirve
// (desinstalaron la app, etc.) simplemente devuelve false sin explotar —
// eso se limpia aparte, no aquí.
export async function sendPush(sa: ServiceAccount, token: string, title: string, body: string, ruta?: string): Promise<boolean> {
  const accessToken = await getAccessToken(sa)
  const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: ruta ? { ruta } : undefined,
        android: { priority: 'high' },
      },
    }),
  })
  if (!resp.ok) console.error('FCM rechazó el envío:', await resp.text())
  return resp.ok
}
