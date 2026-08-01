<script>
  // Force-directed knowledge graph. Instance nodes coloured by prototype and
  // sized by degree; prototype hubs drawn larger with dashed "is-a" links so
  // the prototype-based classification is visible as structure. Edges are the
  // relation entities, labelled on hover. d3-force for layout, SVG for hit-
  // testing and crisp text.
  import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force'
  import { onMount, untrack } from 'svelte'

  let { graph, palette, selected, onSelect, filterProto } = $props()

  let svgEl
  let width = $state(900)
  let height = $state(640)
  let nodes = $state.raw([])
  let links = $state.raw([])
  let sim
  let hoverEdge = $state(null)
  let transform = $state({ k: 1, x: 0, y: 0 })

  // Build the working node/link set: instances + prototype hubs. Prototype
  // hubs let you *see* the classification — instances cluster around the kind
  // they resemble.
  function build() {
    const showProto = (p) => !filterProto || p === filterProto
    const protoNodes = graph.prototypes
      .filter((p) => p.count > 0)
      .map((p) => ({
        id: 'proto:' + p.name,
        kind: 'prototype',
        name: p.name,
        count: p.count,
        r: 10 + Math.sqrt(p.count) * 3,
      }))
    const instNodes = graph.nodes
      .filter((n) => !filterProto || n.prototypes.includes(filterProto))
      .map((n) => ({
        id: n.id,
        kind: 'instance',
        name: n.name,
        proto: n.prototypes[0] || 'Thing',
        r: 5 + Math.sqrt(n.degree + n.mentions) * 2.2,
        raw: n,
      }))

    const instIds = new Set(instNodes.map((n) => n.id))
    const nodeById = new Map([...protoNodes, ...instNodes].map((n) => [n.id, n]))

    // is-a links (dashed): instance → its prototype hub
    const isa = []
    for (const n of instNodes)
      for (const p of n.raw.prototypes)
        if (nodeById.has('proto:' + p)) isa.push({ source: n.id, target: 'proto:' + p, kind: 'isa' })

    // relation links (solid): the extracted edges
    const rel = graph.edges
      .filter((e) => instIds.has(e.from) && instIds.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, kind: 'rel', predicate: e.predicate, raw: e }))

    // preserve positions across rebuilds (untracked — this must not make the
    // rebuild effect depend on `nodes`, or it loops)
    const prev = new Map(untrack(() => nodes).map((n) => [n.id, n]))
    for (const n of nodeById.values()) {
      const p = prev.get(n.id)
      if (p) { n.x = p.x; n.y = p.y; n.vx = p.vx; n.vy = p.vy }
    }
    nodes = [...nodeById.values()]
    links = [...isa, ...rel]
  }

  function start() {
    // measure the real rendered size (SVG clientWidth can be 0 — use the
    // bounding rect) so the centre force targets the actual middle
    if (svgEl) {
      const r = svgEl.getBoundingClientRect()
      if (r.width > 20) { width = r.width; height = r.height }
    }
    build()
    // seed positions at centre so the layout is sane even before it settles
    for (const n of nodes) {
      if (n.x == null || Number.isNaN(n.x)) {
        n.x = width / 2 + (Math.random() - 0.5) * 120
        n.y = height / 2 + (Math.random() - 0.5) * 120
      }
    }
    sim?.stop()
    sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance((l) => (l.kind === 'isa' ? 55 : 120)).strength((l) => (l.kind === 'isa' ? 0.25 : 0.05)))
      .force('charge', forceManyBody().strength((d) => (d.kind === 'prototype' ? -1100 : -430)).distanceMax(600))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius((d) => d.r + 10).strength(0.9))
      .force('x', forceX(width / 2).strength(0.014))
      .force('y', forceY(height / 2).strength(0.02))
      .on('tick', () => {
        nodes = [...nodes] // new ref → $state.raw re-render
        links = [...links]
      })
    // pre-warm synchronously: settles the layout immediately and is robust to
    // rAF throttling (headless/background tabs never animate the sim otherwise)
    sim.alpha(1).stop()
    for (let i = 0; i < 320; i++) sim.tick()
    nodes = [...nodes]
    links = [...links]
    sim.alphaTarget(0).alpha(0.05).restart() // keep warm for drag interactions
  }

  onMount(() => {
    let first = true
    const ro = new ResizeObserver((es) => {
      const r = es[0].contentRect
      if (r.width < 20) return
      width = r.width
      height = r.height
      if (first) {
        first = false
        start() // first real measurement → lay out against true size
      } else {
        sim?.force('center', forceCenter(width / 2, height / 2))
        sim?.force('x', forceX(width / 2).strength(0.03))
        sim?.force('y', forceY(height / 2).strength(0.03))
        sim?.alpha(0.4).restart()
      }
    })
    ro.observe(svgEl)
    return () => { ro.disconnect(); sim?.stop() }
  })

  $effect(() => {
    filterProto // depend only on the filter
    untrack(() => {
      if (sim) start()
    })
  })

  // drag
  let dragging = null
  function down(n, e) {
    dragging = n
    n.fx = n.x
    n.fy = n.y
    sim.alphaTarget(0.2).restart()
    e.stopPropagation()
  }
  function move(e) {
    if (!dragging) return
    const pt = toLocal(e)
    dragging.fx = pt.x
    dragging.fy = pt.y
  }
  function up() {
    if (dragging) { dragging.fx = null; dragging.fy = null }
    dragging = null
    sim?.alphaTarget(0)
  }
  function toLocal(e) {
    const r = svgEl.getBoundingClientRect()
    return { x: (e.clientX - r.left - transform.x) / transform.k, y: (e.clientY - r.top - transform.y) / transform.k }
  }

  // simple wheel zoom
  function wheel(e) {
    e.preventDefault()
    const r = svgEl.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const k = Math.min(3, Math.max(0.4, transform.k * (e.deltaY < 0 ? 1.1 : 0.9)))
    transform = { k, x: mx - (mx - transform.x) * (k / transform.k), y: my - (my - transform.y) * (k / transform.k) }
  }

  const col = (p) => palette.get(p) || '#7c92a8'
  const isSel = (id) => selected?.id === id
