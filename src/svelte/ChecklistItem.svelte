<script lang="ts">
  import type { App } from "obsidian"

  import type { LookAndFeel, TodoItem } from "src/_types"
  import { navToFile, toggleTodoItem } from "src/utils"
  import CheckCircle from "./CheckCircle.svelte"

  export let item: TodoItem
  export let lookAndFeel: LookAndFeel
  export let app: App
  export let priorityRowTint: boolean = true
  export let onToggleChecked: (item: TodoItem) => Promise<void> = async item => {
    await toggleTodoItem(item, app)
  }

  let contentDiv: HTMLDivElement

  const toggleItem = async (item: TodoItem) => {
    await onToggleChecked(item)
  }

  const priorityTint = (priority: TodoItem["priority"]) => {
    if (!priorityRowTint) return "transparent"
    if (priority === "highest") return "rgba(255, 214, 214, 0.55)"
    if (priority === "high") return "rgba(255, 232, 214, 0.5)"
    if (priority === "medium") return "rgba(243, 245, 210, 0.45)"
    if (priority === "none") return "transparent"
    if (priority === "low") return "rgba(221, 245, 226, 0.5)"
    return "rgba(214, 246, 241, 0.46)"
  }

  const handleClick = (ev: MouseEvent, item?: TodoItem) => {
    const target: HTMLElement = ev.target as any
    if (target.tagName === "A") {
      ev.stopPropagation()
      if (target.dataset.type === "link") {
        navToFile(app, target.dataset.filepath, ev, item?.line)
      } else if (target.dataset.type === "tag") {
        // goto tag
      }
    }
    else {
      navToFile(app, item.filePath, ev, item?.line)
    }
  }
  $: {
    if (contentDiv) contentDiv.innerHTML = item.rawHTML
  }
</script>

<li class={`${lookAndFeel}`} style={`--priority-row-bg:${priorityTint(item.priority)}`}>
  <button
    class="toggle"
    on:click={(ev) => {
      toggleItem(item)
      ev.stopPropagation()
    }}
  >
    <CheckCircle checked={item.checked} />
  </button>
  <div bind:this={contentDiv} on:click={(ev) => handleClick(ev, item)} class="content" />
</li>

<style>
  li {
    display: flex;
    align-items: center;
    background-color: var(--priority-row-bg, var(--checklist-listItemBackground));
    border-radius: var(--checklist-listItemBorderRadius);
    margin: var(--checklist-listItemMargin);
    cursor: pointer;
    transition: background-color 100ms ease-in-out;
  }
  li:hover {
    background-color: color-mix(
      in srgb,
      var(--priority-row-bg, var(--checklist-listItemBackground)) 75%,
      var(--checklist-listItemBackground--hover) 25%
    );
  }
  .toggle {
    padding: var(--checklist-togglePadding);
    background: transparent;
    box-shadow: var(--checklist-listItemBoxShadow);
    flex-shrink: 1;
    width: initial;
  }
  .content {
    padding: var(--checklist-contentPadding);
    flex: 1;
    font-size: var(--checklist-contentFontSize);
  }
  .compact {
    bottom: var(--checklist-listItemMargin--compact);
  }
  .compact > .content {
    padding: var(--checklist-contentPadding--compact);
  }
  .compact > .toggle {
    padding: var(--checklist-togglePadding--compact);
  }
  .toggle:hover {
    opacity: 0.8;
  }
</style>
