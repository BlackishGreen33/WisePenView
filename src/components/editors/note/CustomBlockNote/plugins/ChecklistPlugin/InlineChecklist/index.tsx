/* eslint-disable react-refresh/only-export-components -- BlockNote inline spec 与展示组件同文件 */
import type { DefaultStyleSchema } from '@blocknote/core';
import type { ReactCustomInlineContentRenderProps } from '@blocknote/react';
import { createReactInlineContentSpec } from '@blocknote/react';
import { useDebounceFn, useLatest, useUnmount } from 'ahooks';
import { clsx } from 'clsx';
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  CompositionEvent as ReactCompositionEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useNoteEditorReadOnlyContext } from '../../../engines/editor/_context';
import { encodeInlineChecklistMark } from '../markdownMarkers';
import {
  type InlineChecklistMode,
  readChecked,
  readChecklistBackgroundColor,
  readChecklistBorderColor,
  readGroupId,
  readInlineChecklistMode,
  readLabel,
} from '../model';
import {
  applyCheckboxMode,
  applyRadioMode,
  canJoinPreviousRadioGroup,
  joinPreviousRadioGroup,
  selectRadioInGroup,
  splitRadioGroup,
} from '../radioGroup';
import type { InlineChecklistColorPatch, InlineChecklistToolbarPosition } from './index.type';
import { focusLabelAtEnd, insertPlainTextAtCaret, readLabelDomText } from './labelDom';
import { InlineChecklistModeToolbar } from './ModeToolbar';
import styles from './style.module.less';

const LABEL_COMMIT_DEBOUNCE_MS = 120;

const inlineChecklistConfig = {
  type: 'inlineChecklist',
  propSchema: {
    checked: {
      default: false,
      type: 'boolean',
    },
    label: {
      default: '',
    },
    autoFocus: {
      default: false,
      type: 'boolean',
    },
    mode: {
      default: 'checkbox',
    },
    groupId: {
      default: '',
    },
    checklistBorderColor: {
      default: 'default',
    },
    checklistBackgroundColor: {
      default: 'default',
    },
  },
  /**
   * 文案走 props.label + contentEditable（非原生 text input）：
   * 与正文同度量/基线，避免 input 裁降部与行高错位。
   */
  content: 'none',
} as const;

