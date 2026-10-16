import { Dropdown, ListBox } from '@heroui/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import AppModal from '@/components/base/AppModal';
import AppPopover from '@/components/base/AppPopover';
import { AppButton } from '@/components/base/Button';
import Input from '@/components/base/Input/Input';
import Select from '@/components/base/Input/Select';
import { DataTable } from '@/components/base/Table';
import AppAlertDialog from '@/components/business/AppAlertDialog';
import AppSidebarTabs from '@/components/business/Sidebar/_common/tab';
import { ServicesProvider } from '@/domains';
import { AppAuthProvider } from '@/layouts/App/_context';
import { AppNavigationProvider } from '@/layouts/AppNavigation/_context';

import styles from './Radius.stories.module.less';

const OPTIONS = [
  { id: 'all', label: '全部' },
  { id: 'mine', label: '我加入的' },
  { id: 'managed', label: '我管理的' },
] as const;

const appNavigationValue = {
  canGoBack: false,
  canGoForward: false,
  goBack: () => undefined,
  goForward: () => undefined,
  openCommandPalette: () => undefined,
};

function SidebarExample({ children }: { children: ReactNode }) {
  return (
    <ServicesProvider>
      <AppAuthProvider mode="authenticated">
        <AppNavigationProvider value={appNavigationValue}>
          <MemoryRouter>{children}</MemoryRouter>
        </AppNavigationProvider>
      </AppAuthProvider>
    </ServicesProvider>
  );
}

function SelectExample() {
  return (
    <Select label="Select trigger 8px / 展开面板 12px" defaultSelectedKey="all">
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label="选择范围">
          {OPTIONS.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function DropdownExample() {
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <AppButton variant="secondary">操作菜单</AppButton>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="操作菜单" selectionMode="single" defaultSelectedKeys={['mine']}>
          {OPTIONS.map((option) => (
            <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const meta = {
  title: 'Foundations/圆角系统',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverlayStates: Story = {
  render: () => (
    <div className={styles.grid}>
      <AppPopover>
        <AppPopover.Trigger>
          <AppButton>打开 Popover</AppButton>
        </AppPopover.Trigger>
        <AppPopover.Content title="浮层标题">
          <ListBox aria-label="浮层选中项" selectionMode="single" defaultSelectedKeys={['mine']}>
            {OPTIONS.map((option) => (
              <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </AppPopover.Content>
      </AppPopover>
      <DropdownExample />
      <SelectExample />
    </div>
  ),
};
export const InteractiveControls: Story = {
  render: () => (
    <div className={styles.grid}>
      <AppButton>标准按钮</AppButton>
      <AppButton variant="secondary">次要按钮</AppButton>
      <Input aria-label="工作区名称" defaultValue="WisePen" />
      <DataTable
        ariaLabel="圆角规范表格"
        rowKey="id"
        items={[{ id: '1', name: 'Table control', radius: '单元格圆角' }]}
        columns={[
          { id: 'name', label: '控件', isRowHeader: true, renderCell: (row) => row.name },
          { id: 'radius', label: '圆角', renderCell: (row) => row.radius },
        ]}
        virtualized={false}
      />
    </div>
  ),
};
export const SidebarStates: Story = {
  render: () => (
    <SidebarExample>
      <div className={styles.sidebarFrame}>
        <AppSidebarTabs />
      </div>
    </SidebarExample>
  ),
};

export const ModalRadius: Story = {
  render: () => (
    <AppModal isOpen onOpenChange={() => undefined} title="普通 Modal" description="12px 圆角">
      普通尺寸弹窗内容
    </AppModal>
  ),
};

export const FullCoverModalRadius: Story = {
  render: () => (
    <AppModal
      isOpen
      onOpenChange={() => undefined}
      title="Full / cover Modal"
      size="full"
      placement="center"
    >
      全屏覆盖弹窗内容
    </AppModal>
  ),
};

export const AlertDialogRadius: Story = {
  render: () => (
    <AppAlertDialog
      isOpen
      onOpenChange={() => undefined}
      title="AlertDialog"
      description="确认操作并验证弹窗圆角。"
    >
      AlertDialog 内容
    </AppAlertDialog>
  ),
};
