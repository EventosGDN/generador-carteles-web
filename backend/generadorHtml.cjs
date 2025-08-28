const fs = require('fs');
const path = require('path');
const { generarCodigoEAN13 } = require('./codigoBarras');

function elegirPlantilla({ tipo, tamaño }) {
  if (tipo === '%') return tamaño === 'A6' ? '%_A6.html' : '%A4.html';
  return tamaño === 'A6' ? 'cartel-a6-en-a4.html' : 'cartel-a4.html';
}

// ---- DD-MM-AAAA robusto
function formatearDDMMAAAA(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) {
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const yyyy = val.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/); // YYYY-MM-DD
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);     // DD-MM-YYYY
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? s : formatearDDMMAAAA(d);
}

// ---- Reemplazo tolerante a espacios/mayúsculas
function reemplazar(template, mapa) {
  let out = template;
  for (const [k, v] of Object.entries(mapa)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
    out = out.replace(re, v ?? '');
  }
  return out;
}

// ---- Plantillas de rebaja_simple en backend/plantillas/tabla
function leerPlantillaRebajaSimple(tamaño) {
  const archivo = tamaño === 'A6' ? 'rebaja_simple_A6.html' : 'rebaja_simple_A4.html';

  const ruta1 = path.join(__dirname, 'plantillas', 'tabla', archivo);
  if (fs.existsSync(ruta1)) return fs.readFileSync(ruta1, 'utf8');

  const ruta2 = path.join(process.cwd(), 'backend', 'plantillas', 'tabla', archivo);
  if (fs.existsSync(ruta2)) return fs.readFileSync(ruta2, 'utf8');

  throw new Error(`No encontré la plantilla de rebaja_simple: ${archivo}`);
}

function leerPlantillaCPT(tamaño) {
  const archivo = tamaño === 'A6' ? 'CPT_A6.html' : 'CPT_A4.html';

  const ruta1 = path.join(__dirname, 'plantillas', archivo);
  if (fs.existsSync(ruta1)) return fs.readFileSync(ruta1, 'utf8');

  const ruta2 = path.join(process.cwd(), 'backend', 'plantillas', archivo);
  if (fs.existsSync(ruta2)) return fs.readFileSync(ruta2, 'utf8');

  throw new Error(`No encontré la plantilla CPT: ${archivo}`);
}

async function generarHTMLCartel(datos, tipo, tamaño, fuente = 'csv') {
  let template;

  const tipoNorm = String(tipo || '').trim().toLowerCase()

  if (fuente === 'csv') {
    // siempre CPT
    template = leerPlantillaCPT(tamaño)

  } else if (tipoNorm === 'rebaja_simple') {
    // rebaja_simple usa su propia plantilla
    template = leerPlantillaRebajaSimple(tamaño)

  } else {
    // resto de tipos → % o genéricos
    const archivo = elegirPlantilla({ tipo: tipoNorm, tamaño })
    const htmlPath = path.join(__dirname, 'plantillas', 'tabla', archivo)
    template = fs.readFileSync(htmlPath, 'utf8')
  }



  const {
    descripcion = '',
    precioOriginal = 0,
    precioFinal = 0,
    descuento = '',
    desde = '',
    hasta = '',
    departamento = '',
    item = '',
    sku = ''
  } = datos;

  // Código de barras (EAN13)
  let barcodeBase64 = '';
  try {
    const buffer = await generarCodigoEAN13(sku);
    if (buffer?.length) barcodeBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {}

  const [precioFinalEntero, precioFinalDecimales]       = Number(precioFinal).toFixed(2).split('.');
  const [precioOriginalEntero, precioOriginalDecimales] = Number(precioOriginal).toFixed(2).split('.');

  const tokens = {
    descripcion,
    precioOriginalEntero,
    precioOriginalDecimales,
    precioFinalEntero,
    precioFinalDecimales,
    descuento: (descuento ?? '').toString(),
    desde: formatearDDMMAAAA(desde),
    hasta: formatearDDMMAAAA(hasta),
    departamento,
    item,
    barcode: barcodeBase64
  };

  return reemplazar(template, tokens);
}

module.exports = { generarHTMLCartel };
