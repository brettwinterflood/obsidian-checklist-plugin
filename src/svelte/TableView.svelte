<script lang="ts">
  import type { App } from "obsidian"
  import type { Priority, TodoItem } from "src/_types"
  import { navToFile } from "src/utils"

  export let app: App
  export let items: TodoItem[] = []
  export let onPriorityChange: (item: TodoItem, priority: Priority) => Promise<void>
  export let onToggleChecked: (item: TodoItem) => Promise<void>
  export let onHideFile: (path: string) => Promise<void>
  export let onHideFolder: (path: string) => Promise<void>
  export let onHideTodo: (item: TodoItem) => Promise<void>
  export let onMoveToToday: (item: TodoItem) => Promise<void>
  let groupByDay = false
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
    navToFile(app, item.filePath, ev, item.line)
  }

  const priorityRank: Record<Priority, number> = {
    highest: 0,
    high: 1,
    medium: 2,
    none: 3,
    low: 4,
    lowest: 5,
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
    return sortDirection === "asc" ? "▲" : "▼"
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

  const rowId = (item: TodoItem) => `${item.filePath}:${item.line}`
  const folderPathFor = (item: TodoItem) =>
    item.filePath.includes("/") ? item.filePath.slice(0, item.filePath.lastIndexOf("/")) : ""
</script>

<div class="table-controls">
  <button class:active={groupByDay} on:click={() => (groupByDay = !groupByDay)}>
    Group by day
  </button>
</div>

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
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each sortedItems as item, index (rowId(item))}
      {#if groupByDay && (index === 0 || formatDate(sortedItems[index - 1].displayDateTs) !== formatDate(item.displayDateTs))}
        <tr class="day-group-row">
          <td colspan="5">{formatDate(item.displayDateTs)}</td>
        </tr>
      {/if}
      <tr>
        <td>
          <div class="todo-content" on:click={(ev) => handleTodoClick(ev, item)}>{@html item.rawHTML}</div>
        </td>
        <td>
          <button class="note-link" on:click={(ev) => navToFile(app, item.filePath, ev, item.line)}>{item.fileLabel}</button>
        </td>
        <td>{formatDate(item.displayDateTs)}</td>
        <td>{daysAgo(item.displayDateTs)}</td>
        <td>
          <div class="hide-cell-actions">
            <div class="hide-menu-wrap">
	              <button class="hide-action" title="Actions" aria-haspopup="true">
	                Actions
	              </button>
	              <div class="hide-menu">
	                <div class="priority-actions" aria-label="Set priority">
	                  {#each priorityActionOptions as option}
	                    <button
	                      class:active={item.priority === option.value}
	                      title={`Set priority ${option.value}`}
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
	                  Convert to bullet point
	                </button>
                <button on:click={() => onHideFile(item.filePath)}>
                  Hide note
                </button>
                <button
                  disabled={!folderPathFor(item)}
                  on:click={() => {
                    const folder = folderPathFor(item)
                    if (folder) onHideFolder(folder)
                  }}
                >
                  Hide folder: {folderPathFor(item) || "(vault root)"}
                </button>
              </div>
            </div>
            <input
              class="hide-column-checkbox"
              type="checkbox"
              title="Complete todo"
              checked={item.checked}
              on:change={() => onToggleChecked(item)}
            />
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

  .table-controls {
    display: flex;
    justify-content: flex-end;
    margin: 8px 0;
  }

  .table-controls > button {
    width: initial;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--checklist-listItemBorderRadius);
    background: var(--background-primary);
    box-shadow: none;
    color: var(--text-muted);
  }

  .table-controls > button.active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  th,
  td {
    padding: 6px;
    text-align: left;
    border-bottom: 1px solid var(--background-modifier-border);
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
    background: var(--background-secondary);
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

  .todo-table th:nth-child(1),
  .todo-table td:nth-child(1) {
    width: 52%;
  }

  .todo-table th:nth-child(2),
  .todo-table td:nth-child(2) {
    width: 22%;
  }

  .todo-table th:nth-child(3),
  .todo-table td:nth-child(3) {
    width: 110px;
  }

  .todo-table th:nth-child(4),
  .todo-table td:nth-child(4) {
    width: 78px;
  }

  .todo-table th:nth-child(5),
  .todo-table td:nth-child(5) {
    width: 148px;
  }

  .todo-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .todo-table td:nth-child(5) {
    overflow: visible;
  }

  .hide-cell-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .hide-column-checkbox {
    flex: 0 0 auto;
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

  .todo-content {
    width: 100%;
    min-width: 0;
    border: 1px solid transparent;
    background: var(--background-primary);
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

  .hide-menu-wrap {
    position: relative;
    display: inline-flex;
    padding-bottom: 4px;
  }

  .hide-action {
    min-width: 58px;
    height: 28px;
    padding: 0 10px;
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
    right: 0;
    top: 30px;
    z-index: 100;
    min-width: 220px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    display: none;
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
	    background: transparent;
	    box-shadow: none;
	    font-size: 13px;
	  }

	  .priority-actions > button:hover,
	  .priority-actions > button.active {
	    background: var(--background-secondary);
	    border-color: var(--background-modifier-border);
	  }
</style>
