import { invalidApiResponse, isFiniteNumber, isRecord } from '@/apis/runtimeContract';
import {
  mapVersionResourceInfo,
  validateVersionBundle,
} from '@/domains/_shared/mapper/versionAsset.map';
import type { ResourcePermissionOverview } from '@/domains/Resource';
import { ResourceServicesMap } from '@/domains/Resource/mapper/ResourceServices.map';
import { normalizeNonNegativeNumber } from '@/utils/normalize/normalizeNumber';

import type {
  AgentAssetResourceTypeApiValue,
  AgentInfoApiResponse,
  AgentSpecApi,
  AgentVersionBundleApiResponse,
  UpdateAgentInfoApiRequest,
  UpdateAgentSpecApiRequest,
} from '../apis/AgentApi.type';
import { AGENT_ASSET_RESOURCE_TYPE_API } from '../apis/AgentApi.type';
import type { AgentDetail, AgentSpec } from '../entity/agent';
import type { SaveAgentDraftRequest } from '../service/index.type';

const AGENT_SPEC_FALLBACK: AgentSpec = {
  systemPrompt: '',
  autoGenerateTitle: true,
  modelPolicy: { defaultModelId: '', defaultProviderId: '', allowRequestOverride: true },
  toolAndSkillPolicy: {
    enableUseTool: true,
    toolSelectionDefaultEnabled: true,
    toolSelectionOverrides: {},
    enableUseSkill: true,
    onDemandSkillIds: [],
    skillMatchTopK: 3,
  },
  memoryPolicy: {
    enableChatMemory: true,
    enablePersistenceChatMemory: true,
    enableChatMemorySummary: true,
    highWatermarkRatio: 0.8,
    lowWatermarkRatio: 0.5,
    summaryPrompt: '',
    enableLongTermMemory: false,
    longTermMemoryLimit: 10,
    longTermMemoryScoreThreshold: 0.6,
  },
};

