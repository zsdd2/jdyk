<script lang="ts" setup>
import type {
  AiSettings,
  AiSettingsProvider,
  UpdateAiSettingsInput,
} from '#/api/photo-library';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  getAiSettingsApi,
  updateAiSettingsApi,
} from '#/api/photo-library';

const TextArea = Input.TextArea;
const PasswordInput = Input.Password;

const loading = ref(false);
const saving = ref(false);
const settings = ref<AiSettings>();
const unifiedPrompt = ref('');
const outputContractPrompt = ref('');
const form = reactive<UpdateAiSettingsInput>({
  aiCheckIntervalMinutes: 60,
  apiKey: '',
  baseUrl: '',
  classificationPrompt: '',
  commentPrompt: '',
  layoutPrompt: '',
  dailyAiLimit: 100,
  model: '',
  outputContractPrompt: '',
  provider: 'openai_compatible',
  scoringPrompt: '',
});

const providerOptions: Array<{ label: string; value: AiSettingsProvider }> = [
  { label: 'OpenAI Compatible', value: 'openai_compatible' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'qwen' },
  { label: '自定义', value: 'custom' },
];

function buildLegacyUnifiedPrompt(data: AiSettings) {
  return [
    data.scoringPrompt.trim(),
    data.commentPrompt.trim(),
    data.classificationPrompt.trim(),
    data.layoutPrompt.trim(),
  ].filter(Boolean).join('\n\n');
}

async function loadSettings() {
  loading.value = true;
  try {
    const data = await getAiSettingsApi();
    settings.value = data;
    Object.assign(form, {
      apiKey: '',
      aiCheckIntervalMinutes: data.aiCheckIntervalMinutes,
      baseUrl: data.baseUrl,
      classificationPrompt: data.classificationPrompt,
      commentPrompt: data.commentPrompt,
      layoutPrompt: data.layoutPrompt,
      dailyAiLimit: data.dailyAiLimit,
      model: data.model,
      outputContractPrompt: data.outputContractPrompt ?? '',
      provider: data.provider,
      scoringPrompt: data.scoringPrompt,
    });
    outputContractPrompt.value = data.outputContractPrompt ?? '';
    unifiedPrompt.value = data.scoringPrompt?.includes('photo_tv_payload_v1')
      ? data.scoringPrompt
      : buildLegacyUnifiedPrompt(data);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const payload: UpdateAiSettingsInput = {
      aiCheckIntervalMinutes: form.aiCheckIntervalMinutes,
      baseUrl: form.baseUrl,
      classificationPrompt: '',
      commentPrompt: '',
      layoutPrompt: '',
      dailyAiLimit: form.dailyAiLimit,
      model: form.model,
      outputContractPrompt: outputContractPrompt.value ?? '',
      provider: form.provider,
      scoringPrompt: unifiedPrompt.value,
    };
    if (form.apiKey?.trim()) {
      payload.apiKey = form.apiKey.trim();
    }
    settings.value = await updateAiSettingsApi(payload);
    form.apiKey = '';
    message.success('AI 设置已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <Page description="AI 平台、统一提示词与电视端播放版式输出" title="AI 设置">
    <Space class="mb-4" wrap>
      <Button :loading="loading" @click="loadSettings">刷新</Button>
      <Button :loading="saving" type="primary" @click="saveSettings">
        保存设置
      </Button>
      <Tag :color="settings?.apiKeyConfigured ? 'success' : 'warning'">
        {{ settings?.apiKeyConfigured ? 'API Key 已配置' : 'API Key 未配置' }}
      </Tag>
    </Space>

    <div class="ai-settings-grid">
      <Card :loading="loading" title="接口配置">
        <div class="settings-form">
          <label>
            <span>平台</span>
            <Select
              v-model:value="form.provider"
              :options="providerOptions"
            />
          </label>

          <label>
            <span>模型</span>
            <Input v-model:value="form.model" placeholder="gpt-4o-mini" />
          </label>

          <label>
            <span>接口地址</span>
            <Input
              v-model:value="form.baseUrl"
              placeholder="https://api.example.com/v1"
            />
          </label>

          <label>
            <span>API Key</span>
            <PasswordInput
              v-model:value="form.apiKey"
              placeholder="留空则保留已配置 Key"
            />
          </label>

          <label>
            <span>统一检索间隔（分钟）</span>
            <InputNumber
              v-model:value="form.aiCheckIntervalMinutes"
              :min="5"
              style="width: 100%"
            />
          </label>

          <label>
            <span>系统默认每日最大识别数量</span>
            <InputNumber
              v-model:value="form.dailyAiLimit"
              :min="1"
              style="width: 100%"
            />
          </label>
        </div>
      </Card>

      <Card :loading="loading" title="当前状态">
        <Descriptions :column="1" size="small" bordered>
          <DescriptionsItem label="平台">
            {{ settings?.provider || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="模型">
            {{ settings?.model || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="接口地址">
            {{ settings?.baseUrl || '未配置' }}
          </DescriptionsItem>
          <DescriptionsItem label="接口模块">
            <Tag color="default">OpenAI-compatible Vision</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="统一检索间隔">
            {{ settings?.aiCheckIntervalMinutes || '-' }} 分钟
          </DescriptionsItem>
          <DescriptionsItem label="默认每日识别">
            {{ settings?.dailyAiLimit || '-' }} 张
          </DescriptionsItem>
          <DescriptionsItem label="提示词契约">
            <Tag :color="outputContractPrompt?.includes('photo_tv_payload_v1') ? 'success' : 'warning'">
              {{ outputContractPrompt?.includes('photo_tv_payload_v1') ? '独立标准契约' : '未拆分' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="更新时间">
            {{ settings?.updatedAt || '-' }}
          </DescriptionsItem>
        </Descriptions>
      </Card>
    </div>

    <Card class="mt-4" :loading="loading" title="业务 Vision 提示词">
      <div class="prompt-grid">
        <label>
          <span>可自由调整的业务提示词</span>
          <TextArea
            v-model:value="unifiedPrompt"
            :auto-size="{ minRows: 18, maxRows: 32 }"
            placeholder="描述这套照片的审美、评分、旁白、分类和家庭相册偏好。不要在这里写死系统字段契约。"
          />
        </label>
      </div>
    </Card>

    <Card class="mt-4" :loading="loading" title="标准输出字段要求">
      <div class="prompt-grid">
        <label>
          <span>系统必须遵守的 JSON 字段契约</span>
          <TextArea
            v-model:value="outputContractPrompt"
            :auto-size="{ minRows: 12, maxRows: 28 }"
            placeholder="例如：必须返回 schema_version、caption、classification、scores、narration_options、selected_narration_index 和 layout_plan；最终只能输出可被 JSON.parse 解析的 JSON。"
          />
        </label>
      </div>
    </Card>
  </Page>
</template>

<style scoped>
.ai-settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 16px;
}

.settings-form,
.prompt-grid {
  display: grid;
  gap: 14px;
}

.settings-form {
  max-width: 720px;
}

.settings-form label,
.prompt-grid label {
  display: grid;
  gap: 6px;
}

.settings-form label > span,
.prompt-grid label > span {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 1100px) {
  .ai-settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
