const isLocalhost = location.hostname === '127.0.0.1' || location.hostname === 'localhost'

const URL_BACKEND = isLocalhost
  ? 'http://localhost:3000/generar-cartel'
  : 'https://generador-carteles-backend.up.railway.app/generar-cartel'
async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value

  try {
    console.log('📤 Enviando:', { datos, tipo, tamaño })

    const res = await fetch(URL_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos, tipo, tamaño })
    })

    if (!res.ok) {
      const texto = await res.text()
      console.error('❌ Error al generar cartel:', texto)
      alert('Error generando el cartel:\n' + texto)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } catch (error) {
    console.error('❌ Error inesperado:', error)
    alert('Error inesperado:\n' + error.message)
  }
}
