import {ItemView, WorkspaceLeaf} from 'obsidian'

import {TODO_VIEW_TYPE} from './constants'
import App from './svelte/App.svelte'
import {
  CreateTodoModal,
  createTodoInTodayNote,
  groupTodos,
  hideTodoItem,
  parseTodos,
  setTodoItemChecked,
  setTodoItemTag,
  setTodoItemPriority,
  setTodoItemText,
} from './utils'

import type {TodoSettings} from './settings'
import type TodoPlugin from './main'
import type {DateFilter, Priority, TodoGroup, TodoItem} from './_types'
export default class TodoListView extends ItemView {
  private _app: App
  private lastRerender = 0
  private groupedItems: TodoGroup[] = []
  private filteredItems: TodoItem[] = []
  private periodTodoCount = 0
  private periodPriorityCounts: Array<{priority: Priority; count: number}> = []
  private periodTagCounts: Array<{tag: string; count: number}> = []
  private itemsByFile = new Map<string, TodoItem[]>()
  private usedTags: string[] = []
  private selectedUsedTag = ''
  private selectedPriorities: Priority[]
  private searchTerm = ''
  private dateFilter: DateFilter
  private isLoading = false

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: TodoPlugin,
  ) {
    super(leaf)
    this.dateFilter = this.plugin.getSettingValue('dateFilter')
    this.selectedPriorities = [...this.plugin.getSettingValue('selectedPriorities')]
  }

  getViewType(): string {
    return TODO_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Todo List'
  }

  getIcon(): string {
    return 'checkmark'
  }

  get todoTagArray() {
    return this.plugin
      .getSettingValue('todoPageName')
      .trim()
      .split('\n')
      .map(e => e.toLowerCase())
      .filter(e => e)
  }

  get visibleTodoTagArray() {
    return this.todoTagArray.filter(
      t => !this.plugin.getSettingValue('_hiddenTags').includes(t),
    )
  }

  async onClose() {
    this._app.$destroy()
  }

  async onOpen(): Promise<void> {
    this._app = new App({
      target: (this as any).contentEl,
      props: this.props(),
    })
    this.registerEvent(
      this.app.metadataCache.on('resolved', async () => {
        if (!this.plugin.getSettingValue('autoRefresh')) return
        if (this.isEditingInView()) return
        await this.refresh()
      }),
    )
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        if (!this.plugin.getSettingValue('showOnlyActiveFile')) return
        await this.refresh()
      })
    )
    this.registerEvent(
      this.app.vault.on('delete', file => this.deleteFile(file.path)),
    )
    this.refresh()
  }

  async refresh(all = false) {
    if (all) {
      this.lastRerender = 0
      this.itemsByFile.clear()
    }
    const showLoading = all || (this.lastRerender === 0 && this.itemsByFile.size === 0)
    if (showLoading) {
      this.isLoading = true
      this.renderView()
    }
    await this.calculateAllItems()
    this.groupItems()
    if (showLoading) this.isLoading = false
    this.renderView()
    this.lastRerender = +new Date()
  }

  rerender() {
    this.renderView()
  }

  private deleteFile(path: string) {
    this.itemsByFile.delete(path)
    this.groupItems()
    this.renderView()
  }

  private props() {
    return {
      todoTags: this.todoTagArray,
      lookAndFeel: this.plugin.getSettingValue('lookAndFeel'),
      subGroups: this.plugin.getSettingValue('subGroups'),
      _collapsedSections: this.plugin.getSettingValue('_collapsedSections'),
      _hiddenTags: this.plugin.getSettingValue('_hiddenTags'),
      app: this.app,
      todoGroups: this.groupedItems,
      tableItems: this.filteredItems,
      isTableView: false,
      pinnedFilePaths: this.plugin.getSettingValue('pinnedFilePaths'),
      ignoredFilePaths: this.plugin.getSettingValue('ignoredFilePaths'),
      excludedFolderPaths: this.plugin.getSettingValue('excludedFolderPaths'),
      hiddenPriorities: this.plugin.getSettingValue('_hiddenPriorities'),
      dateFilter: this.dateFilter,
      usedTagCounts: this.periodTagCounts,
      selectedUsedTag: this.selectedUsedTag,
      selectedPriorities: this.selectedPriorities,
      priorityRowTint: this.plugin.getSettingValue('priorityRowTint'),
      colorDurationBars: this.plugin.getSettingValue('colorDurationBars'),
      totalTodoCount: this.periodTodoCount,
      priorityCounts: this.periodPriorityCounts,
      isLoading: this.isLoading,
      updateSetting: (updates: Partial<TodoSettings>) =>
        this.plugin.updateSettings(updates),
      onOpenTableView: () => this.plugin.openTableView(),
      onCreateTodo: () => {
        new CreateTodoModal(this.app, async text => {
          await createTodoInTodayNote(this.app, text)
          await this.refresh()
        }).open()
      },
      onFullReload: () => this.refresh(true),
      onHideFile: async (path: string) => {
        const rollback = this.applyOptimisticHideFile(path)
        const ignored = this.plugin.getSettingValue('ignoredFilePaths')
        try {
          if (!ignored.includes(path)) {
            await this.plugin.updateSettings({ignoredFilePaths: [...ignored, path]})
          }
        } catch {
          rollback()
        }
      },
      onHideFolder: async (path: string) => {
        const folderPath = this.normalizeFolderPath(path)
        if (!folderPath) return
        const rollback = this.applyOptimisticHideFolder(folderPath)
        const excluded = this.plugin.getSettingValue('excludedFolderPaths')
        try {
          if (!excluded.includes(folderPath)) {
            await this.plugin.updateSettings({
              excludedFolderPaths: [...excluded, folderPath],
            })
          }
        } catch {
          rollback()
        }
      },
      onHideTodo: async (item: TodoItem) => {
        const expectedOriginalText = item.originalText
        const rollback = this.applyOptimisticHideTodo(item)
        const success = await hideTodoItem(
          item,
          this.app,
          expectedOriginalText,
        )
        if (!success) rollback()
      },
      onMoveToToday: async () => undefined,
      onTogglePin: async (path: string) => {
        const pinned = this.plugin.getSettingValue('pinnedFilePaths')
        const next = pinned.includes(path)
          ? pinned.filter(p => p !== path)
          : [...pinned, path]
        await this.plugin.updateSettings({pinnedFilePaths: next})
      },
      onPriorityChange: async (item: TodoItem, priority: Priority) => {
        const expectedOriginalText = item.originalText
        const rollback = this.applyOptimisticPriority(item, priority)
        const success = await setTodoItemPriority(
          item,
          priority,
          this.app,
          expectedOriginalText,
        )
        if (!success) rollback()
      },
      onTextChange: async (item: TodoItem, text: string) => {
        const expectedOriginalText = item.originalText
        const rollback = this.applyOptimisticText(item, text)
        const success = await setTodoItemText(
          item,
          text,
          this.app,
          expectedOriginalText,
        )
        if (!success) rollback()
      },
      onToggleChecked: async (item: TodoItem) => {
        const expectedOriginalText = item.originalText
        const rollback = this.applyOptimisticChecked(item, !item.checked)
        const success = await setTodoItemChecked(
          item,
          item.checked,
          this.app,
          expectedOriginalText,
        )
        if (!success) rollback()
      },
      onAddTag: async (item: TodoItem, tag: string) => {
        const success = await setTodoItemTag(item, tag, this.app, item.originalText)
        if (success) await this.refresh()
      },
      onSearch: (val: string) => {
        this.searchTerm = val
        this.refresh()
      },
      onDateFilterChange: (filter: DateFilter) => {
        this.dateFilter = filter
        void this.plugin.updateSettings({dateFilter: filter})
      },
      onUsedTagFilterChange: (tag: string) => {
        this.selectedUsedTag = tag
        this.groupItems()
        this.renderView()
      },
      onPriorityFilterChange: (priority: Priority | '') => {
        this.selectedPriorities = priority ? [priority] : []
        void this.plugin.updateSettings({selectedPriorities: this.selectedPriorities})
        this.groupItems()
        this.renderView()
      },
      onPriorityRangeChange: (priorities: Priority[]) => {
        this.selectedPriorities = priorities
        void this.plugin.updateSettings({selectedPriorities: priorities})
        this.groupItems()
        this.renderView()
      },
    }
  }

  private async calculateAllItems() {
    const todosForUpdatedFiles = await parseTodos(
      this.app.vault.getMarkdownFiles(),
      this.todoTagArray.length === 0 ? ['*'] : this.visibleTodoTagArray,
      this.app.metadataCache,
      this.app.vault,
      this.plugin.getSettingValue('includeFiles'),
      this.plugin.getSettingValue('showChecked'),
      this.plugin.getSettingValue('showAllTodos'),
      this.lastRerender,
    )
    for (const [file, todos] of todosForUpdatedFiles) {
      this.itemsByFile.set(file.path, todos)
    }
  }

  private groupItems() {
    const flattenedItems = Array.from(this.itemsByFile.values()).flat()
    const openFile = this.app.workspace.getActiveFile()
    const ignoredFiles = this.plugin.getSettingValue('ignoredFilePaths')
    const excludedFolders = this.plugin.getSettingValue('excludedFolderPaths')
    const hiddenPriorities = this.plugin.getSettingValue('_hiddenPriorities')
    const viewOnlyOpen = this.plugin.getSettingValue('showOnlyActiveFile')
    const baseFilteredItems = flattenedItems.filter(item => {
      if (ignoredFiles.includes(item.filePath)) return false
      if (
        excludedFolders.some(folder =>
          item.filePath === folder || item.filePath.startsWith(`${folder}/`),
        )
        )
        return false
      if (hiddenPriorities.includes(item.priority)) return false
      if (!this.plugin.getSettingValue('showChecked') && item.checked) return false
      if (!this.itemMatchesDateFilter(item)) return false
      if (viewOnlyOpen && (!openFile || item.filePath !== openFile.path)) return false
      return true
    })
    this.usedTags = this.getUsedTags(baseFilteredItems)
    if (this.selectedUsedTag && !this.usedTags.includes(this.selectedUsedTag))
      this.selectedUsedTag = ''
    const tagFilteredItems = this.selectedUsedTag
      ? baseFilteredItems.filter(item =>
          this.itemMatchesSelectedTag(item, this.selectedUsedTag),
        )
      : baseFilteredItems
    const searchTerm = this.searchTerm.toLowerCase()
    const searchedItems = tagFilteredItems.filter(item =>
      [item.originalText, item.filePath]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm),
    )
    this.periodTodoCount = searchedItems.length
    this.periodTagCounts = this.getTopUsedTags(searchedItems)
    const priorities: Priority[] = ['highest', 'high', 'medium', 'none', 'low', 'lowest']
    this.periodPriorityCounts = priorities.map(priority => ({
      priority,
      count: searchedItems.filter(item => item.priority === priority).length,
    }))
    const priorityFilteredItems = this.selectedPriorities.length
      ? searchedItems.filter(item =>
          this.selectedPriorities.includes(item.priority),
        )
      : searchedItems
    this.filteredItems = priorityFilteredItems
    this.groupedItems = groupTodos(
      priorityFilteredItems,
      this.plugin.getSettingValue('groupBy'),
      this.plugin.getSettingValue('sortDirectionGroups'),
      this.plugin.getSettingValue('sortDirectionItems'),
      this.plugin.getSettingValue('subGroups'),
      this.plugin.getSettingValue('sortDirectionSubGroups'),
    )
    this.sortPinnedGroups()
    this.filteredItems = this.groupedItems.flatMap(group => group.todos)
  }

  private sortPinnedGroups() {
    if (this.plugin.getSettingValue('groupBy') !== 'page') return
    const pinned = this.plugin.getSettingValue('pinnedFilePaths')
    this.groupedItems.sort((a, b) => {
      const aPinned = pinned.includes(a.id)
      const bPinned = pinned.includes(b.id)
      if (aPinned === bPinned) return 0
      return aPinned ? -1 : 1
    })
  }

  private renderView() {
    this._app.$set(this.props())
  }

  private itemMatchesDateFilter(item: TodoItem) {
    if (this.dateFilter === 'all') return true
    if (!Number.isFinite(item.displayDateTs)) return false
    if (this.dateFilter === 'today') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      return item.displayDateTs >= start.getTime() && item.displayDateTs < end.getTime()
    }
    const days = this.dateFilterToDays()
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - days)
    return item.displayDateTs >= cutoff.getTime()
  }

  private dateFilterToDays() {
    if (this.dateFilter === 'last7') return 7
    if (this.dateFilter === 'last14') return 14
    if (this.dateFilter === 'last30') return 30
    return 60
  }

  private getUsedTags(items: TodoItem[]) {
    return Array.from(
      new Set(items.flatMap(item => this.getItemTags(item)).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b))
  }

  private getTopUsedTags(items: TodoItem[]) {
    const tags = this.getUsedTags(items)
    const tagCounts = new Map<string, number>()
    for (const tag of tags) {
      tagCounts.set(
        tag,
        items.reduce((count, item) => count + (this.matchesTagText(item, tag) ? 1 : 0), 0),
      )
    }
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([tag, count]) => ({tag, count}))
  }

  private getItemTags(item: TodoItem) {
    const tags = item.originalText.match(/#[\p{L}\p{N}_/-]+/gu) ?? []
    if (item.mainTag)
      tags.push(`#${item.mainTag}${item.subTag ? `/${item.subTag}` : ''}`)
    return Array.from(new Set(tags))
  }

  private itemMatchesSelectedTag(item: TodoItem, selectedTag: string) {
    return this.matchesTagText(item, selectedTag)
  }

  private matchesTagText(item: TodoItem, selectedTag: string) {
    if (this.getItemTags(item).includes(selectedTag)) return true
    const plainTag = selectedTag.replace(/^#/, '').toLowerCase()
    return [item.originalText, item.filePath]
      .join(' ')
      .toLowerCase()
      .includes(plainTag)
  }

  private applyOptimisticPriority(item: TodoItem, priority: Priority) {
    const oldPriority = item.priority
    const oldOriginalText = item.originalText
    const oldTodoText = item.todoText
    item.priority = priority
    item.originalText = this.withPriorityEmoji(item.originalText, priority)
    item.todoText = this.withPriorityEmoji(item.todoText, priority)
    this.groupItems()
    this.renderView()
    return () => {
      item.priority = oldPriority
      item.originalText = oldOriginalText
      item.todoText = oldTodoText
      this.groupItems()
      this.renderView()
    }
  }

  private applyOptimisticChecked(item: TodoItem, checked: boolean) {
    const oldChecked = item.checked
    const oldOriginalText = item.originalText
    const oldTodoText = item.todoText
    item.checked = checked
    item.originalText = this.withDoneDate(item.originalText, checked)
    item.todoText = this.withDoneDate(item.todoText, checked)
    this.groupItems()
    this.renderView()
    return () => {
      item.checked = oldChecked
      item.originalText = oldOriginalText
      item.todoText = oldTodoText
      this.groupItems()
      this.renderView()
    }
  }

  private applyOptimisticText(item: TodoItem, text: string) {
    const oldOriginalText = item.originalText
    const oldTodoText = item.todoText
    const oldPriority = item.priority
    const nextText = text.trim()
    item.originalText = nextText
    item.todoText = nextText
    item.priority = this.priorityFromText(nextText)
    this.groupItems()
    this.renderView()
    return () => {
      item.originalText = oldOriginalText
      item.todoText = oldTodoText
      item.priority = oldPriority
      this.groupItems()
      this.renderView()
    }
  }

  private applyOptimisticHideTodo(item: TodoItem) {
    const oldItems = this.itemsByFile.get(item.filePath) ?? []
    this.itemsByFile.set(
      item.filePath,
      oldItems.filter(
        candidate =>
          candidate.filePath !== item.filePath || candidate.line !== item.line,
      ),
    )
    this.groupItems()
    this.renderView()
    return () => {
      this.itemsByFile.set(item.filePath, oldItems)
      this.groupItems()
      this.renderView()
    }
  }

  private applyOptimisticHideFile(path: string) {
    const oldItems = this.itemsByFile.get(path) ?? []
    this.itemsByFile.set(path, [])
    this.groupItems()
    this.renderView()
    return () => {
      this.itemsByFile.set(path, oldItems)
      this.groupItems()
      this.renderView()
    }
  }

  private applyOptimisticHideFolder(folderPath: string) {
    const oldEntries = Array.from(this.itemsByFile.entries())
    for (const path of this.itemsByFile.keys()) {
      if (path === folderPath || path.startsWith(`${folderPath}/`)) {
        this.itemsByFile.set(path, [])
      }
    }
    this.groupItems()
    this.renderView()
    return () => {
      this.itemsByFile = new Map(oldEntries)
      this.groupItems()
      this.renderView()
    }
  }

  private priorityFromText(text: string): Priority {
    const match = text.trimEnd().match(/\s*(🔺|⏫|🔼|🔽|⏬)\s*$/)
    if (!match) return 'none'
    if (match[1] === '🔺') return 'highest'
    if (match[1] === '⏫') return 'high'
    if (match[1] === '🔼') return 'medium'
    if (match[1] === '🔽') return 'low'
    if (match[1] === '⏬') return 'lowest'
    return 'none'
  }

  private withPriorityEmoji(text: string, priority: Priority) {
    const stripped = text.replace(/\s*(🔺|⏫|🔼|🔽|⏬)\s*$/, '').trimEnd()
    if (priority === 'highest') return `${stripped} 🔺`
    if (priority === 'high') return `${stripped} ⏫`
    if (priority === 'medium') return `${stripped} 🔼`
    if (priority === 'low') return `${stripped} 🔽`
    if (priority === 'lowest') return `${stripped} ⏬`
    return stripped
  }

  private normalizeFolderPath(path: string) {
    return path.trim().replace(/^\/+|\/+$/g, '')
  }

  private withDoneDate(text: string, checked: boolean) {
    const stripped = text.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}\s*$/, '').trimEnd()
    if (!checked) return stripped
    return `${stripped} ✅ ${new Date().toISOString().slice(0, 10)}`
  }

  private isEditingInView() {
    const activeElement = document.activeElement
    if (!(activeElement instanceof HTMLElement)) return false
    if (!(this as any).contentEl.contains(activeElement)) return false
    return ['INPUT', 'SELECT', 'TEXTAREA'].includes(activeElement.tagName)
  }
}
