// POS layout: sin nav, full screen — cajero mode
export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden bg-muted/20">{children}</div>
}
