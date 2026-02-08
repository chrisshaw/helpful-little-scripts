<template>
  <aside class="toolbar">
    <div class="tool-section">
      <h3>Drawing</h3>
      <button
        v-for="tool in drawingTools"
        :key="tool.name"
        :class="{ active: currentTool === tool.name }"
        @click="$emit('use-tool', tool.name)"
      >
        {{ tool.label }}
      </button>
    </div>

    <div class="tool-section">
      <h3>AI Tools</h3>
      <button class="btn-generate" @click="$emit('open-generator')">
        + Generate Tool
      </button>
      <button
        v-for="tool in generatedTools"
        :key="tool.componentName"
        class="generated-tool-btn"
        @click="$emit('place-tool', tool)"
      >
        {{ tool.label }}
      </button>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  currentTool: String,
  generatedTools: Array,
});

defineEmits(["use-tool", "open-generator", "place-tool"]);

const drawingTools = [
  { name: "pick", label: "Select" },
  { name: "brush", label: "Pen" },
  { name: "line", label: "Line" },
  { name: "rectangle", label: "Rectangle" },
  { name: "circle", label: "Circle" },
  { name: "text", label: "Text" },
];
</script>
