// frontend/main.js
const isLocalhost = location.hostname === '127.0.0.1' || location.hostname === 'localhost'

const URL_BACKEND = isLocalhost
  ? 'http://localhost:3000'
  : 'https://generador-carteles-web-production.up.railway.app'

async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value
  await postGenerarCartel({ datos, tipo, tamaño })
}

async function postGenerarCartel({ datos, tipo, tamaño }) {
  try {
    const res = await fetch(`${URL_BACKEND}/generar-cartel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos, tipo, tamaño })
    })
    if (!res.ok) {
      const texto = await res.text()
      console.error('❌ Error al generar cartel:', texto)
      alert('Error generando el cartel:\n' + texto)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } catch (error) {
    console.error('❌ Error inesperado:', error)
    alert('Error inesperado:\n' + error.message)
  }
}

const tiposCartel = [
  'precio_normal', '%', '2x1', '3x2', '4x2', '6x5',
  '2do', 'QrMP', 'MP', 'rebaja_simple', 'fernetcoca', 'FINANCIACION'
]

// ===================== Helpers =====================
const onlyDigits = s => String(s ?? '').replace(/\D/g, '')

function ean13CheckDigit(d12) {
  const s = onlyDigits(d12)
  if (s.length !== 12) return null
  let sum = 0
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0) ? Number(s[i]) : Number(s[i]) * 3
  return String((10 - (sum % 10)) % 10)
}
// PLU (4) -> 27 + PLU + 000000 + check
function eanDesdePLU4(plu4) {
  const p = onlyDigits(plu4)
  if (p.length !== 4) return null
  const base12 = `27${p}000000`
  const cd = ean13CheckDigit(base12)
  return cd ? base12 + cd : null
}
function extraerPLUDesdeEANPeso(eanLike) {
  const s = onlyDigits(eanLike)
  if (s.length !== 13 || !s.startsWith('27')) return null
  const cuerpo = s.slice(2, -1)
  const plu = cuerpo.replace(/0+$/,'')
  return plu || null
}
function normalizarEAN(e) {
  const d = onlyDigits(e || '')
  if (!d) return ''
  if (d.length === 4) return eanDesdePLU4(d) || d
  if (d.length === 13 && d.startsWith('27')) {
    const plu = extraerPLUDesdeEANPeso(d) || ''
    return eanDesdePLU4(plu) || d
  }
  if (d.length === 12) return '0' + d // UPC-A -> EAN-13 (opcional)
  return d
}
const parseNum = v => {
  if (v == null) return NaN
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
function splitPrecioParts(n) {
  const x = parseNum(n)
  if (!Number.isFinite(x)) return { ent: '0', dec: '00' }
  const s = x.toFixed(2)
  const [ent, dec] = s.split('.')
  return { ent, dec }
}
function csvEscape(s) {
  const str = String(s ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}
// 👉 NUEVO: YYYY-MM-DD -> DD-MM-YYYY
function toDDMMYYYY(s = '') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s
}

// ===================== Índices de datos (2 FUENTES) =====================
let baseProductos = []

const idxProdBySKU = new Map()
const idxProdByEAN = new Map()
const idxDeptBySKU = new Map()
const idxDeptByEAN = new Map()
const idxDeptByPLU = new Map()

const idxEvByEAN = new Map()
const idxEvByPLU = new Map()
const idxEvBySKU = new Map()

const productosReady = fetch(`${URL_BACKEND}/base-productos`)
  .then(res => res.json())
  .then(data => {
    baseProductos = Array.isArray(data) ? data : []
    for (const p of baseProductos) {
      const sku = onlyDigits(p?.sku || '')
      const ean = onlyDigits(p?.ean || '')
      const desc = (p?.descripcion || '').trim()
      const depto = (p?.depto || '').trim()
      if (sku) {
        idxProdBySKU.set(sku, { sku, ean, desc, depto })
        if (depto) idxDeptBySKU.set(sku, depto)
      }
      if (ean) {
        idxProdByEAN.set(ean, { sku, ean, desc, depto })
        if (depto) idxDeptByEAN.set(ean, depto)
        const plu = extraerPLUDesdeEANPeso(ean)
        if (plu && depto) idxDeptByPLU.set(plu, depto)
      }
    }
  })
  .catch(err => console.error('Error cargando base de productos:', err))

// CSV de Evento en /frontend/ (opcional)
const eventoReady = (async () => {
  const tryNames = ['Evento Iniciado en Tienda - BD.csv', 'evento_bd.csv']
  for (const name of tryNames) {
    try {
      const res = await fetch(name, { cache: 'no-store' })
      if (!res.ok) continue
      const txt = await res.text()
      parseEventoCSV(txt)
      return
    } catch {}
  }
  console.warn('⚠️ CSV de evento no encontrado en /frontend/ (se usa solo base-productos).')
})()

function splitCSVLine(line) {
  const delim = (line.includes(';') && !line.includes(',')) ? ';' : ','
  return line.split(delim).map(s => s.trim())
}
function parseEventoCSV(texto) {
  idxEvByEAN.clear(); idxEvByPLU.clear(); idxEvBySKU.clear()
  const lines = texto.split(/\r?\n/).filter(l => l.trim().length)
  if (!lines.length) return
  const header = splitCSVLine(lines[0])
  const norm = s => s.toLowerCase()
  const idxEAN  = header.findIndex(h => ['ean','upc','codigo','código','barcode'].includes(norm(h)))
  const idxSKU  = header.findIndex(h => ['sku','item','articulo','artículo','cod interno','sku id'].includes(norm(h)))
  const idxDesc = header.findIndex(h => ['descripcion','descripción','desc','nombre','detalle'].includes(norm(h)))
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    const ean = onlyDigits(cols[idxEAN] ?? '')
    const sku = onlyDigits(cols[idxSKU] ?? '')
    const desc = (cols[idxDesc] ?? '').trim()
    if (ean) {
      idxEvByEAN.set(ean, { ean, sku, desc })
      const plu = extraerPLUDesdeEANPeso(ean)
      if (plu && plu.length === 4) idxEvByPLU.set(plu, { ean, sku, desc })
    }
    if (sku) idxEvBySKU.set(sku, { ean, sku, desc })
  }
}

// ===================== Resolver unificado =====================
async function resolverArticulo(valor) {
  await Promise.all([productosReady, eventoReady])

  const q = onlyDigits(valor)
  const esPLU = q.length === 4
  const esEANPeso = (q.length === 13 && q.startsWith('27'))
  const pluNorm = esPLU ? q : (esEANPeso ? (extraerPLUDesdeEANPeso(q) || '') : '')
  const eanPesoNorm = pluNorm ? (eanDesdePLU4(pluNorm) || '') : ''

  // 1) Evento (descripcion/EAN frescos)
  let ev = null
  if (pluNorm && idxEvByPLU.has(pluNorm)) ev = idxEvByPLU.get(pluNorm)
  if (!ev && eanPesoNorm && idxEvByEAN.has(eanPesoNorm)) ev = idxEvByEAN.get(eanPesoNorm)
  if (!ev && idxEvByEAN.has(q)) ev = idxEvByEAN.get(q)
  if (!ev && idxEvBySKU.has(q)) ev = idxEvBySKU.get(q)

  // 2) Productos (SKU/DEPTO oficiales)
  let prod = idxProdBySKU.get(q) || idxProdByEAN.get(q) ||
             (eanPesoNorm && idxProdByEAN.get(eanPesoNorm)) || null

  const sku = (prod?.sku) || (ev?.sku) || ''

  // EAN normalizado
  let ean = ''
  if (pluNorm) ean = eanPesoNorm
  else if (esEANPeso) ean = eanPesoNorm || q
  else {
    const cand = (ev?.ean && onlyDigits(ev.ean)) ||
                 (prod?.ean && onlyDigits(prod.ean)) || ''
    ean = normalizarEAN(cand)
  }

  const descripcion = (ev?.desc) || (prod?.desc) || (prod?.descripcion) || ''

  let depto = ''
  const kSKU = onlyDigits(sku)
  const kEAN = onlyDigits(ean)
  if (kSKU && idxDeptBySKU.has(kSKU)) depto = idxDeptBySKU.get(kSKU)
  if (!depto && kEAN && idxDeptByEAN.has(kEAN)) depto = idxDeptByEAN.get(kEAN)
  if (!depto && pluNorm && idxDeptByPLU.has(pluNorm)) depto = idxDeptByPLU.get(pluNorm)

  return { descripcion, sku: kSKU, ean: kEAN, depto }
}

// ===================== Tabla / UI =====================
function crearFila() {
  const tr = document.createElement('tr')
  let tipoSelect = null
  for (let i = 0; i < 14; i++) {
    const td = document.createElement('td')

    if (i === 0) {
      const input = document.createElement('input')
      input.type = 'text'
      input.addEventListener('blur', async () => {
        const valor = input.value.trim()
        if (!valor) return
        const art = await resolverArticulo(valor)

        const celdas = tr.querySelectorAll('td')
        const tdDepto = celdas[10].querySelector('input')
        const tdDesc  = celdas[11].querySelector('input')
        const tdSKU   = celdas[12].querySelector('input')
        const tdEAN   = celdas[13].querySelector('input')

        if (art.descripcion) tdDesc.value = art.descripcion
        if (art.sku)         tdSKU.value  = art.sku
        if (art.ean)         tdEAN.value  = art.ean
        if (art.depto)       tdDepto.value= art.depto
      })
      td.appendChild(input)

    } else if (i === 6) {
      const select = document.createElement('select')
      tipoSelect = select
      tiposCartel.forEach(tipo => {
        const option = document.createElement('option')
        option.value = tipo
        option.textContent = tipo
        select.appendChild(option)
      })
      select.addEventListener('change', () => {
        const celdas = tr.querySelectorAll('td')
        const precio = parseNum(celdas[1].querySelector('input').value)
        const descuento = parseNum(celdas[2].querySelector('input').value)
        const output = celdas[3].querySelector('input')
        if (select.value === '%' && Number.isFinite(precio) && Number.isFinite(descuento)) {
          output.value = (precio * (1 - descuento / 100)).toFixed(2)
        }
        if (select.value === '2do' && Number.isFinite(precio) && Number.isFinite(descuento)) {
          const precioConDescuento = precio * (1 - descuento / 100)
          const promedio = ((precio + precioConDescuento) / 2).toFixed(2)
          output.value = promedio
        }
        const promociones = { '3x2': 3/2, '4x2': 4/2, '6x5': 6/5, '3x1': 3/1, '2x1': 2/1 }
        if (promociones[select.value] && Number.isFinite(precio)) {
          const unitario = (precio / promociones[select.value]).toFixed(2)
          output.value = unitario
        }
      })
      td.appendChild(select)

    } else if (i === 2) {
      const input = document.createElement('input')
      input.type = 'text'
      input.addEventListener('blur', () => {
        const valor = parseNum(input.value)
        const select = tr.querySelectorAll('td')[6].querySelector('select')
        if (Number.isFinite(valor) && select && select.value === 'precio_normal') {
          select.value = '%'
          select.dispatchEvent(new Event('change'))
        }
      })
      td.appendChild(input)

    } else if (i >= 7 && i <= 9) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      td.appendChild(checkbox)

    } else {
      const input = document.createElement('input')
      input.type = (i === 4 || i === 5) ? 'date' : 'text'
      td.appendChild(input)
    }
    tr.appendChild(td)
  }
  return tr
}

let filasActuales = 0
const MAX_FILAS = 20

function cargarTablaCarteles() { agregarFila() }
function agregarFila() {
  if (filasActuales >= MAX_FILAS) return
  const tbody = document.getElementById('tablaCartelesBody')
  tbody.appendChild(crearFila())
  filasActuales++
}

// ==== NUEVO: para % arma CSV DE 9 CAMPOS por medida (A4/A6) ====
function lineaCSVDesdeFilaParaBackend(tr) {
  const c = tr.querySelectorAll('td')

  // 👉 Fechas ya en DD-MM-YYYY
  const fechaDesde = toDDMMYYYY(c[4].querySelector('input').value || '')
  const fechaHasta = toDDMMYYYY(c[5].querySelector('input').value || '')

  const sku        = onlyDigits(c[12].querySelector('input').value || '')
  const desc       = c[11].querySelector('input').value || ''
  const ean        = normalizarEAN(c[13].querySelector('input').value || '')

  const precioOri  = parseNum(c[1].querySelector('input').value)
  const descPct    = parseNum(c[2].querySelector('input').value)
  const manual     = parseNum(c[3].querySelector('input').value)

  let precioFin
  if (Number.isFinite(manual)) precioFin = manual
  else if (Number.isFinite(precioOri) && Number.isFinite(descPct)) precioFin = precioOri * (1 - descPct / 100)
  else precioFin = Number.isFinite(precioOri) ? precioOri : 0

  const po = splitPrecioParts(precioOri)
  const pf = splitPrecioParts(precioFin)

  // desde,hasta,sku,descripcion,PO_ent,PO_dec,PF_ent,PF_dec,codigoBarras
  return [
    fechaDesde,
    fechaHasta,
    sku,
    csvEscape(desc),
    po.ent,
    po.dec,
    pf.ent,
    pf.dec,
    ean
  ].join(',')
}

async function cargarDesdeTabla() {
  const filas = document.querySelectorAll('#tablaCartelesBody tr')
  const tipo = document.getElementById('tipoCartel').value

  // dump al textarea (con fechas DD-MM-YYYY en cols 4 y 5)
  const dump = []
  filas.forEach(tr => {
    const celdas = tr.querySelectorAll('td')
    const fila = []
    celdas.forEach((td, idx) => {
      const input = td.querySelector('input, select')
      if (!input) { fila.push(''); return }
      if (input.type === 'checkbox') {
        fila.push(input.checked ? '1' : '')
      } else {
        let val = input.value.trim()
        if (idx === 4 || idx === 5) val = toDDMMYYYY(val) // <-- APLICAR FORMATO
        fila.push(val)
      }
    })
    if (fila.some(v => v !== '')) dump.push(fila.join('\n'))
  })
  document.getElementById('inputDatos').value = dump.join('\n')

  // si no es %, no disparamos generación automática
  if (tipo !== '%') return

  // construir CSV por medida
  const csvA4 = []
  const csvA6 = []

  filas.forEach(tr => {
    const c = tr.querySelectorAll('td')
    const hayDatos = Array.from(c).some(td => {
      const el = td.querySelector('input, select')
      return el && (el.type === 'checkbox' ? el.checked : (el.value || '').trim() !== '')
    })
    if (!hayDatos) return

    const a4 = !!c[8].querySelector('input')?.checked
    const a6 = !!c[9].querySelector('input')?.checked
    const linea = lineaCSVDesdeFilaParaBackend(tr)

    if (a4) csvA4.push(linea)
    if (a6) csvA6.push(linea)
  })

  if (csvA4.length) {
    await postGenerarCartel({ datos: csvA4.join('\n'), tipo: '%', tamaño: 'A4' })
  }
  if (csvA6.length) {
    await postGenerarCartel({ datos: csvA6.join('\n'), tipo: '%', tamaño: 'A6' })
  }
}

window.addEventListener('DOMContentLoaded', () => {
  cargarTablaCarteles()
  document.addEventListener('keydown', function (e) {
    const dir = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }
    const isArrow = Object.keys(dir).includes(e.key)
    const elementos = Array.from(document.querySelectorAll('input, select'))
      .filter(el => !el.disabled && el.offsetParent !== null)
    const actual = document.activeElement
    const idx = elementos.indexOf(actual)
    if (e.key === 'Enter' && idx >= 0 && idx < elementos.length - 1) {
      e.preventDefault(); elementos[idx + 1].focus()
    } else if (isArrow && idx >= 0) {
      e.preventDefault()
      let next = idx
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') next += dir[e.key]
      else { const totalCols = 14; next += dir[e.key] * totalCols }
      if (next >= 0 && next < elementos.length) elementos[next].focus()
    }
  })
})

// Exponer
window.cargarDesdeTabla = cargarDesdeTabla
window.agregarFila = agregarFila
