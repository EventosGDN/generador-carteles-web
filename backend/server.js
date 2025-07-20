const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const PDFDocument = require('pdfkit')
const { generarCodigoEAN13 } = require('./codigoBarras')

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.post('/generar-cartel', async (req, res) => {
  const { datos, tipo, tamaño } = req.body
  const partes = datos.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
const partes = datos.match(/(?:[^,"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g)
const campos = partes.map(s => s.trim().replace(/^"|"$/g, ''))

const desc = campos[3]
const precioOriginal = parseFloat(`${campos[4].replace('$','')}.${campos[5]}`)
const precioFinal = parseFloat(`${campos[6].replace('$','')}.${campos[7]}`)
const sku = campos[8]


  const descuento = tipo === '%' ? Math.round(100 - (precioFinal * 100) / precioOriginal) : null

  const doc = new PDFDocument({ size: tamaño === 'A4' ? 'A4' : [298, 420] })
  const chunks = []
  doc.on('data', c => chunks.push(c))
  doc.on('end', () => res.end(Buffer.concat(chunks)))

  doc.fontSize(24).text(`Producto: ${desc}`, 50, 80)
  if (tipo === '%') {
    doc.fontSize(20).text(`Antes: $${precioOriginal}`, 50, 120)
    doc.fontSize(30).text(`Ahora: $${precioFinal}`, 50, 160)
    doc.fontSize(28).text(`${descuento}% OFF`, 50, 210)
  } else if (tipo === '2x1') {
    doc.fontSize(40).text('2x1', 50, 150)
  }

  const barcodeImg = await generarCodigoEAN13(sku)
  if (barcodeImg && barcodeImg.length > 0) {
  doc.image(barcodeImg, 50, 280, { width: 200 })
}
  doc.end()
})

app.listen(process.env.PORT || 3000, () => console.log('Servidor iniciado'))
