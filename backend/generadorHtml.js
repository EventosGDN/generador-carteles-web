// generadorHtml.js
const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')
const puppeteer = require('puppeteer')

async function generarHTMLCartel(datos) {
  const htmlPath = path.join(__dirname, 'plantillas', 'cartel-a4.html')
  const fontPath = path.join(__dirname, '..', 'frontend', 'fonts', 'miso-bold.ttf')
  let template = fs.readFileSync(htmlPath, 'utf8')

  template = template.replace(/{{fontPath}}/g, fontPath)

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

  const [precioFinalEntero, precioFinalDecimales] = precioFinal.toFixed(2).split('.')
  const [precioOriginalEntero, precioOriginalDecimales] = precioOriginal.toFixed(2).split('.')
  const desdeStr = desde instanceof Date ? desde.toLocaleDateString('es-AR') : desde?.toString() || ''
  const hastaStr = hasta instanceof Date ? hasta.toLocaleDateString('es-AR') : hasta?.toString() || ''


template = template
  .replace(/{{descripcion}}/g, descripcion)
 .replace(/{{precioOriginalEntero}}/g, precioOriginalEntero)
.replace(/{{precioOriginalDecimales}}/g, precioOriginalDecimales)
  .replace(/{{precioFinalEntero}}/g, precioFinalEntero)
  .replace(/{{precioFinalDecimales}}/g, precioFinalDecimales)
  .replace(/{{descuento}}/g, descuento)
  .replace(/{{desde}}/g, desdeStr)
  .replace(/{{hasta}}/g, hastaStr)
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
