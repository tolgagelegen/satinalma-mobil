import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase.js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── CONSTANTS ──────────────────────────────────────────────
const UNITS     = ['Adet','Kg','m²','m³','Ton','Lt','Mt','Paket','Koli','Çuval','Rulo','Palet','Kamyon']
const PROJECTS  = ['FLATS PROJESİ','BOULEVARD PROJESİ','CENTRAL PROJESİ','ALYA PROJESİ','PRİME PROJESİ','DİĞER']
const URGENCIES = [
  {l:'Normal',   c:'#22c97a', sub:'1 hafta ve üzeri'},
  {l:'Acil',     c:'#f59e0b', sub:'3 gün içinde'},
  {l:'Çok Acil', c:'#ef4444', sub:'Bugün / Yarın'},
]
const STATUS    = {
  beklemede:  {label:'Beklemede', color:'#f59e0b'},
  onaylandi:  {label:'Onaylandı', color:'#22c97a'},
  reddedildi: {label:'Reddedildi',color:'#ef4444'},
}

const THEMES = [
  { n:'Karanlık',    bg:'#060c12', bg2:'#0a1420', bg3:'#091323', border:'#162336', text:'#e2eaf3', text2:'#3e5e78', text3:'#2e4a60', accent:'#ff6b35', accent2:'#e85520' },
  { n:'Gece Mavisi', bg:'#0b1520', bg2:'#101d2c', bg3:'#0f1e2e', border:'#1e3248', text:'#e2eaf3', text2:'#3e5e78', text3:'#2e4a60', accent:'#ff6b35', accent2:'#e85520' },
  { n:'Koyu Gri',    bg:'#111827', bg2:'#1f2937', bg3:'#1a2332', border:'#374151', text:'#f9fafb', text2:'#9ca3af', text3:'#6b7280', accent:'#f97316', accent2:'#ea580c' },
  { n:'Yeşil Gece',  bg:'#071410', bg2:'#0c1f18', bg3:'#0a1c14', border:'#1a3328', text:'#dcfce7', text2:'#4ade80', text3:'#16a34a', accent:'#22c97a', accent2:'#16a34a' },
  { n:'Mor Gece',    bg:'#0d0a16', bg2:'#160f24', bg3:'#130d20', border:'#2d1d47', text:'#f3e8ff', text2:'#c084fc', text3:'#9333ea', accent:'#a855f7', accent2:'#9333ea' },
  { n:'Çelik Mavi',  bg:'#0a1525', bg2:'#0f2035', bg3:'#0e1d30', border:'#1e3a5f', text:'#dbeafe', text2:'#93c5fd', text3:'#3b82f6', accent:'#60a5fa', accent2:'#3b82f6' },
  { n:'Amber',       bg:'#1a0e05', bg2:'#271708', bg3:'#221406', border:'#4a2d0e', text:'#fef3c7', text2:'#fbbf24', text3:'#d97706', accent:'#f59e0b', accent2:'#d97706' },
  { n:'Açık',        bg:'#f0f4f8', bg2:'#ffffff', bg3:'#e8edf3', border:'#cbd5e1', text:'#1e293b', text2:'#64748b', text3:'#94a3b8', accent:'#ff6b35', accent2:'#e85520' },
]

const applyTheme = (t) => {
  const r = document.documentElement
  r.style.setProperty('--bg',     t.bg)
  r.style.setProperty('--bg2',    t.bg2)
  r.style.setProperty('--bg3',    t.bg3)
  r.style.setProperty('--border', t.border)
  r.style.setProperty('--text',   t.text)
  r.style.setProperty('--text2',  t.text2)
  r.style.setProperty('--text3',  t.text3)
  r.style.setProperty('--accent', t.accent)
  r.style.setProperty('--accent2',t.accent2)
}

