const fs = require('fs')
const path = require('path')
const { generarCodigoEAN13 } = require('./codigoBarras')

function leerPlantilla(tipo, tamaño, fuente) {
  console.log('DEBUG leerPlantilla: tipo=', tipo, 'tamaño=', tamaño, 'fuente=', fuente)
  let archivo

  // 🟢 PRIORIDAD 1: rebaja_simple
  if ((tipo || '').toLowerCase() === 'rebaja_simple') {
    archivo = tamaño === 'A6' ? 'rebaja_simple_A6.html' : 'rebaja_simple_A4.html'
  }
  // 🟠 PRIORIDAD 2: CSV → siempre usa % (CPT)
  else if (fuente === 'csv') {
    archivo = tamaño === 'A6' ? '%_A6.html' : '%A4.html'
  }
  // ⚪ PRIORIDAD 3: por defecto %
  else {
    archivo = tamaño === 'A6' ? '%_A6.html' : '%A4.html'
  }

  console.log('DEBUG archivo elegido:', archivo)

  console.log('DEBUG archivo elegido:', archivo)

  const ruta1 = path.join(__dirname, 'plantillas', 'tabla', archivo)
  if (fs.existsSync(ruta1)) return fs.readFileSync(ruta1, 'utf8')

  const ruta2 = path.join(process.cwd(), 'backend', 'plantillas', 'tabla', archivo)
  if (fs.existsSync(ruta2)) return fs.readFileSync(ruta2, 'utf8')

  throw new Error(`No encontré la plantilla ${archivo}`)
}


async function generarHTMLCartelesTabla(lista, tamaño = 'A4', fuente = 'tabla') {
  const bloques = []

  for (let i = 0; i < lista.length; i++) {
    const d = lista[i] || {}

    console.log('DEBUG generarHTMLCartelesTabla:',
    'tipoFila=', d.tipoFila,
    'tamaño=', tamaño,
    'descripcion=', d.descripcion
  )

    // elegir plantilla según tipoFila y fuente
    const plantilla = leerPlantilla(d.tipoFila || '%', tamaño, fuente)

    // precios
    const [pfEnt, pfDec] = Number(d.precioFinal ?? 0).toFixed(2).split('.')
    const [poEnt, poDec] = Number(d.precioOriginal ?? 0).toFixed(2).split('.')

    // fechas
    const fmt = new Intl.DateTimeFormat('es-AR')
    const desde = d.desde instanceof Date ? fmt.format(d.desde) : (d.desde ?? '')
    const hasta = d.hasta instanceof Date ? fmt.format(d.hasta) : (d.hasta ?? '')

    // código de barras
    let barcode = ''
    try {
      const buf = await generarCodigoEAN13(d.sku)
      if (buf?.length) barcode = `data:image/png;base64,${buf.toString('base64')}`
    } catch {}

    let html = plantilla
      .replace(/{{descripcion}}/g, d.descripcion ?? '')
      .replace(/{{descuento}}/g, String(d.descuento ?? ''))
      .replace(/{{precioFinalEntero}}/g, pfEnt).replace(/{{precioFinalDecimales}}/g, pfDec)
      .replace(/{{precioOriginalEntero}}/g, poEnt).replace(/{{precioOriginalDecimales}}/g, poDec)
      .replace(/{{desde}}/g, desde).replace(/{{hasta}}/g, hasta)
      .replace(/{{departamento}}/g, d.departamento ?? '')
      .replace(/{{item}}/g, d.item ?? '')
      .replace(/{{barcode}}/g, barcode)

    // 👇 si es A6, ubicamos bloques en cuadrícula (4 por página A4)
    if (tamaño === 'A6') {
      const top  = (Math.floor((i % 4) / 2) * 148.5).toFixed(1)
      const left = (i % 2 === 0 ? 0 : 105).toFixed(1)
      html = html.replace(
        'class="contenedor-a6"',
        `class="contenedor-a6" style="top:${top}mm; left:${left}mm"`
      )
    }

    bloques.push(html)
  }

  // empaquetado en páginas
  const paginas = []
  if (tamaño === 'A6') {
    for (let i = 0; i < bloques.length; i += 4) {
      paginas.push(
        `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body>${bloques.slice(i, i+4).join('')}</body></html>`
      )
    }
  } else {
    for (let i = 0; i < bloques.length; i++) {
      paginas.push(
        `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body>${bloques[i]}</body></html>`
      )
    }
  }

  return paginas
}

module.exports = generarHTMLCartelesTabla
