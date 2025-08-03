// generarCartelesA6.js
const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')
const { generarHTMLCartel } = require('./generadorHtml')

// Posiciones en mm (1pt = 0.3528mm aprox)
const posicionesA6 = [
  { x: 0, y: 421.89 },        // arriba izquierda
  { x: 297.64, y: 421.89 },  // arriba derecha
  { x: 0, y: 0 },            // abajo izquierda
  { x: 297.64, y: 0 }        // abajo derecha
]

async function generarCartelesA6(datosList, tipo) {
  const isRailway = process.env.RAILWAY_STATIC_URL !== undefined
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: isRailway ? '/usr/bin/chromium-browser' : undefined
  })

  const fragmentos = []
  for (const datos of datosList) {
    const html = await generarHTMLCartel(datos, tipo, 'A6')
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.pdf({
      width: '105mm',
      height: '148.5mm',
      printBackground: true
    })
    fragmentos.push(buffer)
    await page.close()
  }

  await browser.close()

  const finalDoc = await PDFDocument.create()
  for (let i = 0; i < fragmentos.length; i += 4) {
    const paginaA4 = await finalDoc.addPage([595.28, 841.89]) // A4 en pt
    const grupo = fragmentos.slice(i, i + 4)
    for (let j = 0; j < grupo.length; j++) {
      const docFrag = await PDFDocument.load(grupo[j])
      const [pagina] = await finalDoc.copyPages(docFrag, [0])
      paginaA4.drawPage(pagina, {
        x: posicionesA6[j].x,
        y: posicionesA6[j].y
      })
    }
  }

  return await finalDoc.save()
}

module.exports = { generarCartelesA6 }
