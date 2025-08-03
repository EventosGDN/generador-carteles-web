const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const parse = require('csv-parse/sync')
const puppeteer = require('puppeteer')
const { PDFDocument } = require('pdf-lib')
const generarHTMLCartelesA6 = require('./generarCartelesA6.js')
const { generarHTMLCartel } = require('./generadorHtml.js') // el viejo generador A4
const app = express()

app.use(cors())
app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body
    if (!datos) {
      console.error('⚠️ datos está undefined en el servidor')
      return res.status(400).send('Faltan los datos')
    }

    const lineas = datos.split('\n').map(l => l.trim()).filter(Boolean)
    const datosCarteles = []

    for (const linea of lineas) {
      const partes = linea.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
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

      datosCarteles.push({
        descripcion,
        precioOriginal,
        precioFinal,
        descuento,
        sku: codigoBarras,
        desde,
        hasta,
        departamento,
        item
      })
    }

    let paginasHTML = []
    if (tamaño === 'A6') {
      paginasHTML = await generarHTMLCartelesA6(datosCarteles)
    } else {
      for (const datos of datosCarteles) {
        const html = await generarHTMLCartel(datos, tipo, tamaño)
        paginasHTML.push(html)
      }
    }

    const isRailway = process.env.RAILWAY_STATIC_URL !== undefined
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: isRailway ? '/usr/bin/chromium-browser' : undefined
    })

    const pdfDoc = await PDFDocument.create()
    for (const html of paginasHTML) {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const buffer = await page.pdf({
        format: 'A4', // usamos A4 siempre, porque A6 se acomoda dentro
        printBackground: true
      })
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

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor iniciado')
})

function buscarDepartamentoPorSkuDesdeCSV(sku) {
  const csvPath = path.join(__dirname, 'base_deptos.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('❌ No se encontró base_deptos.csv en:', csvPath)
    return 'Depto no disponible'
  }
  const contenido = fs.readFileSync(csvPath)
  const filas = parse.parse(contenido, { columns: true })
  const fila = filas.find(row => row['SKU ID']?.toString().trim() === sku)
  return fila?.['Dept ID']?.toString().trim() || 'Depto no disponible'
}
