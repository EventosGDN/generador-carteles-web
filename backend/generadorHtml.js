const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')

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
