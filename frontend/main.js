/*async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value

  const res = await fetch('https://generador-carteles-backend.onrender.com/generar-cartel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos, tipo, tamaño })
  })

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `Cartel_${tipo}_${tamaño}.pdf`
  link.textContent = 'Descargar PDF'
  document.getElementById('resultado').innerHTML = ''
  document.getElementById('resultado').appendChild(link)
} */


// main.js (para desarrollo local)
const URL_BACKEND = 'https://generador-carteles-backend-production.up.railway.app/generar-cartel'


function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
const tamaño = document.getElementById('formato').value


  fetch(URL_BACKEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos, tipo, tamaño })
  })
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    })
    .catch(err => {
      alert('Error al generar cartel: ' + err)
    })
}
