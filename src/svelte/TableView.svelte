<script lang="ts">
  import type { App } from "obsidian"
  import type { Priority, TodoItem } from "src/_types"
  import { navToFile } from "src/utils"

  export let app: App
  export let items: TodoItem[] = []
  export let onPriorityChange: (item: TodoItem, priority: Priority) => Promise<void>
  export let onTextChange: (item: TodoItem, text: string) => Promise<void>
  export let onToggleChecked: (item: TodoItem) => Promise<void>
  export let onHideFile: (path: string) => Promise<void>
  export let onHideFolder: (path: string) => Promise<void>
  export let onHideTodo: (item: TodoItem) => Promise<void>

  const priorityOptions: Array<{ value: Priority; label: string }> = [
    { value: "highest", label: "🔺" },
    { value: "high", label: "⏫" },
    { value: "medium", label: "🔼" },
    { value: "none", label: "-" },
    { value: "low", label: "🔽" },
    { value: "lowest", label: "⏬" },
  ]

  const handlePriorityChange = async (item: TodoItem, event: Event) => {
    const target = event.currentTarget as HTMLSelectElement
    const priority = target.value as Priority
    window.setTimeout(() => {
      onPriorityChange(item, priority)
    }, 0)
  }

  const handleTextSave = async (item: TodoItem, event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    await onTextChange(item, target.value)
  }

  const priorityRank: Record<Priority, number> = {
    highest: 0,
    high: 1,
    medium: 2,
    none: 3,
    low: 4,
    lowest: 5,
  }

  const formatDate = (ts: number) => new Date(ts).toISOString().slice(0, 10)

  $: sortedItems = [...items].sort((a, b) => {
    const rankDiff = priorityRank[a.priority] - priorityRank[b.priority]
    if (rankDiff !== 0) return rankDiff
    return b.fileModifiedTs - a.fileModifiedTs
  })

  const rowId = (item: TodoItem) => `${item.filePath}:${item.line}`
  const folderPathFor = (item: TodoItem) =>
    item.filePath.includes("/") ? item.filePath.slice(0, item.filePath.lastIndexOf("/")) : ""
</script>

<table class="todo-table">
  <thead>
    <tr>
      <th>Priority</th>
      <th>TODO</th>
      <th>Status</th>
      <th>Note</th>
      <th>Tag</th>
      <th>Date</th>
      <th>Hide</th>
    </tr>
  </thead>
  <tbody>
    {#each sortedItems as item (rowId(item))}
      <tr>
        <td>
          <select value={item.priority} on:change={(ev) => handlePriorityChange(item, ev)}>
            {#each priorityOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </td>
        <td>
          <input class="todo-input" type="text" value={item.todoText} on:change={(ev) => handleTextSave(item, ev)} />
        </td>
        <td>
          <input type="checkbox" checked={item.checked} on:change={() => onToggleChecked(item)} />
        </td>
        <td>
          <button class="note-link" on:click={(ev) => navToFile(app, item.filePath, ev, item.line)}>{item.fileLabel}</button>
        </td>
        <td>{item.mainTag ? `#${item.mainTag}${item.subTag ? `/${item.subTag}` : ""}` : "-"}</td>
        <td>{formatDate(item.fileModifiedTs)}</td>
        <td>
          <div class="hide-cell-actions">
            <div class="hide-menu-wrap">
              <button class="hide-action" title="Hide options" aria-haspopup="true">
                Hide
              </button>
              <div class="hide-menu">
                <button on:click={() => onHideTodo(item)}>
                  Hide todo
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

  .todo-table tbody tr:hover td {
    background: var(--background-secondary);
  }

  .todo-table th:nth-child(1),
  .todo-table td:nth-child(1) {
    width: 92px;
  }

  .todo-table th:nth-child(2),
  .todo-table td:nth-child(2) {
    width: 50%;
  }

  .todo-table th:nth-child(3),
  .todo-table td:nth-child(3) {
    width: 64px;
  }

  .todo-table th:nth-child(4),
  .todo-table td:nth-child(4) {
    width: 20%;
  }

  .todo-table th:nth-child(5),
  .todo-table td:nth-child(5) {
    width: 15%;
  }

  .todo-table th:nth-child(6),
  .todo-table td:nth-child(6) {
    width: 110px;
  }

  .todo-table th:nth-child(7),
  .todo-table td:nth-child(7) {
    width: 128px;
  }

  .todo-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .todo-table td:nth-child(7) {
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

  .todo-input {
    width: 100%;
    min-width: 0;
    border: 1px solid transparent;
    background: var(--background-primary);
    border-radius: 6px;
    padding: 4px 6px;
    color: var(--text-normal);
  }

  select {
    width: 80px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--background-primary);
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .todo-input:hover,
  .todo-input:focus,
  select:hover,
  select:focus {
    border-color: var(--background-modifier-border);
    outline: none;
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
</style>
