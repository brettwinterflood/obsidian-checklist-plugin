import {Plugin} from 'obsidian'

import {TODO_TABLE_VIEW_TYPE, TODO_VIEW_TYPE} from './constants'
import {DEFAULT_SETTINGS, TodoSettings, TodoSettingTab} from './settings'
import TodoTableView from './table-view'
import TodoListView from './view'

export default class TodoPlugin extends Plugin {
  private settings: TodoSettings

  get view() {
    return this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)[0]
      ?.view as TodoListView
  }

  get tableView() {
    return this.app.workspace.getLeavesOfType(TODO_TABLE_VIEW_TYPE)[0]
      ?.view as TodoTableView
  }

  async onload() {
    await this.loadSettings()

    this.addSettingTab(new TodoSettingTab(this.app, this))
    this.addCommand({
      id: 'show-checklist-view',
      name: 'Show Checklist Pane',
      callback: () => {
        const workspace = this.app.workspace
        const views = workspace.getLeavesOfType(TODO_VIEW_TYPE)
        if (views.length === 0) {
          workspace
            .getRightLeaf(false)
            .setViewState({
              type: TODO_VIEW_TYPE,
              active: true,
            })
            .then(() => {
              const todoLeaf = workspace.getLeavesOfType(TODO_VIEW_TYPE)[0]
              workspace.revealLeaf(todoLeaf)
              workspace.setActiveLeaf(todoLeaf, true, true)
            })
        } else {
          views[0].setViewState({
            active: true,
            type: TODO_VIEW_TYPE,
          })
          workspace.revealLeaf(views[0])
          workspace.setActiveLeaf(views[0], true, true)
        }
      },
    })
    this.addCommand({
      id: 'refresh-checklist-view',
      name: 'Refresh List',
      callback: () => {
        this.view?.refresh()
        this.tableView?.refresh()
      },
    })
    this.addCommand({
      id: 'show-checklist-table-view',
      name: 'Show Checklist Table',
      callback: () => {
        this.openTableView()
      },
    })
    this.addRibbonIcon('table', 'Open Checklist Table', () => {
      this.openTableView()
    })
    this.registerView(TODO_VIEW_TYPE, leaf => {
      const newView = new TodoListView(leaf, this)
      return newView
    })
    this.registerView(TODO_TABLE_VIEW_TYPE, leaf => {
      const newView = new TodoTableView(leaf, this)
      return newView
    })

    if (this.app.workspace.layoutReady) this.initLeaf()
    else this.app.workspace.onLayoutReady(() => this.initLeaf())
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE).length) return

    this.app.workspace.getRightLeaf(false).setViewState({
      type: TODO_VIEW_TYPE,
      active: true,
    })
  }

  async onunload() {
    this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)[0]?.detach()
    this.app.workspace.getLeavesOfType(TODO_TABLE_VIEW_TYPE)[0]?.detach()
  }

  async loadSettings() {
    const loadedData = await this.loadData()
    this.settings = {...DEFAULT_SETTINGS, ...loadedData}
  }

  async updateSettings(updates: Partial<TodoSettings>) {
    Object.assign(this.settings, updates)
    await this.saveData(this.settings)
    const onlyRepaintWhenChanges = [
      'autoRefresh',
      'lookAndFeel',
      '_collapsedSections',
    ]
    const onlyReGroupWhenChanges = [
      'subGroups',
      'groupBy',
      'sortDirectionGroups',
      'sortDirectionSubGroups',
      'sortDirectionItems',
      'pinnedFilePaths',
      'ignoredFilePaths',
      'excludedFolderPaths',
      '_hiddenPriorities',
      '_hiddenTags',
    ]
    if (onlyRepaintWhenChanges.includes(Object.keys(updates)[0])) {
      this.view?.rerender()
      this.tableView?.rerender()
    } else {
      const shouldReparse = !onlyReGroupWhenChanges.includes(Object.keys(updates)[0])
      this.view?.refresh(shouldReparse)
      this.tableView?.refresh(shouldReparse)
    }
  }

  getSettingValue<K extends keyof TodoSettings>(setting: K): TodoSettings[K] {
    return this.settings[setting]
  }

  openTableView() {
    const workspace = this.app.workspace
    const views = workspace.getLeavesOfType(TODO_TABLE_VIEW_TYPE)
    if (views.length === 0) {
      workspace
        .getLeaf(true)
        .setViewState({
          type: TODO_TABLE_VIEW_TYPE,
          active: true,
        })
        .then(() => {
          const tableLeaf = workspace.getLeavesOfType(TODO_TABLE_VIEW_TYPE)[0]
          if (!tableLeaf) return
          workspace.revealLeaf(tableLeaf)
          workspace.setActiveLeaf(tableLeaf, true, true)
        })
      return
    }
    workspace.revealLeaf(views[0])
    workspace.setActiveLeaf(views[0], true, true)
  }
}
