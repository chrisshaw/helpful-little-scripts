<template>
  <header class="top-bar">
    <h1>Zwibbler + AI Tool Generator</h1>
    <div class="top-actions">
      <button @click="$emit('undo')" :disabled="!canUndo">Undo</button>
      <button @click="$emit('redo')" :disabled="!canRedo">Redo</button>
      <button @click="$emit('zoom-in')">Zoom +</button>
      <button @click="$emit('zoom-out')">Zoom &minus;</button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  canUndo: Boolean,
  canRedo: Boolean,
});

defineEmits(["undo", "redo", "zoom-in", "zoom-out"]);
</script>
