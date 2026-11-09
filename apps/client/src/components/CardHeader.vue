<script setup lang="ts">
/**
 * 卡片标题行（L1）：统一 .card-title > .title-with-icon(svg + span) + 右侧插槽。
 * 用法：<CardHeader icon="..."><template #title>标题</template><template #extra>右侧内容</template></CardHeader>
 */
defineProps<{ icon?: string }>()
</script>

<template>
  <div class="card-title">
    <span class="title-with-icon">
      <svg v-if="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path :d="icon" />
      </svg>
      <span class="title-text"><slot name="title" /></span>
    </span>
    <slot name="extra" />
  </div>
</template>

<style scoped>
.card-title {
  /* BoardUI：卡片标题走 headline 一档（16px / semibold），字体与字重成对定义 */
  font: var(--text-headline);
  letter-spacing: var(--tracking-normal);
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.title-with-icon svg {
  color: var(--accent-500);
  flex-shrink: 0;
}
.title-text {
  line-height: 1.2;
}
</style>
