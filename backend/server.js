/*const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { generarHTMLCartel } = require('./generadorHtml')
const { generarCodigoEAN13 } = require('./codigoBarras')
const puppeteer = require('puppeteer') // asegurate de tenerlo instalado

const app = express()
/*app.use(cors({
  origin: 'https://generador-carteles-frontend.vercel.app',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}))*/

/*app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:3000', 'https://generador-carteles-frontend.vercel.app']
}))


app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body

    const partes = datos.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
    const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

    console.log('Campos:', campos) // debug

    const desde = campos[0]
    const hasta = campos[1]
    const sku = campos[2]
    const descripcion = campos[3]
    const precioOriginal = parseFloat(`${campos[4].replace('$', '')}.${campos[5]}`)
    const precioFinal = parseFloat(`${campos[6].replace('$', '')}.${campos[7]}`)
    const codigoBarras = campos[8]
    const descuento = tipo === '%' ? Math.round(100 - (precioFinal * 100) / precioOriginal) : null

    const item = sku
    const departamento = buscarDepartamentoPorSkuDesdeCSV(sku)

    const htmlFinal = await generarHTMLCartel({
      descripcion,
      precioOriginal,
      precioFinal,
      descuento,
      sku: codigoBarras,
      desde,
      hasta,
      departamento,
      item
    }, tipo, tamaño)

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setContent(htmlFinal, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: tamaño === 'A4' ? 'A4' : 'A6', printBackground: true })
    await browser.close()

    res.contentType('application/pdf')
    res.send(pdfBuffer)
  } catch (err) {
    console.error('❌ Error en generación:', err)
    res.status(500).send('Error generando cartel')
  }
})


app.listen(process.env.PORT || 3000, () => console.log('Servidor iniciado'))



const fs = require('fs')
const parse = require('csv-parse/sync')

function buscarDepartamentoPorSkuDesdeCSV(sku) {
  const csvPath = './backend/base_deptos.csv' // Ruta al archivo CSV exportado
  const contenido = fs.readFileSync(csvPath)
  const filas = parse.parse(contenido, { columns: true }) // usa primera fila como encabezados

  const fila = filas.find(row => row['SKU ID']?.toString().trim() === sku)
  return fila?.['Dept ID']?.toString().trim() || 'Depto no disponible'
}

*/





const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { generarHTMLCartel } = require('./generadorHtml')
const { generarCodigoEAN13 } = require('./codigoBarras')
const puppeteer = require('puppeteer')
const { PDFDocument } = require('pdf-lib')

const app = express()

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:3000', 'https://generador-carteles-frontend.vercel.app']
}))
app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  const { datos, tipo, tamaño } = req.body
  const lineas = datos.split(/\r?\n/).filter(l => l.trim() !== '') // separa por línea

  const pdfsBuffers = []
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()

  for (const linea of lineas) {
    const partes = linea.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
    const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

    const descripcion = campos[3]
    const precioOriginal = parseFloat(`${campos[4].replace('$', '')}.${campos[5]}`)
    const precioFinal = parseFloat(`${campos[6].replace('$', '')}.${campos[7]}`)
    const descuento = tipo === '%' ? Math.round(100 - (precioFinal * 100) / precioOriginal) : null
    const sku = campos[8]
    const depto = campos[10]
    const item = campos[11]
    const origen = 'Argentina'
    const vigencia = `del ${campos[1]} al ${campos[2]}`

    const htmlFinal = await generarHTMLCartel({
      descripcion,
      precioOriginal,
      precioFinal,
      descuento,
      sku,
      depto,
      item,
      origen,
      vigencia
    }, tipo, tamaño)

    await page.setContent(htmlFinal, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: tamaño === 'A4' ? 'A4' : 'A6', printBackground: true })
    pdfsBuffers.push(pdfBuffer)
  }

  await browser.close()

  // Unir PDFs
  const mergedPdf = await PDFDocument.create()
  for (const pdfBytes of pdfsBuffers) {
    const pdf = await PDFDocument.load(pdfBytes)
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    copiedPages.forEach(p => mergedPdf.addPage(p))
  }

  const finalPdfBytes = await mergedPdf.save()
  res.contentType('application/pdf')
  res.send(finalPdfBytes)
})

app.listen(process.env.PORT || 3000, () => console.log('Servidor iniciado'))
