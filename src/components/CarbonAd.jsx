import { useEffect, useRef } from 'react'

const PLACEMENT = import.meta.env.VITE_CARBON_ADS_PLACEMENT

export default function CarbonAd() {
  const el = useRef(null)

  useEffect(() => {
    if (!PLACEMENT || !el.current) return
    const s = document.createElement('script')
    s.id = '_carbonads_js'
    s.src = `//cdn.carbonads.com/carbon.js?serve=${PLACEMENT}&placement=hyperprepapp`
    s.async = true
    el.current.appendChild(s)
    return () => { if (el.current) el.current.innerHTML = '' }
  }, [])

  if (!PLACEMENT) return null
  return <div ref={el} className="flex justify-center py-2" />
}
