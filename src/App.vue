<script setup>
import ScheduleOverview from './components/ScheduleOverview.vue'
</script>

<template>
  <main>
    <ScheduleOverview ref="schedule" />
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
}
main {
  box-sizing: border-box;
  margin: 0;
  display: block;
  /* Remove vertical centering */
}
</style>
