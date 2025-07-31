// Cambiá esta línea según el entorno:
const URL_BACKEND = location.hostname.includes('localhost')
  ? 'http://localhost:3000/generar-cartel' // desarrollo local
  : 'https://generador-carteles-backend-production.up.railway.app/generar-cartel' // producción Railway

async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value

  try {
    const res = await fetch(URL_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos, tipo, tamaño })
    })

    if (!res.ok) throw new Error('Respuesta no OK del servidor')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    // Abrir PDF en una nueva pestaña
    window.open(url, '_blank')
  } catch (err) {
    alert('Error al generar cartel: ' + err.message)
    console.error(err)
  }
}
