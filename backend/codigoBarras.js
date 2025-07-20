const bwipjs = require('bwip-js')
exports.generarCodigoEAN13 = async function (codigo) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'ean13',
        text: codigo.padStart(13, '0'),
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
