import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:images',
      order: 10,
      title: '照片中心',
    },
    name: 'PhotoLibrary',
    path: '/photo-library',
    children: [
      {
        component: () => import('#/views/photo-library/photos/index.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:images',
          title: '照片列表',
        },
        name: 'PhotoLibraryPhotos',
        path: '/photo-library/photos',
      },
      {
        component: () => import('#/views/photo-library/playback-albums/index.vue'),
        meta: {
          icon: 'lucide:folder-heart',
          title: '播放相册',
        },
        name: 'PhotoLibraryPlaybackAlbums',
        path: '/photo-library/playback-albums',
      },
      {
        component: () => import('#/views/photo-library/ai-settings/index.vue'),
        meta: {
          icon: 'lucide:brain-circuit',
          title: 'AI 设置',
        },
        name: 'PhotoLibraryAiSettings',
        path: '/photo-library/ai-settings',
      },
      {
        component: () => import('#/views/photo-library/devices/index.vue'),
        meta: {
          icon: 'lucide:monitor-check',
          title: '设备中心',
        },
        name: 'PhotoLibraryDevices',
        path: '/photo-library/devices',
      },
      {
        component: () => import('#/views/photo-library/tv-release/index.vue'),
        meta: {
          icon: 'lucide:upload-cloud',
          title: 'TV 版本管理',
        },
        name: 'PhotoLibraryTvRelease',
        path: '/photo-library/tv-release',
      },
      {
        component: () => import('#/views/photo-library/scan/index.vue'),
        meta: {
          icon: 'lucide:folder-search',
          title: '照片扫描',
        },
        name: 'PhotoLibraryScan',
        path: '/photo-library/scan',
      },
      {
        component: () => import('#/views/photo-library/sources/index.vue'),
        meta: {
          icon: 'lucide:plug',
          title: '照片源配置',
        },
        name: 'PhotoLibrarySources',
        path: '/photo-library/sources',
      },
    ],
  },
];

export default routes;
