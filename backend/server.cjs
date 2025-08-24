const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const parse = require('csv-parse/sync')
const puppeteer = require('puppeteer')
const { PDFDocument } = require('pdf-lib')

const generarHTMLCartelesA6 = require('./generarCartelesA6.js')
const { generarHTMLCartel } = require('./generadorHtml.cjs')

const app = express()

// === Fuentes Miso ===
const fontBoldPath   = path.join(__dirname, 'fonts', 'miso-bold.ttf')
const fontRegPath    = path.join(__dirname, 'fonts', 'miso-regular.ttf')
const fontLightPath  = path.join(__dirname, 'fonts', 'miso-light.ttf')

const misoBoldBase64   = fs.existsSync(fontBoldPath)  ? fs.readFileSync(fontBoldPath).toString('base64')  : ''
const misoRegBase64    = fs.existsSync(fontRegPath)   ? fs.readFileSync(fontRegPath).toString('base64')   : ''
const misoLightBase64  = fs.existsSync(fontLightPath) ? fs.readFileSync(fontLightPath).toString('base64') : ''

const STYLE = `
<style>
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_LIGHT_BASE64}}') format('truetype');  font-weight:300; font-style:normal; }
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_REGULAR_BASE64}}') format('truetype');font-weight:400; font-style:normal; }
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_BOLD_BASE64}}') format('truetype');   font-weight:700; font-style:normal; }
body{ margin:0; width:210mm; height:297mm; position:relative; font-family:'Miso',sans-serif; font-synthesis:none; }
</style>`

function ensureFullHtml(h) {
  const hasHtml = /<html[\s>]/i.test(h)
  return hasHtml ? h : `<!DOCTYPE html><html lang="es"><head>${STYLE}</head><body>${h}</body></html>`
}

// ✅ CORS
const ORIGENES_PERMITIDOS = [
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://generador-carteles-web.vercel.app'
]

app.use((req, res, next) => {
  const origen = req.headers.origin
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(bodyParser.json({ limit: '10mb' }))

// === RUTA PRINCIPAL: genera PDF de carteles (A4/A6) ===
app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body
    if (!datos) return res.status(400).send('Faltan los datos')

    // === PARSE CSV A OBJETOS ===
    const lineas = datos.split('\n').map(l => l.trim()).filter(Boolean)
    const datosCarteles = []

    for (const linea of lineas) {
      const partes = linea.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g) || []
      const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

      const desde = campos[0]
      const hasta = campos[1]
      const sku = campos[2]
      const descripcion = campos[3]
      const precioOriginal = parseFloat(`${(campos[4] || '').replace('$', '')}.${campos[5] || '00'}`)
      const precioFinal    = parseFloat(`${(campos[6] || '').replace('$', '')}.${campos[7] || '00'}`)

      if (isNaN(precioOriginal) || isNaN(precioFinal)) throw new Error('Precio inválido')

      const codigoBarras = campos[8]

      // 🔎 Tipo por fila: si alguna celda dice "rebaja_simple", usamos ese tipo
      const tieneRebajaSimple = campos.some(c => String(c || '').trim().toLowerCase() === 'rebaja_simple')
      const tipoFila = tieneRebajaSimple ? 'rebaja_simple' : tipo

      const descuento = tipoFila === '%'
        ? Math.round(100 - (precioFinal * 100) / precioOriginal)
        : null

      const item = sku
      const departamento = buscarDepartamentoPorSkuDesdeCSV(sku)

      datosCarteles.push({
        descripcion,
        precioOriginal,
        precioFinal,
        descuento,
        sku: codigoBarras,   // esto alimenta el EAN13
        desde,
        hasta,
        departamento,
        item,
        tipoFila
      })
    }

    // === GENERAR HTMLS ===
    let paginasHTML = []

    if (tamaño === 'A6') {
      // 1) Filas NO rebaja_simple → A6 “viejo” (mosaico existente)
      const normales = datosCarteles.filter(d => d.tipoFila !== 'rebaja_simple')
      if (normales.length) {
        const htmlNormales = await generarHTMLCartelesA6(normales)
        paginasHTML = paginasHTML.concat(htmlNormales)
      }
      // 2) Filas rebaja_simple → nuevas plantillas A6
      const rebajas = datosCarteles.filter(d => d.tipoFila === 'rebaja_simple')
      for (const datos of rebajas) {
        const html = await generarHTMLCartel(datos, 'rebaja_simple', 'A6')
        paginasHTML.push(html)
      }
    } else {
      // A4: cada fila decide su tipo (rebaja_simple o el global)
      for (const datos of datosCarteles) {
        const tipoUsado = datos.tipoFila || tipo
        const html = await generarHTMLCartel(datos, tipoUsado, 'A4')
        paginasHTML.push(html)
      }
    }

    // === Inyectar wrapper + fuentes
    paginasHTML = paginasHTML.map(ensureFullHtml).map(h => h
      .replace(/{{MISO_LIGHT_BASE64}}/g,  misoLightBase64)
      .replace(/{{MISO_REGULAR_BASE64}}/g, misoRegBase64)
      .replace(/{{MISO_BOLD_BASE64}}/g,    misoBoldBase64)
    )

    // === Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const pdfDoc = await PDFDocument.create()
    for (const html of paginasHTML) {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      await page.evaluateHandle('document.fonts.ready')
      const buffer = await page.pdf({ format: 'A4', printBackground: true })
      const tempDoc = await PDFDocument.load(buffer)
      const copied = await pdfDoc.copyPages(tempDoc, tempDoc.getPageIndices())
      copied.forEach(p => pdfDoc.addPage(p))
      await page.close()
    }
    await browser.close()

    const finalPdf = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename=carteles.pdf')
    res.send(Buffer.from(finalPdf))

  } catch (err) {
    console.error('❌ Error en generación:', err)
    res.status(500).send('Error generando carteles')
  }
})

// === RUTA AUXILIAR: base de productos ===
app.get('/base-productos', (req, res) => {
  try {
    const ruta = path.join(__dirname, 'base_deptos.csv')
    if (!fs.existsSync(ruta)) {
      return res.status(404).send('base_deptos.csv no encontrado')
    }
    const contenido = fs.readFileSync(ruta, 'utf8')
    const productos = parse.parse(contenido, { columns: true, skip_empty_lines: true })
    const resultado = productos.map(p => ({
      sku: p['SKU ID']?.trim(),
      ean: p['Código SKU ID']?.trim(),
      descripcion: p['SKU DESC']?.trim(),
      depto: p['Dept ID']?.trim()
    }))
    res.json(resultado)
  } catch (error) {
    console.error('❌ Error al leer base_deptos.csv:', error)
    res.status(500).send('Error procesando base de productos')
  }
})

// === Server ===
app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor iniciado')
})

// === Helper ===
function buscarDepartamentoPorSkuDesdeCSV(sku) {
  const csvPath = path.join(__dirname, 'base_deptos.csv')
  if (!fs.existsSync(csvPath)) return 'Depto no disponible'
  const contenido = fs.readFileSync(csvPath)
  const filas = parse.parse(contenido, { columns: true })
  const fila = filas.find(row => row['SKU ID']?.toString().trim() === sku)
  return fila?.['Dept ID']?.toString().trim() || 'Depto no disponible'
}