// ── PDF PRINT ──────────────────────────────────────────────
const downloadOrderPDF = async (order) => {
  const items = parseItems(order.product_description, order.quantity, order.unit)
  const statusMap = { beklemede:'Beklemede', onaylandi:'Onaylandı', reddedildi:'Reddedildi' }

  // Geçici div oluştur
  const div = document.createElement('div')
  div.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;padding:32px;font-family:Arial,sans-serif;font-size:13px;color:#111;'

  const itemRows = items.map((it,i) => `
    <tr style="background:${i%2===0?'#fff':'#fafafa'}">
      <td style="padding:7px 10px;border:1px solid #eee">${i+1}</td>
      <td style="padding:7px 10px;border:1px solid #eee">${it.desc}</td>
      <td style="padding:7px 10px;border:1px solid #eee;text-align:center">${it.qty}</td>
      <td style="padding:7px 10px;border:1px solid #eee;text-align:center">${it.unit}</td>
    </tr>`).join('')

  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ff6b35;padding-bottom:14px;margin-bottom:18px">
      <div>
        <img src="${window.location.origin}/logo.jpg" style="height:48px;object-fit:contain;display:block;margin-bottom:4px"/>
        <div style="font-size:11px;color:#666">Mehmet Kavan Yapı · Saha Sipariş Portalı</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:800">${order.order_no}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${new Date(order.created_at).toLocaleString('tr-TR')}</div>
        <span style="display:inline-block;margin-top:4px;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;border:1.5px solid #555;color:#555;text-transform:uppercase">${statusMap[order.status]||order.status}</span>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr style="background:#f5f5f5"><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888;width:120px">Sipariş Veren</td><td style="padding:8px 10px;border:1px solid #ddd">${order.user_name}</td><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888;width:80px">Proje</td><td style="padding:8px 10px;border:1px solid #ddd">${order.project}</td></tr>
      <tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Aciliyet</td><td style="padding:8px 10px;border:1px solid #ddd">${order.urgency}</td><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">E-posta</td><td style="padding:8px 10px;border:1px solid #ddd">${order.user_email}</td></tr>
      <tr style="background:#f5f5f5"><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">İş Tanımı</td><td colspan="3" style="padding:8px 10px;border:1px solid #ddd">${order.job_description}</td></tr>
      ${order.notes?`<tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888">Not</td><td colspan="3" style="padding:8px 10px;border:1px solid #ddd">${order.notes}</td></tr>`:''}
    </table>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px">Ürün Kalemleri</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
      <thead><tr style="background:#f5f5f5"><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;font-size:11px;text-transform:uppercase">#</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;font-size:11px;text-transform:uppercase">Ürün Açıklaması</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:center;font-size:11px;text-transform:uppercase">Miktar</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:center;font-size:11px;text-transform:uppercase">Birim</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${order.admin_note?`<div style="background:#fff8f5;border:1px solid #ffd0be;border-radius:6px;padding:10px 14px;margin-bottom:18px"><div style="font-size:10px;font-weight:700;color:#e85520;margin-bottom:4px;text-transform:uppercase">Satın Alma Notu</div>${order.admin_note}</div>`:''}
    <div style="display:flex;gap:24px;margin-top:32px">
      <div style="flex:1;border:1.5px solid #ddd;border-radius:8px;padding:16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px">Siparişi Veren</div>
        <div style="height:52px"></div>
        <div style="border-top:1.5px solid #333;margin-bottom:6px"></div>
        <div style="font-size:12px;font-weight:600;text-align:center">${order.user_name}</div>
      </div>
      <div style="flex:1;border:1.5px solid #ddd;border-radius:8px;padding:16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px">Onay</div>
        <div style="height:52px"></div>
        <div style="border-top:1.5px solid #333;margin-bottom:6px"></div>
        <div style="font-size:12px;font-weight:600;text-align:center">&nbsp;</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:12px;margin-top:16px;font-size:10px;color:#aaa">
      <span>Satınalma Sistemi · Mehmet Kavan Yapı</span>
      <span>Çıktı: ${new Date().toLocaleString('tr-TR')}</span>
    </div>`

  document.body.appendChild(div)
  try {
    const canvas = await html2canvas(div, { scale: 2, useCORS: true, backgroundColor: '#fff' })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = (canvas.height * pdfW) / canvas.width
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)
    pdf.save(`Siparis-${order.order_no}.pdf`)
  } finally {
    document.body.removeChild(div)
  }
}

const printOrder = (order) => {
  const items = parseItems(order.product_description, order.quantity, order.unit)
  const statusMap = { beklemede:'Beklemede', onaylandi:'Onaylandı', reddedildi:'Reddedildi' }
  const urgColor  = { Normal:'#22c97a', Acil:'#f59e0b', 'Çok Acil':'#ef4444' }
  const date      = new Date(order.created_at).toLocaleString('tr-TR')
  const printDate = new Date().toLocaleString('tr-TR')

  const itemRows = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.desc}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:center">${it.unit}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="UTF-8"/>
<title>Sipariş ${order.order_no}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #111; background: white; padding: 28px 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ff6b35; padding-bottom: 14px; margin-bottom: 18px; }
  .logo img { height: 52px; object-fit: contain; display: block; margin-bottom: 4px; }
  .logo { font-size: 13px; font-weight: 700; color: #333; }
  .logo span { display: block; font-size: 11px; font-weight: 400; color: #666; margin-top: 1px; }
  .order-no { font-size: 20px; font-weight: 800; color: #111; text-align: right; }
  .order-no span { display: block; font-size: 11px; font-weight: 400; color: #666; margin-top: 2px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; border: 1.5px solid; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 18px; }
  .row { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .row:nth-child(odd) { background: #fafafa; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 2px; }
  .value { font-size: 13px; color: #111; line-height: 1.4; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; border: 1px solid #ddd; }
  td { padding: 8px 10px; border: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .admin-note { background: #fff8f5; border: 1px solid #ffd0be; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; }
  .footer { display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 12px; margin-top: 8px; font-size: 10px; color: #aaa; }
  .sign-box { margin-top: 32px; display: flex; gap: 24px; }
  .sign-card { flex: 1; border: 1.5px solid #ddd; border-radius: 8px; padding: 16px; }
  .sign-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 8px; }
  .sign-space { height: 52px; }
  .sign-line { border-top: 1.5px solid #333; margin-bottom: 6px; }
  .sign-printed { font-size: 12px; font-weight: 600; color: #333; text-align: center; }
  @media print { @page { margin: 1.5cm; } }
</style>
</head><body>
<div class="header">
  <div>
    <div class="logo"><img src="${window.location.origin}/logo.jpg" alt="Mehmet Kavan Yapı"/>SATINALMA SİSTEMİ<span>Mehmet Kavan Yapı · Saha Sipariş Portalı</span></div>
  </div>
  <div style="text-align:right">
    <div class="order-no">${order.order_no}<span>${date}</span></div>
    <div class="badge" style="color:${urgColor[order.urgency]||'#22c97a'};border-color:${urgColor[order.urgency]||'#22c97a'}">${order.urgency}</div>
    &nbsp;
    <div class="badge" style="color:#555;border-color:#999">${statusMap[order.status]||order.status}</div>
  </div>
</div>

<div class="grid">
  <div class="row"><div class="label">Sipariş Veren</div><div class="value">${order.user_name}</div></div>
  <div class="row"><div class="label">E-Posta</div><div class="value">${order.user_email}</div></div>
  <div class="row"><div class="label">Proje</div><div class="value">${order.project}</div></div>
  <div class="row"><div class="label">Aciliyet</div><div class="value">${order.urgency}</div></div>
  <div class="row" style="grid-column:1/-1"><div class="label">İş Tanımı / Kullanım Yeri</div><div class="value">${order.job_description}</div></div>
  ${order.notes ? `<div class="row" style="grid-column:1/-1"><div class="label">Not</div><div class="value">${order.notes}</div></div>` : ''}
</div>

<div class="section-title">Ürün Kalemleri</div>
<table>
  <thead><tr><th>#</th><th>Ürün Açıklaması</th><th style="text-align:center">Miktar</th><th style="text-align:center">Birim</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>

${order.admin_note ? `<div class="admin-note"><div class="label" style="color:#e85520;margin-bottom:4px">Satın Alma Notu</div><div class="value">${order.admin_note}</div></div>` : ''}

<div class="sign-box">
  <div class="sign-card">
    <div class="sign-title">Siparişi Veren</div>
    <div class="sign-space"></div>
    <div class="sign-line"></div>
    <div class="sign-printed">${order.user_name}</div>
  </div>
  <div class="sign-card">
    <div class="sign-title">Onay</div>
    <div class="sign-space"></div>
    <div class="sign-line"></div>
    <div class="sign-printed">&nbsp;</div>
  </div>
</div>

<div class="footer">
  <span>Satınalma Sistemi · Mehmet Kavan Yapı</span>
  <span>Çıktı tarihi: ${printDate}</span>
</div>
</body></html>`

  const w = window.open('', '_blank', 'width=800,height=900')
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

// ── HELPERS ────────────────────────────────────────────────
const parseItems = (productDescription, quantity, unit) => {
  try {
    const parsed = JSON.parse(productDescription)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ desc: productDescription, qty: quantity || '', unit: unit || 'Adet' }]
}

