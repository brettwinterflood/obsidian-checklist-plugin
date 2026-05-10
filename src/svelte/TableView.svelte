<script lang="ts">
  import type { App } from "obsidian"
  import type { DateFilter, Priority, TodoItem } from "src/_types"
  import { displayTag, tagEmojiFor } from "src/utils/helpers"
  import { navToFile } from "src/utils"
  import Icon from "./Icon.svelte"

  export let app: App
  export let items: TodoItem[] = []
  export let todoTags: string[] = []
  export let dateFilter: DateFilter = "last14"
  export let priorityRowTint: boolean = true
  export let colorDurationBars: boolean = false
  export let groupByDay: boolean = false
  export let onPriorityChange: (item: TodoItem, priority: Priority) => Promise<void>
  export let onTextChange: (item: TodoItem, text: string) => Promise<void>
  export let onToggleChecked: (item: TodoItem) => Promise<void>
  export let onAddTag: (item: TodoItem, tag: string) => Promise<void>
  export let onHideFile: (path: string) => Promise<void>
  export let onHideFolder: (path: string) => Promise<void>
  export let onHideTodo: (item: TodoItem) => Promise<void>
  export let onMoveToToday: (item: TodoItem) => Promise<void>
  let editingRowId: string | null = null
  let editingValue = ""
  let sortColumn: "date" | "daysAgo" | "" = ""
  let sortDirection: "asc" | "desc" | "" = ""

  const priorityOptions: Array<{ value: Priority; label: string }> = [
    { value: "highest", label: "🔺" },
    { value: "high", label: "⏫" },
    { value: "medium", label: "🔼" },
    { value: "none", label: "⬜" },
    { value: "low", label: "🔽" },
    { value: "lowest", label: "⏬" },
  ]
  const priorityActionOptions = [...priorityOptions].reverse()
  const visibleTodoTags = todoTags.filter((tag) => tag && tag.trim())

  const handleTodoClick = (ev: MouseEvent, item: TodoItem) => {
    const target = ev.target as HTMLElement
    if (target.tagName === "A") {
      ev.stopPropagation()
      if (target.dataset.type === "link") {
        navToFile(app, target.dataset.filepath, ev, item.line)
      } else if (target.dataset.type === "tag") {
        // noop
      }
      return
    }
    startEditing(item)
  }

  const rowId = (item: TodoItem) => `${item.filePath}:${item.line}`

  const startEditing = (item: TodoItem) => {
    editingRowId = rowId(item)
    editingValue = item.todoText
  }

  const cancelEditing = () => {
    editingRowId = null
    editingValue = ""
  }

  const saveEditing = async (item: TodoItem) => {
    const nextValue = editingValue.trim()
    if (!nextValue) return
    if (nextValue !== item.todoText) {
      await onTextChange(item, nextValue)
    }
    cancelEditing()
  }

  const priorityRank: Record<Priority, number> = {
    highest: 0,
    high: 1,
    medium: 2,
    none: 3,
    low: 4,
    lowest: 5,
  }

  const priorityTint = (priority: Priority) => {
    if (!priorityRowTint) return "transparent"
    if (priority === "highest") return "rgba(255, 214, 214, 0.34)"
    if (priority === "high") return "rgba(255, 232, 214, 0.28)"
    if (priority === "medium") return "rgba(243, 245, 210, 0.24)"
    if (priority === "none") return "transparent"
    if (priority === "low") return "rgba(221, 245, 226, 0.26)"
    return "rgba(214, 246, 241, 0.2)"
  }

  const formatDate = (ts: number) => {
    const date = new Date(ts)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const daysAgo = (ts: number) => {
    const itemDate = new Date(ts)
    itemDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((today.getTime() - itemDate.getTime()) / 86400000))
  }

  const dateFilterDays = () => {
    if (dateFilter === "today") return 1
    if (dateFilter === "last7") return 7
    if (dateFilter === "last14") return 14
    if (dateFilter === "last30") return 30
    if (dateFilter === "last60") return 60
    return Math.max(1, ...items.map((item) => daysAgo(item.displayDateTs)))
  }

  const ageBarWidth = (ts: number) => {
    const scale = dateFilterDays()
    return Math.max(2, Math.min(100, (daysAgo(ts) / scale) * 100))
  }

  const ageBarColor = (ts: number) => {
    const scale = dateFilterDays()
    const ratio = Math.max(0, Math.min(1, daysAgo(ts) / scale))
    if (!colorDurationBars) return `hsla(0, 0%, ${82 - ratio * 48}%, 0.8)`
    const hue = 120 - ratio * 120
    return `hsla(${hue}, 70%, 84%, 0.72)`
  }

  const ageBarLightness = (ts: number) => {
    const scale = dateFilterDays()
    const ratio = Math.max(0, Math.min(1, daysAgo(ts) / scale))
    return colorDurationBars ? 84 : 82 - ratio * 48
  }

  const ageBarTextColor = (ts: number) => {
    const lightness = Math.max(0, Math.min(100, ageBarLightness(ts)))
    return lightness > 62 ? "var(--text-normal)" : "var(--text-on-accent)"
  }

  const handleTagSelectChange = async (ev: Event, item: TodoItem) => {
    const target = ev.currentTarget as HTMLSelectElement
    const value = target.value
    target.value = ""
    if (!value) return
    await onAddTag(item, value)
  }

  const cycleSort = (column: "date" | "daysAgo") => {
    if (sortColumn !== column) {
      sortColumn = column
      sortDirection = "asc"
      return
    }
    if (sortDirection === "asc") {
      sortDirection = "desc"
      return
    }
    sortColumn = ""
    sortDirection = ""
  }

  const sortIcon = (column: "date" | "daysAgo") => {
    if (sortColumn !== column) return "⇅"
    return sortDirection === "asc" ? "⌃" : "⌄"
  }

  $: sortedItems = [...items].sort((a, b) => {
    if (sortColumn) {
      const aValue = sortColumn === "daysAgo" ? daysAgo(a.displayDateTs) : a.displayDateTs
      const bValue = sortColumn === "daysAgo" ? daysAgo(b.displayDateTs) : b.displayDateTs
      const diff = aValue - bValue
      if (diff !== 0) return sortDirection === "asc" ? diff : -diff
    }
    if (groupByDay) {
      const dateDiff = b.displayDateTs - a.displayDateTs
      if (dateDiff !== 0) return dateDiff
    }
    const rankDiff = priorityRank[a.priority] - priorityRank[b.priority]
    if (rankDiff !== 0) return rankDiff
    return b.displayDateTs - a.displayDateTs
  })

  const folderPathFor = (item: TodoItem) =>
    item.filePath.includes("/") ? item.filePath.slice(0, item.filePath.lastIndexOf("/")) : ""

  const noteTagsFor = (item: TodoItem) => {
    const tags = item.rawHTML.match(/#[\p{L}\p{N}_/-]+/gu) ?? []
    if (item.mainTag) tags.push(`#${item.mainTag}${item.subTag ? `/${item.subTag}` : ""}`)
    return Array.from(new Set(tags))
  }

  const noteTagLabel = (tag: string) => {
    const emoji = tagEmojiFor(tag)
    const text = displayTag(tag)
    return emoji ? `${emoji} ${text}` : text
  }
</script>

<table class="todo-table">
  <thead>
    <tr>
      <th>TODO</th>
      <th>Note</th>
      <th>
        <button
          class:active={sortColumn === "date"}
          class="sort-header"
          title="Sort by date"
          on:click={() => cycleSort("date")}
        >
          <span>Date</span><span class="sort-icon">{sortIcon("date")}</span>
        </button>
      </th>
      <th>
        <button
          class:active={sortColumn === "daysAgo"}
          class="sort-header"
          title="Sort by days ago"
          on:click={() => cycleSort("daysAgo")}
        >
          <span>Days ago</span><span class="sort-icon">{sortIcon("daysAgo")}</span>
        </button>
      </th>
      <th>Tags</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each sortedItems as item, index (rowId(item))}
      {#if groupByDay && (index === 0 || formatDate(sortedItems[index - 1].displayDateTs) !== formatDate(item.displayDateTs))}
        <tr class="day-group-row">
          <td colspan="6">{formatDate(item.displayDateTs)}</td>
        </tr>
      {/if}
      <tr style={`--priority-row-bg:${priorityTint(item.priority)}`}>
        <td>
          {#if editingRowId === rowId(item)}
            <div class="todo-editor">
              <input
                class="todo-edit-input"
                bind:value={editingValue}
                on:keydown={async (ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault()
                    await saveEditing(item)
                  }
                  if (ev.key === "Escape") {
                    ev.preventDefault()
                    cancelEditing()
                  }
                }}
              />
              <button class="todo-edit-save" on:click={() => saveEditing(item)}>Save</button>
              <button class="todo-edit-cancel" on:click={cancelEditing}>Cancel</button>
            </div>
          {:else}
            <div class="todo-content" on:click={(ev) => handleTodoClick(ev, item)}>
              {@html item.rawHTML}
              <button class="todo-edit-trigger" title="Edit todo" aria-label="Edit todo" on:click|stopPropagation={() => startEditing(item)}>
                ✎
              </button>
            </div>
          {/if}
        </td>
        <td>
          <button
            class="note-link"
            title={item.fileLabel}
            on:click={(ev) => navToFile(app, item.filePath, ev, item.line)}
          >
            {item.fileLabel}
          </button>
        </td>
        <td>{formatDate(item.displayDateTs)}</td>
        <td>
          <div class="days-ago-meter">
            <div
              class="days-ago-fill"
              style={`width:${ageBarWidth(item.displayDateTs)}%;background:${ageBarColor(item.displayDateTs)}`}
            />
            <span class="days-ago-value" style={`color:${ageBarTextColor(item.displayDateTs)}`}>
              {daysAgo(item.displayDateTs)}
            </span>
          </div>
        </td>
        <td>
          <div class="note-tags">
            {#each noteTagsFor(item) as tag}
              <span class="note-tag-chip">{noteTagLabel(tag)}</span>
            {/each}
          </div>
        </td>
        <td>
          <div class="hide-cell-actions">
            <div class="hide-menu-wrap">
	              <button class="hide-action" title="Actions" aria-haspopup="true">
	                Actions
	              </button>
	              <div class="hide-menu">
	                {#if visibleTodoTags.length}
	                  <select
	                    class="tag-action-select"
	                    value=""
	                    on:change={(ev) => handleTagSelectChange(ev, item)}
	                  >
	                    <option value="" disabled>Add tag</option>
	                    {#each visibleTodoTags as tag}
	                      <option value={tag}>#{tag}</option>
	                    {/each}
	                  </select>
	                {/if}
	                <div class="priority-actions" aria-label="Set priority">
	                  {#each priorityActionOptions as option}
	                    <button
	                      class:active={item.priority === option.value}
	                      title={`Set priority ${option.value}`}
	                      style={`--priority-chip-bg:${priorityTint(option.value)}`}
	                      on:click={() => onPriorityChange(item, option.value)}
	                    >
	                      {option.label}
	                    </button>
	                  {/each}
	                </div>
	                <button
	                  class="done-action"
	                  disabled={item.checked}
	                  on:click={() => {
	                    if (!item.checked) onToggleChecked(item)
	                  }}
	                >
	                  <span class="done-check">✅</span> Mark as done
	                </button>
	                <button on:click={() => onMoveToToday(item)}>
	                  📅 Move to today's note
	                </button>
	                <button on:click={() => onHideTodo(item)}>
	                  • Convert to bullet point
	                </button>
                <button on:click={() => onHideFile(item.filePath)}>
                  Hide note: <code>{item.fileLabel}</code>
                </button>
                <button
                  disabled={!folderPathFor(item)}
                  on:click={() => {
                    const folder = folderPathFor(item)
                    if (folder) onHideFolder(folder)
                  }}
                >
                  Hide folder: <code>{folderPathFor(item) || "(vault root)"}</code>
                </button>
              </div>
            </div>
            <button
              class:checked={item.checked}
              class="hide-column-checkbox"
              title="Complete todo"
              aria-label="Complete todo"
              on:click={() => onToggleChecked(item)}
            >
              ✅
            </button>
            <button
              class="hide-todo-icon"
              title="Convert to bullet point"
              aria-label="Convert to bullet point"
              on:click={() => onHideTodo(item)}
            >
              <Icon name="trash" style="button" />
            </button>
          </div>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .todo-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--checklist-contentFontSize);
    table-layout: fixed;
    margin-top: 0;
  }

  th,
  td {
    padding: 6px;
    text-align: left;
    vertical-align: middle;
  }

  .todo-table thead th {
    position: sticky;
    top: 57px;
    z-index: 12;
    background: var(--background-primary);
    min-height: 38px;
    padding-top: 10px;
    padding-bottom: 10px;
    line-height: 1.2;
    box-shadow: 0 1px 0 var(--background-modifier-border);
  }

  .todo-table thead th::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: -8px;
    height: 8px;
    background: var(--background-primary);
  }

  .sort-header {
    width: initial;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    color: inherit;
    font: inherit;
    text-align: left;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .sort-header:hover {
    color: var(--text-normal);
  }

  .sort-header.active {
    color: var(--text-normal);
  }

  .sort-icon {
    color: var(--text-faint);
    font-size: 13px;
    min-width: 14px;
    text-align: center;
  }

  .sort-header.active .sort-icon {
    color: var(--text-accent);
    font-weight: 700;
  }

  .todo-table tbody tr:hover td {
    background: color-mix(
      in srgb,
      var(--priority-row-bg, transparent) 72%,
      var(--background-secondary) 28%
    );
  }

  .todo-table tbody tr {
    position: relative;
  }

  .todo-table tbody tr:hover,
  .todo-table tbody tr:focus-within {
    z-index: 50;
  }

  .todo-table tbody tr.day-group-row td {
    background: var(--background-secondary);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0;
    padding: 8px 6px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .todo-table tbody tr.day-group-row:hover td {
    background: var(--background-secondary);
  }

  .todo-table tbody tr:not(.day-group-row) td {
    background: var(--priority-row-bg, transparent);
  }

  .todo-table th:nth-child(1),
  .todo-table td:nth-child(1) {
    width: 52%;
  }

  .todo-table th:nth-child(2),
  .todo-table td:nth-child(2) {
    width: 11%;
  }

  .todo-table th:nth-child(3),
  .todo-table td:nth-child(3) {
    width: 92px;
  }

  .todo-table th:nth-child(4),
  .todo-table td:nth-child(4) {
    width: 80px;
  }

  .todo-table th:nth-child(5),
  .todo-table td:nth-child(5) {
    width: 96px;
  }

  .todo-table th:nth-child(6),
  .todo-table td:nth-child(6) {
    width: 96px;
  }

  .todo-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .todo-table td:nth-child(5) {
    overflow: visible;
  }

  .todo-table td:nth-child(6) {
    overflow: visible;
    position: relative;
    z-index: 3;
  }

  .todo-table tbody tr:hover td:nth-child(6),
  .todo-table tbody tr:focus-within td:nth-child(6) {
    z-index: 60;
  }

  .hide-cell-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    width: max-content;
    max-width: 100%;
  }

  .hide-column-checkbox {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--success-color);
    font-size: 15px;
    line-height: 1;
    opacity: 0.55;
    outline: none;
  }

  .hide-column-checkbox.checked {
    opacity: 1;
  }

  .hide-todo-icon {
    width: 18px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    box-shadow: none;
    flex: 0 0 auto;
    outline: none;
  }

  .note-link {
    background: transparent;
    box-shadow: none;
    padding: 0;
    text-align: left;
    width: initial;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--link-color);
    text-decoration: underline;
  }

  .note-link:hover {
    overflow: visible;
    white-space: normal;
    position: relative;
    z-index: 2;
    background: var(--background-primary);
  }

  .note-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    min-width: 0;
  }

  .note-tag-chip {
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--background-secondary);
    color: var(--text-accent);
    font-size: 11px;
    white-space: nowrap;
  }

  .todo-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 4px 6px;
    color: var(--text-normal);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .todo-content:hover {
    border-color: var(--background-modifier-border);
  }

  :global(.todo-content p) {
    margin: 0;
  }

  :global(.todo-content a) {
    color: var(--link-color);
    text-decoration: underline;
  }

  .todo-edit-trigger {
    margin-left: auto;
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 6px;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
  }

  .todo-edit-trigger:hover {
    color: var(--text-normal);
  }

  .todo-editor {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 6px;
  }

  .todo-edit-input {
    flex: 1 1 auto;
    min-width: 0;
    border: none;
    background: transparent;
    border-radius: 0;
    padding: 0;
    color: var(--text-normal);
    box-shadow: none;
  }

  .todo-edit-save,
  .todo-edit-cancel {
    flex: 0 0 auto;
    width: initial;
    padding: 0 10px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: none;
  }

  .hide-menu-wrap {
    position: relative;
    display: inline-flex;
    padding-bottom: 4px;
    z-index: 4;
  }

  .hide-action {
    min-width: 46px;
    height: 28px;
    padding: 0 6px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: none;
    line-height: 1;
    justify-content: center;
  }

  .hide-action:hover {
    border-color: var(--text-muted);
    background: var(--background-primary-alt);
  }

  .hide-menu {
    position: absolute;
    left: 50%;
    top: 30px;
    transform: translateX(-50%);
    z-index: 1000;
    min-width: 196px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    display: none;
  }

  .tag-action-select {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-muted);
    box-shadow: none;
    outline: none;
    margin-bottom: 4px;
  }

  .hide-menu-wrap:hover .hide-menu,
  .hide-menu-wrap:focus-within .hide-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hide-menu > button {
    width: 100%;
    text-align: left;
    display: block;
    box-shadow: none;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 6px 8px;
  }

  .hide-menu > button:hover:not(:disabled) {
    background: var(--background-secondary);
    border-color: var(--background-modifier-border);
  }

	  .hide-menu > button:disabled {
	    opacity: 0.5;
	    cursor: not-allowed;
	  }

	  .done-action {
	    color: var(--text-normal);
	  }

	  .done-check {
	    color: var(--color-green);
	    margin-right: 6px;
	  }

	  .priority-actions {
	    display: flex;
	    flex-direction: row;
	    align-items: center;
	    gap: 2px;
	    padding: 2px 2px 6px;
	    margin-bottom: 4px;
	    border-bottom: 1px solid var(--background-modifier-border);
	  }

  .priority-actions > button {
    width: 28px;
    height: 28px;
    padding: 0;
    display: inline-flex;
	    align-items: center;
	    justify-content: center;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--priority-chip-bg, transparent);
    box-shadow: none;
    font-size: 13px;
  }

  .priority-actions > button:hover,
  .priority-actions > button.active {
    background: color-mix(
      in srgb,
      var(--priority-chip-bg, var(--background-secondary)) 72%,
      var(--background-secondary) 28%
    );
    border-color: var(--background-modifier-border);
  }

  .days-ago-meter {
    position: relative;
    min-height: 18px;
    width: 100%;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--background-secondary) 55%, transparent);
  }

  .days-ago-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    min-width: 2px;
  }

  .days-ago-value {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    padding: 0 6px;
    font-weight: 600;
    text-shadow: none;
  }
</style>
