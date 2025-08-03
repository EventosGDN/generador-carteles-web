const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')

async function generarHTMLCartel(datos, tipo, tamaño) {
  const plantilla = tamaño === 'A6' ? 'cartel-a6-en-a4.html' : 'cartel-a4.html'
  const htmlPath = path.join(__dirname, 'plantillas', plantilla)
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

  const buffer = await generarCodigoEAN13(sku)
  const barcodeBase64 = buffer.length
    ? `data:image/png;base64,${buffer.toString('base64')}`
    : ''

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
    .replace(/{{descuento}}/g, descuento ?? '')
    .replace(/{{desde}}/g, desdeStr)
    .replace(/{{hasta}}/g, hastaStr)
    .replace(/{{departamento}}/g, departamento)
    .replace(/{{item}}/g, item)
    .replace(/{{barcode}}/g, barcodeBase64)

  return template
}

module.exports = { generarHTMLCartel }
