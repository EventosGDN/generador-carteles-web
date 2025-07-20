const bwipjs = require('bwip-js')

exports.generarCodigoEAN13 = async function (codigo) {
  const limpio = codigo.replace(/\D/g, '') // solo números

  if (limpio.length < 12 || limpio.length > 13) {
    console.warn('⚠️ Código de barras inválido:', codigo)
    return Buffer.alloc(0) // devuelve imagen vacía
  }

  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'ean13',
        text: limpio.padStart(13, '0'),
        scale: 3,
        height: 10,
      },
      function (err, png) {
        if (err) reject(err)
        else resolve(png)
      }
    )
  })
}