function InlineChecklistView(
  props: ReactCustomInlineContentRenderProps<typeof inlineChecklistConfig, DefaultStyleSchema>
) {
  const { t } = useTranslation('note');
  const { contentRef, updateInlineContent, inlineContent, editor } = props;
  const readOnly = useNoteEditorReadOnlyContext();
  const checked = readChecked(inlineContent.props.checked);
  const label = readLabel(inlineContent.props.label);
  const autoFocus = readChecked(inlineContent.props.autoFocus);
  const mode = readInlineChecklistMode(inlineContent.props.mode);
  const groupId = readGroupId(inlineContent.props.groupId);
  const borderColor = readChecklistBorderColor(inlineContent.props);
  const backgroundColor = readChecklistBackgroundColor(inlineContent.props);
  const labelRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const labelLatest = useLatest(label);
  const inlineContentPropsLatest = useLatest(inlineContent.props);
  const updateInlineContentLatest = useLatest(updateInlineContent);
  const placeholder = t('checklist.inlinePlaceholder');
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<InlineChecklistToolbarPosition | null>(null);
  const [canJoinPrevious, setCanJoinPrevious] = useState(false);
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  const setRootRef = (node: HTMLSpanElement | null) => {
    rootRef.current = node;
    contentRef(node);
  };

  const commitLabelNow = (nextLabel: string) => {
    if (nextLabel === labelLatest.current) return;
    updateInlineContentLatest.current({
      type: 'inlineChecklist',
      props: {
        ...inlineContentPropsLatest.current,
        label: nextLabel,
        autoFocus: false,
      },
    });
  };

  const { run: scheduleCommitLabel, cancel: cancelCommitLabel } = useDebounceFn(
    (nextLabel: string) => {
      commitLabelNow(nextLabel);
    },
    { wait: LABEL_COMMIT_DEBOUNCE_MS }
  );

  useUnmount(() => {
    const node = labelRef.current;
    cancelCommitLabel();
    if (node) {
      commitLabelNow(readLabelDomText(node));
    }
  });

  const syncLabelFromDom = (node: HTMLElement) => {
    let next = readLabelDomText(node);
    if (next.length === 0 && node.innerHTML !== '') {
      node.textContent = '';
      next = '';
    }
    scheduleCommitLabel(next);
  };

  const writeLabelDomIfIdle = (node: HTMLElement | null, nextLabel: string) => {
    if (!node || document.activeElement === node) return;
    if (readLabelDomText(node) !== nextLabel) {
      node.textContent = nextLabel;
    }
  };

  /**
   * @wisepen-manual-effect
   * 执行时机：props.label 变化且文案未聚焦时，同步 contentEditable DOM。
   * 不可替代原因：受控 contentEditable 需避免输入时重写 textContent 打断光标。
   * cleanup：无。
   */
  useLayoutEffect(() => {
    writeLabelDomIfIdle(labelRef.current, label);
  }, [label]);

  /**
   * @wisepen-manual-effect
   * 执行时机：插入时 autoFocus=true，聚焦文案并复位标记。
   * 不可替代原因：需命令式 focus contentEditable，并用事务清掉 autoFocus。
   * cleanup：取消 animation frame。
   */
  useEffect(() => {
    if (readOnly || !autoFocus) return;
    const frame = window.requestAnimationFrame(() => {
      const propsSnapshot = inlineContentPropsLatest.current;
      updateInlineContentLatest.current({
        type: 'inlineChecklist',
        props: {
          ...propsSnapshot,
          autoFocus: false,
        },
      });
      const node = labelRef.current;
      if (!node) return;
      focusLabelAtEnd(node);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, inlineContentPropsLatest, readOnly, updateInlineContentLatest]);

  const syncToolbarPosition = () => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    setToolbarPos({
      top: Math.max(8, rect.top - 8),
      left: rect.left + rect.width / 2,
    });
  };

  /**
   * @wisepen-manual-effect
   * 执行时机：模式工具栏打开时，监听外部点击/滚动以重定位或关闭。
   * 不可替代原因：浮动层相对芯片 DOM 定位，且需全局 pointer/scroll 订阅。
   * cleanup：移除监听。
   */
  useLayoutEffect(() => {
    if (!toolbarOpen || readOnly) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (toolbarRef.current?.contains(target)) return;
      setToolbarOpen(false);
      setColorPanelOpen(false);
    };

    const handleReposition = () => {
      syncToolbarPosition();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [readOnly, toolbarOpen]);

  const handleCheckedChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const nextChecked = event.currentTarget.checked;

    if (mode === 'radio') {
      if (!nextChecked) return;
      selectRadioInGroup(editor, rootRef.current, {
        ...inlineContent.props,
        checked: true,
        autoFocus: false,
      });
      return;
    }

    updateInlineContent({
      type: 'inlineChecklist',
      props: {
        ...inlineContent.props,
        checked: nextChecked,
        autoFocus: false,
      },
    });
  };

  const handleLabelInput = (event: FormEvent<HTMLSpanElement>) => {
    if (readOnly || composingRef.current) return;
    syncLabelFromDom(event.currentTarget);
  };

  const handleLabelCompositionStart = () => {
    composingRef.current = true;
  };

  const handleLabelCompositionEnd = (event: ReactCompositionEvent<HTMLSpanElement>) => {
    composingRef.current = false;
    if (readOnly) return;
    syncLabelFromDom(event.currentTarget);
  };

  const handleLabelBlur = (event: ReactFocusEvent<HTMLSpanElement>) => {
    if (readOnly) return;
    const next = readLabelDomText(event.currentTarget);
    cancelCommitLabel();
    commitLabelNow(next);
  };

  const setLabelRef = (node: HTMLSpanElement | null) => {
    labelRef.current = node;
    writeLabelDomIfIdle(node, label);
  };

  const handleLabelKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    // 阻止快捷键冒泡到 ProseMirror；Enter 在芯片内换行
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      event.preventDefault();
      if (readOnly) return;
      const host = event.currentTarget;
      if (insertPlainTextAtCaret(host, '\n')) {
        syncLabelFromDom(host);
      }
    }
  };

  const handleLabelPaste = (event: ReactClipboardEvent<HTMLSpanElement>) => {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const text = event.clipboardData.getData('text/plain');
    const host = event.currentTarget;
    if (insertPlainTextAtCaret(host, text)) {
      syncLabelFromDom(host);
    }
  };

  const refreshCanJoinPrevious = (nextMode: InlineChecklistMode, nextGroupId: string) => {
    setCanJoinPrevious(
      nextMode === 'radio' &&
        canJoinPreviousRadioGroup(editor.prosemirrorView, rootRef.current, nextGroupId)
    );
  };

  const handleModeChange = (nextMode: InlineChecklistMode) => {
    if (readOnly || nextMode === mode) return;
    if (nextMode === 'radio') {
      // 默认已尝试并入上一组；拆组后才可能再出现「并入」
      applyRadioMode(editor, rootRef.current, { ...inlineContent.props });
    } else {
      applyCheckboxMode(editor, rootRef.current, { ...inlineContent.props });
    }
    setCanJoinPrevious(false);
  };

  const handleJoinPrevious = () => {
    if (readOnly) return;
    joinPreviousRadioGroup(editor, rootRef.current, { ...inlineContent.props });
    setCanJoinPrevious(false);
  };

  const handleSplitGroup = () => {
    if (readOnly) return;
    splitRadioGroup(editor, rootRef.current, { ...inlineContent.props });
    refreshCanJoinPrevious('radio', '');
  };

  const patchChecklistColors = (patch: InlineChecklistColorPatch) => {
    if (readOnly) return;
    // 写入新字段时清掉旧单色，避免 default + 残留 checklistColor 再次回退
    const propsWithLegacy = inlineContent.props as typeof inlineContent.props & {
      checklistColor?: unknown;
    };
    const { checklistColor: _removedLegacyColor, ...restProps } = propsWithLegacy;
    updateInlineContent({
      type: 'inlineChecklist',
      props: {
        ...restProps,
        ...patch,
        autoFocus: false,
      },
    });
  };

  /** 仅单击芯片打开模式工具栏（不响应 hover） */
  const openToolbarFromContent = () => {
    if (readOnly) return;
    syncToolbarPosition();
    refreshCanJoinPrevious(mode, groupId);
    setToolbarOpen(true);
  };

  const checkedAriaLabel =
    mode === 'radio'
      ? checked
        ? t('checklist.inlineRadioChecked')
        : t('checklist.inlineRadioUnchecked')
      : checked
        ? t('checklist.inlineChecked')
        : t('checklist.inlineUnchecked');

  return (
    <span
      ref={setRootRef}
      className={`${styles.root} bn-inline-checklist-root`}
      contentEditable={false}
      data-inline-checklist=""
      data-checked={checked ? 'true' : 'false'}
      data-mode={mode}
      data-checklist-border-color={borderColor}
      data-checklist-background-color={backgroundColor}
      data-group-id={groupId || undefined}
      onClick={openToolbarFromContent}
    >
      <span className={styles.control}>
        <input
          type="checkbox"
          className={styles.input}
          checked={checked}
          disabled={readOnly}
          aria-label={checkedAriaLabel}
          onChange={handleCheckedChange}
          onClick={(event) => {
            event.stopPropagation();
            if (mode === 'radio' && checked) {
              event.preventDefault();
            }
          }}
          onMouseDown={(event) => event.stopPropagation()}
        />
      </span>
      <span
        ref={setLabelRef}
        className={clsx(styles.label, 'bn-inline-checklist-label')}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        aria-multiline={true}
        data-placeholder={placeholder}
        data-empty={label.length === 0 ? 'true' : undefined}
        spellCheck={false}
        onInput={handleLabelInput}
        onCompositionStart={handleLabelCompositionStart}
        onCompositionEnd={handleLabelCompositionEnd}
        onBlur={handleLabelBlur}
        onKeyDown={handleLabelKeyDown}
        onPaste={handleLabelPaste}
        onClick={(event) => {
          event.stopPropagation();
          openToolbarFromContent();
        }}
        onMouseDown={(event) => event.stopPropagation()}
      />
      {toolbarOpen && toolbarPos
        ? createPortal(
            <div
              ref={toolbarRef}
              className={styles.modePopover}
              style={
                {
                  '--inline-checklist-toolbar-top': `${toolbarPos.top}px`,
                  '--inline-checklist-toolbar-left': `${toolbarPos.left}px`,
                } as CSSProperties
              }
              aria-label={t('checklist.modeLabel')}
            >
              <InlineChecklistModeToolbar
                mode={mode}
                borderColor={borderColor}
                backgroundColor={backgroundColor}
                colorPanelOpen={colorPanelOpen}
                canJoinPrevious={canJoinPrevious}
                onModeChange={handleModeChange}
                onBorderColorChange={(color) =>
                  patchChecklistColors({ checklistBorderColor: color })
                }
                onBackgroundColorChange={(color) =>
                  patchChecklistColors({ checklistBackgroundColor: color })
                }
                onResetColors={() =>
                  patchChecklistColors({
                    checklistBorderColor: 'default',
                    checklistBackgroundColor: 'default',
                  })
                }
                onToggleColorPanel={() => setColorPanelOpen((open) => !open)}
                onJoinPrevious={handleJoinPrevious}
                onSplitGroup={handleSplitGroup}
              />
            </div>,
            document.body
          )
        : null}
    </span>
  );
}

function InlineChecklistExportHTML(
  props: ReactCustomInlineContentRenderProps<typeof inlineChecklistConfig, DefaultStyleSchema>
) {
  const checked = readChecked(props.inlineContent.props.checked);
  const label = readLabel(props.inlineContent.props.label);
  const mode = readInlineChecklistMode(props.inlineContent.props.mode);
  const groupId = readGroupId(props.inlineContent.props.groupId);
  const borderColor = readChecklistBorderColor(props.inlineContent.props);
  const backgroundColor = readChecklistBackgroundColor(props.inlineContent.props);
  const mark = encodeInlineChecklistMark({
    checked,
    label,
    mode,
    groupId,
    borderColor,
    backgroundColor,
  });
  return <span data-inline-checklist-export={mark}>{` ${mark} `}</span>;
}

export const inlineChecklistContentSpec = createReactInlineContentSpec(inlineChecklistConfig, {
  render: InlineChecklistView,
  toExternalHTML: InlineChecklistExportHTML,
});
