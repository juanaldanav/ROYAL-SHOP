/* eslint-disable @next/next/no-img-element */
export function RoyaleLogo({ size = 110 }: { size?: number }) {
  return (
    <img
      src="/logo-icon.png"
      alt="Royal Shop"
      width={size}
      height={size}
      className="rounded-full block"
    />
  )
}
