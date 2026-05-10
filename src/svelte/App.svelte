<script lang="ts">
  import type { App } from "obsidian"
  import type { DateFilter, LookAndFeel, Priority, TodoGroup, TodoItem } from "src/_types"
  import type { TodoSettings } from "src/settings"
  import ChecklistGroup from "./ChecklistGroup.svelte"
  import Header from "./Header.svelte"
  import TableView from "./TableView.svelte"

  export let todoTags: string[]
  export let lookAndFeel: LookAndFeel
  export let _collapsedSections: string[]
  export let _hiddenTags: string[]
  export let hiddenPriorities: Priority[]
  export let dateFilter: DateFilter
  export let usedTagCounts: Array<{ tag: string; count: number }> = []
  export let selectedUsedTag: string
  export let selectedPriorities: Priority[]
  export let totalTodoCount: number
  export let priorityCounts: Array<{ priority: Priority; count: number }> = []
  export let priorityRowTint: boolean = true
  export let colorDurationBars: boolean = false
  export let pinnedFilePaths: string[]
  export let ignoredFilePaths: string[]
  export let excludedFolderPaths: string[]
  export let isTableView: boolean
  export let updateSetting: (updates: Partial<TodoSettings>) => Promise<void>
  export let onSearch: (str: string) => void
  export let onDateFilterChange: (filter: DateFilter) => void
  export let onUsedTagFilterChange: (tag: string) => void
  export let onPriorityFilterChange: (priority: Priority | "") => void
  export let onPriorityRangeChange: (priorities: Priority[]) => void
  export let onOpenTableView: () => void
  export let onToggleGroupByDay: () => void
  export let onCreateTodo: () => void
  export let onFullReload: () => void
  export let onHideFile: (path: string) => Promise<void>
  export let onHideFolder: (path: string) => Promise<void>
  export let onHideTodo: (item: TodoItem) => Promise<void>
  export let onMoveToToday: (item: TodoItem) => Promise<void>
  export let onTogglePin: (path: string) => Promise<void>
  export let onPriorityChange: (item: TodoItem, priority: Priority) => Promise<void>
  export let onTextChange: (item: TodoItem, text: string) => Promise<void>
  export let onToggleChecked: (item: TodoItem) => Promise<void>
  export let onAddTag: (item: TodoItem, tag: string) => Promise<void>
  export let isLoading: boolean
  export let app: App
  export let todoGroups: TodoGroup[] = []
  export let tableItems: TodoItem[] = []
  export let groupByDay: boolean = false

  const visibleTags = todoTags.filter((t) => !_hiddenTags.includes(t))

  const toggleGroup = (id: string) => {
    const newCollapsedSections = _collapsedSections.includes(id)
      ? _collapsedSections.filter((e) => e !== id)
      : [..._collapsedSections, id]
    updateSetting({ _collapsedSections: newCollapsedSections })
  }

  const updateTagStatus = (tag: string, status: boolean) => {
    const newHiddenTags = _hiddenTags.filter((t) => t !== tag)
    if (!status) newHiddenTags.push(tag)
    updateSetting({ _hiddenTags: newHiddenTags })
  }

  const priorities: Priority[] = ["highest", "high", "medium", "none", "low", "lowest"]

  const toggleGroupByDay = () => {
    groupByDay = !groupByDay
    onToggleGroupByDay()
  }

  const updatePriorityStatus = (priority: Priority, enabled: boolean) => {
    const newHidden = hiddenPriorities.filter((p) => p !== priority)
    if (!enabled) newHidden.push(priority)
    updateSetting({ _hiddenPriorities: newHidden })
  }

  const removeIgnored = (path: string) =>
    updateSetting({ ignoredFilePaths: ignoredFilePaths.filter((p) => p !== path) })

  const removeExcludedFolder = (path: string) =>
    updateSetting({ excludedFolderPaths: excludedFolderPaths.filter((p) => p !== path) })

  $: checklistFilePaths = Array.from(new Set(tableItems.map((item) => item.filePath))).sort((a, b) =>
    a.localeCompare(b),
  )
  $: visibleTodoCount = tableItems.length
  const updateNoteVisibility = (path: string, visible: boolean) => {
    const nextIgnored = ignoredFilePaths.filter((p) => p !== path)
    if (!visible) nextIgnored.push(path)
    updateSetting({ ignoredFilePaths: nextIgnored })
  }
