import logo from '../assets/logos/logo-oficial-web.png'

export default function Logo({ size = 38, rounded = 12 }: { size?: number; rounded?: number }) {
  return (
    <img
      src={logo}
      alt="CashFlow"
      style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover', flexShrink: 0, display: 'block' }}
    />
  )
}