// AudioContext'i kullanıcı etkileşimiyle başlat
let _audioCtx = null
const getAudioCtx = () => {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', () => getAudioCtx(), { once: true })
  window.addEventListener('touchstart', () => getAudioCtx(), { once: true })
}

const playNotificationSound = (type = 'info') => {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime

    if (type === 'success') {
      // Onay: iki yükselen nota — DO MI
      [[0, 523], [0.18, 659]].forEach(([delay, freq]) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0.25, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35)
        osc.start(now + delay); osc.stop(now + delay + 0.35)
      })
    } else if (type === 'error') {
      // Red: iki alçalan nota — LA FA
      [[0, 440], [0.18, 349]].forEach(([delay, freq]) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0.25, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4)
        osc.start(now + delay); osc.stop(now + delay + 0.4)
      })
    } else {
      // Yeni sipariş: üç nota — dikkat çekici uzun ses
      [[0, 880], [0.28, 1046], [0.56, 1318]].forEach(([delay, freq]) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0.28, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55)
        osc.start(now + delay); osc.stop(now + delay + 0.55)
      })
    }
  } catch (_) {}
}

const showBrowserNotification = (title, body, soundType = 'info') => {
  playNotificationSound(soundType)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }) } catch (_) {}
  }
}

// ── APP ────────────────────────────────────────────────────
export default function App() {
  const [session,   setSession]   = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('new')
  const [notifPerm, setNotifPerm] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  )
  const [themeIdx,  setThemeIdx]  = useState(() => parseInt(localStorage.getItem('themeIdx') ?? '1'))

  useEffect(() => {
    const t = THEMES[themeIdx] || THEMES[1]
    applyTheme(t)
    localStorage.setItem('themeIdx', themeIdx)
  }, [themeIdx])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess)
      if (sess) loadProfile(sess.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
    setTab(data?.role === 'admin' ? 'all' : 'new')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setTab('new')
  }

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const p = await Notification.requestPermission()
      setNotifPerm(p)
    }
  }

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <Spin/>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:480,margin:'0 auto',overflow:'hidden',background:'var(--bg)'}}>
      {!session
        ? <AuthView onLogin={() => {}} />
        : !profile
          ? <NoProfileView onLogout={handleLogout}/>
          : <Shell
              session={session} profile={profile} tab={tab} setTab={setTab}
              onLogout={handleLogout} reloadProfile={() => loadProfile(session.user.id)}
              notifPerm={notifPerm} onRequestNotif={requestNotifPermission}
              themeIdx={themeIdx} onThemeChange={setThemeIdx}
            />
      }
    </div>
  )
}

// ── AUTH VIEW ─────────────────────────────────────────────
const toEmail = (phone) => phone.replace(/\s/g,'') + '@mky.com'

function AuthView() {
  const [phone, setPhone] = useState('')
  const [pass,  setPass]  = useState('')
  const [err,   setErr]   = useState('')
  const [busy,  setBusy]  = useState(false)

  const isEmail = (v) => v.includes('@')

  const fmt = (v) => {
    if (isEmail(v)) return v  // e-posta girişine dokunma
    const d = v.replace(/\D/g,'').slice(0,11)
    if (d.length <= 4) return d
    if (d.length <= 7) return d.slice(0,4)+' '+d.slice(4)
    if (d.length <= 9) return d.slice(0,4)+' '+d.slice(4,7)+' '+d.slice(7)
    return d.slice(0,4)+' '+d.slice(4,7)+' '+d.slice(7,9)+' '+d.slice(9)
  }

  const handleSubmit = async () => {
    setErr('')
    if (!pass) { setErr('Şifre zorunludur.'); return }
    let email
    if (isEmail(phone)) {
      email = phone.trim()
    } else {
      const digits = phone.replace(/\D/g,'')
      if (digits.length < 10) { setErr('Geçerli bir telefon numarası giriniz.'); return }
      email = toEmail(digits)
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setErr('Giriş bilgileri hatalı.')
    setBusy(false)
  }

  return (
    <div className="fade" style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'1.5rem',overflowY:'auto'}}>
      <div style={{textAlign:'center',marginBottom:'2rem'}}>
        <div style={{marginBottom:12}}>
          <img src="/logo.jpg" alt="Mehmet Kavan Yapı" style={{height:72,objectFit:'contain',borderRadius:12}}/>
        </div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,letterSpacing:'-.4px'}}>SATINALMA SİSTEMİ</h1>
        <p style={{color:'var(--text2)',fontSize:12,marginTop:4}}>Mehmet Kavan Yapı · Saha Sipariş Portalı</p>
      </div>

      <div style={{background:'var(--bg2)',borderRadius:16,padding:'1.4rem',border:'1px solid var(--border)',boxShadow:'0 16px 40px rgba(0,0,0,.4)',display:'flex',flexDirection:'column',gap:12}}>
        <Fld label="Telefon No veya E-posta">
          <input
            type="text" value={phone} placeholder="0555 123 45 67"
            onChange={e => setPhone(fmt(e.target.value))}
            onKeyDown={e => e.key==='Enter' && handleSubmit()}
            autoCapitalize="none" autoCorrect="off"
          />
        </Fld>
        <Fld label="Şifre">
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
        </Fld>
        {err && <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'9px 12px',color:'#ef4444',fontSize:13}}>{err}</div>}
        <button onClick={handleSubmit} disabled={busy} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#ff6b35,#e85520)',color:'white',border:'none',borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:'pointer',boxShadow:'0 5px 16px rgba(255,107,53,.35)',opacity:busy?.7:1}}>
          {busy ? 'Lütfen bekleyin...' : 'Giriş Yap →'}
        </button>
        <div style={{textAlign:'center',fontSize:11,color:'var(--text3)',marginTop:4}}>
          Hesap açmak için yöneticinizle iletişime geçin
        </div>
      </div>
    </div>
  )
}

