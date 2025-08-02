const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const { generarHTMLCartel } = require('./generadorHtml')
const puppeteer = require('puppeteer')
const fs = require('fs')
const parse = require('csv-parse/sync')

const app = express()

// 🔓 CORS liberado temporalmente para test
app.use(cors())
app.options('*', cors())

app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body
    console.log('Datos recibidos:', datos)

    const partes = datos.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
    const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

    const desde = campos[0]
    const hasta = campos[1]
    const sku = campos[2]
    const descripcion = campos[3]

    const precioOriginal = parseFloat(`${campos[4].replace('$', '')}.${campos[5]}`)
    const precioFinal = parseFloat(`${campos[6].replace('$', '')}.${campos[7]}`)

    if (isNaN(precioOriginal) || isNaN(precioFinal)) {
      throw new Error('Precio inválido')
    }

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

    const isRailway = process.env.RAILWAY_STATIC_URL !== undefined
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: isRailway ? '/usr/bin/chromium-browser' : undefined
    })

    const page = await browser.newPage()
    await page.setContent(htmlFinal, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: tamaño === 'A4' ? 'A4' : 'A6',
      printBackground: true
    })

    await browser.close()

    res.contentType('application/pdf')
    res.send(pdfBuffer)
  } catch (err) {
    console.error('❌ Error en generación:', err)
    res.status(500).send('Error generando cartel')
  }
})

app.listen(process.env.PORT || 3000, () => console.log('Servidor iniciado'))

function buscarDepartamentoPorSkuDesdeCSV(sku) {
  const csvPath = './backend/base_deptos.csv'
  if (!fs.existsSync(csvPath)) {
    console.error('❌ No se encontró base_deptos.csv en:', csvPath)
    return 'Depto no disponible'
  }
  const contenido = fs.readFileSync(csvPath)
  const filas = parse.parse(contenido, { columns: true })
  const fila = filas.find(row => row['SKU ID']?.toString().trim() === sku)
  return fila?.['Dept ID']?.toString().trim() || 'Depto no disponible'
}
