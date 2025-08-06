const isLocalhost = location.hostname === '127.0.0.1' || location.hostname === 'localhost'

const URL_BACKEND = isLocalhost
  ? 'http://localhost:3000'
  : 'https://generador-carteles-backend.up.railway.app'

async function generarCartel() {
  const datos = document.getElementById('inputDatos').value
  const tipo = document.getElementById('tipoCartel').value
  const tamaño = document.getElementById('formato').value

  try {
    console.log('📤 Enviando:', { datos, tipo, tamaño })

    const res = await fetch(`${URL_BACKEND}/generar-cartel`, {
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

const tiposCartel = [
  'precio_normal', '%', '2x1', '3x2', '4x2', '6x5',
  '2do', 'QrMP', 'MP', 'rebaja_simple', 'fernetcoca', 'FINANCIACION'
]

function crearFila() {
  const tr = document.createElement('tr')
  let tipoSelect = null

  for (let i = 0; i < 14; i++) {
    const td = document.createElement('td')

    if (i === 0) {
      const input = document.createElement('input')
      input.type = 'text'
      input.addEventListener('blur', () => {
        const valor = input.value.trim()
        const producto = buscarProducto(valor)
        if (producto) {
          const celdas = tr.querySelectorAll('td')
          if (producto.depto !== undefined) celdas[10].querySelector('input').value = producto.depto
          if (producto.descripcion !== undefined) celdas[11].querySelector('input').value = producto.descripcion
          if (producto.sku !== undefined) celdas[12].querySelector('input').value = producto.sku
          if (producto.ean !== undefined) celdas[13].querySelector('input').value = producto.ean
        }
      })
      td.appendChild(input)

    } else if (i === 6) {
      const select = document.createElement('select')
      tipoSelect = select
      tiposCartel.forEach(tipo => {
        const option = document.createElement('option')
        option.value = tipo
        option.textContent = tipo
        select.appendChild(option)
      })
      select.addEventListener('change', () => {
        const celdas = tr.querySelectorAll('td')
        const precio = parseFloat(celdas[1].querySelector('input').value.replace(',', '.'))
        const descuento = parseFloat(celdas[2].querySelector('input').value.replace(',', '.'))
        const output = celdas[3].querySelector('input')

        if (select.value === '%' && !isNaN(precio) && !isNaN(descuento)) {
          output.value = (precio * (1 - descuento / 100)).toFixed(2)
        }

        if (select.value === '2do' && !isNaN(precio) && !isNaN(descuento)) {
  const precioConDescuento = precio * (1 - descuento / 100)
  const promedio = ((precio + precioConDescuento) / 2).toFixed(2)
  output.value = promedio
}

        const promociones = {
          '3x2': 3 / 2,
          '4x2': 4 / 2,
          '6x5': 6 / 5,
          '3x1': 3 / 1,
          '2x1': 2 / 1
        }
        if (promociones[select.value] && !isNaN(precio)) {
          const unitario = (precio / promociones[select.value]).toFixed(2)
          output.value = unitario
        }
      })
      td.appendChild(select)

    } else if (i === 2) {
      const input = document.createElement('input')
      input.type = 'text'
      input.addEventListener('blur', () => {
        const valor = parseFloat(input.value.replace(',', '.'))
        if (!isNaN(valor) && tipoSelect && tipoSelect.value === 'precio_normal') {
          tipoSelect.value = '%'
          tipoSelect.dispatchEvent(new Event('change'))
        }
      })
      td.appendChild(input)

    } else if (i >= 7 && i <= 9) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      td.appendChild(checkbox)

    } else {
      const input = document.createElement('input')
      input.type = (i === 4 || i === 5) ? 'date' : 'text'
      td.appendChild(input)
    }

    tr.appendChild(td)
  }
  return tr
}

let filasActuales = 0
const MAX_FILAS = 20

function cargarTablaCarteles() {
  agregarFila()
}

function agregarFila() {
  if (filasActuales >= MAX_FILAS) return
  const tbody = document.getElementById('tablaCartelesBody')
  tbody.appendChild(crearFila())
  filasActuales++
}

function cargarDesdeTabla() {
  const filas = document.querySelectorAll('#tablaCartelesBody tr')
  const datos = []

  filas.forEach(tr => {
    const celdas = tr.querySelectorAll('td')
    const fila = []
    celdas.forEach((td, i) => {
      const input = td.querySelector('input, select')
      if (input) {
        if (input.type === 'checkbox') {
          fila.push(input.checked ? '1' : '')
        } else {
          fila.push(input.value.trim())
        }
      } else {
        fila.push('')
      }
    })
    if (fila.some(val => val !== '')) {
      datos.push(fila.join('\n'))
    }
  })

  document.getElementById('inputDatos').value = datos.join('\n')
}

window.addEventListener('DOMContentLoaded', () => {
  cargarTablaCarteles()

  document.addEventListener('keydown', function (e) {
    const dir = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowDown: 1
    }
    const isArrow = Object.keys(dir).includes(e.key)

    const elementos = Array.from(document.querySelectorAll('input, select'))
      .filter(el => !el.disabled && el.offsetParent !== null)
    const actual = document.activeElement
    const idx = elementos.indexOf(actual)

    if (e.key === 'Enter' && idx >= 0 && idx < elementos.length - 1) {
      e.preventDefault()
      elementos[idx + 1].focus()
    } else if (isArrow && idx >= 0) {
      e.preventDefault()
      let next = idx
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        next += dir[e.key]
      } else {
        const totalCols = 14
        next += dir[e.key] * totalCols
      }
      if (next >= 0 && next < elementos.length) {
        elementos[next].focus()
      }
    }
  })
})

let baseProductos = []

fetch(`${URL_BACKEND}/base-productos`)
  .then(res => res.json())
  .then(data => {
    baseProductos = data
  })
  .catch(err => {
    console.error('Error cargando base de productos:', err)
  })

function buscarProducto(valor) {
  const limpio = valor.replace(/^0+/, '').trim()
  return baseProductos.find(p =>
    p.sku?.replace(/^0+/, '') === limpio || p.ean?.replace(/^0+/, '') === limpio
  )
}
