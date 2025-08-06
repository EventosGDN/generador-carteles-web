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

// ✅ Lista blanca de orígenes permitidos
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
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})


app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  try {
    const { datos, tipo, tamaño } = req.body
    if (!datos) return res.status(400).send('Faltan los datos')

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

      if (isNaN(precioOriginal) || isNaN(precioFinal)) throw new Error('Precio inválido')

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

    const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})


    const pdfDoc = await PDFDocument.create()
    for (const html of paginasHTML) {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
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

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor iniciado')
})

function buscarDepartamentoPorSkuDesdeCSV(sku) {
  const csvPath = path.join(__dirname, 'base_deptos.csv')
  if (!fs.existsSync(csvPath)) return 'Depto no disponible'
  const contenido = fs.readFileSync(csvPath)
  const filas = parse.parse(contenido, { columns: true })
  const fila = filas.find(row => row['SKU ID']?.toString().trim() === sku)
  return fila?.['Dept ID']?.toString().trim() || 'Depto no disponible'
}

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
