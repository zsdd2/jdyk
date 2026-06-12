<script lang="ts" setup>
import { About } from '@vben/common-ui';

import { getAdminReleaseVersion } from '#/app-version';

defineOptions({ name: 'About' });

const adminReleaseVersion = getAdminReleaseVersion();
</script>

<template>
  <About />
  <div class="mx-4 mt-4 rounded border border-border bg-card px-5 py-4 text-sm text-foreground">
    当前版本号：{{ adminReleaseVersion }}
  </div>
</template>
