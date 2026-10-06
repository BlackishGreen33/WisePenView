import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { build } from 'esbuild';

// 外部 API 使用 fixture，实际执行 service、mapper、分页 Hook 和通知生命周期。
const bundled = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { useDrivePagedTreeChildren } from './src/components/business/Drive/common/useDrivePagedTreeChildren';
      export function createPager(options) {
        let pager;
        function Probe() { pager = useDrivePagedTreeChildren(options); return null; }
        renderToStaticMarkup(createElement(Probe));
        return pager;
      }
      export { createAgentServices } from './src/domains/Agent/service/AgentServices.impl';
      export { createDocumentServices } from './src/domains/Document/service/DocumentServices.impl';
      export { createDriveServices } from './src/domains/Drive/service/DriveServices.impl';
      export { createNoteServices } from './src/domains/Note/service/NoteServices.impl';
      export { createResourceServices } from './src/domains/Resource/service/ResourceServices.impl';
      export { createSkillServices } from './src/domains/Skill/service/SkillServices.impl';
      export { createTagServices } from './src/domains/Tag/service/TagServices.impl';
      export { driveRefreshStore, requestDriveRefresh } from './src/domains/Drive/session/driveRefresh';
      export { resourceDisplayNameCache } from './src/domains/Resource/session/resourceDisplayNameCache';
      export { resetTabStores } from './src/store/lifecycle';
      export { handlers, requests } from '@domain-apis';
    `,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  tsconfig: 'tsconfig.app.json',
  define: { 'import.meta.env': '{}' },
  write: false,
  plugins: [
    {
      name: 'drive-fixtures',
      setup(builder) {
        builder.onResolve({ filter: /^(@heroui\/react|react-i18next)$/ }, (args) => ({
          path: args.path,
          namespace: 'ui-fixture',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'ui-fixture' }, (args) => ({
          contents:
            args.path === 'react-i18next'
              ? "export const useTranslation = () => ({ t: (key) => key }); export const initReactI18next = { type: '3rdParty', init() {} };"
              : 'export const toast = { danger() {} };',
        }));
        builder.onResolve({ filter: /^@domain-apis$/ }, () => ({
          path: 'apis',
          namespace: 'api-fixture',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'api-fixture' }, () => ({
          contents: `
          export const handlers = new Map();
          export const requests = [];
          const api = (name) => new Proxy({}, {
            get: (_, method) => async (...args) => {
              const key = name + '.' + String(method);
              requests.push({ key, args });
              if (!handlers.has(key)) throw new Error('未设置 API fixture：' + key);
              return handlers.get(key)(...args);
            },
          });
          export const AgentApi = api('AgentApi');
          export const DocumentApi = api('DocumentApi');
          export const NoteApi = api('NoteApi');
          export const ResourceItemApi = api('ResourceItemApi');
          export const ResourcePlacementApi = api('ResourcePlacementApi');
          export const SkillApi = api('SkillApi');
          export const TagApi = api('TagApi');
          export const putOssPresignedUrl = (...args) => api('Oss').put(...args);
          export const createOssClient = (...args) => api('Oss').createClient(...args);
        `,
        }));
      },
    },
  ],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(
  createRequire(import.meta.url),
  module,
  module.exports
);
const {
  createAgentServices,
  createDocumentServices,
  createDriveServices,
  createNoteServices,
  createResourceServices,
  createSkillServices,
  createTagServices,
  createPager,
  driveRefreshStore,
  requestDriveRefresh,
  resourceDisplayNameCache,
  resetTabStores,
  handlers,
  requests,
} = module.exports;
const changeDeps = { onDriveChange: requestDriveRefresh };
const version = () => driveRefreshStore.getState().refreshVersion;
function resetFixtures() {
  handlers.clear();
  requests.length = 0;
  driveRefreshStore.setState({ refreshVersion: 0 });
}
function fixture(key, result) {
  handlers.set(key, async () => result);
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const scope = { type: 'personal', rootId: 'root' };
const parent = { id: 'folder', type: 'folder', scope };
const stableIds = (nodes) => nodes.filter((node) => node.type !== 'loading').map((node) => node.id);

// 所有用例顺序执行，避免共用 API fixture 和通知版本互相干扰。
test('创建笔记完成后所有订阅者收到一次通知，并保留目标目录', async () => {
  resetFixtures();
  const pending = deferred();
  handlers.set('NoteApi.addNote', () => pending.promise);
  const service = createNoteServices({
    resourceService: createResourceServices(changeDeps),
    ...changeDeps,
  });
  const observed = [[], []];
  const unsubscribers = observed.map((versions) =>
    driveRefreshStore.subscribe((state) => versions.push(state.refreshVersion))
  );
  try {
    const creating = service.createNote({ title: '新笔记', pathTagId: 'folder-target' });
    assert.equal(version(), 0);
    pending.resolve('note-new');
    assert.deepEqual(await creating, { resourceId: 'note-new' });
    assert.deepEqual(observed, [[1], [1]]);
    assert.equal(requests[0].args[0].mountTargetTagId, 'folder-target');
  } finally {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
});

test('失败或缺少资源 ID 的创建不通知成功刷新', async () => {
  resetFixtures();
  const failure = new Error('创建失败');
  handlers.set('NoteApi.addNote', async () => {
    throw failure;
  });
  const service = createNoteServices({
    resourceService: createResourceServices(changeDeps),
    ...changeDeps,
  });
  await assert.rejects(service.createNote({ title: '失败笔记' }), (error) => error === failure);
  fixture('NoteApi.addNote', '');
  assert.deepEqual(await service.createNote({ title: '空响应' }), { resourceId: undefined });
  assert.equal(version(), 0);
});

test('编辑器同步标题只通知一次，通知时名称缓存已经更新', async () => {
  resetFixtures();
  fixture('ResourceItemApi.renameResource', undefined);
  const noteService = createNoteServices({
    resourceService: createResourceServices(changeDeps),
    ...changeDeps,
  });
  const unsubscribe = driveRefreshStore.subscribe(() =>
    assert.equal(resourceDisplayNameCache.getState().byResourceId['note-1'], '新标题')
  );
  try {
    await noteService.syncTitle({ resourceId: 'note-1', newName: '新标题' });
    assert.equal(version(), 1);
  } finally {
    unsubscribe();
  }
});

test('资源移动、挂载、删除与权限写入通知，无变更和失败不通知', async () => {
  resetFixtures();
  const service = createResourceServices(changeDeps);
  fixture('ResourcePlacementApi.setPersonalResourcesPathTag', { resourceCount: 0 });
  assert.equal(
    await service.setPersonalResourcesPathTag({
      resourceIds: ['note-1'],
      targetPathTagId: 'target',
    }),
    0
  );
  assert.equal(version(), 0);
  fixture('ResourcePlacementApi.setPersonalResourcesPathTag', { resourceCount: 1 });
  await service.setPersonalResourcesPathTag({ resourceIds: ['note-1'], targetPathTagId: 'target' });
  fixture('ResourcePlacementApi.mountResourcesToGroup', { resourceCount: 1 });
  await service.mountResourcesToGroup({
    resourceIds: ['note-1'],
    groupId: 'group-1',
    targetTagId: 'target',
  });
  fixture('ResourcePlacementApi.unmountResourcesToGroup', { resourceCount: 1 });
  await service.unmountResourcesToGroup({
    groupId: 'group-1',
    resourceSourceTagMap: { 'note-1': 'target' },
  });
  fixture('ResourcePlacementApi.movePersonalResourcesToTrash', { resourceCount: 1 });
  await service.movePersonalResourcesToTrash({ resourceIds: ['note-1'] });
  fixture('ResourceItemApi.removeResources', undefined);
  await service.removeResources({ resourceIds: ['note-1'] });
  fixture('ResourceItemApi.changeResourceActionPermission', undefined);
  await service.updateResourceActionPermission({
    resourceId: 'note-1',
    overrideGrantedActions: { 'group-1': [] },
  });
  assert.equal(version(), 6);
  handlers.set('ResourceItemApi.removeResources', async () => {
    throw new Error('删除失败');
  });
  await assert.rejects(service.removeResources({ resourceIds: ['note-1'] }));
  assert.equal(version(), 6);
});

test('标签变更先失效缓存；排序部分成功后仍通知更新', async () => {
  resetFixtures();
  fixture('TagApi.getTagTree', [
    { tagId: 'first', tagName: '/第一项', parentId: 'root' },
    { tagId: 'second', tagName: '/第二项', parentId: 'root' },
  ]);
  const service = createTagServices(changeDeps);
  await service.getRawTagTree();
  const unsubscribe = driveRefreshStore.subscribe(() =>
    assert.equal(service.getRawTagById('first'), undefined)
  );
  try {
    let writes = 0;
    handlers.set('TagApi.changeTag', async () => {
      if (++writes === 2) throw new Error('第二项失败');
    });
    await assert.rejects(service.reorderSiblingTags({ orderedTagIds: ['first', 'second'] }));
    assert.equal(version(), 1);
    assert.equal(writes, 2);
    await service.getRawTagTree();
    fixture('TagApi.changeTag', undefined);
    await service.updateTag({ targetTagId: 'first', tagName: '/新名称' });
    assert.equal(version(), 2);
  } finally {
    unsubscribe();
  }
});

test('Drive 混合移动部分成功时，成功写入仍通知其他实例', async () => {
  resetFixtures();
  fixture('ResourcePlacementApi.setPersonalResourcesPathTag', { resourceCount: 1 });
  handlers.set('TagApi.moveTags', async () => {
    throw new Error('文件夹移动失败');
  });
  const service = createDriveServices({
    resourceService: createResourceServices(changeDeps),
    tagService: createTagServices(changeDeps),
  });
  await assert.rejects(
    service.moveNodes({
      nodes: [
        {
          type: 'resource',
          id: 'resource-node',
          resourceId: 'note-1',
          mountTagId: 'source',
          parentId: 'source-node',
          scope,
        },
        {
          type: 'folder',
          id: 'folder-node',
          tagId: 'folder',
          parentId: 'root',
          ancestorTagIds: [],
          scope,
        },
      ],
      target: {
        type: 'folder',
        id: 'target-node',
        tagId: 'target',
        parentId: 'root',
        ancestorTagIds: [],
        scope,
      },
    })
  );
  assert.equal(version(), 1);
});

test('Agent、Skill 创建和资源复制都经过 service 通知', async () => {
  resetFixtures();
  fixture('AgentApi.createAgent', 'agent-new');
  fixture('SkillApi.createSkill', 'skill-new');
  fixture('SkillApi.forkSkill', 'skill-copy');
  fixture('NoteApi.forkNote', 'note-copy');
  fixture('DocumentApi.forkDocument', 'doc-copy');
  const resourceService = createResourceServices(changeDeps);
  assert.equal(await createAgentServices(changeDeps).createAgent('Agent'), 'agent-new');
  const skills = createSkillServices({ resourceService, ...changeDeps });
  assert.equal(await skills.createSkill('Skill'), 'skill-new');
  assert.equal(
    await skills.forkSkill({ resourceId: 'skill-new', forkedResourceName: '副本' }),
    'skill-copy'
  );
  assert.deepEqual(
    await createNoteServices({ resourceService, ...changeDeps }).forkNote({
      resourceId: 'note-1',
      forkedResourceName: '副本',
    }),
    { resourceId: 'note-copy' }
  );
  assert.equal(
    await createDocumentServices(changeDeps).forkDocument({
      resourceId: 'doc-1',
      forkedResourceName: '副本',
    }),
    'doc-copy'
  );
  assert.equal(version(), 5);
});

test('文档处理完成时通知，处理中的轮询不触发 Drive 重读', async () => {
  resetFixtures();
  const service = createDocumentServices(changeDeps);
  fixture('DocumentApi.syncDocStatus', { status: 'REGISTERING_RES' });
  await service.syncPendingDocStatus('doc-1');
  assert.equal(version(), 0);
  fixture('DocumentApi.syncDocStatus', { status: 'READY' });
  await service.syncPendingDocStatus('doc-1');
  assert.equal(version(), 1);
});

test('刷新通知按标签页生命周期重置，重置后仍可通知', () => {
  resetFixtures();
  globalThis.sessionStorage = {
    length: 0,
    key() {
      return null;
    },
  };
  try {
    requestDriveRefresh();
    resetTabStores();
    assert.equal(version(), 0);
    requestDriveRefresh();
    assert.equal(version(), 1);
  } finally {
    delete globalThis.sessionStorage;
  }
});

test('上传队列观察到延迟注册完成时通知，重复 READY 队列不通知', async () => {
  resetFixtures();
  const service = createDocumentServices(changeDeps);
  const doc = {
    documentId: 'doc-late',
    uploadMeta: {},
    documentStatus: { status: 'REGISTERING_RES' },
  };
  fixture('DocumentApi.listPendingDocs', [doc]);
  await service.listPendingDocs();
  assert.equal(version(), 0);
  fixture('DocumentApi.listPendingDocs', [{ ...doc, documentStatus: { status: 'READY' } }]);
  await service.listPendingDocs();
  await service.listPendingDocs();
  assert.equal(version(), 1);
});

test('不同 Drive 实例各自分页，连续加载不使用旧数据闭包', async () => {
  const options = (prefix) => ({
    loadPage: async ({ cursor }) => ({
      nodes: [{ type: 'resource', id: prefix + (cursor ?? 'first') }],
      total: 3,
      nextCursor: cursor === 'last' ? undefined : cursor ? 'last' : 'second',
    }),
  });
  const first = createPager(options('a-'));
  const second = createPager(options('b-'));
  await first.loadChildren(parent);
  await second.loadChildren(parent);
  assert.deepEqual(stableIds(await first.loadMoreChildren(parent)), ['a-first', 'a-second']);
  assert.deepEqual(stableIds(await first.loadMoreChildren(parent)), [
    'a-first',
    'a-second',
    'a-last',
  ]);
  assert.deepEqual(stableIds(await second.loadMoreChildren(parent)), ['b-first', 'b-second']);
});

test('刷新前的子节点和加载更多请求不能回写新分页状态', async () => {
  const oldPageResult = deferred();
  let moreResult = deferred();
  let old = true;
  const pager = createPager({
    loadPage: ({ cursor }) => {
      if (cursor) return moreResult.promise;
      if (old) return oldPageResult.promise;
      return Promise.resolve({
        nodes: [{ type: 'resource', id: 'fresh' }],
        total: 2,
        nextCursor: 'fresh-cursor',
      });
    },
  });
  const oldPage = pager.loadChildren(parent);
  pager.reset();
  old = false;
  await pager.loadChildren(parent);
  oldPageResult.resolve({ nodes: [{ type: 'resource', id: 'stale' }], total: 1 });
  await oldPage;
  assert.equal(pager.getPageState(parent.id).cursor, 'fresh-cursor');
  const oldMore = pager.loadMoreChildren(parent);
  pager.reset();
  await pager.loadChildren(parent);
  moreResult.resolve({ nodes: [{ type: 'resource', id: 'stale-more' }], total: 1 });
  await oldMore;
  assert.equal(pager.getPageState(parent.id).cursor, 'fresh-cursor');
  moreResult = deferred();
  const newMore = pager.loadMoreChildren(parent);
  moreResult.resolve({ nodes: [{ type: 'resource', id: 'fresh-more' }], total: 2 });
  assert.deepEqual(stableIds(await newMore), ['fresh', 'fresh-more']);
});

test('文档秒传与 OSS 完成后通知，OSS 失败不通知完成', async () => {
  resetFixtures();
  const originalReader = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((result) => this.onload({ target: { result } }));
    }
  };
  try {
    const service = createDocumentServices(changeDeps);
    const file = new File(['pdf'], 'example.pdf');
    fixture('DocumentApi.uploadDoc', { documentId: 'flash-doc', flashUploaded: true });
    assert.equal(await service.uploadDocument({ file, pathTagId: 'target' }), 'flash-doc');
    assert.equal(requests[0].args[0].mountTargetTagId, 'target');
    assert.equal(version(), 1);
    fixture('DocumentApi.uploadDoc', {
      documentId: 'oss-doc',
      putUrl: 'https://oss.example/put',
      callbackHeader: 'callback',
    });
    fixture('Oss.put', undefined);
    assert.equal(await service.uploadDocument({ file, pathTagId: 'target' }), 'oss-doc');
    assert.equal(version(), 2);
    handlers.set('Oss.put', async () => {
      throw new Error('上传失败');
    });
    await assert.rejects(service.uploadDocument({ file, pathTagId: 'target' }));
    assert.equal(version(), 2);
  } finally {
    if (originalReader) globalThis.FileReader = originalReader;
    else delete globalThis.FileReader;
  }
});
