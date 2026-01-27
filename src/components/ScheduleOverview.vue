<template>
  <section class="schedule-container">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <ElInput v-model="filter" placeholder="Filter by title or channel" style="width:300px" />
      <div style="display:flex;gap:12px;align-items:center;">
        <ElButton v-if="selectedJobs.length" style="margin-right:8px" type="danger">
          <ElPopconfirm title="Delete all selected recordings?" @confirm="deleteSelectedJobs">
            <template #reference>
              <span>Delete Selected ({{ selectedJobs.length }})</span>
            </template>
          </ElPopconfirm>
        </ElButton>
        <ElButton @click="toggleDarkMode" :type="isDark ? 'info' : 'default'">
          <span v-if="isDark">🌙 Dark</span>
          <span v-else>☀️ Light</span>
        </ElButton>
        <ElButton type="primary" @click="showManualDialog = true">Create Manual Recording</ElButton>
      </div>
    </div>
    <ElTable
      :data="filteredJobs"
      style="width:100%; min-width:800px;"
      border
      stripe
      @selection-change="onSelectionChange"
      ref="tableRef"
    >
      <ElTableColumn type="selection" width="55" />
      <ElTableColumn prop="Name" label="Title" sortable />
      <ElTableColumn prop="Channels" label="Channels" :formatter="formatChannels" />
      <ElTableColumn prop="Time" label="Start" :formatter="row => formatDate(row.Time)" sortable />
      <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" sortable />
      <ElTableColumn label="Actions">
        <template #default="scope">
          <ElPopconfirm title="Delete this recording?" @confirm="deleteJob(scope.row.ID)">
            <template #reference>
              <ElButton type="danger" size="small">Delete</ElButton>
            </template>
          </ElPopconfirm>
          <ElButton type="primary" size="small" style="margin-left:8px">Edit</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <div v-if="loading">Loading...</div>
    <div v-if="error" style="color:red">{{ error }}</div>
    <div v-if="!loading && !filteredJobs.length">No scheduled recordings.</div>
    <ElDialog v-model="showManualDialog" title="Create Manual Recording" width="600px" @close="resetManualForm">
      <ManualRecording :visible="showManualDialog" @recording-created="onManualSaved" />
    </ElDialog>
  </section>
</template>

<script setup>
import { ref, onMounted, defineExpose, computed } from 'vue'
import ManualRecording from './ManualRecording.vue'
import { ElTable, ElTableColumn, ElInput, ElButton, ElPopconfirm, ElMessage, ElDialog } from 'element-plus'

const jobs = ref([])
const channels = ref([])
const loading = ref(false)
const error = ref('')
const filter = ref('')
const showManualDialog = ref(false)
const isDark = ref(false)
const selectedJobs = ref([])

function formatDate(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

async function loadJobs() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/dvr/jobs')
    jobs.value = await res.json()
  } catch (e) {
    error.value = 'Failed to fetch jobs.'
  }
  loading.value = false
}

async function loadChannels() {
  try {
    const res = await fetch('/api/devices')
    const devices = await res.json()
    channels.value = devices.flatMap(dev => dev.Channels)
  } catch (e) {
    // fallback: empty
    channels.value = []
  }
}

async function deleteJob(id) {
  try {
    const res = await fetch(`/api/dvr/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    ElMessage.success('Deleted!')
    await loadJobs()
  } catch (e) {
    ElMessage.error('Delete failed')
  }
}

async function deleteSelectedJobs() {
  try {
    for (const job of selectedJobs.value) {
      const res = await fetch(`/api/dvr/jobs/${job.ID}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    }
    ElMessage.success('Deleted!')
    selectedJobs.value = []
    await loadJobs()
  } catch (e) {
    ElMessage.error('Delete failed')
  }
}

const filteredJobs = computed(() => {
  if (!filter.value) return jobs.value
  return jobs.value.filter(job =>
    job.Name.toLowerCase().includes(filter.value.toLowerCase()) ||
    job.Channels.join(',').includes(filter.value)
  )
})

onMounted(() => {
  // Load mode from localStorage if present
  isDark.value = localStorage.getItem('theme') === 'dark'
  applyTheme()
  loadChannels()
  loadJobs()
})

function toggleDarkMode() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme()
}

function applyTheme() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
    root.style.setProperty('--color-background', '#181818')
    root.style.setProperty('--color-background-mute', '#232323')
    root.style.setProperty('--color-background-soft', '#222')
    root.style.setProperty('--color-text', '#f3f3f3')
  } else {
    root.classList.remove('dark')
    root.style.setProperty('--color-background', '#fff')
    root.style.setProperty('--color-background-mute', '#f5f5f5')
    root.style.setProperty('--color-background-soft', '#f0f0f0')
    root.style.setProperty('--color-text', '#222')
  }
}

defineExpose({ loadJobs })

function onManualSaved() {
  showManualDialog.value = false
  loadJobs()
}
function resetManualForm() {
  showManualDialog.value = false;
}
function onSelectionChange(selected) {
  selectedJobs.value = selected
}

function formatChannels(row) {
  if (!row.Channels || !Array.isArray(row.Channels)) return ''
  // Map channel IDs to GuideName using fetched channels
  const names = row.Channels.map(id => {
    const ch = channels.value.find(c => c.ID == id || c.GuideNumber == id)
    return ch ? `${ch.GuideNumber} - ${ch.GuideName}` : id
  })
  return names.join(', ')
}
</script>

<style scoped>
:deep(.el-table),
:deep(.el-table__header),
:deep(.el-table__body),
:deep(.el-table__cell),
:deep(.el-table th),
:deep(.el-table td) {
  background: var(--color-background) !important;
  color: var(--color-text) !important;
}
:deep(.el-table__row:hover) {
  background: var(--color-background-soft) !important;
}
:deep(.el-table__header th) {
  font-weight: bold;
  background: var(--color-background-mute) !important;
}
:deep(.el-dialog) {
  background: var(--color-background, #222) !important;
  color: var(--color-text) !important;
  border-radius: 10px;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.12);
}
:deep(.el-dialog__title){
  color: var(--color-text) !important;
}
</style>
