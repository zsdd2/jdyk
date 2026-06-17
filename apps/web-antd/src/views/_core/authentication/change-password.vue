<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore } from '@vben/stores';

import { Alert, Button, Card, Form, FormItem, InputPassword, message } from 'ant-design-vue';

import { changeAdminPasswordApi } from '#/api';

defineOptions({ name: 'InitialPasswordChange' });

const router = useRouter();
const accessStore = useAccessStore();
const saving = ref(false);
const formState = reactive({
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
});

async function handleFinish() {
  if (!accessStore.accessToken) {
    await router.replace(LOGIN_PATH);
    return;
  }
  saving.value = true;
  try {
    await changeAdminPasswordApi({
      currentPassword: formState.currentPassword,
      newPassword: formState.newPassword,
    });
    message.success('初始密码已修改，请使用新密码重新登录');
    resetAllStores();
    await router.replace(LOGIN_PATH);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="initial-password-page">
    <Card class="initial-password-panel" :bordered="false">
      <div class="initial-password-header">
        <h1>修改初始密码</h1>
        <p>首次使用默认账号登录后，需要设置新的管理密码。</p>
      </div>
      <Alert
        class="initial-password-alert"
        message="新密码不能继续使用 admin123，长度至少 8 位。"
        show-icon
        type="warning"
      />
      <Form :model="formState" layout="vertical" @finish="handleFinish">
        <FormItem
          label="当前密码"
          name="currentPassword"
          :rules="[{ required: true, message: '请输入当前密码' }]"
        >
          <InputPassword
            v-model:value="formState.currentPassword"
            autocomplete="current-password"
            placeholder="当前密码"
          />
        </FormItem>
        <FormItem
          label="新密码"
          name="newPassword"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '新密码至少 8 位' },
            {
              validator: async (_rule, value) => {
                if (value === 'admin123') throw new Error('不能继续使用初始密码');
              },
            },
          ]"
        >
          <InputPassword
            v-model:value="formState.newPassword"
            autocomplete="new-password"
            placeholder="新密码"
          />
        </FormItem>
        <FormItem
          label="确认新密码"
          name="confirmPassword"
          :rules="[
            { required: true, message: '请再次输入新密码' },
            {
              validator: async (_rule, value) => {
                if (value !== formState.newPassword) throw new Error('两次输入的密码不一致');
              },
            },
          ]"
        >
          <InputPassword
            v-model:value="formState.confirmPassword"
            autocomplete="new-password"
            placeholder="确认新密码"
          />
        </FormItem>
        <Button block :loading="saving" type="primary" html-type="submit">
          保存并重新登录
        </Button>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
.initial-password-page {
  display: flex;
  justify-content: center;
  width: 100%;
}

.initial-password-panel {
  width: min(420px, calc(100vw - 32px));
}

.initial-password-header {
  margin-bottom: 16px;
}

.initial-password-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.initial-password-header p {
  margin: 8px 0 0;
  color: hsl(var(--muted-foreground));
}

.initial-password-alert {
  margin-bottom: 20px;
}
</style>
