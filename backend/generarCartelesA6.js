const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')

async function generarHTMLCartelesA6(listaDeDatos) {
  const plantillaPath = path.join(__dirname, 'plantillas', 'cartel-a6-en-a4.html')
  let plantilla = fs.readFileSync(plantillaPath, 'utf8')
  const estilosPath = path.join(__dirname, 'plantillas', 'estilos-a6.css')
  const estilos = fs.readFileSync(estilosPath, 'utf8')

  const bloques = []
  for (let i = 0; i < listaDeDatos.length; i++) {
    const datos = listaDeDatos[i]
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

    const top = (Math.floor((i % 4) / 2) * 148.5).toFixed(1)
    const left = (i % 2 === 0 ? 0 : 105).toFixed(1)

    const bloque = plantilla
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
      .replace('class="contenedor-a6"', `class="contenedor-a6" style="top:${top}mm; left:${left}mm"`)

    bloques.push(bloque)
  }

  const paginas = []
  for (let i = 0; i < bloques.length; i += 4) {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <style>${estilos}</style>
      </head>
      <body>
        ${bloques.slice(i, i + 4).join('\n')}
      </body>
      </html>
    `
    paginas.push(html)
  }

  return paginas
}

module.exports = generarHTMLCartelesA6
