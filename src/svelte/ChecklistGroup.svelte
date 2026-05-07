<script lang="ts">
  import type { App } from "obsidian"

  import type { LookAndFeel, TodoGroup, TodoItem } from "src/_types"
  import { navToFile } from "src/utils"
  import { clickOutside } from "./clickOutside.directive"
  import ChecklistItem from "./ChecklistItem.svelte"
  import Icon from "./Icon.svelte"

  export let group: TodoGroup
  export let isCollapsed: boolean
  export let lookAndFeel: LookAndFeel
  export let pinnedFilePaths: string[]
  export let app: App
  export let onToggle: (id: string) => void
  export let onHideFile: (path: string) => Promise<void>
  export let onHideFolder: (path: string) => Promise<void>
  export let onTogglePin: (path: string) => Promise<void>
  export let onToggleChecked: (item: TodoItem) => Promise<void>

  function clickTitle(ev: MouseEvent) {
    if (group.type === "page") navToFile(app, group.id, ev)
  }

  $: isPinned = group.type === "page" && pinnedFilePaths.includes(group.id)
  $: folderPath = group.type === "page" && group.id.includes("/") ? group.id.slice(0, group.id.lastIndexOf("/")) : ""
  $: folderLabel = folderPath || "(vault root)"

  let showContextMenu = false
  let contextX = 0
  let contextY = 0
  let showSettingsMenu = false

  const openContextMenu = (ev: MouseEvent) => {
    if (group.type !== "page") return
    ev.preventDefault()
    contextX = ev.clientX
    contextY = ev.clientY
    showContextMenu = true
  }

  const hideNote = async () => {
    if (group.type !== "page") return
    await onHideFile(group.id)
    showContextMenu = false
  }

  const hideFolder = async () => {
    if (!folderPath) return
    await onHideFolder(folderPath)
    showContextMenu = false
    showSettingsMenu = false
  }

  const hideNoteFromSettings = async () => {
    if (group.type !== "page") return
    await onHideFile(group.id)
    showSettingsMenu = false
  }

  const togglePinFromSettings = async () => {
    if (group.type !== "page") return
    await onTogglePin(group.id)
    showSettingsMenu = false
  }
</script>

<section class="group {group.className}">
  <header class={`group-header ${group.type}`} on:contextmenu={openContextMenu}>
    <div class="title" on:click={clickTitle}>
      {#if group.type === "page"}
        {group.pageName}
      {:else if group.mainTag}
        <span class="tag-base">#</span>
        <span class={group.subTags == null ? "tag-sub" : "tag-base"}
          >{`${group.mainTag}${group.subTags != null ? "/" : ""}`}</span
        >
        {#if group.subTags != null}
          <span class="tag-sub">{group.subTags}</span>
        {/if}
      {:else}
        <span class="tag-base">All Tags</span>
      {/if}
    </div>
    <div class="space" />
    <div class="count">{group.todos.length}</div>
    {#if group.type === "page"}
      <div class="settings-menu-wrap">
        <button
          class="icon-action"
          on:click={() => (showSettingsMenu = !showSettingsMenu)}
          title="Note actions"
        >
          <Icon name="settings" style="button" />
        </button>
        {#if showSettingsMenu}
          <div
            class="inline-menu"
            use:clickOutside
            on:click_outside={() => (showSettingsMenu = false)}
          >
            <button on:click={togglePinFromSettings}>{isPinned ? "Unpin note" : "Pin note"}</button>
            <button on:click={hideNoteFromSettings}>Hide note</button>
            <button disabled={!folderPath} on:click={hideFolder}>Hide folder: {folderLabel}</button>
          </div>
        {/if}
      </div>
    {/if}
    <button class="collapse" on:click={() => onToggle(group.id)} title="Toggle Group">
      <Icon name="chevron" direction={isCollapsed ? "left" : "down"} />
    </button>
  </header>
  {#if !isCollapsed}
    <ul>
      {#each group.todos as item}
        <ChecklistItem {item} {lookAndFeel} {app} {onToggleChecked} />
      {/each}
    </ul>
  {/if}
  {#if showContextMenu}
    <div
      class="context-menu"
      style={`left:${contextX}px;top:${contextY}px;`}
      use:clickOutside
      on:click_outside={() => (showContextMenu = false)}
    >
      <button on:click={hideNote}>Hide note: {group.id}</button>
      <button disabled={!folderPath} on:click={hideFolder}>Hide folder: {folderLabel}</button>
    </div>
  {/if}
</section>

<style>
  .page {
    margin: var(--checklist-pageMargin);
    color: var(--checklist-textColor);
    transition: opacity 150ms ease-in-out;
    cursor: pointer;
  }

  .file-link:hover {
    opacity: 0.8;
  }

  header {
    font-weight: var(--checklist-headerFontWeight);
    font-size: var(--checklist-headerFontSize);
    margin: var(--checklist-headerMargin);
    display: flex;
    gap: var(--checklist-headerGap);
    align-items: center;
  }

  .space {
    flex: 1;
  }
  button,
  .count,
  .title {
    flex-shrink: 1;
  }
  .count {
    padding: var(--checklist-countPadding);
    background: var(--checklist-countBackground);
    border-radius: var(--checklist-countBorderRadius);
    font-size: var(--checklist-countFontSize);
  }
  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
  }
  button {
    display: flex;
    padding: var(--checklist-buttonPadding);
    background: transparent;
    box-shadow: var(--checklist-buttonBoxShadow);
  }

  .tag-base {
    color: var(--checklist-tagBaseColor);
  }
  .tag-sub {
    color: var(--checklist-tagSubColor);
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    padding-inline-start: initial !important;
  }

  .group {
    margin-bottom: var(--checklist-groupMargin);
  }

  .collapse {
    width: initial;
  }

  .icon-action {
    width: 22px;
    height: 22px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: none;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1;
  }

  .icon-action:hover {
    border-color: var(--text-muted);
    background: var(--background-primary-alt);
  }

  .settings-menu-wrap {
    position: relative;
  }

  .inline-menu {
    position: absolute;
    right: 0;
    top: 24px;
    z-index: 20;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .inline-menu > button {
    width: 100%;
    text-align: left;
    display: block;
    box-shadow: none;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 6px 8px;
  }

  .inline-menu > button:hover:not(:disabled) {
    background: var(--background-secondary);
    border-color: var(--background-modifier-border);
  }

  .inline-menu > button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .context-menu > button {
    width: 100%;
    text-align: left;
    display: block;
    box-shadow: none;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 6px 8px;
  }

  .context-menu > button:hover:not(:disabled) {
    background: var(--background-secondary);
    border-color: var(--background-modifier-border);
  }

  .context-menu > button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