// ── NO PROFILE ────────────────────────────────────────────
function NoProfileView({ onLogout }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <div style={{fontSize:52,marginBottom:16}}>⏳</div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,marginBottom:8}}>Hesabınız Aktif Edilmedi</h2>
      <p style={{color:'#4e6a82',fontSize:14,lineHeight:1.6,marginBottom:24}}>Hesabınız henüz aktif edilmedi. Lütfen yönetici ile iletişime geçin.</p>
      <button onClick={onLogout} style={{padding:'10px 24px',background:'var(--border)',color:'var(--text)',border:'none',borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:'pointer'}}>Çıkış Yap</button>
    </div>
  )
}

// ── SHELL ─────────────────────────────────────────────────
function Shell({ session, profile, tab, setTab, onLogout, reloadProfile, notifPerm, onRequestNotif, themeIdx, onThemeChange }) {
  const isAdmin = profile?.role === 'admin'
  const tabs = isAdmin
    ? [{id:'all',icon:'📋',label:'Siparişler'},{id:'users',icon:'👥',label:'Kullanıcılar'}]
    : [{id:'new',icon:'➕',label:'Yeni Sipariş'},{id:'my',icon:'📦',label:'Siparişlerim'}]

  // ── Realtime notifications ──────────────────────────────
  useEffect(() => {
    if (!profile) return

    if (isAdmin) {
      // Admin: yeni sipariş geldiğinde bildir
      const ch = supabase
        .channel('admin-new-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new
          const urgLabel = o.urgency === 'Çok Acil' ? '⚠️ ÇOK ACİL · ' : o.urgency === 'Acil' ? '🔶 ACİL · ' : ''
          showBrowserNotification(
            `🛒 Yeni Sipariş: ${o.order_no}`,
            `${urgLabel}${o.user_name}\n${o.project}`,
            'info'
          )
        })
        .subscribe()
      return () => supabase.removeChannel(ch)
    } else {
      // Saha şefi: kendi siparişinin durumu değiştiğinde bildir
      const ch = supabase
        .channel(`user-order-updates-${profile.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new
          if (o.user_id !== profile.id) return
          const icon = o.status === 'onaylandi' ? '✅' : '❌'
          const label = o.status === 'onaylandi' ? 'onaylandı' : 'reddedildi'
          showBrowserNotification(
            `${icon} Sipariş ${label}: ${o.order_no}`,
            o.admin_note ? `Not: ${o.admin_note}` : `Siparişiniz ${label}.`,
            o.status === 'onaylandi' ? 'success' : 'error'
          )
        })
        .subscribe()
      return () => supabase.removeChannel(ch)
    }
  }, [profile, isAdmin])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'var(--bg2)',padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,background:'white',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',boxShadow:'0 3px 10px rgba(0,0,0,.2)'}}>
            <img src="/logo.jpg" alt="logo" style={{width:'100%',height:'100%',objectFit:'contain',padding:3}}/>
          </div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,letterSpacing:'-.3px',lineHeight:1.1}}>SATINALMA</div>
            <div style={{fontSize:11,color:'var(--text2)'}}>{profile?.name}{isAdmin&&<span style={{color:'var(--accent)',fontWeight:700}}> · Admin</span>}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center'}}>
          {notifPerm === 'default' && (
            <button onClick={onRequestNotif} title="Bildirimleri Etkinleştir" style={{background:'rgba(255,107,53,.12)',border:'1px solid rgba(255,107,53,.3)',color:'var(--accent)',borderRadius:7,padding:'5px 9px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>🔔</button>
          )}
          {notifPerm === 'granted' && (
            <span title="Bildirimler aktif" style={{fontSize:16,opacity:.7}}>🔔</span>
          )}
          {/* Tema seçici */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:2}}>
            {THEMES.map((t,i)=>(
              <button key={i} onClick={()=>onThemeChange(i)} title={t.n}
                style={{width:14,height:14,borderRadius:3,background:t.bg2,border:`2px solid ${i===themeIdx?t.accent:'transparent'}`,cursor:'pointer',padding:0,outline:'none',boxSizing:'border-box',transition:'border-color .15s'}}
              />
            ))}
          </div>
          <button onClick={onLogout} style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.28)',color:'#ef4444',borderRadius:7,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Çıkış</button>
        </div>
      </div>

      {/* Bildirim izni banner */}
      {notifPerm === 'default' && (
        <div style={{background:'rgba(255,107,53,.08)',borderBottom:'1px solid rgba(255,107,53,.2)',padding:'9px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexShrink:0}}>
          <span style={{fontSize:12,color:'var(--accent)',lineHeight:1.4}}>🔔 Yeni sipariş bildirimlerini almak için izin verin</span>
          <button onClick={onRequestNotif} style={{background:'#ff6b35',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'DM Sans',sans-serif"}}>İzin Ver</button>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='new'   && <NewOrderView  profile={profile}/>}
        {tab==='my'    && <MyOrdersView  profile={profile}/>}
        {tab==='all'   && <AllOrdersView profile={profile}/>}
        {tab==='users' && <UsersView     profile={profile} reloadProfile={reloadProfile}/>}
      </div>

      {/* Tab Bar */}
      <div style={{background:'var(--bg2)',borderTop:'1px solid var(--border)',display:'flex',flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'9px 0 7px',background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <span style={{fontSize:19}}>{t.icon}</span>
            <span style={{fontSize:10,fontFamily:"'DM Sans',sans-serif",color:tab===t.id?'#ff6b35':'#3e5e78',fontWeight:tab===t.id?700:400}}>{t.label}</span>
            <div style={{width:20,height:2,background:tab===t.id?'#ff6b35':'transparent',borderRadius:1}}/>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── NEW ORDER ─────────────────────────────────────────────
const EMPTY_ITEM = { desc:'', qty:'', unit:'Adet' }
const EMPTY_FORM = { project:'FLATS PROJESİ', customProj:'', job:'', urgency:'Normal', note:'' }

function NewOrderView({ profile }) {
  const [items,    setItems]    = useState([{ ...EMPTY_ITEM }])
  const [f,        setF]        = useState({ ...EMPTY_FORM })
  const [busy,     setBusy]     = useState(false)
  const [ok,       setOk]       = useState(null)
  const [err,      setErr]      = useState('')
  const [errFields,setErrFields]= useState({})   // hangi alanlar hatalı

  const set     = (k, v) => { setF(x => ({ ...x, [k]: v })); setErrFields(x=>({...x,[k]:false})) }
  const setItem  = (i, k, v) => {
    setItems(x => x.map((it, j) => j === i ? { ...it, [k]: v } : it))
    setErrFields(x=>({...x,[`item_${i}_${k}`]:false}))
  }
  const addItem    = () => setItems(x => [...x, { ...EMPTY_ITEM }])
  const removeItem = (i) => setItems(x => x.filter((_, j) => j !== i))

  const submit = async () => {
    const newErrFields = {}
    const msgs = []

    for (let i = 0; i < items.length; i++) {
      if (!items[i].desc.trim()) {
        newErrFields[`item_${i}_desc`] = true
        msgs.push(`${i+1}. kalemin ürün açıklaması`)
      }
      const qtyNum = parseFloat(String(items[i].qty).replace(',','.').trim())
      if (!items[i].qty || isNaN(qtyNum) || qtyNum <= 0) {
        newErrFields[`item_${i}_qty`] = true
        msgs.push(`${i+1}. kalem miktarı`)
      }
    }
    if (f.project === 'DİĞER' && !f.customProj.trim()) { newErrFields.customProj = true; msgs.push('Proje adı') }
    if (!f.job.trim()) { newErrFields.job = true; msgs.push('İş Tanımı / Kullanım Yeri') }

    if (msgs.length > 0) {
      setErrFields(newErrFields)
      setErr('Lütfen eksik alanları doldurunuz: ' + msgs.join(', '))
      // Sayfanın üstüne scroll et
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setErr(''); setErrFields({}); setBusy(true)

    const { data: no, error: noErr } = await supabase.rpc('next_order_no')
    if (noErr || !no) { setErr('Sipariş numarası alınamadı: ' + (noErr?.message||'bilinmeyen hata')); setBusy(false); return }

    const { error } = await supabase.from('orders').insert({
      order_no:            no,
      user_id:             profile.id,
      user_email:          (await supabase.auth.getUser()).data.user.email,
      user_name:           profile.name,
      product_description: items.length === 1 ? items[0].desc : JSON.stringify(items),
      quantity:            parseFloat(String(items[0].qty).replace(',','.').trim()) || 0,
      unit:                items[0].unit,
      project:             f.project === 'DİĞER' ? f.customProj : f.project,
      job_description:     f.job,
      urgency:             f.urgency,
      notes:               f.note,
    })

    if (error) setErr('Sipariş kaydedilemedi: ' + error.message)
    else { setOk(no); setItems([{ ...EMPTY_ITEM }]); setF({ ...EMPTY_FORM }); setTimeout(() => setOk(null), 5000) }
    setBusy(false)
  }

  return (
    <div className="fade" style={{padding:'1rem'}}>
      <SH title="Yeni Sipariş" sub="Satın alma talebinizi oluşturun"/>

      {ok && (
        <div style={{background:'rgba(34,201,122,.1)',border:'1px solid rgba(34,201,122,.35)',borderRadius:11,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:24}}>✅</span>
          <div>
            <div style={{color:'#22c97a',fontWeight:700,fontSize:13}}>Sipariş oluşturuldu!</div>
            <div style={{color:'var(--text2)',fontSize:12}}>Sipariş No: <strong style={{color:'var(--text)'}}>{ok}</strong></div>
          </div>
        </div>
      )}
      {err && (
        <div style={{background:'rgba(239,68,68,.12)',border:'2px solid rgba(239,68,68,.5)',borderRadius:11,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'flex-start',gap:10,animation:'shake .3s ease'}}>
          <span style={{fontSize:22,flexShrink:0}}>⚠️</span>
          <div>
            <div style={{color:'#ef4444',fontWeight:700,fontSize:13,marginBottom:2}}>Eksik Bilgi!</div>
            <div style={{color:'#f87171',fontSize:12,lineHeight:1.5}}>{err}</div>
          </div>
        </div>
      )}

      <Card>
        {/* Sipariş Veren */}
        <div style={{background:'rgba(255,107,53,.06)',border:'1px solid rgba(255,107,53,.18)',borderRadius:9,padding:'9px 13px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>👤</span>
          <div>
            <div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:.8,fontWeight:600}}>Sipariş Veren</div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{profile.name}</div>
          </div>
        </div>

        {/* Kalemler */}
        <div>
          <div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:700}}>
            Ürün Kalemleri
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {items.map((item, i) => (
              <div key={i} style={{background:'var(--bg)',borderRadius:10,padding:'10px',border:'1px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontSize:11,color:'var(--accent)',fontWeight:700}}>{i+1}. Kalem</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.25)',color:'#ef4444',borderRadius:6,padding:'3px 8px',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                      Kaldır
                    </button>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  <textarea
                    rows={2}
                    value={item.desc}
                    onChange={e => setItem(i, 'desc', e.target.value)}
                    placeholder="Ürün adı, kodu, teknik özellikler..."
                    style={{resize:'vertical', borderColor: errFields[`item_${i}_desc`] ? '#ef4444 !important' : undefined, boxShadow: errFields[`item_${i}_desc`] ? '0 0 0 3px rgba(239,68,68,.2) !important' : undefined}}
                  />
                  {errFields[`item_${i}_desc`] && <div style={{fontSize:11,color:'#ef4444',marginTop:-4}}>⚠ Ürün açıklaması zorunludur</div>}
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}>
                    <div>
                    <input type="text" inputMode="decimal" value={item.qty} onChange={e => setItem(i, 'qty', e.target.value.replace(',','.'))} placeholder="Miktar" style={{borderColor: errFields[`item_${i}_qty`] ? '#ef4444' : undefined}}/>
                    {errFields[`item_${i}_qty`] && <div style={{fontSize:11,color:'#ef4444',marginTop:3}}>⚠ Miktar zorunludur</div>}
                    </div>
                    <select value={item.unit} onChange={e => setItem(i, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            style={{width:'100%',marginTop:9,padding:'9px',background:'transparent',color:'var(--accent)',border:'1.5px dashed rgba(255,107,53,.4)',borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer',transition:'all .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,107,53,.06)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            + Kalem Ekle
          </button>
        </div>

        {/* Proje */}
        <Fld label="Proje">
          <select value={f.project} onChange={e=>set('project',e.target.value)}>
            {PROJECTS.map(p=><option key={p}>{p}</option>)}
          </select>
          {f.project==='DİĞER' && <input value={f.customProj} onChange={e=>set('customProj',e.target.value)} placeholder="Proje adını yazınız..." style={{marginTop:7}}/>}
        </Fld>

        {/* İş Tanımı */}
        <Fld label="İş Tanımı / Kullanım Yeri">
          <textarea rows={2} value={f.job} onChange={e=>set('job',e.target.value)} placeholder="Bu malzeme hangi iş için, nerede kullanılacak?" style={{resize:'vertical', borderColor: errFields.job ? '#ef4444' : undefined}}/>
          {errFields.job && <div style={{fontSize:11,color:'#ef4444',marginTop:3}}>⚠ İş tanımı zorunludur</div>}
        </Fld>

        {/* Aciliyet */}
        <Fld label="Aciliyet">
          <div style={{display:'flex',gap:7}}>
            {URGENCIES.map(u=>(
              <button key={u.l} onClick={()=>set('urgency',u.l)} style={{flex:1,padding:'8px 4px',borderRadius:8,border:`2px solid ${f.urgency===u.l?u.c:'var(--border)'}`,background:f.urgency===u.l?`${u.c}18`:'transparent',color:f.urgency===u.l?u.c:'#3e5e78',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <span>{u.l}</span>
                <span style={{fontSize:9,fontWeight:400,color:f.urgency===u.l?u.c:'#2e4a60',lineHeight:1.2}}>{u.sub}</span>
              </button>
            ))}
          </div>
        </Fld>

        {/* Not */}
        <Fld label="Not (İsteğe Bağlı)">
          <input value={f.note} onChange={e=>set('note',e.target.value)} placeholder="Tedarikçi tercihi, ek notlar..."/>
        </Fld>

        <button onClick={submit} disabled={busy} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#ff6b35,#e85520)',color:'white',border:'none',borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:'pointer',boxShadow:'0 4px 16px rgba(255,107,53,.28)',opacity:busy?.7:1}}>
          {busy?'Kaydediliyor...':'🛒  Sipariş Oluştur'}
        </button>
      </Card>
    </div>
  )
}

// ── MY ORDERS ─────────────────────────────────────────────
function MyOrdersView({ profile }) {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [dateFrom,setDateFrom]= useState('')
  const [dateTo,  setDateTo]  = useState('')

  const load = () => {
    setLoading(true)
    supabase.from('orders').select('*').eq('user_id',profile.id).order('created_at',{ascending:false})
      .then(({data})=>{ setOrders(data||[]); setLoading(false) })
  }
  useEffect(()=>{ load() },[profile.id])

  const filtered = orders.filter(o=>{
    const q = search.toLowerCase()
    const matchText = !q || o.order_no?.toLowerCase().includes(q) || o.product_description?.toLowerCase().includes(q) || o.project?.toLowerCase().includes(q) || o.job_description?.toLowerCase().includes(q)
    const d = new Date(o.created_at)
    const matchFrom = !dateFrom || d >= new Date(dateFrom)
    const matchTo   = !dateTo   || d <= new Date(dateTo + 'T23:59:59')
    return matchText && matchFrom && matchTo
  })

  if (loading) return <Spin/>
  return (
    <div className="fade" style={{padding:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <SH title="Siparişlerim" sub={`${filtered.length} / ${orders.length} sipariş`}/>
        <button onClick={load} title="Yenile" style={{background:'rgba(255,107,53,.12)',border:'1px solid rgba(255,107,53,.3)',color:'var(--accent)',borderRadius:8,padding:'6px 10px',fontSize:14,cursor:'pointer'}}>🔄</button>
      </div>
      {/* Filtre */}
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Malzeme, proje, iş tanımı ara..." style={{width:'100%',padding:'8px 12px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:13,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:3}}>Başlangıç Tarihi</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:12,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:3}}>Bitiş Tarihi</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:12,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
          </div>
        </div>
        {(search||dateFrom||dateTo) && <button onClick={()=>{setSearch('');setDateFrom('');setDateTo('')}} style={{alignSelf:'flex-start',background:'none',border:'none',color:'var(--accent)',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>✕ Filtreyi Temizle</button>}
      </div>
      {filtered.length===0
        ? <Empty icon="📭" msg={orders.length===0?"Henüz sipariş oluşturmadınız.":"Arama kriterlerine uyan sipariş bulunamadı."}/>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>{filtered.map(o=><OCard key={o.id} order={o} onPrint={()=>printOrder(o)}/>)}</div>
      }
    </div>
  )
}

// ── ALL ORDERS (ADMIN) ────────────────────────────────────
function AllOrdersView({ profile }) {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [sel,     setSel]     = useState(null)
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [search,  setSearch]  = useState('')
  const [dateFrom,setDateFrom]= useState('')
  const [dateTo,  setDateTo]  = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at',{ascending:false})
    setOrders(data||[]); setLoading(false)
  },[])

  useEffect(()=>{ load() },[load])

  const counts = {
    beklemede:  orders.filter(o=>o.status==='beklemede').length,
    onaylandi:  orders.filter(o=>o.status==='onaylandi').length,
    reddedildi: orders.filter(o=>o.status==='reddedildi').length,
  }
  const filtered = orders.filter(o=>{
    const matchStatus = filter==='all' || o.status===filter
    const q = search.toLowerCase()
    const matchText = !q || o.order_no?.toLowerCase().includes(q) || o.product_description?.toLowerCase().includes(q) || o.project?.toLowerCase().includes(q) || o.job_description?.toLowerCase().includes(q) || o.user_name?.toLowerCase().includes(q)
    const d = new Date(o.created_at)
    const matchFrom = !dateFrom || d >= new Date(dateFrom)
    const matchTo   = !dateTo   || d <= new Date(dateTo + 'T23:59:59')
    return matchStatus && matchText && matchFrom && matchTo
  })

  const act = async (status) => {
    setSaving(true)
    await supabase.from('orders').update({status, admin_note:note, updated_at:new Date().toISOString()}).eq('id',sel.id)
    setSel(null); setNote(''); load(); setSaving(false)
  }

  if (loading) return <Spin/>

  // Detail
  if (sel) {
    const items = parseItems(sel.product_description, sel.quantity, sel.unit)
    return (
      <div className="fade" style={{padding:'1rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:5,fontWeight:600}}>← Geri Dön</button>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>printOrder(sel)} style={{background:'rgba(255,107,53,.12)',border:'1px solid rgba(255,107,53,.3)',color:'var(--accent)',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>🖨️ Yazdır</button>
            <button onClick={()=>downloadOrderPDF(sel)} style={{background:'rgba(34,201,122,.1)',border:'1px solid rgba(34,201,122,.3)',color:'#22c97a',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>⬇️ İndir</button>
          </div>
        </div>
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:'var(--accent)'}}>{sel.order_no}</div>
              <div style={{color:'var(--text2)',fontSize:11,marginTop:2}}>{new Date(sel.created_at).toLocaleString('tr-TR')}</div>
            </div>
            <Badge status={sel.status}/>
          </div>

          {/* Sipariş Veren */}
          <div style={{background:'rgba(255,107,53,.06)',border:'1px solid rgba(255,107,53,.18)',borderRadius:9,padding:'9px 13px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>👤</span>
            <div>
              <div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:.8,fontWeight:600}}>Sipariş Veren</div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{sel.user_name}</div>
              <div style={{fontSize:11,color:'var(--text2)'}}>{sel.user_email}</div>
            </div>
          </div>

          {/* Kalemler */}
          <div>
            <div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:.8,marginBottom:7,fontWeight:600}}>
              Ürün Kalemleri ({items.length} kalem)
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {items.map((it, i) => (
                <div key={i} style={{background:'var(--bg)',borderRadius:8,padding:'9px 11px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,marginBottom:3}}>{i+1}. Kalem</div>
                  <div style={{fontSize:13,color:'var(--text)',lineHeight:1.4,marginBottom:4}}>{it.desc}</div>
                  <div style={{fontSize:12,color:'var(--text2)'}}>📦 {it.qty} {it.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {[
            ['Proje',    sel.project],
            ['İş Tanımı',sel.job_description],
            ['Aciliyet', sel.urgency],
            sel.notes && ['Not', sel.notes],
          ].filter(Boolean).map(([k,v])=>(
            <div key={k}>
              <div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:.8,marginBottom:2,fontWeight:600}}>{k}</div>
              <div style={{fontSize:13,color:'var(--text)',lineHeight:1.4}}>{v}</div>
            </div>
          ))}

          {sel.status==='beklemede' && <>
            <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
              <Fld label="Admin Notu (İsteğe Bağlı)">
                <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Red sebebi, revizyon talebi..." style={{resize:'vertical'}}/>
              </Fld>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>act('onaylandi')}  disabled={saving} style={{flex:1,padding:'11px',background:'#22c97a',color:'white',border:'none',borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer'}}>✓ Onayla</button>
              <button onClick={()=>act('reddedildi')} disabled={saving} style={{flex:1,padding:'11px',background:'#ef4444',color:'white',border:'none',borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer'}}>✕ Reddet</button>
            </div>
          </>}

          {sel.admin_note && (
            <div style={{background:'rgba(255,107,53,.08)',border:'1px solid rgba(255,107,53,.2)',borderRadius:8,padding:'9px 12px'}}>
              <div style={{fontSize:10,color:'var(--accent)',fontWeight:700,marginBottom:3,letterSpacing:.8}}>ADMİN NOTU</div>
              <div style={{fontSize:13,color:'var(--text)'}}>{sel.admin_note}</div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="fade" style={{padding:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <SH title="Tüm Siparişler" sub={`${filtered.length} / ${orders.length} kayıt`}/>
        <button onClick={load} title="Yenile" style={{background:'rgba(255,107,53,.12)',border:'1px solid rgba(255,107,53,.3)',color:'var(--accent)',borderRadius:8,padding:'6px 10px',fontSize:14,cursor:'pointer'}}>🔄</button>
      </div>

      {/* Arama & Tarih Filtresi */}
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Malzeme, proje, kişi, sipariş no ara..." style={{width:'100%',padding:'8px 12px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:13,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:3}}>Başlangıç Tarihi</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:12,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:3}}>Bitiş Tarihi</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:9,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)',fontSize:12,fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
          </div>
        </div>
        {(search||dateFrom||dateTo) && <button onClick={()=>{setSearch('');setDateFrom('');setDateTo('')}} style={{alignSelf:'flex-start',background:'none',border:'none',color:'var(--accent)',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>✕ Filtreyi Temizle</button>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:12}}>
        {[{k:'beklemede',l:'Bekleyen',c:'#f59e0b'},{k:'onaylandi',l:'Onaylanan',c:'#22c97a'},{k:'reddedildi',l:'Reddedilen',c:'#ef4444'}].map(s=>(
          <div key={s.k} style={{background:'var(--bg2)',borderRadius:10,padding:'10px 6px',border:`1px solid ${s.c}30`,textAlign:'center'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:s.c,lineHeight:1}}>{counts[s.k]}</div>
            <div style={{fontSize:10,color:'var(--text2)',marginTop:3}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:7,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
        {[{id:'all',l:'Tümü'},{id:'beklemede',l:'Bekleyen'},{id:'onaylandi',l:'Onaylı'},{id:'reddedildi',l:'Reddedilen'}].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${filter===f.id?'var(--accent)':'var(--border)'}`,background:filter===f.id?'rgba(255,107,53,.14)':'transparent',color:filter===f.id?'var(--accent)':'var(--text2)',fontSize:11,fontWeight:filter===f.id?700:400,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'DM Sans',sans-serif"}}>
            {f.l}
          </button>
        ))}
      </div>

      {filtered.length===0
        ? <Empty icon="🔍" msg="Bu filtrede sipariş bulunmuyor."/>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>{filtered.map(o=><OCard key={o.id} order={o} showUser onClick={()=>{setSel(o);setNote(o.admin_note||'')}}/>)}</div>
      }
    </div>
  )
}