const mapSpec = (spec?: AgentSpecApi | null): AgentSpec => {
  if (spec != null && !isRecord(spec)) invalidApiResponse('Agent spec 契约无效');
  const value = spec as AgentSpecApi | undefined;
  const modelPolicy = isRecord(value?.modelPolicy)
    ? (value?.modelPolicy as NonNullable<AgentSpecApi['modelPolicy']>)
    : undefined;
  const toolPolicy = isRecord(value?.toolAndSkillPolicy)
    ? (value?.toolAndSkillPolicy as NonNullable<AgentSpecApi['toolAndSkillPolicy']>)
    : undefined;
  const memoryPolicy = isRecord(value?.memoryPolicy)
    ? (value?.memoryPolicy as NonNullable<AgentSpecApi['memoryPolicy']>)
    : undefined;
  const string = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;
  const boolean = (value: unknown): boolean | undefined =>
    typeof value === 'boolean' ? value : undefined;
  const number = (value: unknown): number | undefined =>
    isFiniteNumber(value) ? value : undefined;
  return {
    systemPrompt: string(value?.systemPrompt) ?? AGENT_SPEC_FALLBACK.systemPrompt,
    agentMd: string(value?.agentMd),
    autoGenerateTitle: boolean(value?.autoGenerateTitle) ?? AGENT_SPEC_FALLBACK.autoGenerateTitle,
    billingGroupId: string(value?.billingGroupId),
    agentMaxIterations:
      number(value?.agentMaxIterations) !== undefined &&
      Number.isInteger(number(value?.agentMaxIterations)) &&
      (number(value?.agentMaxIterations) as number) >= 1
        ? number(value?.agentMaxIterations)
        : undefined,
    modelPolicy: {
      defaultModelId: string(modelPolicy?.defaultModelId) ?? '',
      defaultProviderId: string(modelPolicy?.defaultProviderId) ?? '',
      allowRequestOverride:
        boolean(modelPolicy?.allowRequestOverride) ??
        AGENT_SPEC_FALLBACK.modelPolicy.allowRequestOverride,
    },
    toolAndSkillPolicy: {
      enableUseTool:
        boolean(toolPolicy?.enableUseTool) ?? AGENT_SPEC_FALLBACK.toolAndSkillPolicy.enableUseTool,
      toolSelectionDefaultEnabled:
        boolean(toolPolicy?.toolSelectionDefaultEnabled) ??
        AGENT_SPEC_FALLBACK.toolAndSkillPolicy.toolSelectionDefaultEnabled,
      toolSelectionOverrides: isRecord(toolPolicy?.toolSelectionOverrides)
        ? Object.fromEntries(
            Object.entries(toolPolicy.toolSelectionOverrides).filter(
              (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
            )
          )
        : {},
      enableUseSkill:
        boolean(toolPolicy?.enableUseSkill) ??
        AGENT_SPEC_FALLBACK.toolAndSkillPolicy.enableUseSkill,
      onDemandSkillIds: Array.isArray(toolPolicy?.onDemandSkillIds)
        ? toolPolicy.onDemandSkillIds.filter((id): id is string => typeof id === 'string')
        : [],
      skillMatchTopK:
        number(toolPolicy?.skillMatchTopK) ?? AGENT_SPEC_FALLBACK.toolAndSkillPolicy.skillMatchTopK,
    },
    memoryPolicy: {
      enableChatMemory:
        boolean(memoryPolicy?.enableChatMemory) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.enableChatMemory,
      enablePersistenceChatMemory:
        boolean(memoryPolicy?.enablePersistenceChatMemory) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.enablePersistenceChatMemory,
      enableChatMemorySummary:
        boolean(memoryPolicy?.enableChatMemorySummary) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.enableChatMemorySummary,
      highWatermarkRatio:
        number(memoryPolicy?.highWatermarkRatio) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.highWatermarkRatio,
      lowWatermarkRatio:
        number(memoryPolicy?.lowWatermarkRatio) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.lowWatermarkRatio,
      summaryPrompt: string(memoryPolicy?.summaryPrompt) ?? '',
      enableLongTermMemory:
        boolean(memoryPolicy?.enableLongTermMemory) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.enableLongTermMemory,
      longTermMemoryLimit:
        number(memoryPolicy?.longTermMemoryLimit) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.longTermMemoryLimit,
      longTermMemoryScoreThreshold:
        number(memoryPolicy?.longTermMemoryScoreThreshold) ??
        AGENT_SPEC_FALLBACK.memoryPolicy.longTermMemoryScoreThreshold,
    },
  };
};

const mapAgentSpecToApi = (spec: AgentSpec): AgentSpecApi => ({
  systemPrompt: spec.systemPrompt,
  agentMd: spec.agentMd,
  autoGenerateTitle: spec.autoGenerateTitle,
  billingGroupId: spec.billingGroupId,
  agentMaxIterations: spec.agentMaxIterations,
  modelPolicy: { ...spec.modelPolicy },
  toolAndSkillPolicy: {
    ...spec.toolAndSkillPolicy,
    toolSelectionOverrides: { ...spec.toolAndSkillPolicy.toolSelectionOverrides },
    onDemandSkillIds: [...spec.toolAndSkillPolicy.onDemandSkillIds],
  },
  memoryPolicy: { ...spec.memoryPolicy },
});

const mapSaveAgentDraftRequests = (
  request: SaveAgentDraftRequest
): {
  info: UpdateAgentInfoApiRequest;
  spec: UpdateAgentSpecApiRequest;
} => ({
  info: {
    resourceId: request.resourceId,
    name: request.name,
    description: request.description,
  },
  spec: {
    resourceId: request.resourceId,
    draftVersion: request.draftVersion,
    spec: mapAgentSpecToApi(request.spec),
  },
});

const resolveAssetResourceType = (name: string): AgentAssetResourceTypeApiValue => {
  const extension = name.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, AgentAssetResourceTypeApiValue> = {
    md: AGENT_ASSET_RESOURCE_TYPE_API.MD,
    py: AGENT_ASSET_RESOURCE_TYPE_API.PYTHON_SCRIPT,
    json: AGENT_ASSET_RESOURCE_TYPE_API.JSON,
    yaml: AGENT_ASSET_RESOURCE_TYPE_API.YAML,
    yml: AGENT_ASSET_RESOURCE_TYPE_API.YAML,
    toml: AGENT_ASSET_RESOURCE_TYPE_API.TOML,
  };
  return typeMap[extension ?? ''] ?? AGENT_ASSET_RESOURCE_TYPE_API.TEXT;
};

const mapAgentDetail = (params: {
  resourceId: string;
  info?: AgentInfoApiResponse;
  bundle?: AgentVersionBundleApiResponse;
}): AgentDetail => {
  if (params.info != null && !isRecord(params.info)) invalidApiResponse('Agent 信息契约无效');
  if (params.bundle != null) validateVersionBundle(params.bundle);
  const info = params.info as AgentInfoApiResponse | undefined;
  const bundle = params.bundle as AgentVersionBundleApiResponse | undefined;
  const resource = info?.resourceInfo
    ? ResourceServicesMap.mapResourceItemFromApi(info.resourceInfo)
    : undefined;
  const agentInfo = info?.agentInfo ? mapVersionResourceInfo(info.agentInfo) : undefined;
  const publishedVersion = agentInfo?.version ?? 0;
  const version = bundle?.version ?? publishedVersion;
  return {
    resourceId: params.resourceId,
    resourceInfo: resource,
    title: resource?.resourceName ?? 'Agent',
    name: agentInfo?.name ?? '',
    description: agentInfo?.description ?? '',
    publishedVersion,
    draftVersion: publishedVersion + 1,
    version,
    status: bundle?.status ?? (publishedVersion > 0 ? 'PUBLISHED' : 'DRAFT'),
    spec: mapSpec(bundle?.spec),
    assets: (bundle?.assets ?? []).map((asset) => ({
      id: asset.id ?? '',
      name: asset.name ?? '',
      path: asset.path ?? '/',
      objectKey: typeof asset.objectKey === 'string' ? asset.objectKey : undefined,
      assetResourceType: asset.assetResourceType ?? 'TEXT',
      uploadStatus: asset.uploadStatus ?? 'UPLOADING',
      size: normalizeNonNegativeNumber(asset.size) ?? 0,
    })),
    ownerId: resource?.ownerId,
    currentActions: resource?.currentActions,
  };
};

const mapAgentPermissionOverviewFromApi = (
  info: AgentInfoApiResponse | null | undefined,
  resourceId: string
): ResourcePermissionOverview =>
  ResourceServicesMap.mapResourcePermissionOverviewFromApi(
    info?.resourceInfo ?? { resourceId, resourceName: '', ownerInfo: {} },
    resourceId
  );

export const AgentServicesMap = {
  mapAgentDetail,
  mapAgentPermissionOverviewFromApi,
  mapSaveAgentDraftRequests,
  mapSpec,
  resolveAssetResourceType,
};
