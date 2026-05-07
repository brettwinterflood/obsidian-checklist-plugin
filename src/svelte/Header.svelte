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
  export let noteCount: number = 0
  export let todoCount: number = 0
  export let dateFilter: DateFilter = "all"
  export let onTagStatusChange: (tag: string, status: boolean) => void
  export let onPriorityStatusChange: (priority: Priority, status: boolean) => void
  export let onDateFilterChange: (filter: DateFilter) => void
  export let onOpenTableView: () => void
  export let onNoteVisibilityChange: (path: string, visible: boolean) => void
  export let onIgnoredFileToggle: (path: string) => void
  export let onExcludedFolderToggle: (path: string) => void
  export let onSearch: (str: string) => void

  let showPopover = false
  let search = ""
  const priorityLabel = (priority: Priority) => {
    if (priority === "highest") return "🔺 Highest"
    if (priority === "high") return "⏫ High"
    if (priority === "medium") return "🔼 Medium"
    if (priority === "low") return "🔽 Low"
    if (priority === "lowest") return "⏬ Lowest"
    return "None"
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
    <button
      class:active={dateFilter === "last60"}
      role="tab"
      aria-selected={dateFilter === "last60"}
      on:click={() => onDateFilterChange("last60")}
    >
      Last 60 days
    </button>
    <button
      class:active={dateFilter === "all"}
      role="tab"
      aria-selected={dateFilter === "all"}
      on:click={() => onDateFilterChange("all")}
    >
      All
    </button>
  </div>
  <div class="toolbar-actions">
    <div class="count-pill" title="Visible notes and todos">Notes: {noteCount} · Todos: {todoCount}</div>
    {#if showOpenTableButton}
      <button class="mode-toggle" on:click={onOpenTableView}>Table</button>
    {/if}
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
    flex: 0 1 380px;
    min-width: 220px;
  }

  .toolbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
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
    height: 30px;
    width: initial;
    padding: 0 10px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    white-space: nowrap;
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


  .search:focus {
    box-shadow: 0 0 0 2px var(--checklist-accentColor);
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
  }

  .count-pill {
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    border-radius: var(--checklist-listItemBorderRadius);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
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
