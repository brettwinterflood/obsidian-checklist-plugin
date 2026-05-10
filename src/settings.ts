import {
  App,
  FuzzySuggestModal,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
} from 'obsidian'

import type TodoPlugin from './main'
import type {
  DateFilter,
  GroupByType,
  LookAndFeel,
  Priority,
  SortDirection,
} from './_types'

export interface TodoSettings {
  todoPageName: string
  showChecked: boolean
  showAllTodos: boolean
  showOnlyActiveFile: boolean
  autoRefresh: boolean
  groupBy: GroupByType
  subGroups: boolean
  sortDirectionItems: SortDirection
  sortDirectionGroups: SortDirection
  sortDirectionSubGroups: SortDirection
  includeFiles: string
  lookAndFeel: LookAndFeel
  dateFilter: DateFilter
  selectedPriorities: Priority[]
  priorityRowTint: boolean
  colorDurationBars: boolean
  pinnedFilePaths: string[]
  ignoredFilePaths: string[]
  excludedFolderPaths: string[]
  _collapsedSections: string[]
  _hiddenTags: string[]
  _hiddenPriorities: Priority[]
}

export const DEFAULT_SETTINGS: TodoSettings = {
  todoPageName: '',
  showChecked: false,
  showAllTodos: false,
  showOnlyActiveFile: false,
  autoRefresh: true,
  subGroups: false,
  groupBy: 'page',
  sortDirectionItems: 'new->old',
  sortDirectionGroups: 'new->old',
  sortDirectionSubGroups: 'new->old',
  includeFiles: '',
  lookAndFeel: 'classic',
  dateFilter: 'last14',
  selectedPriorities: [],
  priorityRowTint: true,
  colorDurationBars: false,
  pinnedFilePaths: ['TODO.md'],
  ignoredFilePaths: [],
  excludedFolderPaths: [],
  _collapsedSections: [],
  _hiddenTags: [],
  _hiddenPriorities: [],
}

class FileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private onChoosePath: (path: string) => Promise<void>,
  ) {
    super(app)
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles()
  }

  getItemText(item: TFile): string {
    return item.path
  }

  onChooseItem(item: TFile): void {
    this.onChoosePath(item.path)
  }
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private onChoosePath: (path: string) => Promise<void>,
  ) {
    super(app)
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((entry): entry is TFolder => entry instanceof TFolder)
  }

  getItemText(item: TFolder): string {
    return item.path
  }

  onChooseItem(item: TFolder): void {
    this.onChoosePath(item.path.replace(/\/+$/, ''))
  }
}

