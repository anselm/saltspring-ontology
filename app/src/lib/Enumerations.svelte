<script>
  // The three enumerations the brief asks for: abstract primitives
  // (prototypes), the component buckets found, and the entities — each
  // cross-linked to the graph/map by selection and prototype filter.
  let { graph, palette, filterProto, onFilter, onSelect, selected } = $props()

  let tab = $state('prototypes')
  let q = $state('')

  const col = (p) => palette.get(p) || '#7c92a8'
  const filteredEntities = $derived(
    graph.nodes
      .filter((n) => !filterProto || n.prototypes.includes(filterProto))
      .filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.degree + b.mentions - (a.degree + a.mentions))
  )
</script>

<div class="flex h-full flex-col">
  <div class="flex gap-1 border-b border-ink-800 p-2 text-xs">
    {#each [['prototypes', `Prototypes ${graph.prototypes.filter((p) => p.count).length}`], ['components', `Components ${graph.components.length}`], ['entities', `Entities ${graph.nodes.length}`]] as [id, label] (id)}
      <button
        onclick={() => (tab = id)}
        class={tab === id ? 'rounded bg-ink-700 px-2.5 py-1 font-medium text-ink-100' : 'rounded px-2.5 py-1 text-ink-400 hover:text-ink-200'}
        >{label}</button
      >
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if tab === 'prototypes'}
      <p class="px-1 pb-2 text-[11px] leading-relaxed text-ink-400">
        The abstract kinds the extractor found. Prototype-based: a thing is classified by which prototype it resembles.
        Click to filter the graph.
      </p>
      {#if filterProto}
        <button onclick={() => onFilter(null)} class="mb-2 w-full rounded bg-accent-500/15 px-2 py-1 text-left text-xs text-accent-400">
          ✕ clear filter: {filterProto}
        </button>
      {/if}
      <ul class="space-y-0.5">
        {#each graph.prototypes.filter((p) => p.count > 0) as p (p.id)}
          <li>
            <button
              onclick={() => onFilter(filterProto === p.name ? null : p.name)}
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-ink-800 {filterProto === p.name ? 'bg-ink-800' : ''}"
            >
              <span class="h-3 w-3 shrink-0 rounded-full" style="background:{col(p.name)}"></span>
              <span class="flex-1 truncate text-sm text-ink-200">{p.name}</span>
              {#if p.of.length}<span class="truncate text-[10px] text-ink-400">is-a {p.of.join(', ')}</span>{/if}
              <span class="shrink-0 rounded bg-ink-800 px-1.5 text-xs text-ink-300">{p.count}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if tab === 'components'}
      <p class="px-1 pb-2 text-[11px] leading-relaxed text-ink-400">
        The reusable trait buckets entities are decorated with. In ECS you can read an entity's kind off the
        components it carries — a thing with a <code>relation</code> component is an edge; with
        <code>location</code>, it's mappable.
      </p>
      <ul class="space-y-0.5">
        {#each graph.components as c (c.name)}
          <li class="flex items-center gap-2 rounded px-2 py-1.5">
            <span class="font-mono text-sm text-accent-400">{c.name}</span>
            <span class="flex-1 border-b border-dashed border-ink-800"></span>
            <span class="text-xs text-ink-400">on {c.count} entities</span>
          </li>
        {/each}
      </ul>
    {:else}
      <input
        bind:value={q}
        placeholder="filter entities…"
        class="mb-2 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
      />
      <ul class="space-y-0.5">
        {#each filteredEntities as n (n.id)}
          <li>
            <button
              onclick={() => onSelect(n)}
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-ink-800 {selected?.id === n.id ? 'bg-ink-800' : ''}"
            >
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{col(n.prototypes[0])}"></span>
              <span class="flex-1 truncate text-sm text-ink-200">{n.name}</span>
              {#if n.location?.lat}<span class="shrink-0 text-[10px] text-ink-500">◍</span>{/if}
              <span class="shrink-0 text-[10px] text-ink-500">{n.degree}▸</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
