<script lang="ts">
  import type { DateFilter, Priority } from "src/_types"
  import Icon from "./Icon.svelte"
  import { clickOutside } from "./clickOutside.directive"

  export let todoTags: string[]
  export let priorities: Priority[]
  export let hiddenTags: string[]
  export let hiddenPriorities: Priority[]
  export let ignoredFilePaths: string[]
  export let checklistFilePaths: string[]
  export let excludedFolderPaths: string[]
  export let disableSearch: boolean
  export let showOpenTableButton: boolean = false
  export let todoCount: number = 0
  export let priorityCounts: Array<{ priority: Priority; count: number }> = []
  export let selectedPriorities: Priority[] = []
  export let totalTodoCount: number = 0
  export let dateFilter: DateFilter = "last14"
  export let usedTagCounts: Array<{ tag: string; count: number }> = []
  export let selectedUsedTag: string = ""
  export let onTagStatusChange: (tag: string, status: boolean) => void
  export let onPriorityStatusChange: (priority: Priority, status: boolean) => void
  export let onPriorityFilterChange: (priority: Priority | "") => void
  export let onPriorityRangeChange: (priorities: Priority[]) => void
  export let onDateFilterChange: (filter: DateFilter) => void
  export let onUsedTagFilterChange: (tag: string) => void
  export let onOpenTableView: () => void
  export let onToggleGroupByDay: () => void
  export let onCreateTodo: () => void
  export let onFullReload: () => void
  export let showGroupByDayButton: boolean = false
  export let groupByDay: boolean = false
  export let onNoteVisibilityChange: (path: string, visible: boolean) => void
  export let onIgnoredFileToggle: (path: string) => void
  export let onExcludedFolderToggle: (path: string) => void
  export let onSearch: (str: string) => void

  let showPopover = false
  let search = ""
  let priorityPointerDown = false
  let priorityPointerMoved = false
  let priorityDragStart = -1
  let priorityDragEnd = -1
  let suppressPriorityClick = false
  const priorityOrder: Priority[] = ["highest", "high", "medium", "none", "low", "lowest"]
  const dateFilters: Array<{ value: DateFilter; label: string }> = [
    { value: "today", label: "Today" },
    { value: "last7", label: "1 week" },
    { value: "last14", label: "2 weeks" },
    { value: "last30", label: "30 days" },
    { value: "last60", label: "60 days" },
    { value: "all", label: "All" },
  ]
  const priorityLabel = (priority: Priority) => {
    if (priority === "highest") return "🔺 Highest"
    if (priority === "high") return "⏫ High"
    if (priority === "medium") return "🔼 Medium"
    if (priority === "low") return "🔽 Low"
    if (priority === "lowest") return "⏬ Lowest"
    return "None"
  }
  const priorityBadgeLabel = (priority: Priority) => {
    if (priority === "highest") return "🔺"
    if (priority === "high") return "⏫"
    if (priority === "medium") return "🔼"
    if (priority === "low") return "🔽"
    if (priority === "lowest") return "⏬"
    return "⬜"
  }

  const priorityTint = (priority: Priority) => {
    if (priority === "highest") return "rgba(255, 214, 214, 0.55)"
    if (priority === "high") return "rgba(255, 232, 214, 0.5)"
    if (priority === "medium") return "rgba(243, 245, 210, 0.45)"
    if (priority === "none") return "transparent"
    if (priority === "low") return "rgba(221, 245, 226, 0.5)"
    return "rgba(214, 246, 241, 0.46)"
  }

  const displayTag = (tag: string) => tag.replace(/^#/, "")

  const tagEmoji = (tag: string) => {
    const value = displayTag(tag).toLowerCase()
    const rules: Array<{ match: RegExp; emoji: string }> = [
      { match: /(shopping|buy|purchase)/, emoji: "🛒" },
      { match: /drip/, emoji: "🧥" },
      { match: /(books|reading)/, emoji: "📖" },
      { match: /dj/, emoji: "👨🏻‍🎤" },
      { match: /production/, emoji: "🎧" },
      { match: /visuals/, emoji: "🖼️" },
      { match: /(music|release)/, emoji: "🎵" },
      { match: /travel/, emoji: "🗺️" },
      { match: /living-location/, emoji: "🏠" },
      { match: /career/, emoji: "💼" },
      { match: /(business|entrepreneurship|project)/, emoji: "🛠️" },
      { match: /finance/, emoji: "💰" },
      { match: /marketing/, emoji: "📈" },
      { match: /(fitness|health)/, emoji: "💪" },
      { match: /(dating|girls)/, emoji: "👱🏻‍♀️" },
      { match: /(art|creative)/, emoji: "🎨" },
      { match: /(mindset|philosophy|religion|politics)/, emoji: "🧠" },
      { match: /\blife\b/, emoji: "⭐" },
      { match: /(alert|warning|pay attention)/, emoji: "🚨" },
      { match: /asia/, emoji: "🇭🇰🇸🇬🇹🇼🇹🇭🐉🗾🧧" },
      { match: /(definition|what)/, emoji: "❓" },
      { match: /\bwhy\b/, emoji: "🤷" },
      { match: /shipping/, emoji: "🚢" },
      { match: /(socialising|networking|meeting people)/, emoji: "🗣️" },
      { match: /(coding|backend)/, emoji: "📟" },
      { match: /(in progress|progress)/, emoji: "🚧" },
      { match: /projects in progress/, emoji: "📂" },
      { match: /(occult|magic|spells|affirmations)/, emoji: "🔮" },
      { match: /(dress|form)/, emoji: "🧥" },
      { match: /family/, emoji: "🏡" },
      { match: /(goal|target|objective)/, emoji: "🎯" },
      { match: /(next up|future|deferred)/, emoji: "🔜" },
      { match: /(learning|growth)/, emoji: "🌱" },
    ]
    return rules.find((rule) => rule.match.test(value))?.emoji ?? ""
  }

  const rangeFromIndexes = (start: number, end: number) => {
    const low = Math.min(start, end)
    const high = Math.max(start, end)
    return priorityOrder.slice(low, high + 1)
  }

  const selectedPriorityIndexes = () =>
    selectedPriorities
      .map((priority) => priorityOrder.indexOf(priority))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)

  const isPriorityRangeStart = (index: number) => {
    const indexes = selectedPriorityIndexes()
    return indexes.length > 1 && index === indexes[0]
  }

  const isPriorityRangeEnd = (index: number) => {
    const indexes = selectedPriorityIndexes()
    return indexes.length > 1 && index === indexes[indexes.length - 1]
  }

  const isPriorityRangeMiddle = (index: number) => {
    const indexes = selectedPriorityIndexes()
    return indexes.length > 1 && index > indexes[0] && index < indexes[indexes.length - 1]
  }

  const isPrioritySingle = (index: number) => selectedPriorities.length === 1 && selectedPriorityIndexes()[0] === index

  const startPriorityDrag = (index: number) => {
    priorityPointerDown = true
    priorityPointerMoved = false
    priorityDragStart = index
    priorityDragEnd = index
    suppressPriorityClick = false
    onPriorityRangeChange(rangeFromIndexes(index, index))
  }

  const extendPriorityDrag = (index: number) => {
    if (!priorityPointerDown) return
    if (priorityDragEnd === index) return
    priorityPointerMoved = true
    priorityDragEnd = index
    suppressPriorityClick = true
    onPriorityRangeChange(rangeFromIndexes(priorityDragStart, priorityDragEnd))
  }

  const finishPriorityDrag = () => {
    if (!priorityPointerDown) return
    priorityPointerDown = false
    suppressPriorityClick = priorityPointerMoved
    priorityPointerMoved = false
  }

  const handlePriorityClick = (priority: Priority) => {
    if (suppressPriorityClick) {
      suppressPriorityClick = false
      return
    }
    onPriorityFilterChange(priority)
  }
