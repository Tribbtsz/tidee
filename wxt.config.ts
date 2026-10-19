import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'tidee',
    short_name: 'tidee',
    description: '把 Edge 收藏夹理干净：自动分类、写一句描述、批量写回，不改动原有数据。',
    permissions: ['bookmarks', 'storage', 'favicon', 'alarms'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: {
      default_title: 'tidee',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
