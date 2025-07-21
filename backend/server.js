const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { generarHTML } = require('./generadorHtml')
const { generarCodigoEAN13 } = require('./codigoBarras')
const puppeteer = require('puppeteer') // asegurate de tenerlo instalado

const app = express()
app.use(cors({
  origin: 'https://generador-carteles-frontend.vercel.app',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}))

app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  const { datos, tipo, tamaño } = req.body

  const partes = datos.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
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

  const htmlFinal = generarHTML({
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
})

app.listen(process.env.PORT || 3000, () => console.log('Servidor iniciado'))