</script>

<div class="container">
  <div class="search-wrap">
    <input
      disabled={disableSearch && !search}
      class="search"
      placeholder="Search tasks"
      bind:value={search}
      on:input={() => onSearch(search)}
    />
    {#if search}
      <button
        class="search-clear"
        title="Clear search"
        on:click={() => {
          search = ""
          onSearch(search)
        }}
      >
        ×
      </button>
    {/if}
  </div>
  <div class="date-tabs" role="tablist" aria-label="Date filter">
    {#each dateFilters as filter}
      <button
        class:active={dateFilter === filter.value}
        role="tab"
        aria-selected={dateFilter === filter.value}
        on:click={() => onDateFilterChange(filter.value)}
      >
        {filter.label}
      </button>
    {/each}
  </div>
  <div class="toolbar-actions">
    <div class="tag-filter-wrap" title="Filter by hashtag">
      <button
        class:active={!selectedUsedTag}
        class="tag-filter-clear"
        on:click={() => onUsedTagFilterChange("")}
      >
        All tags
      </button>
      <div class="tag-filter-list">
        {#each usedTagCounts as item}
          <button
            class:active={selectedUsedTag === item.tag}
            class="tag-filter-chip"
            on:click={() => onUsedTagFilterChange(selectedUsedTag === item.tag ? "" : item.tag)}
          >
            {#if tagEmoji(item.tag)}
              <span class="tag-prefix">{tagEmoji(item.tag)}</span>
            {/if}
            <span class="tag-badge">{displayTag(item.tag)}</span>
            <span class="tag-count">{item.count}</span>
          </button>
        {/each}
        <button
          class:visible={!!selectedUsedTag}
          class="tag-filter-clear-end"
          aria-label="Clear tag filter"
          title="Clear tag filter"
          on:click={() => onUsedTagFilterChange("")}
        >
          ×
        </button>
      </div>
    </div>
    <div class="priority-counts" title="Visible todos by priority">
      {#each priorityCounts as item, index}
        <button
          class:active={selectedPriorities.includes(item.priority)}
          class:selected-single={isPrioritySingle(index)}
          class:selected-range-start={isPriorityRangeStart(index)}
          class:selected-range-middle={isPriorityRangeMiddle(index)}
          class:selected-range-end={isPriorityRangeEnd(index)}
          style={`--priority-chip-bg:${priorityTint(item.priority)}`}
          on:pointerdown={() => startPriorityDrag(index)}
          on:pointerenter={() => extendPriorityDrag(index)}
          on:pointerup={finishPriorityDrag}
          on:pointercancel={finishPriorityDrag}
          on:click={() => handlePriorityClick(item.priority)}
        >
          {priorityBadgeLabel(item.priority)} {item.count}
        </button>
      {/each}
      {#if selectedPriorities.length}
        <button class="priority-clear" title="Clear priority filter" aria-label="Clear priority filter" on:click={() => onPriorityFilterChange("")}>
          ×
        </button>
      {/if}
      <span class="total-count">
        ({todoCount} of {totalTodoCount} total)
      </span>
    </div>
    {#if showOpenTableButton}
      <button class="mode-toggle" on:click={onOpenTableView}>Table</button>
    {/if}
    {#if showGroupByDayButton}
      <button
        class="mode-toggle icon-button"
        class:active={groupByDay}
        title="Group by day"
        aria-label="Group by day"
        on:click={onToggleGroupByDay}
      >
        <Icon name="calendar" style="button" />
      </button>
    {/if}
    <button class="mode-toggle icon-button" title="Create todo" aria-label="Create todo" on:click={onCreateTodo}>
      <Icon name="plus" style="button" />
    </button>
    <button class="mode-toggle icon-button" title="Full reload" aria-label="Full reload" on:click={onFullReload}>
      <Icon name="refresh" style="button" />
    </button>
    <div class="settings-container">
      <Icon
        name="settings"
        style="button"
        on:click={(ev) => {
          showPopover = !showPopover
        }}
      />
      {#if showPopover}
        <div
          use:clickOutside
          on:click_outside={(ev) => {
            showPopover = false
          }}
          class="popover"
        >
        <section>
          <div class="section-title">Show Tags?</div>
          {#each todoTags as tag}
            <div class="checkbox-item">
              <label
                ><input
                  type="checkbox"
                  checked={!hiddenTags.includes(tag)}
                  on:click|preventDefault={(ev) => onTagStatusChange(tag, hiddenTags.includes(tag))}
                /><span class="hash">#</span>{tag}</label
              >
            </div>
          {/each}
          {#if todoTags.length === 0}
            <div class="empty">No tags specified</div>
          {/if}
        </section>
        <section>
          <div class="section-title">Show Priorities?</div>
          {#each priorities as priority}
            <div class="checkbox-item">
              <label
                ><input
                  type="checkbox"
                  checked={!hiddenPriorities.includes(priority)}
                  on:click|preventDefault={() => onPriorityStatusChange(priority, hiddenPriorities.includes(priority))}
                />{priorityLabel(priority)}</label
              >
            </div>
          {/each}
        </section>
        <section>
          <div class="section-title">Hidden checklist</div>
          {#if checklistFilePaths.length === 0}
            <div class="empty-list">No checklist notes</div>
          {:else}
            {#each checklistFilePaths as path}
              <div class="checkbox-item">
                <label
                  ><input
                    type="checkbox"
                    checked={!ignoredFilePaths.includes(path)}
                    on:click|preventDefault={() => onNoteVisibilityChange(path, ignoredFilePaths.includes(path))}
                  />{path}</label
                >
              </div>
            {/each}
          {/if}
        </section>
        <section>
          <div class="section-title">Ignored notes</div>
          {#if ignoredFilePaths.length === 0}
            <div class="empty-list">No ignored notes</div>
          {:else}
            {#each ignoredFilePaths as path}
              <div class="path-toggle-item">
                <span>{path}</span>
                <button on:click={() => onIgnoredFileToggle(path)}>Show</button>
              </div>
            {/each}
          {/if}
        </section>
        <section>
          <div class="section-title">Excluded folders</div>
          {#if excludedFolderPaths.length === 0}
            <div class="empty-list">No excluded folders</div>
          {:else}
            {#each excludedFolderPaths as path}
              <div class="path-toggle-item">
                <span>{path}</span>
                <button on:click={() => onExcludedFolderToggle(path)}>Show</button>
              </div>
            {/each}
          {/if}
        </section>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .empty {
    color: var(--text-faint);
    text-align: center;
    margin-top: 32px;
    font-style: italic;
  }

  .container {
    min-height: 57px;
    box-sizing: border-box;
    margin-bottom: 0;
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 15;
    background: var(--background-primary);
    padding: 6px 0 12px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .container::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--background-primary);
    z-index: -1;
  }

  .search {
    width: 100%;
    background: var(--checklist-searchBackground);
    border: none;
    font-size: var(--checklist-contentFontSize);
    border-radius: var(--checklist-listItemBorderRadius);
    padding: 0 30px 0 10px;
    color: var(--checklist-textColor);
    height: 38px;
  }
  .search-wrap {
    position: relative;
    flex: 0 1 190px;
    min-width: 170px;
  }

  .toolbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    flex: 0 0 auto;
  }

  .tag-filter-wrap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 30px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--checklist-listItemBorderRadius);
    background: var(--background-primary);
    flex: 1 1 560px;
    min-width: 560px;
    max-width: none;
    overflow-x: auto;
    white-space: nowrap;
  }

  .tag-filter-list {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-wrap: nowrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  .date-tabs {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--checklist-listItemBorderRadius);
    overflow: hidden;
    background: var(--background-primary);
  }

  .date-tabs > button {
    height: 24px;
    width: initial;
    padding: 0 8px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    white-space: nowrap;
    outline: none;
    font-size: 11px;
  }

  .date-tabs > button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .date-tabs > button:not(.active):hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    box-shadow: none;
    line-height: 1;
    font-size: 14px;
  }

  .search-clear:hover {
    background: var(--background-modifier-border-hover);
    color: var(--text-normal);
  }

  .settings-container {
    flex-shrink: 1;
    display: flex;
    align-items: center;
    position: relative;
  }

  .mode-toggle {
    height: 100%;
    width: initial;
    padding: 0 10px;
    outline: none;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .icon-button {
    width: 30px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    outline: none;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .priority-counts {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 0 8px;
    border-radius: var(--checklist-listItemBorderRadius);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .priority-counts > button {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    width: initial;
    height: 24px;
    padding: 0 5px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--priority-chip-bg, transparent);
    box-shadow: none;
    color: var(--text-muted);
    outline: none;
    margin-right: 6px;
  }

  .priority-counts > button:hover,
  .priority-counts > button.active {
    background: color-mix(
      in srgb,
      var(--priority-chip-bg, var(--background-secondary)) 72%,
      var(--background-secondary) 28%
    );
    border-color: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .priority-counts > button.selected-single {
    border-color: var(--background-modifier-border);
    box-shadow: 0 0 0 1px var(--background-modifier-border);
    border-radius: 999px;
  }

  .priority-counts > button.selected-range-start {
    border-color: var(--background-modifier-border);
    border-radius: 999px 0 0 999px;
    border-right-color: transparent;
    box-shadow: 0 0 0 1px var(--background-modifier-border);
    margin-right: 0;
  }

  .priority-counts > button.selected-range-middle {
    border-color: var(--background-modifier-border);
    border-radius: 0;
    border-left-color: transparent;
    border-right-color: transparent;
    box-shadow: none;
    margin-right: 0;
  }

  .priority-counts > button.selected-range-end {
    border-color: var(--background-modifier-border);
    border-radius: 0 999px 999px 0;
    border-left-color: transparent;
    box-shadow: 0 0 0 1px var(--background-modifier-border);
    margin-right: 6px;
  }

  .priority-clear {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    box-shadow: none;
    line-height: 1;
    font-size: 14px;
    outline: none;
  }

  .priority-clear:hover {
    background: var(--background-modifier-border-hover);
    color: var(--text-normal);
  }

  .tag-filter-clear,
  .tag-filter-chip {
    width: initial;
    height: 22px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    font-size: 12px;
    flex: 0 0 auto;
    outline: none;
  }

  .tag-filter-clear:hover,
  .tag-filter-chip:hover,
  .tag-filter-chip.active,
  .tag-filter-clear.active {
    background: var(--background-secondary);
    border-color: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .tag-filter-chip {
    padding-left: 6px;
    padding-right: 7px;
    gap: 2px;
  }

  .tag-badge {
    color: var(--tag-color, var(--text-accent));
    font-weight: 600;
  }

  .tag-prefix {
    color: var(--text-muted);
    flex: 0 0 auto;
  }

  .tag-filter-chip .tag-count {
    color: var(--text-faint);
    margin-left: 0;
    min-width: 18px;
    height: 16px;
    padding: 0 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--background-secondary);
  }

  .tag-filter-clear-end {
    width: 16px;
    height: 16px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-faint);
    font-size: 13px;
    line-height: 1;
    flex: 0 0 auto;
    visibility: hidden;
    pointer-events: none;
  }

  .tag-filter-clear-end.visible {
    visibility: visible;
    pointer-events: auto;
  }

  .tag-filter-clear-end:hover {
    color: var(--text-normal);
  }

  .container :focus,
  .container :focus-visible {
    outline: none;
    box-shadow: none;
  }

  .total-count {
    color: var(--text-faint);
  }

  .popover {
    position: absolute;
    top: 44px;
    right: 0px;
    width: 300px;
    padding: 12px;
    border-radius: var(--checklist-listItemBorderRadius);
    background: var(--checklist-searchBackground);
    box-shadow: 0 2px 4px var(--background-modifier-cover);
    z-index: 10;
  }

  .section-title {
    font-weight: bold;
    margin-bottom: 8px;
  }

  section {
    margin-bottom: 24px;
  }

  .checkbox-item label {
    gap: 4px;
    display: flex;
    align-items: center;
    height: 28px;
  }

  .path-toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .path-toggle-item > span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path-toggle-item > button {
    width: initial;
    padding: 0 8px;
  }

  .empty-list {
    color: var(--text-faint);
    font-size: 12px;
  }

  .hash {
    color: var(--checklist-tagBaseColor);
  }
</style>