</script>

<div class="relative h-full w-full overflow-hidden bg-ink-950">
  <svg
    bind:this={svgEl}
    class="h-full w-full touch-none"
    onmousemove={move}
    onmouseup={up}
    onmouseleave={up}
    onwheel={wheel}
    role="presentation"
  >
    <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
      <!-- links -->
      {#each links as l (l.source.id + '|' + l.target.id + '|' + (l.predicate || 'isa'))}
        {#if l.kind === 'isa'}
          <line x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
            stroke="#2a3744" stroke-width="1" stroke-dasharray="2 3" />
        {:else}
          <line x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
            stroke={hoverEdge === l ? '#4bd6c4' : '#3a4b5e'} stroke-width={hoverEdge === l ? 2 : 1.2}
            onmouseenter={() => (hoverEdge = l)} onmouseleave={() => (hoverEdge = null)}
            class="cursor-pointer" role="presentation" />
        {/if}
      {/each}

      <!-- edge label on hover -->
      {#if hoverEdge}
        <text x={(hoverEdge.source.x + hoverEdge.target.x) / 2} y={(hoverEdge.source.y + hoverEdge.target.y) / 2 - 4}
          fill="#cdd9e5" font-size="11" text-anchor="middle" class="pointer-events-none select-none"
          style="paint-order:stroke;stroke:#0b0f14;stroke-width:3px">{hoverEdge.predicate}</text>
      {/if}

      <!-- nodes -->
      {#each nodes as n (n.id)}
        {#if n.kind === 'prototype'}
          <g transform="translate({n.x},{n.y})" class="cursor-pointer"
            onmousedown={(e) => down(n, e)}
            onclick={() => onSelect({ id: n.id, kind: 'prototype', name: n.name })} role="presentation">
            <circle r={n.r} fill={col(n.name)} fill-opacity="0.14" stroke={col(n.name)} stroke-width="1.5" stroke-dasharray="4 3" />
            <text y="4" fill={col(n.name)} font-size="12" font-weight="700" text-anchor="middle" class="select-none pointer-events-none">{n.name}</text>
          </g>
        {:else}
          <g transform="translate({n.x},{n.y})" class="cursor-pointer"
            onmousedown={(e) => down(n, e)}
            onclick={() => onSelect(n.raw)} role="presentation">
            <circle r={n.r} fill={col(n.proto)} fill-opacity={isSel(n.id) ? 1 : 0.85}
              stroke={isSel(n.id) ? '#fff' : '#0b0f14'} stroke-width={isSel(n.id) ? 2 : 1} />
            {#if n.r > 8 || isSel(n.id)}
              <text y={n.r + 11} fill="#a7bacb" font-size="10.5" text-anchor="middle" class="select-none pointer-events-none"
                style="paint-order:stroke;stroke:#0b0f14;stroke-width:2.5px">{n.name.length > 26 ? n.name.slice(0, 24) + '…' : n.name}</text>
            {/if}
          </g>
        {/if}
      {/each}
    </g>
  </svg>

  <div class="pointer-events-none absolute bottom-2 left-3 text-[11px] text-ink-400">
    drag nodes · scroll to zoom · dashed = <span class="text-ink-300">is-a</span> · solid = relation
  </div>
</div>
