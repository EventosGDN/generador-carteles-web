const fs = require('fs');
const path = require('path');
const { generarCodigoEAN13 } = require('./codigoBarras');

const PLANTILLA = fs.readFileSync(
  path.join(__dirname, 'plantillas', '%_A6.html'),
  'utf8'
);

async function generarHTMLCartelesA6(lista) {
  const bloques = [];

  for (let i = 0; i < lista.length; i++) {
    const d = lista[i] || {};

    // precios
    const [pfEnt, pfDec] = Number(d.precioFinal ?? 0).toFixed(2).split('.');
    const [poEnt, poDec] = Number(d.precioOriginal ?? 0).toFixed(2).split('.');

    // fechas
    const fmt = new Intl.DateTimeFormat('es-AR');
    const desde = d.desde instanceof Date ? fmt.format(d.desde) : (d.desde ?? '');
    const hasta = d.hasta instanceof Date ? fmt.format(d.hasta) : (d.hasta ?? '');

    // código de barras
    let barcode = '';
    try {
      const buf = await generarCodigoEAN13(d.sku);
      if (buf?.length) barcode = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {}

    // posición A6 (4 por A4)
    const top  = (Math.floor((i % 4) / 2) * 148.5).toFixed(1);
    const left = (i % 2 === 0 ? 0 : 105).toFixed(1);

    const html = PLANTILLA
      .replace('class="contenedor-a6"', `class="contenedor-a6" style="top:${top}mm; left:${left}mm"`)
      .replace(/{{descripcion}}/g, d.descripcion ?? '')
      .replace(/{{descuento}}/g, String(d.descuento ?? ''))
      .replace(/{{precioFinalEntero}}/g, pfEnt).replace(/{{precioFinalDecimales}}/g, pfDec)
      .replace(/{{precioOriginalEntero}}/g, poEnt).replace(/{{precioOriginalDecimales}}/g, poDec)
      .replace(/{{desde}}/g, desde).replace(/{{hasta}}/g, hasta)
      .replace(/{{departamento}}/g, d.departamento ?? '')
      .replace(/{{item}}/g, d.item ?? '')
      .replace(/{{barcode}}/g, barcode);

    bloques.push(html);
  }

  // empaquetar cada 4 A6 por página A4
  const paginas = [];
  for (let i = 0; i < bloques.length; i += 4) {
    paginas.push(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body>${bloques.slice(i, i+4).join('')}</body></html>`);
  }
  return paginas;
}

module.exports = generarHTMLCartelesA6;
