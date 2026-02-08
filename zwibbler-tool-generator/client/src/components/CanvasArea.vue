<template>
  <div class="canvas-area">
    <div ref="canvasEl" class="zwibbler-canvas"></div>
  </div>
</template>

<script setup>
import { ref, defineExpose } from "vue";

const canvasEl = ref(null);

defineExpose({ canvasEl });
</script>
