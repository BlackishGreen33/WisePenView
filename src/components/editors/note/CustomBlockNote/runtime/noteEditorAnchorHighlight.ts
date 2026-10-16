/**
 * 编辑器锚点定位命中的高亮契约。
 *
 * 类名与时长属于编辑器滚动层，需与 `CustomBlockNote/style.module.less`
 * 中 `.wise-note-anchor-highlight` 的动画时长保持一致。
 */

/** 命中块的临时高亮类名，由 `useNoteEditorScroll` 挂载和移除 */
export const NOTE_ANCHOR_HIGHLIGHT_CLASS = 'wise-note-anchor-highlight';
/** 命中块的高亮时长 */
export const NOTE_ANCHOR_HIGHLIGHT_DURATION_MS = 1_200;
