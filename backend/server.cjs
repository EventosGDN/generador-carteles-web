// backend/server.cjs
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const parse = require('csv-parse/sync')
const puppeteer = require('puppeteer')
const { PDFDocument } = require('pdf-lib')

const generarHTMLCartelesA6 = require('./generarCartelesA6.js')
const { generarHTMLCartel } = require('./generadorHtml.cjs')

const cors = require('cors')

// === Fuentes Miso ===
// Asegúrate de que estos archivos estén en backend/fonts/
const fontBoldPath  = path.join(__dirname, 'fonts', 'miso-bold.ttf')
const fontRegPath   = path.join(__dirname, 'fonts', 'miso-regular.ttf')
const fontLightPath = path.join(__dirname, 'fonts', 'miso-light.ttf')

const misoBoldBase64  = fs.existsSync(fontBoldPath)  ? fs.readFileSync(fontBoldPath).toString('base64')  : ''
const misoRegBase64   = fs.existsSync(fontRegPath)   ? fs.readFileSync(fontRegPath).toString('base64')   : ''
const misoLightBase64 = fs.existsSync(fontLightPath) ? fs.readFileSync(fontLightPath).toString('base64') : ''

const STYLE = `
<style>
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_LIGHT_BASE64}}') format('truetype'); font-weight:300; font-style:normal; }
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_REGULAR_BASE64}}') format('truetype'); font-weight:400; font-style:normal; }
@font-face{ font-family:'Miso'; src:url('data:font/ttf;base64,{{MISO_BOLD_BASE64}}') format('truetype'); font-weight:700; font-style:normal; }
body{ margin:0; width:210mm; height:297mm; position:relative; font-family:'Miso',sans-serif; font-synthesis:none; }
</style>`

function ensureFullHtml(h) {
  const hasHtml = /<html[\s>]/i.test(h)
  return hasHtml ? h : `<!DOCTYPE html><html lang="es"><head>${STYLE}</head><body>${h}</body></html>`
}

// === App Express ===
const app = express()

const ORIGENES_PERMITIDOS = [
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://generador-carteles-web.vercel.app'
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ORIGENES_PERMITIDOS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS bloqueado para este origen'))
    }
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}))

app.options('*', cors())

app.use(bodyParser.json({ limit: '10mb' }))

// === Ruta generación de cartel ===
app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body
    const lineas = datos.split('\n').filter(l => l.trim() !== '')

    let paginasHTML = []

    for (let linea of lineas) {
      const partes = linea.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
      const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

      let html
      if (tamaño === 'A6') {
        html = generarHTMLCartelesA6(campos, tipo)
      } else {
        html = generarHTMLCartel(campos, tipo)
      }
      paginasHTML.push(html)
    }

    // Incrustar fuentes y asegurar estructura HTML
    paginasHTML = paginasHTML.map(ensureFullHtml)
    paginasHTML = paginasHTML.map(h => h
      .replace(/{{MISO_LIGHT_BASE64}}/g,  misoLightBase64)
      .replace(/{{MISO_REGULAR_BASE64}}/g, misoRegBase64)
      .replace(/{{MISO_BOLD_BASE64}}/g,    misoBoldBase64)
    )

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const pdfBuffers = []

    for (let html of paginasHTML) {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({ format: tamaño || 'A4', printBackground: true })
      pdfBuffers.push(pdf)
      await page.close()
    }

    await browser.close()

    // Combinar PDFs
    const mergedPdf = await PDFDocument.create()
    for (let pdfBytes of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBytes)
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      copiedPages.forEach(p => mergedPdf.addPage(p))
    }

    const finalPdf = await mergedPdf.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.send(Buffer.from(finalPdf))

  } catch (err) {
    console.error('❌ Error en generación:', err)
    res.status(500).send('Error al generar el cartel')
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`))