export class TodoSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: TodoPlugin,
  ) {
    super(app, plugin)
    this.plugin.settingsTab = this
  }

  display(): void {
    this.containerEl.empty()

    this.containerEl.createEl('h3', {
      text: 'General Settings',
    })

    this.buildSettings()
  }

  private buildSettings() {
    /** GENERAL */

    new Setting(this.containerEl).setName('General')

    new Setting(this.containerEl)
      .setName('Tag name')
      .setDesc(
        'e.g. "todo" will match #todo. You may add mutliple tags separated by a newline. Leave empty to capture all',
      )
      .addTextArea(text =>
        text
          .setPlaceholder('todo')
          .setValue(this.plugin.getSettingValue('todoPageName'))
          .onChange(async value => {
            await this.plugin.updateSettings({
              todoPageName: value,
            })
          }),
      )

    new Setting(this.containerEl)
      .setName('Show Completed?')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('showChecked'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({showChecked: value})
        })
      })

    new Setting(this.containerEl)
      .setName('Show All Todos In File?')
      .setDesc(
        'Show all items in file if tag is present, or only items attached to the block where the tag is located. Only has an effect if Tag Name is not empty',
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('showAllTodos'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({showAllTodos: value})
        })
      })

    new Setting(this.containerEl)
      .setName('Show only in currently active file?')
      .setDesc(
        'Show only todos present in currently active file?'
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('showOnlyActiveFile'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({showOnlyActiveFile: value})
        })
      })

    /** GORUPING & SORTING */

    new Setting(this.containerEl).setName('Grouping & Sorting')

    new Setting(this.containerEl).setName('Group By').addDropdown(dropdown => {
      dropdown.addOption('page', 'Page')
      dropdown.addOption('tag', 'Tag')
      dropdown.setValue(this.plugin.getSettingValue('groupBy'))
      dropdown.onChange(async (value: GroupByType) => {
        await this.plugin.updateSettings({groupBy: value})
      })
    })

    // new Setting(this.containerEl)
    //   .setName("Enable Sub-Groups?")
    //   .addToggle((toggle) => {
    //     toggle.setValue(this.plugin.getSettingValue("subGroups"))
    //     toggle.onChange(async (value) => {
    //       await this.plugin.updateSettings({ subGroups: value })
    //     })
    //   })
    //   .setDesc("When grouped by page you will see sub-groups by tag, and vice versa.")

    new Setting(this.containerEl)
      .setName('Item Sort')
      .addDropdown(dropdown => {
        dropdown.addOption('a->z', 'A -> Z')
        dropdown.addOption('z->a', 'Z -> A')
        dropdown.addOption('new->old', 'New -> Old')
        dropdown.addOption('old->new', 'Old -> New')
        dropdown.setValue(this.plugin.getSettingValue('sortDirectionItems'))
        dropdown.onChange(async (value: SortDirection) => {
          await this.plugin.updateSettings({
            sortDirectionItems: value,
          })
        })
      })
      .setDesc(
        'Time sorts are based on last time the file for a particular item was edited',
      )

    new Setting(this.containerEl)
      .setName('Group Sort')
      .addDropdown(dropdown => {
        dropdown.addOption('a->z', 'A -> Z')
        dropdown.addOption('z->a', 'Z -> A')
        dropdown.addOption('new->old', 'New -> Old')
        dropdown.addOption('old->new', 'Old -> New')
        dropdown.setValue(this.plugin.getSettingValue('sortDirectionGroups'))
        dropdown.onChange(async (value: SortDirection) => {
          await this.plugin.updateSettings({
            sortDirectionGroups: value,
          })
        })
      })
      .setDesc(
        'Time sorts are based on last time the file for the newest or oldest item in a group was edited',
      )

    // new Setting(this.containerEl)
    //   .setName("Sub-Group Sort")
    //   .addDropdown((dropdown) => {
    //     dropdown.addOption("a->z", "A -> Z")
    //     dropdown.addOption("z->a", "Z -> A")
    //     dropdown.addOption("new->old", "New -> Old")
    //     dropdown.addOption("old->new", "Old -> New")
    //     dropdown.setValue(this.plugin.getSettingValue("sortDirectionSubGroups"))
    //     dropdown.onChange(async (value: SortDirection) => {
    //       await this.plugin.updateSettings({ sortDirectionSubGroups: value })
    //     })
    //   })
    //   .setDesc("Time sorts are based on last time the file for the newest or oldest item in a group was edited")

    /** STYLING */

    new Setting(this.containerEl).setName('Styling')

    new Setting(this.containerEl)
      .setName('Look and Feel')
      .addDropdown(dropdown => {
        dropdown.addOption('classic', 'Classic')
        dropdown.addOption('compact', 'Compact')
        dropdown.setValue(this.plugin.getSettingValue('lookAndFeel'))
        dropdown.onChange(async (value: LookAndFeel) => {
          await this.plugin.updateSettings({lookAndFeel: value})
        })
      })

    new Setting(this.containerEl)
      .setName('Tint rows by priority')
      .setDesc('Use a subtle pastel row background based on each todo priority.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('priorityRowTint'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({priorityRowTint: value})
        })
      })

    new Setting(this.containerEl)
      .setName('Color duration bars')
      .setDesc('Use age-based colored duration bars instead of a monochrome neutral bar.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('colorDurationBars'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({colorDurationBars: value})
        })
      })

    this.buildPathListSetting({
      title: 'Pinned notes',
      description:
        'Pinned notes always sort before unpinned notes when grouped by page.',
      values: this.plugin.getSettingValue('pinnedFilePaths'),
      emptyText: 'No pinned notes',
      onAdd: () =>
        new FileSuggestModal(this.app, async path => {
          const current = this.plugin.getSettingValue('pinnedFilePaths')
          if (!current.includes(path)) {
            await this.plugin.updateSettings({
              pinnedFilePaths: [...current, path],
            })
          }
        }).open(),
      onRemove: async value => {
        await this.plugin.updateSettings({
          pinnedFilePaths: this.plugin
            .getSettingValue('pinnedFilePaths')
            .filter(path => path !== value),
        })
      },
    })

    this.buildPathListSetting({
      title: 'Ignored notes',
      description: 'Ignored notes are hidden from both list and table views.',
      values: this.plugin.getSettingValue('ignoredFilePaths'),
      emptyText: 'No ignored notes',
      onAdd: () =>
        new FileSuggestModal(this.app, async path => {
          const current = this.plugin.getSettingValue('ignoredFilePaths')
          if (!current.includes(path)) {
            await this.plugin.updateSettings({
              ignoredFilePaths: [...current, path],
            })
          }
        }).open(),
      onRemove: async value => {
        await this.plugin.updateSettings({
          ignoredFilePaths: this.plugin
            .getSettingValue('ignoredFilePaths')
            .filter(path => path !== value),
        })
      },
    })

    this.buildPathListSetting({
      title: 'Excluded folders',
      description: 'Notes in excluded folders are hidden from all views.',
      values: this.plugin.getSettingValue('excludedFolderPaths'),
      emptyText: 'No excluded folders',
      onAdd: () =>
        new FolderSuggestModal(this.app, async path => {
          const current = this.plugin.getSettingValue('excludedFolderPaths')
          if (!current.includes(path)) {
            await this.plugin.updateSettings({
              excludedFolderPaths: [...current, path],
            })
          }
        }).open(),
      onRemove: async value => {
        await this.plugin.updateSettings({
          excludedFolderPaths: this.plugin
            .getSettingValue('excludedFolderPaths')
            .filter(path => path !== value),
        })
      },
    })

    /** ADVANCED */

    new Setting(this.containerEl).setName('Advanced')

    new Setting(this.containerEl)
      .setName('Include Files')
      .setDesc(
        'Include all files that match this glob pattern. Examples on plugin page/github readme. Leave empty to check all files.',
      )
      .setTooltip('**/*')
      .addText(text =>
        text
          .setValue(this.plugin.getSettingValue('includeFiles'))
          .onChange(async value => {
            await this.plugin.updateSettings({
              includeFiles: value,
            })
          }),
      )

    new Setting(this.containerEl)
      .setName('Auto Refresh List?')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.getSettingValue('autoRefresh'))
        toggle.onChange(async value => {
          await this.plugin.updateSettings({autoRefresh: value})
        })
      })
      .setDesc(
        'It\'s recommended to leave this on unless you are expereince performance issues due to a large vault. You can then reload manually using the "Checklist: refresh" command',
      )
  }

  private buildPathListSetting({
    title,
    description,
    values,
    emptyText,
    onAdd,
    onRemove,
  }: {
    title: string
    description: string
    values: string[]
    emptyText: string
    onAdd: () => void
    onRemove: (value: string) => Promise<void>
  }) {
    new Setting(this.containerEl)
      .setName(title)
      .setDesc(description)
      .addButton(button => {
        button.setButtonText('Add')
        button.onClick(onAdd)
      })

    const listEl = this.containerEl.createDiv({cls: 'checklist-setting-list'})
    if (!values.length) {
      listEl.createDiv({cls: 'checklist-setting-empty', text: emptyText})
      return
    }

    for (const value of values) {
      new Setting(listEl).setName(value).addButton(button => {
        button.setButtonText('Remove')
        button.onClick(() => onRemove(value))
      })
    }
  }
}