</script>

<div class="checklist-plugin-main markdown-preview-view">
    <Header
      disableSearch={todoGroups.length === 0}
      todoCount={visibleTodoCount}
      {totalTodoCount}
      {priorityCounts}
      {selectedPriorities}
      {dateFilter}
      {usedTagCounts}
      {selectedUsedTag}
      {todoTags}
      hiddenTags={_hiddenTags}
      showOpenTableButton={!isTableView}
      showGroupByDayButton={isTableView}
      {groupByDay}
      {hiddenPriorities}
      {priorities}
      {ignoredFilePaths}
      {checklistFilePaths}
      {excludedFolderPaths}
      onTagStatusChange={updateTagStatus}
      onPriorityStatusChange={updatePriorityStatus}
      onPriorityFilterChange={onPriorityFilterChange}
      onPriorityRangeChange={onPriorityRangeChange}
      onDateFilterChange={onDateFilterChange}
      onUsedTagFilterChange={onUsedTagFilterChange}
      {onOpenTableView}
      onToggleGroupByDay={toggleGroupByDay}
      {onCreateTodo}
      {onFullReload}
      onNoteVisibilityChange={updateNoteVisibility}
      onIgnoredFileToggle={removeIgnored}
      onExcludedFolderToggle={removeExcludedFolder}
      {onSearch}
    />
    {#if isLoading}
      <div class="loading-wrap">
        <div class="spinner" />
      </div>
    {:else if todoGroups.length === 0}
      <div class="empty">
        {#if _hiddenTags.length === todoTags.length}
          All checklist set to hidden
        {:else if visibleTags.length}
          No checklists found for tag{visibleTags.length > 1 ? "s" : ""}: {visibleTags.map((e) => `#${e}`).join(" ")}
        {:else}
          No checklists found in all files
        {/if}
      </div>
    {:else}
      {#if isTableView}
        <TableView
          {app}
          items={tableItems}
          {todoTags}
          {dateFilter}
          {priorityRowTint}
          {colorDurationBars}
          {groupByDay}
          onPriorityChange={onPriorityChange}
          onTextChange={onTextChange}
          onToggleChecked={onToggleChecked}
          onAddTag={onAddTag}
          onHideFile={onHideFile}
          onHideFolder={onHideFolder}
          onHideTodo={onHideTodo}
          onMoveToToday={onMoveToToday}
        />
      {:else}
        {#each todoGroups as group}
          <ChecklistGroup
            {group}
            {app}
            {lookAndFeel}
            {priorityRowTint}
            pinnedFilePaths={pinnedFilePaths}
            isCollapsed={_collapsedSections.includes(group.id)}
            onToggle={toggleGroup}
            onHideFile={onHideFile}
            onHideFolder={onHideFolder}
            onTogglePin={onTogglePin}
            onToggleChecked={onToggleChecked}
          />
        {/each}
      {/if}
    {/if}
</div>

<style>
  .empty {
    color: var(--text-faint);
    text-align: center;
    margin-top: 32px;
    font-style: italic;
  }

  .checklist-plugin-main {
    padding: initial;
    width: initial;
    height: initial;
    position: initial;
    overflow-y: initial;
    overflow-wrap: initial;
  }

  .loading-wrap {
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }

  .spinner {
    width: var(--checklist-loaderSize);
    height: var(--checklist-loaderSize);
    border: 2px solid;
    border-color: var(--checklist-loaderBorderColor);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
