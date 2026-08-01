<script>
  import GraphView from './lib/GraphView.svelte'
  import MapView from './lib/MapView.svelte'
  import Enumerations from './lib/Enumerations.svelte'
  import DetailPanel from './lib/DetailPanel.svelte'
  import AboutPage from './lib/AboutPage.svelte'
  import { paletteFor } from './lib/palette.js'

  let graph = $state(null)
  let palette = $state(new Map())
  const params = new URLSearchParams(location.search)
  let view = $state(params.get('view') === 'map' ? 'map' : 'graph') // graph | map
  let selected = $state(null)
  let filterProto = $state(null)
  let showAbout = $state(params.has('about'))

  fetch('data/graph.json')
    .then((r) => r.json())
    .then((g) => {
      graph = g
      palette = paletteFor(g.prototypes.map((p) => p.name))
    })

  function select(n) {
    // n may be a graph node or a prototype ref; prototypes filter instead of detail
    if (n?.kind === 'prototype') {
      filterProto = filterProto === n.name ? null : n.name
      return
    }
    selected = n
  }
  const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '')
</script>

<div class="flex h-full flex-col bg-ink-950 text-ink-200">
  <header class="z-20 flex items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 py-2.5">
    <div class="flex items-center gap-2">
      <span class="text-lg">🕸️</span>
      <div class="leading-tight">
        <div class="text-sm font-semibold text-ink-100">Salt Spring <span class="text-accent-400">Ontology</span></div>
        <div class="text-[11px] text-ink-400">a knowledge graph read from island news</div>
      </div>
    </div>

    {#if graph}
      <div class="ml-3 hidden items-center gap-1.5 text-[11px] text-ink-400 sm:flex">
        <span class="rounded bg-ink-800 px-2 py-0.5">{graph.stats.instances} entities</span>
        <span class="rounded bg-ink-800 px-2 py-0.5">{graph.stats.relations} relations</span>
        <span class="rounded bg-ink-800 px-2 py-0.5">{graph.stats.prototypes} prototypes</span>
      </div>
    {/if}

    <div class="ml-auto flex items-center gap-2">
      <div class="flex rounded-md border border-ink-700 p-0.5 text-xs">
        <button onclick={() => (view = 'graph')} class={view === 'graph' ? 'rounded bg-ink-700 px-3 py-1 text-ink-100' : 'px-3 py-1 text-ink-400'}>Graph</button>
        <button onclick={() => (view = 'map')} class={view === 'map' ? 'rounded bg-ink-700 px-3 py-1 text-ink-100' : 'px-3 py-1 text-ink-400'}>Map</button>
      </div>
      <button onclick={() => (showAbout = true)} class="rounded-md border border-ink-700 px-3 py-1.5 text-xs hover:bg-ink-800">About</button>
    </div>
  </header>

  {#if !graph}
    <div class="grid flex-1 place-items-center text-sm text-ink-400">Loading graph…</div>
  {:else}
    <main class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1">
        {#if view === 'graph'}
          <GraphView {graph} {palette} {selected} {filterProto} onSelect={select} />
        {:else}
          <MapView {graph} {palette} {selected} onSelect={select} />
        {/if}
      </div>

      <aside class="flex w-80 shrink-0 flex-col border-l border-ink-800 bg-ink-900">
        {#if selected}
          <DetailPanel entity={selected} {graph} {palette} onSelect={select} onClose={() => (selected = null)} />
        {:else}
          <Enumerations {graph} {palette} {filterProto} onFilter={(p) => (filterProto = p)} onSelect={select} {selected} />
        {/if}
      </aside>
    </main>

    <footer class="border-t border-ink-800 bg-ink-900 px-4 py-1.5 text-[11px] text-ink-500">
      snapshot {fmtWhen(graph.generatedAt)} · source: Gulf Islands Driftwood · entities machine-extracted, may contain errors
    </footer>
  {/if}

  {#if showAbout && graph}
    <AboutPage stats={graph.stats} onClose={() => (showAbout = false)} />
  {/if}
</div>
