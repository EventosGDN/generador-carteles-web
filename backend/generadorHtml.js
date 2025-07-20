// generadorHtml.js
const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')
const puppeteer = require('puppeteer')

async function generarHTMLCartel(datos) {
  const htmlPath = path.join(__dirname, 'plantillas', 'cartel-a4.html')
  let template = fs.readFileSync(htmlPath, 'utf8')

  const {
    descripcion,
    precioOriginal,
    precioFinal,
    descuento,
    desde,
    hasta,
    departamento,
    item,
    sku
  } = datos

  const barcodeBase64 = await generarCodigoEAN13(sku)

  template = template
    .replace(/{{descripcion}}/g, descripcion)
    .replace(/{{precioOriginal}}/g, precioOriginal.toFixed(2))
    .replace(/{{precioFinal}}/g, precioFinal.toFixed(2))
    .replace(/{{descuento}}/g, descuento)
    .replace(/{{desde}}/g, desde)
    .replace(/{{hasta}}/g, hasta)
    .replace(/{{departamento}}/g, departamento)
    .replace(/{{item}}/g, item)
    .replace(/{{barcode}}/g, barcodeBase64)

  return template
}

async function generarPDFdesdeHTML(htmlString, res) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(htmlString, { waitUntil: 'load' })
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
  await browser.close()
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="cartel.pdf"')
  res.send(pdfBuffer)
}

module.exports = { generarHTMLCartel, generarPDFdesdeHTML }
