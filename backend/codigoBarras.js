const bwipjs = require('bwip-js')

function calcularCheckDigit(codigo12) {
  const sum = codigo12
    .split('')
    .map(Number)
    .reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0)
  const resto = sum % 10
  return resto === 0 ? 0 : 10 - resto
}

exports.generarCodigoEAN13 = async function (codigo) {
  const limpio = codigo.replace(/\D/g, '') // solo números

  if (limpio.length !== 12 && limpio.length !== 13) {
    console.warn('⚠️ Código EAN-13 inválido (esperado 12 o 13 dígitos):', codigo)
    return Buffer.alloc(0)
  }

  const ean13 = limpio.length === 12
    ? limpio + calcularCheckDigit(limpio).toString()
    : limpio

  return new Promise((resolve) => {
    bwipjs.toBuffer(
      {
        bcid: 'ean13',
        text: ean13,
        includetext: true,
        parse: false,
        validatecheck: false,
      },
      function (err, png) {
        if (err) {
          console.warn('⚠️ Error al generar código:', err.message)
          resolve(Buffer.alloc(0))
        } else {
          resolve(png)
        }
      }
    )
  })
}
