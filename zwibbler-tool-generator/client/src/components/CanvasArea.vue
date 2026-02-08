<template>
  <div class="canvas-area">
    <div ref="canvasEl" class="zwibbler-canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const canvasEl = ref<HTMLDivElement | null>(null);

defineExpose({ canvasEl });
</script>
