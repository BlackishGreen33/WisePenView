/**
 * 字体与字号的取值定义：行内 mark 的值、菜单选项、AI Diff 预览和外部 HTML 共用这一份映射。
 *
 * 字体只使用系统字体栈，不打包字体文件：仓库里没有附加的字体许可与体积成本，
 * 代价是每台机器实际渲染的字体由本地安装情况决定，靠 fallback 链逐级降级。
 */

export const FONT_SIZE_STYLE_TYPE = 'fontSize';
export const FONT_FAMILY_STYLE_TYPE = 'fontFamily';

/** 字号预设（px）。`default` 表示不写 mark，回到正文默认字号。 */
export const NOTE_FONT_SIZE_PX = {
  small: 14,
  large: 18,
  xlarge: 22,
  xxlarge: 28,
} as const;

export type NoteFontSizeValue = keyof typeof NOTE_FONT_SIZE_PX | 'default';

/** 菜单顺序：默认档次插在小号与大号之间，便于从常用字号向两侧选取。 */
export const NOTE_FONT_SIZE_VALUES: readonly NoteFontSizeValue[] = [
  'small',
  'default',
  'large',
  'xlarge',
  'xxlarge',
];

/** 字体族预设：全部为系统字体栈，中文优先命中本地字库，未命中时降级到通用族。 */
export const NOTE_FONT_FAMILY_STACKS = {
  serif: '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, STSong, serif',
  kai: '"Kaiti SC", STKaiti, KaiTi, 楷体, "Kaiti TC", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
} as const;

export type NoteFontFamilyValue = keyof typeof NOTE_FONT_FAMILY_STACKS | 'default';

export const NOTE_FONT_FAMILY_VALUES: readonly NoteFontFamilyValue[] = [
  'default',
  'serif',
  'kai',
  'mono',
];

export function getFontSizePx(value: string): number | undefined {
  return Object.hasOwn(NOTE_FONT_SIZE_PX, value)
    ? NOTE_FONT_SIZE_PX[value as keyof typeof NOTE_FONT_SIZE_PX]
    : undefined;
}

export function getFontFamilyStack(value: string): string | undefined {
  return Object.hasOwn(NOTE_FONT_FAMILY_STACKS, value)
    ? NOTE_FONT_FAMILY_STACKS[value as keyof typeof NOTE_FONT_FAMILY_STACKS]
    : undefined;
}

/** 字号 mark 的视觉结果；未识别的取值（旧版本或被删除的 preset）不写任何样式。 */
export function applyFontSizeStyle(element: HTMLElement, value: string): void {
  const px = getFontSizePx(value);
  if (px === undefined) return;
  element.style.fontSize = `${px}px`;
}

export function applyFontFamilyStyle(element: HTMLElement, value: string): void {
  const stack = getFontFamilyStack(value);
  if (stack === undefined) return;
  element.style.fontFamily = stack;
}
