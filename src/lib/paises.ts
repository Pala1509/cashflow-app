// Lista de países para el selector de registro/perfil, agrupados en el
// mismo continente que ya usan los bancos predeterminados (ver
// BANCOS_GRUPOS en Cuentas.tsx). Así, con solo el país de la persona
// alcanza para saber qué grupo de bancos mostrarle de entrada, sin
// tener que pedirle el continente por aparte.
export type ContinenteBanco = 'norteamerica' | 'centroamerica' | 'sudamerica' | 'europa' | 'asia'

export const PAISES: { nombre: string; continente: ContinenteBanco }[] = [
  // Norteamérica
  { nombre: 'México', continente: 'norteamerica' },
  { nombre: 'Estados Unidos', continente: 'norteamerica' },
  { nombre: 'Canadá', continente: 'norteamerica' },
  // Centroamérica y Caribe — comparten el mismo grupo de bancos que
  // Centroamérica en BANCOS_GRUPOS (no hay un grupo de bancos "Caribe" aparte).
  { nombre: 'Guatemala', continente: 'centroamerica' },
  { nombre: 'Belice', continente: 'centroamerica' },
  { nombre: 'Honduras', continente: 'centroamerica' },
  { nombre: 'El Salvador', continente: 'centroamerica' },
  { nombre: 'Nicaragua', continente: 'centroamerica' },
  { nombre: 'Costa Rica', continente: 'centroamerica' },
  { nombre: 'Panamá', continente: 'centroamerica' },
  { nombre: 'Cuba', continente: 'centroamerica' },
  { nombre: 'República Dominicana', continente: 'centroamerica' },
  { nombre: 'Puerto Rico', continente: 'centroamerica' },
  { nombre: 'Jamaica', continente: 'centroamerica' },
  { nombre: 'Haití', continente: 'centroamerica' },
  // Sudamérica
  { nombre: 'Colombia', continente: 'sudamerica' },
  { nombre: 'Venezuela', continente: 'sudamerica' },
  { nombre: 'Ecuador', continente: 'sudamerica' },
  { nombre: 'Perú', continente: 'sudamerica' },
  { nombre: 'Bolivia', continente: 'sudamerica' },
  { nombre: 'Chile', continente: 'sudamerica' },
  { nombre: 'Argentina', continente: 'sudamerica' },
  { nombre: 'Uruguay', continente: 'sudamerica' },
  { nombre: 'Paraguay', continente: 'sudamerica' },
  { nombre: 'Brasil', continente: 'sudamerica' },
  { nombre: 'Guyana', continente: 'sudamerica' },
  { nombre: 'Surinam', continente: 'sudamerica' },
  // Europa
  { nombre: 'España', continente: 'europa' },
  { nombre: 'Francia', continente: 'europa' },
  { nombre: 'Alemania', continente: 'europa' },
  { nombre: 'Italia', continente: 'europa' },
  { nombre: 'Reino Unido', continente: 'europa' },
  { nombre: 'Portugal', continente: 'europa' },
  { nombre: 'Países Bajos', continente: 'europa' },
  { nombre: 'Bélgica', continente: 'europa' },
  { nombre: 'Suiza', continente: 'europa' },
  { nombre: 'Suecia', continente: 'europa' },
  { nombre: 'Noruega', continente: 'europa' },
  { nombre: 'Dinamarca', continente: 'europa' },
  { nombre: 'Irlanda', continente: 'europa' },
  { nombre: 'Polonia', continente: 'europa' },
  // Asia
  { nombre: 'China', continente: 'asia' },
  { nombre: 'Japón', continente: 'asia' },
  { nombre: 'India', continente: 'asia' },
  { nombre: 'Corea del Sur', continente: 'asia' },
  { nombre: 'Singapur', continente: 'asia' },
  { nombre: 'Filipinas', continente: 'asia' },
  { nombre: 'Indonesia', continente: 'asia' },
  { nombre: 'Emiratos Árabes Unidos', continente: 'asia' },
  // Catch-all para quien no encuentre su país en la lista — no filtra
  // (continenteDe devuelve null para este valor, ver abajo), simplemente
  // le sigue mostrando todos los bancos, como antes de este cambio.
  { nombre: 'Otro / no listado', continente: 'sudamerica' },
]

const CONTINENTE_DE_PAIS: Record<string, ContinenteBanco> = Object.fromEntries(
  PAISES.filter((p) => p.nombre !== 'Otro / no listado').map((p) => [p.nombre, p.continente])
)

// Devuelve el continente (grupo de BANCOS_GRUPOS) de un país guardado.
// Si el país es null/undefined, no está en la lista, o es el catch-all
// "Otro / no listado", devuelve null — quien llame debe interpretar null
// como "no filtrar, mostrar todos los continentes" para no esconderle
// bancos a alguien de quien no sabemos (o no podemos inferir) el país,
// como los usuarios beta que se registraron antes de este campo existir.
export function continenteDe(pais: string | null | undefined): ContinenteBanco | null {
  if (!pais || pais === 'Otro / no listado') return null
  return CONTINENTE_DE_PAIS[pais] ?? null
}
