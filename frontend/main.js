async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value

  const res = await fetch('http://localhost:3000/generar-cartel', {
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
}
