<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DevicePolicyResponse, PlaylistItem, PlaylistResponse } from '@wrjdyk/shared'

const apiBase = import.meta.env.VITE_API_BASE || '/api'

const items = ref<PlaylistItem[]>([])
const policy = ref<DevicePolicyResponse | null>(null)
const activeIndex = ref(0)
const paused = ref(false)
const loading = ref(true)
const errorMessage = ref('')
let timer: number | undefined

const activeItem = computed(() => items.value[activeIndex.value])
const nextItem = computed(() => items.value[(activeIndex.value + 1) % items.value.length])
const intervalMs = computed(
  () => activeItem.value?.durationMs ?? (policy.value?.intervalSeconds ?? 12) * 1000,
)

function mediaUrl(path?: string) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  if (apiBase.startsWith('http')) {
    return `${apiBase.replace(/\/api\/?$/, '')}${path}`
  }
  return path
}

function playbackImageUrl(item?: PlaylistItem) {
  return item?.displayImageUrl || item?.imageUrl || ''
}

function playbackDurationSeconds(item?: PlaylistItem) {
  if (item?.durationMs) return Math.round(item.durationMs / 1000)
  return policy.value?.intervalSeconds ?? 12
}

async function loadPlaybackData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [policyResponse, playlistResponse] = await Promise.all([
      fetch(`${apiBase}/device/current-policy`),
      fetch(`${apiBase}/device/playlist?limit=12`),
    ])

    if (!policyResponse.ok || !playlistResponse.ok) {
      throw new Error('playback-api-unavailable')
    }

    policy.value = (await policyResponse.json()) as DevicePolicyResponse
    const playlist = (await playlistResponse.json()) as PlaylistResponse
    items.value = playlist.items
    activeIndex.value = 0
    scheduleNext()
  } catch {
    errorMessage.value = '电视端暂时无法连接播放服务'
  } finally {
    loading.value = false
  }
}

function scheduleNext() {
  window.clearTimeout(timer)
  if (paused.value || items.value.length < 2) return
  timer = window.setTimeout(() => showNext(false), intervalMs.value)
}

function reportPlayback(item: PlaylistItem | undefined, skipped: boolean) {
  if (!item || !policy.value) return

  fetch(`${apiBase}/device/play-record`, {
    body: JSON.stringify({
      durationSeconds: playbackDurationSeconds(item),
      photoId: item.photoId,
      policyId: policy.value.policyId,
      skipped,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }).catch(() => undefined)
}

function showNext(skipped: boolean) {
  const current = activeItem.value
  if (!items.value.length) return
  activeIndex.value = (activeIndex.value + 1) % items.value.length
  reportPlayback(current, skipped)
  scheduleNext()
}

function showPrevious() {
  if (!items.value.length) return
  activeIndex.value = (activeIndex.value - 1 + items.value.length) % items.value.length
  scheduleNext()
}

function togglePause() {
  paused.value = !paused.value
  scheduleNext()
}

function handleRemoteKey(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') showNext(true)
  if (event.key === 'ArrowLeft') showPrevious()
  if (event.key === 'Enter' || event.key === ' ') togglePause()
}

onMounted(() => {
  window.addEventListener('keydown', handleRemoteKey)
  void loadPlaybackData()
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  window.removeEventListener('keydown', handleRemoteKey)
})
</script>

<template>
  <main class="player-shell">
    <section v-if="loading" class="state-layer">
      <div class="pulse-mark"></div>
      <p>正在连接播放服务</p>
    </section>

    <section v-else-if="errorMessage" class="state-layer">
      <p>{{ errorMessage }}</p>
    </section>

    <section v-else-if="activeItem" class="stage" :key="activeItem.photoId">
      <img class="backdrop" :src="mediaUrl(playbackImageUrl(activeItem))" alt="" />
      <img class="photo next-photo" :src="mediaUrl(playbackImageUrl(nextItem))" alt="" />
      <img class="photo current-photo" :src="mediaUrl(playbackImageUrl(activeItem))" :alt="activeItem.caption.title" />
      <div class="shade-layer"></div>

      <article class="caption-layer">
        <p class="album">{{ activeItem.albumName }}</p>
        <h1>{{ activeItem.caption.title }}</h1>
        <p class="caption">{{ activeItem.caption.text }}</p>
        <p class="meta">
          <span>{{ activeItem.takenAt }}</span>
          <span>{{ activeItem.location }}</span>
        </p>
      </article>

      <aside class="status-strip">
        <span>{{ paused ? 'PAUSED' : 'PLAYING' }}</span>
        <span>{{ activeIndex + 1 }} / {{ items.length }}</span>
      </aside>
    </section>
  </main>
</template>
