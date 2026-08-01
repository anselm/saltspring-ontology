<script>
  import maplibregl from 'maplibre-gl'
  import { onMount } from 'svelte'

  let { graph, palette, selected, onSelect } = $props()

  let container
  let map
  let ready = $state(false)

  const located = () => graph.nodes.filter((n) => n.location && n.location.lat != null)

  const style = {
    version: 8,
    sources: {
      dark: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'dark', type: 'raster', source: 'dark' }],
  }

  onMount(async () => {
    map = new maplibregl.Map({
      container,
      style,
      center: [-123.5, 48.82],
      zoom: 10.4,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const perimeter = await fetch('data/perimeter.json').then((r) => r.json()).catch(() => null)

    map.on('load', () => {
      if (perimeter?.[0]?.ring) {
        map.addSource('island', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [perimeter[0].ring.map(([la, lo]) => [lo, la])] },
          },
        })
        map.addLayer({ id: 'island-fill', type: 'fill', source: 'island', paint: { 'fill-color': '#23bda9', 'fill-opacity': 0.06 } })
        map.addLayer({ id: 'island-line', type: 'line', source: 'island', paint: { 'line-color': '#23bda9', 'line-width': 1, 'line-opacity': 0.5 } })
      }
      ready = true
      draw()
    })
  })

  let markers = []
  function draw() {
    if (!ready) return
    for (const m of markers) m.remove()
    markers = []
    for (const n of located()) {
      const el = document.createElement('div')
      const color = palette.get(n.prototypes[0]) || '#7c92a8'
      const r = 8 + Math.min(10, n.mentions * 3)
      el.style.cssText = `width:${r}px;height:${r}px;border-radius:9999px;background:${color};border:1.5px solid ${
        selected?.id === n.id ? '#fff' : 'rgba(0,0,0,.5)'
      };cursor:pointer;box-shadow:0 0 0 ${selected?.id === n.id ? 3 : 0}px rgba(75,214,196,.4)`
      el.title = n.name
      el.onclick = () => onSelect(n)
      const marker = new maplibregl.Marker({ element: el }).setLngLat([n.location.lon, n.location.lat]).addTo(map)
      markers.push(marker)
    }
  }

  $effect(() => {
    selected
    graph
    if (ready) draw()
  })
</script>

<div class="relative h-full w-full">
  <div bind:this={container} class="h-full w-full"></div>
  <div class="pointer-events-none absolute bottom-2 left-3 rounded bg-ink-950/80 px-2 py-1 text-[11px] text-ink-400">
    {located().length} located entities · size = mentions · colour = prototype · positions approximate (gazetteer)
  </div>
</div>
