/** 由 registry 注入，写操作完成后通知 Drive 视图更新。 */
export interface DriveChangeDeps {
  onDriveChange: () => void;
}