// ── USERS (ADMIN) ─────────────────────────────────────────
function UsersView({ profile, reloadProfile }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at',{ascending:true})
    setUsers(data||[]); setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const setRole = async (uid, role) => {
    setSaving(uid)
    await supabase.from('profiles').update({role}).eq('id',uid)
    if (uid === profile.id) reloadProfile()
    load(); setSaving(null)
  }

  const startEdit = (u) => { setEditId(u.id); setEditName(u.name||'') }
  const cancelEdit = () => { setEditId(null); setEditName('') }

  const saveName = async (uid) => {
    if (!editName.trim()) return
    setNameBusy(true)
    await supabase.from('profiles').update({ name: editName.trim() }).eq('id', uid)
    if (uid === profile.id) reloadProfile()
    await load()
    setEditId(null); setEditName(''); setNameBusy(false)
  }

  if (loading) return <Spin/>
  return (
    <div className="fade" style={{padding:'1rem'}}>
      <SH title="Kullanıcılar" sub={`${users.length} kullanıcı`}/>
      <div style={{background:'rgba(255,107,53,.08)',border:'1px solid rgba(255,107,53,.2)',borderRadius:10,padding:'10px 13px',marginBottom:14,fontSize:12,color:'var(--accent)',lineHeight:1.6}}>
        💡 Yeni kullanıcı eklemek için Supabase Dashboard → Authentication → Users → <strong>Add user</strong>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {users.map(u=>(
          <div key={u.id} style={{background:'var(--bg2)',borderRadius:12,padding:'12px',border:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:u.role==='admin'?'rgba(255,107,53,.14)':'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{u.role==='admin'?'👑':'👷'}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{u.name||'—'}</div>
                  <div style={{fontSize:10,color:u.role==='admin'?'#ff6b35':'#3e5e78',fontWeight:700,marginTop:2,textTransform:'uppercase',letterSpacing:.6}}>{u.role==='admin'?'Admin':'Saha Şefi'}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button
                  onClick={()=> editId===u.id ? cancelEdit() : startEdit(u)}
                  style={{padding:'5px 9px',background:'rgba(99,179,237,.1)',border:'1px solid rgba(99,179,237,.3)',color:'#63b3ed',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                >
                  ✏️ İsim
                </button>
                {u.id !== profile.id && (
                  <button
                    onClick={()=>setRole(u.id, u.role==='admin'?'user':'admin')}
                    disabled={saving===u.id}
                    style={{padding:'5px 9px',background:u.role==='admin'?'rgba(239,68,68,.1)':'rgba(34,201,122,.1)',border:`1px solid ${u.role==='admin'?'rgba(239,68,68,.3)':'rgba(34,201,122,.3)'}`,color:u.role==='admin'?'#ef4444':'#22c97a',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}
                  >
                    {saving===u.id ? '...' : u.role==='admin' ? 'Şef Yap' : 'Admin Yap'}
                  </button>
                )}
              </div>
            </div>

            {/* İsim düzenleme alanı */}
            {editId === u.id && (
              <div style={{marginTop:10,display:'flex',gap:7,alignItems:'center'}}>
                <input
                  value={editName}
                  onChange={e=>setEditName(e.target.value)}
                  placeholder="Ad Soyad"
                  onKeyDown={e=>e.key==='Enter'&&saveName(u.id)}
                  style={{flex:1,fontSize:13}}
                  autoFocus
                />
                <button
                  onClick={()=>saveName(u.id)}
                  disabled={nameBusy||!editName.trim()}
                  style={{padding:'8px 14px',background:'#22c97a',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}
                >
                  {nameBusy ? '...' : 'Kaydet'}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{padding:'8px 10px',background:'var(--border)',color:'var(--text2)',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                >
                  İptal
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SHARED COMPONENTS ──────────────────────────────────────
function Card({children}) {
  return <div style={{background:'var(--bg2)',borderRadius:13,padding:'1.1rem',border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'0.85rem'}}>{children}</div>
}
function Fld({label,children}) {
  return <div><div style={{fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:1,marginBottom:5,fontWeight:700}}>{label}</div>{children}</div>
}
function Badge({status}) {
  const s = STATUS[status]||STATUS.beklemede
  return <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:`${s.color}18`,color:s.color,border:`1px solid ${s.color}38`,textTransform:'uppercase',letterSpacing:.6,whiteSpace:'nowrap'}}>{s.label}</span>
}
function Spin() {
  return <div style={{display:'flex',justifyContent:'center',padding:'2.5rem'}}><div style={{width:30,height:30,border:'3px solid #ff6b35',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div>
}
function Empty({icon,msg}) {
  return <div style={{textAlign:'center',padding:'2.5rem 1rem',color:'var(--border)'}}><div style={{fontSize:48,marginBottom:10}}>{icon}</div><p style={{fontSize:13}}>{msg}</p></div>
}
function ErrBox({msg}) {
  return <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'9px 12px',color:'#ef4444',fontSize:12,marginBottom:12}}>{msg}</div>
}
function SH({title,sub}) {
  return <div style={{marginBottom:14}}><h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:19,letterSpacing:'-.3px'}}>{title}</h2><p style={{color:'var(--text2)',fontSize:12,marginTop:2}}>{sub}</p></div>
}
function OCard({order, showUser, onClick, onPrint}) {
  const uc = {Normal:'#22c97a',Acil:'#f59e0b','Çok Acil':'#ef4444'}
  const items = parseItems(order.product_description, order.quantity, order.unit)
  const itemLabel = items.length === 1 ? items[0].desc : `${items.length} kalem ürün`

  return (
    <div onClick={onClick} style={{background:'var(--bg2)',borderRadius:12,padding:'12px',border:'1px solid var(--border)',cursor:onClick?'pointer':'default',transition:'border-color .15s'}}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor='rgba(255,107,53,.45)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:7}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,color:'var(--accent)'}}>{order.order_no}</span>
          {order.urgency!=='Normal' && <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:`${uc[order.urgency]}18`,color:uc[order.urgency],border:`1px solid ${uc[order.urgency]}38`}}>{order.urgency.toUpperCase()}</span>}
        </div>
        <Badge status={order.status}/>
      </div>
      <div style={{fontSize:15,fontWeight:800,color:'var(--text)',marginBottom:5,lineHeight:1.35,fontFamily:"'Syne',sans-serif"}}>{itemLabel}</div>
      {items.length > 1 && (
        <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:5}}>
          {items.map((it, i) => (
            <div key={i} style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>· {it.desc} <span style={{color:'#1e5270',fontWeight:600}}>({it.qty} {it.unit})</span></div>
          ))}
        </div>
      )}
      <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px',fontSize:11,color:'var(--text2)'}}>
        {items.length === 1 && <span>📦 {items[0].qty} {items[0].unit}</span>}
        <span>🏗️ {order.project}</span>
        {showUser && <span>👤 {order.user_name}</span>}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:5}}>
        <div style={{fontSize:10,color:'#1e5270'}}>{new Date(order.created_at).toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})} · {new Date(order.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>
        {onPrint && (
          <button onClick={e=>{e.stopPropagation();onPrint()}} style={{background:'none',border:'none',color:'var(--text2)',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",padding:'2px 6px',borderRadius:5,display:'flex',alignItems:'center',gap:3}}
            onMouseEnter={e=>e.currentTarget.style.color='#ff6b35'}
            onMouseLeave={e=>e.currentTarget.style.color='#3e5e78'}>
            🖨️ PDF
          </button>
        )}
      </div>
    </div>
  )
}
