const fs = require('fs')
const path = require('path')

function generarHTML(datos, tipo, tamaño) {
  const plantillaNombre = tamaño === 'A4' ? 'cartel-a4.html' : 'cartel-a6.html'
  const plantillaPath = path.join(__dirname, 'plantillas', plantillaNombre)
  const htmlBase = fs.readFileSync(plantillaPath, 'utf8')

  // Datos crudos (ya parseados antes de venir acá)
  const {
    descripcion, precioOriginal, precioFinal, descuento, sku, depto, item, origen, vigencia
  } = datos

  // Reemplaza los {{placeholders}} por los valores reales
  return htmlBase
    .replace('{{descripcion}}', descripcion)
    .replace('{{precioOriginal}}', precioOriginal)
    .replace('{{precioFinal}}', precioFinal)
    .replace('{{descuento}}', descuento || '')
    .replace('{{sku}}', sku)
    .replace('{{depto}}', depto)
    .replace('{{item}}', item)
    .replace('{{origen}}', origen)
    .replace('{{vigencia}}', vigencia)
    .replace('{{tipo}}', tipo)
}

module.exports = { generarHTML }
